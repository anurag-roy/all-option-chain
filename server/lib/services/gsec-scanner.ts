import { getGsecSellerDepth, rankGsecs } from '@server/lib/calculators/gsecs';
import { logger } from '@server/lib/logger';
import { APPROVED_SECURITIES_PAGE, GsecSeedError } from '@server/lib/services/approved-gsecs';
import { getSeededGsecs } from '@server/lib/services/gsec-catalog';
import { getFullQuotes } from '@server/lib/services/kite';
import { marketDataService } from '@server/lib/services/market-data';
import { gsecKey } from '@shared/lib/gsec-key';
import type { GsecDepth, GsecExchange, GsecListing, GsecScan, GsecSellerLevel } from '@shared/types/gsecs';

type SellerQuote = { depth: { sell: GsecSellerLevel[] } };

export class GsecScanner {
  private securities = new Map<number, GsecListing>();
  private quotes: Record<string, SellerQuote> = {};
  private quoteTimes = new Map<string, string>();
  private tickVersions = new Map<string, number>();
  private snapshot: GsecScan | null = null;
  private approvedListFetchedAt = '';
  private quotesFetchedAt = '';
  private tradeDate = '';
  private settlementDate = '';
  private revision = 0;
  private pending: Promise<GsecScan> | null = null;
  private pendingFullRefresh = false;
  private publishTimer: ReturnType<typeof setTimeout> | null = null;
  private seedTimer: ReturnType<typeof setInterval> | null = null;
  private disposeTick: (() => void) | null = null;
  private disposeConnection: (() => void) | null = null;
  private updateHandler: ((snapshot: GsecScan) => void) | null = null;
  private stopped = false;

  onUpdate(handler: (snapshot: GsecScan) => void) {
    this.updateHandler = handler;
  }

  getCachedSnapshot() {
    return this.snapshot;
  }

  private start() {
    if (this.disposeTick) return;
    this.disposeTick = marketDataService.onTick((tick) => {
      if (tick.mode !== 'full') return;
      const security = this.securities.get(tick.instrument_token);
      if (!security) return;
      const key = gsecKey(security);
      this.quotes[key] = { depth: { sell: getGsecSellerDepth(tick.depth?.sell) } };
      this.tickVersions.set(key, (this.tickVersions.get(key) ?? 0) + 1);
      this.quotesFetchedAt = new Date().toISOString();
      this.quoteTimes.set(key, this.quotesFetchedAt);
      if (!this.publishTimer) {
        this.publishTimer = setTimeout(() => {
          this.publishTimer = null;
          this.publish();
        }, 250);
      }
    });
    this.disposeConnection = marketDataService.onConnectionChange((connected) => {
      if (!this.snapshot || this.snapshot.streamStatus === 'error') return;
      if (connected) {
        void this.refresh(true).catch((error) => logger.error('G-Sec reconnect refresh failed:', error));
      } else {
        this.publish('disconnected', 'Live updates disconnected. Showing the last received seller prices.');
      }
    });
    // The catalog is cached for the IST day; this only detects a new day's DB seed.
    this.seedTimer = setInterval(() => {
      void this.refresh().catch((error) => logger.error('G-Sec daily seed check failed:', error));
    }, 60_000);
  }

  async refresh(fullRefresh = false): Promise<GsecScan> {
    this.assertRunning();
    this.start();
    if (this.pending) {
      if (fullRefresh && !this.pendingFullRefresh) {
        await this.pending;
        return this.refresh(true);
      }
      return this.pending;
    }
    this.pendingFullRefresh = fullRefresh;
    this.pending = this.refreshData(fullRefresh)
      .catch((error) => {
        if (!this.stopped) this.fail(error);
        throw error;
      })
      .finally(() => {
        this.pending = null;
        this.pendingFullRefresh = false;
      });
    return this.pending;
  }

