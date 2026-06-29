import { calculateDelta } from '@server/lib/calculators/delta';
import {
  calculateReturnValue,
  calculateSellValue,
  calculateStrikePosition,
  shouldTriggerOrder,
} from '@server/lib/calculators/returns';
import { calculateSd, calculateSigmaN, calculateSigmaX, calculateSigmaXi } from '@server/lib/calculators/sigma';
import { logger } from '@server/lib/logger';
import { accessToken } from '@server/lib/services/access-token';
import { ensureTodayNseBans, getBannedNames } from '@server/lib/services/bans-service';
import {
  getEquityByName,
  getFuturesForName,
  getOptionsForNameAndExpiry,
} from '@server/lib/services/instrument-catalog';
import { getFullQuotes } from '@server/lib/services/kite';
import { marginBook } from '@server/lib/services/margin-book';
import { marketDataService } from '@server/lib/services/market-data';
import {
  instrumentQuoteKey,
  planInstrumentsForSymbol,
  type PlannedInstrument,
} from '@server/lib/services/subscription-planner';
import { workingDaysCache } from '@server/lib/services/working-days-cache';
import { NSE_STOCKS_TO_INCLUDE } from '@server/shared/config';
import type { ChainFilter } from '@server/shared/schemas/chain-filter';
import type { ChainEngineStatus, OptionChainData, OptionChainRow } from '@shared/types/types';
import type { TickFull } from 'kiteconnect-ts';

type ChainUpdateHandler = (data: OptionChainData, status: ChainEngineStatus) => void;
type NotificationHandler = (message: string, severity: 'info' | 'important') => void;

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

export class OptionChainCoordinator {
  private rows = new Map<number, InternalRow>();
  private equityLtps = new Map<string, number>();
  private equityByToken = new Map<number, EquitySnapshot>();
  private filter: ChainFilter | null = null;
  private status: ChainEngineStatus['status'] = 'idle';
  private statusMessage?: string;
  private updateHandler: ChainUpdateHandler | null = null;
  private notificationHandler: NotificationHandler | null = null;
  private computeTimer: ReturnType<typeof setInterval> | null = null;
  private marginTimer: ReturnType<typeof setInterval> | null = null;
  private tickUnsubscribe: (() => void) | null = null;
  private triggeredOrderTokens = new Set<number>();
  private baselineTokens = new Set<number>();
  private loadingAtPrime = new Set<number>();
  private alertsPrimed = false;
  private topBidToken: number | null = null;
  private topBidValue: number | null = null;

