import { calculateDelta } from '@server/lib/calculators/delta';
import { calculateReturnValue, calculateSellValue, calculateStrikePosition } from '@server/lib/calculators/returns';
import { calculateSd, calculateSigmaN, calculateSigmaX, calculateSigmaXi } from '@server/lib/calculators/sigma';
import { logger } from '@server/lib/logger';
import { accessToken } from '@server/lib/services/access-token';
import { ensureTodayNseBans, getBannedNames } from '@server/lib/services/bans-service';
import {
  getEquityByName,
  getFuturesForName,
  getOptionsForNameAndExpiry,
  type DbInstrument,
} from '@server/lib/services/instrument-catalog';
import { getFullQuotes } from '@server/lib/services/kite';
import { marginBook } from '@server/lib/services/margin-book';
import { marketDataService } from '@server/lib/services/market-data';
import { marketMinutesCache } from '@server/lib/services/market-minutes-cache';
import {
  instrumentQuoteKey,
  planInstrumentsForSymbol,
  type PlannedInstrument,
} from '@server/lib/services/subscription-planner';
import { NSE_STOCKS_TO_INCLUDE } from '@server/shared/config';
import type { ChainFilter } from '@server/shared/schemas/chain-filter';
import type { ChainEngineStatus, OptionChainData, OptionChainRow } from '@shared/types/types';
import type { TickFull } from 'kiteconnect-ts';

type ChainUpdateHandler = (data: OptionChainData, status: ChainEngineStatus) => void;

type InternalRow = OptionChainRow & {
  futExpiry: string;
};

type EquitySnapshot = {
  symbol: string;
  token: number;
  prevClose: number;
  ltp: number;
  gainLossPercent: number;
};

type SymbolInstruments = {
  options: DbInstrument[];
  futures: DbInstrument[];
};

const OI_RECHECK_MS = 60_000;

export class OptionChainCoordinator {
  private rows = new Map<number, InternalRow>();
  private equityLtps = new Map<string, number>();
  private equityByToken = new Map<number, EquitySnapshot>();
  private symbolInstruments = new Map<string, SymbolInstruments>();
  private candidates = new Map<number, PlannedInstrument>();
  // Once a candidate has OI, retain its subscription through zero-OI ticks.
  private watchedOptions = new Set<number>();
  private oiCheckedAt = 0;
  private filterVersion = 0;
  private selectionRefreshing = false;
  private filter: ChainFilter | null = null;
  private status: ChainEngineStatus['status'] = 'idle';
  private statusMessage?: string;
  private updateHandler: ChainUpdateHandler | null = null;
  private computeTimer: ReturnType<typeof setInterval> | null = null;
  private marginTimer: ReturnType<typeof setInterval> | null = null;
  private tickUnsubscribe: (() => void) | null = null;

  async init() {
    await marketMinutesCache.initializeRuntimeCache();
    await marketDataService.connect();

    this.tickUnsubscribe = marketDataService.onTick((tick) => {
      const fullTick = tick as TickFull;

      const equitySnapshot = this.equityByToken.get(fullTick.instrument_token);
      if (equitySnapshot) {
        const ltp = fullTick.last_price ?? equitySnapshot.ltp;
        if (ltp > 0) {
          equitySnapshot.ltp = ltp;
          equitySnapshot.gainLossPercent =
            equitySnapshot.prevClose > 0 ? ((ltp - equitySnapshot.prevClose) * 100) / equitySnapshot.prevClose : 0;
          this.equityLtps.set(equitySnapshot.symbol, ltp);
        }
        return;
      }

      if (tick.mode !== 'full') {
        return;
      }

      const instrument = this.candidates.get(fullTick.instrument_token);
      if (!instrument) {
        return;
      }

      const previous = this.rows.get(fullTick.instrument_token);
      const oi = fullTick.oi ?? previous?.oi ?? 0;
      if (oi <= 0) {
        this.rows.delete(fullTick.instrument_token);
        return;
      }

      // An empty book clears the bid; retaining it would keep a row above entry value.
      const bid = fullTick.depth ? (fullTick.depth.buy[0]?.price ?? 0) : (previous?.bid ?? 0);
      const row = previous ?? this.createRow(instrument, bid, oi);
      row.bid = bid;
      row.oi = oi;
      row.sellValue = calculateSellValue(bid, row.lotSize);
      this.rows.set(row.instrumentToken, row);
    });

    this.computeTimer = setInterval(() => {
      this.recomputeRows();
      this.publish();
      void this.refreshSelection().catch((error) => logger.error('Failed to refresh option selection:', error));
    }, 500);

    this.marginTimer = setInterval(() => {
      void this.refreshMargins();
    }, 5000);
  }

