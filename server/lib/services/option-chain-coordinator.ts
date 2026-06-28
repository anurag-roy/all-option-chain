import { calculateDelta } from '@server/lib/calculators/delta';
import {
  calculateReturnValue,
  calculateSellValue,
  calculateStrikePosition,
} from '@server/lib/calculators/returns';
import {
  calculateSd,
  calculateSigmaN,
  calculateSigmaXi,
  calculateSigmaX,
} from '@server/lib/calculators/sigma';
import {
  getEquityByName,
  getFuturesForName,
  getOptionsForNameAndExpiry,
} from '@server/lib/services/instrument-catalog';
import { getFullQuotes, getLtpQuotes } from '@server/lib/services/kite';
import { marginBook } from '@server/lib/services/margin-book';
import { marketDataService } from '@server/lib/services/market-data';
import {
  instrumentQuoteKey,
  planInstrumentsForSymbol,
  type PlannedInstrument,
} from '@server/lib/services/subscription-planner';
import { workingDaysCache } from '@server/lib/services/working-days-cache';
import { NSE_STOCKS_TO_INCLUDE } from '@server/shared/config';
import { accessToken } from '@server/lib/services/access-token';
import type { ChainFilter } from '@server/shared/schemas/chain-filter';
import type { ChainEngineStatus, OptionChainData, OptionChainRow } from '@shared/types/types';
import type { TickFull } from 'kiteconnect-ts';

type ChainUpdateHandler = (data: OptionChainData, status: ChainEngineStatus) => void;

type InternalRow = OptionChainRow & {
  futExpiry: string;
};

export class OptionChainCoordinator {
  private rows = new Map<number, InternalRow>();
  private equityLtps = new Map<string, number>();
  private filter: ChainFilter | null = null;
  private status: ChainEngineStatus['status'] = 'idle';
  private statusMessage?: string;
  private updateHandler: ChainUpdateHandler | null = null;
  private computeTimer: ReturnType<typeof setInterval> | null = null;
  private marginTimer: ReturnType<typeof setInterval> | null = null;
  private tickUnsubscribe: (() => void) | null = null;

  async init() {
    await workingDaysCache.initializeRuntimeCache();
    await marketDataService.connect();

    this.tickUnsubscribe = marketDataService.onTick((tick) => {
      if (tick.mode !== 'full') {
        return;
      }

      const fullTick = tick as TickFull;
      const row = this.rows.get(fullTick.instrument_token);
      if (!row) {
        return;
      }

      const bid = fullTick.depth?.buy?.[0]?.price ?? row.bid;
      row.bid = bid;
      row.oi = fullTick.oi ?? row.oi;
      row.sellValue = calculateSellValue(bid, row.lotSize);
    });

    this.computeTimer = setInterval(() => {
      this.recomputeRows();
      this.publish();
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
            orderPercent: this.filter.orderPercent,
          }
        : null,
      subscribedTokenCount: marketDataService.getSubscribedTokens().size,
      rowCount: this.rows.size,
      visibleRowCount: this.getVisibleRowCount(),
      hasAccessToken: Boolean(accessToken),
    };
  }

  async applyFilter(filter: ChainFilter) {
    this.filter = filter;
    this.setStatus('warming', 'Applying filter');

    const symbols = filter.symbols?.length ? filter.symbols : [...NSE_STOCKS_TO_INCLUDE];
    const planned: PlannedInstrument[] = [];

    this.setStatus('fetching_quotes', 'Fetching underlying quotes');

    const equityKeys: string[] = [];
    for (const symbol of symbols) {
      const equity = await getEquityByName(symbol);
      if (equity) {
        equityKeys.push(instrumentQuoteKey(equity));
      }
    }

    const equityQuotes = await getLtpQuotes(equityKeys);
    for (const symbol of symbols) {
      const equity = await getEquityByName(symbol);
      if (!equity) {
        continue;
      }

      const quote = equityQuotes[instrumentQuoteKey(equity)];
      const ltp = quote?.last_price ?? 0;
      if (ltp <= 0) {
        continue;
      }

      this.equityLtps.set(symbol, ltp);

      const [options, futures] = await Promise.all([
        getOptionsForNameAndExpiry(symbol, filter.expiry),
        getFuturesForName(symbol),
      ]);

      const symbolPlanned = await planInstrumentsForSymbol(
        symbol,
        filter.expiry,
        filter.sdMultiplier,
        options,
        futures,
        ltp
      );
      planned.push(...symbolPlanned);
    }

    this.setStatus('fetching_quotes', 'Fetching option quotes and filtering OI');

    const quoteKeys = planned.map((instrument) => instrumentQuoteKey(instrument));
    const fullQuotes = await getFullQuotes(quoteKeys);

    const withOi = planned.filter((instrument) => {
      const quote = fullQuotes[instrumentQuoteKey(instrument)];
      return quote && (quote.oi ?? 0) > 0;
    });

    const newTokens = new Set(withOi.map((instrument) => instrument.instrumentToken));
    const oldTokens = marketDataService.getSubscribedTokens();
    const added = [...newTokens].filter((token) => !oldTokens.has(token));
    const removed = [...oldTokens].filter((token) => !newTokens.has(token));

    this.setStatus('subscribing', `Subscribing to ${newTokens.size} instruments`);
    marketDataService.applyDiff(added, removed);

    this.rows.clear();
    for (const instrument of withOi) {
      const quote = fullQuotes[instrumentQuoteKey(instrument)]!;
      const bid = quote.depth?.buy?.[0]?.price ?? 0;
      const row = this.createRow(instrument, bid, quote.oi ?? 0);
      this.rows.set(row.instrumentToken, row);
    }

    marginBook.markPending(withOi.map((instrument) => instrument.tradingsymbol));
    await this.refreshMargins();
    this.recomputeRows();

    this.setStatus('ready');
    this.publish();
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

  private async recomputeRows() {
    if (this.rows.size === 0) {
      return;
    }

    const workingDaysInLastYear = await workingDaysCache.getWorkingDaysInLastYear();

    for (const row of this.rows.values()) {
      const equityLtp = this.equityLtps.get(row.name) ?? row.underlyingLtp;
      row.underlyingLtp = equityLtp;
      row.strikePosition = calculateStrikePosition(row.strike, equityLtp);
      row.sellValue = calculateSellValue(row.bid, row.lotSize);

      if (row.av > 0) {
        const workingDaysTillExpiry = await workingDaysCache.getWorkingDaysTillExpiry(row.expiry);
        const sigma = calculateSd(row.av, workingDaysInLastYear, workingDaysTillExpiry);
        const sigmaN = calculateSigmaN(sigma, this.filter?.sdMultiplier ?? 1);
        const sigmaX = calculateSigmaX(sigmaN, workingDaysInLastYear, workingDaysTillExpiry);
        const sigmaXI = calculateSigmaXi(sigmaN, sigmaX, row.instrumentType);

        row.sd = sigma;
        row.sigmaN = sigmaN;
        row.sigmaX = sigmaX;
        row.sigmaXI = sigmaXI;

        const timeToExpiry = workingDaysTillExpiry / workingDaysInLastYear;
        row.delta = calculateDelta(equityLtp, row.strike, row.av / 100, timeToExpiry, row.instrumentType);
      }

      const marginEntry = marginBook.getMargin(row.tradingsymbol);
      if (marginEntry?.status === 'ready') {
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
    const tradingsymbols = [...this.rows.values()].map((row) => row.tradingsymbol);
    await marginBook.refresh(tradingsymbols);
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