  async init() {
    await workingDaysCache.initializeRuntimeCache();
    await marketDataService.connect();

    this.tickUnsubscribe = marketDataService.onTick((tick) => {
      const fullTick = tick as TickFull;

      const equitySnapshot = this.equityByToken.get(fullTick.instrument_token);
      if (equitySnapshot) {
        const ltp = fullTick.last_price ?? equitySnapshot.ltp;
        if (ltp > 0 && equitySnapshot.prevClose > 0) {
          equitySnapshot.ltp = ltp;
          equitySnapshot.gainLossPercent = ((ltp - equitySnapshot.prevClose) * 100) / equitySnapshot.prevClose;
          this.equityLtps.set(equitySnapshot.symbol, ltp);
        }
        return;
      }

      if (tick.mode !== 'full') {
        return;
      }

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

  onNotification(handler: NotificationHandler) {
    this.notificationHandler = handler;
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
    this.resetAlertState();
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
    const planned: PlannedInstrument[] = [];

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
    this.equityByToken.clear();

    for (const { symbol, token, key } of equityRecords) {
      const quote = equityQuotes[key];
      const ltp = quote?.last_price ?? 0;
      const prevClose = quote?.ohlc?.close ?? ltp;
      if (ltp <= 0) {
        continue;
      }

      const gainLossPercent = prevClose > 0 ? ((ltp - prevClose) * 100) / prevClose : 0;
      this.equityLtps.set(symbol, ltp);
      this.equityByToken.set(token, {
        symbol,
        token,
        prevClose,
        ltp,
        gainLossPercent,
      });
    }

    for (const symbol of symbols) {
      const equity = await getEquityByName(symbol);
      if (!equity) {
        continue;
      }

      const ltp = this.equityLtps.get(symbol) ?? 0;
      if (ltp <= 0) {
        continue;
      }

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

    const optionTokens = new Set(withOi.map((instrument) => instrument.instrumentToken));
    const equityTokens = new Set([...this.equityByToken.keys()]);
    const newTokens = new Set([...optionTokens, ...equityTokens]);
    const oldTokens = marketDataService.getSubscribedTokens();
    const added = [...newTokens].filter((token) => !oldTokens.has(token));
    const removed = [...oldTokens].filter((token) => !newTokens.has(token));

    this.setStatus('subscribing', `Subscribing to ${optionTokens.size} options and ${equityTokens.size} equities`);
    marketDataService.applyDiff(added, removed);

    if (equityTokens.size > 0) {
      marketDataService.subscribeLtp([...equityTokens]);
    }

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
    this.detectAlerts();
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
      const equitySnapshot = [...this.equityByToken.values()].find((snapshot) => snapshot.symbol === row.name);
      row.underlyingLtp = equityLtp;
      row.gainLossPercent = equitySnapshot?.gainLossPercent;

      const prevStrikePosition = row.strikePosition;
      row.strikePosition = calculateStrikePosition(row.strike, equityLtp);
      row.strikePositionChange = prevStrikePosition > 0 ? row.strikePosition - prevStrikePosition : 0;
      row.sellValue = calculateSellValue(row.bid, row.lotSize);

      if (row.av > 0) {
        const workingDaysTillExpiry = await workingDaysCache.getWorkingDaysTillExpiry(row.expiry);
        const sigma = calculateSd(row.av, workingDaysInLastYear, workingDaysTillExpiry);
        // SD multiplier applies only to strike-selection bounds, not per-row sigma display.
        const sigmaN = calculateSigmaN(sigma, 1);
        const sigmaX = calculateSigmaX(sigmaN, workingDaysInLastYear, workingDaysTillExpiry);
        const sigmaXI = calculateSigmaXi(sigmaN, sigmaX, row.instrumentType);

        row.sd = sigma;
        row.sigmaN = sigmaN;
        row.sigmaX = sigmaX;
        row.sigmaXI = sigmaXI;

        const timeToExpiry = workingDaysTillExpiry / workingDaysInLastYear;
        row.delta = calculateDelta(equityLtp, row.strike, row.av, timeToExpiry, row.instrumentType);
      }

      const marginEntry = marginBook.getMargin(row.tradingsymbol);
      if (
        marginEntry?.status === 'ready' &&
        marginEntry.price === row.bid &&
        marginEntry.quantity === row.lotSize
      ) {
        row.orderMargin = marginEntry.margin;
        row.marginStatus = 'ready';
        row.returnValue = calculateReturnValue(row.sellValue, marginEntry.margin);
      } else if (marginEntry?.status === 'error') {
        row.marginStatus = 'error';
      } else {
        row.marginStatus = 'loading';
      }
    }

    if (this.status === 'ready') {
      this.detectAlerts();
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

  private resetAlertState() {
    this.triggeredOrderTokens.clear();
    this.baselineTokens.clear();
    this.loadingAtPrime.clear();
    this.alertsPrimed = false;
    this.topBidToken = null;
    this.topBidValue = null;
  }

  private getTopReturnRow(): InternalRow | null {
    let topRow: InternalRow | null = null;
    for (const row of this.rows.values()) {
      if (row.marginStatus !== 'ready') {
        continue;
      }
      if (!topRow || row.returnValue > topRow.returnValue) {
        topRow = row;
      }
    }
    return topRow;
  }

  private formatOrderTriggerMessage(rows: InternalRow[]): string {
    if (rows.length === 1) {
      const row = rows[0]!;
      return `Order triggered for ${row.tradingsymbol} — return ${row.returnValue.toFixed(2)}, bid ${row.bid}, qty ${row.lotSize}`;
    }

    const preview = rows
      .slice(0, 3)
      .map((row) => row.tradingsymbol)
      .join(', ');
    const remaining = rows.length - 3;
    const suffix = remaining > 0 ? ` (+${remaining} more)` : '';
    return `${rows.length} new order triggers: ${preview}${suffix}`;
  }

  private detectAlerts() {
    if (!this.filter || this.rows.size === 0) {
      return;
    }

    const orderPercent = this.filter.orderPercent;

    if (!this.alertsPrimed) {
      for (const row of this.rows.values()) {
        this.baselineTokens.add(row.instrumentToken);
        if (row.marginStatus === 'loading') {
          this.loadingAtPrime.add(row.instrumentToken);
        }
        if (shouldTriggerOrder(row.returnValue, orderPercent, row.marginStatus)) {
          this.triggeredOrderTokens.add(row.instrumentToken);
        }
      }

      const topRow = this.getTopReturnRow();
      if (topRow) {
        this.topBidToken = topRow.instrumentToken;
        this.topBidValue = topRow.bid;
      }

      this.alertsPrimed = true;
      return;
    }

    const newlyTriggered: InternalRow[] = [];

    for (const row of this.rows.values()) {
      if (this.triggeredOrderTokens.has(row.instrumentToken)) {
        continue;
      }
      if (!shouldTriggerOrder(row.returnValue, orderPercent, row.marginStatus)) {
        continue;
      }

      this.triggeredOrderTokens.add(row.instrumentToken);
      if (!this.loadingAtPrime.has(row.instrumentToken)) {
        newlyTriggered.push(row);
      }
    }

    if (newlyTriggered.length > 0) {
      this.notificationHandler?.(this.formatOrderTriggerMessage(newlyTriggered), 'important');
    }

    const topRow = this.getTopReturnRow();
    if (topRow && this.topBidToken === topRow.instrumentToken && this.topBidValue !== null) {
      if (topRow.bid !== this.topBidValue) {
        this.notificationHandler?.(
          `Top bid changed for ${topRow.tradingsymbol}: ${this.topBidValue.toFixed(2)} → ${topRow.bid.toFixed(2)}`,
          'important'
        );
      }
    }

    if (topRow) {
      this.topBidToken = topRow.instrumentToken;
      this.topBidValue = topRow.bid;
    }
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