  onUpdate(handler: ChainUpdateHandler) {
    this.updateHandler = handler;
  }

  getStatus(): ChainEngineStatus {
    return {
      status: this.status,
      message: this.statusMessage,
      filter: this.filter
        ? {
            expiry: this.filter.expiry,
            sdMultiplier: this.filter.sdMultiplier,
            entryValue: this.filter.entryValue,
          }
        : null,
      subscribedTokenCount: marketDataService.getSubscribedTokens('option-chain').size,
      rowCount: this.rows.size,
      visibleRowCount: this.getVisibleRowCount(),
      hasAccessToken: Boolean(accessToken),
    };
  }

  async applyFilter(filter: ChainFilter) {
    const version = ++this.filterVersion;
    this.filter = filter;
    this.setStatus('warming', 'Applying filter');

    await ensureTodayNseBans();
    const bannedNames = await getBannedNames();
    const baseSymbols = filter.symbols?.length ? filter.symbols : [...NSE_STOCKS_TO_INCLUDE];
    const symbols = baseSymbols.filter((symbol) => {
      if (bannedNames.has(symbol)) {
        logger.debug(`Skipping banned symbol: ${symbol}`);
        return false;
      }
      return true;
    });
    if (version !== this.filterVersion) return;
    const symbolInstruments = new Map<string, SymbolInstruments>();

    this.setStatus('fetching_quotes', 'Fetching underlying quotes');

    const equityKeys: string[] = [];
    const equityRecords: Array<{ symbol: string; token: number; key: string }> = [];
    for (const symbol of symbols) {
      const equity = await getEquityByName(symbol);
      if (equity) {
        const key = instrumentQuoteKey(equity);
        equityKeys.push(key);
        equityRecords.push({ symbol, token: equity.instrumentToken, key });
      }
    }

    const equityQuotes = await getFullQuotes(equityKeys);
    if (version !== this.filterVersion) return;
    const equityByToken = new Map<number, EquitySnapshot>();
    const equityLtps = new Map<string, number>();

    for (const { symbol, token, key } of equityRecords) {
      const quote = equityQuotes[key];
      const ltp = quote?.last_price ?? 0;
      const prevClose = quote?.ohlc?.close ?? ltp;
      if (ltp <= 0) {
        continue;
      }

      const gainLossPercent = prevClose > 0 ? ((ltp - prevClose) * 100) / prevClose : 0;
      equityLtps.set(symbol, ltp);
      equityByToken.set(token, {
        symbol,
        token,
        prevClose,
        ltp,
        gainLossPercent,
      });
    }

    for (const symbol of symbols) {
      const ltp = equityLtps.get(symbol) ?? 0;
      if (ltp <= 0) {
        continue;
      }

      const [options, futures] = await Promise.all([
        getOptionsForNameAndExpiry(symbol, filter.expiry),
        getFuturesForName(symbol),
      ]);

      symbolInstruments.set(symbol, { options, futures });
    }

    if (version !== this.filterVersion) return;
    const planned = this.planSelection(filter, symbolInstruments, equityLtps);
    this.setStatus('fetching_quotes', 'Fetching option quotes and filtering OI');

    const quoteKeys = planned.map((instrument) => instrumentQuoteKey(instrument));
    const fullQuotes = await getFullQuotes(quoteKeys);
    if (version !== this.filterVersion) return;

    const withOi = planned.filter((instrument) => {
      const quote = fullQuotes[instrumentQuoteKey(instrument)];
      return quote && (quote.oi ?? 0) > 0;
    });

    const optionTokens = new Set(withOi.map((instrument) => instrument.instrumentToken));
    const equityTokens = new Set(equityByToken.keys());
    this.setStatus('subscribing', `Subscribing to ${optionTokens.size} options and ${equityTokens.size} equities`);
    try {
      marketDataService.setSubscriptions('option-chain', { full: [...optionTokens], ltp: [...equityTokens] });
    } catch (error) {
      if (error instanceof Error) this.setStatus('error', error.message);
      throw error;
    }

    this.symbolInstruments = symbolInstruments;
    this.equityByToken = equityByToken;
    this.equityLtps = equityLtps;
    this.candidates = new Map(planned.map((instrument) => [instrument.instrumentToken, instrument]));
    this.watchedOptions = optionTokens;
    this.oiCheckedAt = Date.now();
    this.rows.clear();
    for (const instrument of withOi) {
      const quote = fullQuotes[instrumentQuoteKey(instrument)]!;
      const bid = quote.depth?.buy?.[0]?.price ?? 0;
      const row = this.createRow(instrument, bid, quote.oi ?? 0);
      this.rows.set(row.instrumentToken, row);
    }

    marginBook.markPending(withOi.map((instrument) => instrument.tradingsymbol));
    await this.refreshMargins();
    if (version !== this.filterVersion) return;
    this.recomputeRows();

    this.setStatus('ready');
  }