  private async refreshData(fullRefresh: boolean): Promise<GsecScan> {
    const approved = await getSeededGsecs();
    this.assertRunning();
    const next = new Map<number, GsecListing>();
    for (const { instrumentToken, ...security } of approved.securities) {
      next.set(instrumentToken, security);
    }

    if (!this.snapshot || fullRefresh || this.snapshot.streamStatus === 'error') await marketDataService.connect();
    this.assertRunning();
    marketDataService.setSubscriptions('gsecs', { full: [...next.keys()] });
    const addedKeys = [...next]
      .filter(([token, security]) => {
        const previous = this.securities.get(token);
        return !previous || gsecKey(previous) !== gsecKey(security);
      })
      .map(([, security]) => gsecKey(security));
    const allowedKeys = new Set([...next.values()].map(gsecKey));
    for (const key of Object.keys(this.quotes)) {
      if (!allowedKeys.has(key) || addedKeys.includes(key)) {
        delete this.quotes[key];
        this.quoteTimes.delete(key);
        this.tickVersions.delete(key);
      }
    }
    this.securities = next;
    this.approvedListFetchedAt = approved.fetchedAt;
    this.tradeDate = approved.tradeDate;
    this.settlementDate = approved.settlementDate;
    // Apply the daily seeded list before requesting quote snapshots.
    this.publish();

    const keys = fullRefresh ? [...allowedKeys] : addedKeys;
    if (keys.length) {
      const versions = new Map(keys.map((key) => [key, this.tickVersions.get(key) ?? 0]));
      const quotes = await getFullQuotes(keys);
      this.assertRunning();
      const now = new Date().toISOString();
      for (const key of keys) {
        // A tick received during the REST request is newer than its initial snapshot.
        if ((this.tickVersions.get(key) ?? 0) !== versions.get(key)) continue;
        const quote = quotes[key];
        if (quote) {
          this.quotes[key] = { depth: { sell: getGsecSellerDepth(quote.depth?.sell) } };
          this.quoteTimes.set(key, now);
        } else {
          delete this.quotes[key];
          this.quoteTimes.delete(key);
        }
      }
      this.quotesFetchedAt = now;
    }
    return this.publish();
  }

  private publish(status?: GsecScan['streamStatus'], message?: string): GsecScan {
    if (this.publishTimer) clearTimeout(this.publishTimer);
    this.publishTimer = null;
    const streamStatus = status ?? (marketDataService.isConnected() ? 'live' : 'disconnected');
    this.snapshot = {
      rows: rankGsecs([...this.securities.values()], this.quotes, this.settlementDate).map((row) => ({
        ...row,
        quoteUpdatedAt: this.quoteTimes.get(gsecKey(row)) ?? null,
      })),
      sourceUrl: APPROVED_SECURITIES_PAGE,
      approvedListFetchedAt: this.approvedListFetchedAt || new Date().toISOString(),
      quotesFetchedAt: this.quotesFetchedAt || new Date().toISOString(),
      revision: ++this.revision,
      tradeDate: this.tradeDate,
      settlementDate: this.settlementDate,
      streamStatus,
      message:
        message ??
        (streamStatus === 'disconnected'
          ? 'Live updates disconnected. Showing the last received seller prices.'
          : undefined),
    };
    this.updateHandler?.(this.snapshot);
    return this.snapshot;
  }

  private fail(error: unknown) {
    marketDataService.setSubscriptions('gsecs', { full: [] });
    this.securities.clear();
    this.quotes = {};
    this.quoteTimes.clear();
    this.tickVersions.clear();
    const tokenRejected =
      typeof error === 'object' && error !== null && 'error_type' in error && error.error_type === 'TokenException';
    const message = tokenRejected
      ? 'Kite login is invalid or expired. Run npm run login and restart the server.'
      : error instanceof GsecSeedError ||
          (error instanceof Error && error.message.startsWith('Kite ticker limit exceeded:'))
        ? error.message
        : 'Could not refresh G-Sec data. Check the Kite login and run npm run data:prepare, then restart the app.';
    this.publish('error', message);
  }

  async getDepth(tradingsymbol: string, exchange: GsecExchange = 'NSE'): Promise<GsecDepth | null> {
    const snapshot = await this.refresh();
    const row = snapshot.rows.find(
      (security) => security.exchange === exchange && security.tradingsymbol === tradingsymbol
    );
    if (!row) return null;
    if (row.quoteStatus === 'unavailable') throw new Error(`Seller quote unavailable for ${exchange}:${tradingsymbol}`);
    return {
      exchange,
      tradingsymbol,
      sell: row.sellerDepth,
      fetchedAt: row.quoteUpdatedAt ?? snapshot.quotesFetchedAt,
    };
  }

  shutdown() {
    this.stopped = true;
    if (this.seedTimer) clearInterval(this.seedTimer);
    if (this.publishTimer) clearTimeout(this.publishTimer);
    this.seedTimer = null;
    this.publishTimer = null;
    this.disposeTick?.();
    this.disposeConnection?.();
    this.disposeTick = null;
    this.disposeConnection = null;
    marketDataService.setSubscriptions('gsecs', { full: [] });
  }

  private assertRunning() {
    if (this.stopped) throw new Error('G-Sec scanner shut down');
  }
}

export const gsecScanner = new GsecScanner();
export const scanGsecs = (fullRefresh = false) => gsecScanner.refresh(fullRefresh);
export const getGsecDepth = (tradingsymbol: string, exchange: GsecExchange = 'NSE') =>
  gsecScanner.getDepth(tradingsymbol, exchange);