  private planSelection(
    filter: ChainFilter,
    catalog = this.symbolInstruments,
    ltps = this.equityLtps
  ): PlannedInstrument[] {
    return [...catalog].flatMap(([symbol, { options, futures }]) => {
      const ltp = ltps.get(symbol) ?? 0;
      return ltp > 0 ? planInstrumentsForSymbol(symbol, filter.expiry, filter.sdMultiplier, options, futures, ltp) : [];
    });
  }

  private async refreshSelection() {
    if (this.status !== 'ready' || !this.filter || this.selectionRefreshing) return;
    this.selectionRefreshing = true;
    const version = this.filterVersion;
    try {
      const planned = this.planSelection(this.filter);
      // Poll initially zero-OI candidates sparingly, without spending ticker slots on them.
      const recheckOi = Date.now() - this.oiCheckedAt >= OI_RECHECK_MS;
      const additions = planned.filter(
        (instrument) =>
          !this.candidates.has(instrument.instrumentToken) ||
          (recheckOi && !this.watchedOptions.has(instrument.instrumentToken))
      );
      const quotes = additions.length ? await getFullQuotes(additions.map(instrumentQuoteKey)) : {};
      if (version !== this.filterVersion || this.status !== 'ready') return;
      if (recheckOi) this.oiCheckedAt = Date.now();

      // Prices (or the filter) may have moved while the REST request was in flight.
      const latest = this.planSelection(this.filter);
      const candidates = new Map(
        latest
          .filter(
            (instrument) => this.candidates.has(instrument.instrumentToken) || quotes[instrumentQuoteKey(instrument)]
          )
          .map((instrument) => [instrument.instrumentToken, instrument])
      );
      const watchedOptions = new Set(
        [...candidates.values()]
          .filter(
            (instrument) =>
              this.watchedOptions.has(instrument.instrumentToken) ||
              (quotes[instrumentQuoteKey(instrument)]?.oi ?? 0) > 0
          )
          .map((instrument) => instrument.instrumentToken)
      );
      const changed =
        candidates.size !== this.candidates.size ||
        [...candidates.keys()].some((token) => !this.candidates.has(token)) ||
        watchedOptions.size !== this.watchedOptions.size ||
        [...watchedOptions].some((token) => !this.watchedOptions.has(token));
      if (!changed) return;

      marketDataService.setSubscriptions('option-chain', {
        full: [...watchedOptions],
        ltp: [...this.equityByToken.keys()],
      });
      for (const token of this.rows.keys()) {
        if (!candidates.has(token)) this.rows.delete(token);
      }
      for (const [token, instrument] of candidates) {
        if (this.watchedOptions.has(token)) continue;
        const quote = quotes[instrumentQuoteKey(instrument)];
        if (quote && (quote.oi ?? 0) > 0) {
          this.rows.set(token, this.createRow(instrument, quote.depth?.buy[0]?.price ?? 0, quote.oi!));
        }
      }
      this.candidates = candidates;
      this.watchedOptions = watchedOptions;
      marginBook.markPending([...this.rows.values()].map((row) => row.tradingsymbol));
      this.recomputeRows();
      this.publish();
    } finally {
      this.selectionRefreshing = false;
    }
  }

  async updateSdMultiplier(value: number) {
    if (!this.filter) {
      return false;
    }

    await this.applyFilter({ ...this.filter, sdMultiplier: value });
    return true;
  }

  getSnapshot(): OptionChainData {
    const snapshot: OptionChainData = {};

    for (const row of this.rows.values()) {
      const { futExpiry: _futExpiry, ...publicRow } = row;
      snapshot[row.instrumentToken] = publicRow;
    }

    return snapshot;
  }

  getVisibleRowCount(): number {
    const entryValue = this.filter?.entryValue ?? 0;
    return [...this.rows.values()].filter((row) => row.sellValue >= entryValue).length;
  }

  private createRow(instrument: PlannedInstrument, bid: number, oi: number): InternalRow {
    return {
      instrumentToken: instrument.instrumentToken,
      tradingsymbol: instrument.tradingsymbol,
      name: instrument.name,
      expiry: instrument.expiry!,
      strike: instrument.strike!,
      instrumentType: instrument.instrumentType as 'CE' | 'PE',
      lotSize: instrument.lotSize!,
      tickSize: instrument.tickSize!,
      av: instrument.av ?? 0,
      dv: instrument.dv ?? 0,
      underlyingLtp: instrument.underlyingLtp,
      futExpiry: instrument.futExpiry,
      bid,
      sellValue: calculateSellValue(bid, instrument.lotSize!),
      strikePosition: calculateStrikePosition(instrument.strike!, instrument.underlyingLtp),
      orderMargin: 0,
      returnValue: 0,
      sd: 0,
      sigmaN: 0,
      sigmaX: 0,
      sigmaXI: 0,
      delta: 0,
      oi,
      marginStatus: 'loading',
    };
  }

  private recomputeRows() {
    if (this.rows.size === 0) {
      return;
    }

    const marketMinutesInLastYear = marketMinutesCache.getMarketMinutesInLastYear();

    for (const row of this.rows.values()) {
      const equityLtp = this.equityLtps.get(row.name) ?? row.underlyingLtp;
      const equitySnapshot = [...this.equityByToken.values()].find((snapshot) => snapshot.symbol === row.name);
      row.underlyingLtp = equityLtp;
      row.gainLossPercent = equitySnapshot?.gainLossPercent;

      const prevStrikePosition = row.strikePosition;
      row.strikePosition = calculateStrikePosition(row.strike, equityLtp);
      row.strikePositionChange = prevStrikePosition > 0 ? row.strikePosition - prevStrikePosition : 0;
      row.sellValue = calculateSellValue(row.bid, row.lotSize);

      if (row.av > 0) {
        const marketMinutesTillExpiry = marketMinutesCache.getMarketMinutesTillExpiry(row.expiry);
        const sigma = calculateSd(row.av, marketMinutesInLastYear, marketMinutesTillExpiry);
        // SD multiplier applies only to strike-selection bounds, not per-row sigma display.
        const sigmaN = calculateSigmaN(sigma, 1);
        const sigmaX = calculateSigmaX(sigmaN, marketMinutesInLastYear, marketMinutesTillExpiry);
        const sigmaXI = calculateSigmaXi(sigmaN, sigmaX, row.instrumentType);

        row.sd = sigma;
        row.sigmaN = sigmaN;
        row.sigmaX = sigmaX;
        row.sigmaXI = sigmaXI;

        const timeToExpiry = marketMinutesTillExpiry / marketMinutesInLastYear;
        row.delta = calculateDelta(equityLtp, row.strike, row.av, timeToExpiry, row.instrumentType);
      }

      const marginEntry = marginBook.getMargin(row.tradingsymbol);
      if (marginEntry?.status === 'ready' && marginEntry.price === row.bid && marginEntry.quantity === row.lotSize) {
        row.orderMargin = marginEntry.margin;
        row.marginStatus = 'ready';
        row.returnValue = calculateReturnValue(row.sellValue, marginEntry.margin);
      } else if (marginEntry?.status === 'error') {
        row.marginStatus = 'error';
      } else {
        row.marginStatus = 'loading';
      }
    }
  }

  private async refreshMargins() {
    const orders = [...this.rows.values()].map((row) => ({
      tradingsymbol: row.tradingsymbol,
      quantity: row.lotSize,
      price: row.bid,
    }));
    await marginBook.refresh(orders);
    this.recomputeRows();
    this.publish();
  }

  private setStatus(status: ChainEngineStatus['status'], message?: string) {
    this.status = status;
    this.statusMessage = message;
    this.publish();
  }

  private publish() {
    this.updateHandler?.(this.getSnapshot(), this.getStatus());
  }

  async shutdown() {
    ++this.filterVersion;
    this.status = 'idle';
    if (this.computeTimer) {
      clearInterval(this.computeTimer);
    }
    if (this.marginTimer) {
      clearInterval(this.marginTimer);
    }
    this.tickUnsubscribe?.();
    marketDataService.disconnect();
  }
}

export const optionChainCoordinator = new OptionChainCoordinator();
