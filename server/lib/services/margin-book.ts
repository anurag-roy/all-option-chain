import { logger } from '@server/lib/logger';
import { getOrderMargins } from '@server/lib/services/kite';

type MarginEntry = {
  margin: number;
  status: 'ready' | 'error' | 'unavailable';
  updatedAt: number;
};

const STALE_MS = 60_000;

export class MarginBook {
  private margins = new Map<string, MarginEntry>();
  private isFetching = false;
  private pendingSymbols = new Set<string>();

  getMargin(tradingsymbol: string) {
    return this.margins.get(tradingsymbol);
  }

  markPending(tradingsymbols: string[]) {
    for (const tradingsymbol of tradingsymbols) {
      this.pendingSymbols.add(tradingsymbol);
      if (!this.margins.has(tradingsymbol)) {
        this.margins.set(tradingsymbol, { margin: 0, status: 'unavailable', updatedAt: 0 });
      }
    }
  }

  getStaleSymbols(tradingsymbols: string[]) {
    const now = Date.now();
    return tradingsymbols.filter((tradingsymbol) => {
      const entry = this.margins.get(tradingsymbol);
      if (!entry) {
        return true;
      }
      return now - entry.updatedAt > STALE_MS || entry.status !== 'ready';
    });
  }

  async refresh(tradingsymbols: string[]) {
    const stale = this.getStaleSymbols(tradingsymbols);
    if (stale.length === 0 || this.isFetching) {
      return;
    }

    this.isFetching = true;
    this.markPending(stale);

    try {
      const margins = await getOrderMargins(stale);
      const fetched = new Set(margins.map((margin) => margin.tradingsymbol));

      for (const margin of margins) {
        this.margins.set(margin.tradingsymbol, {
          margin: margin.total,
          status: 'ready',
          updatedAt: Date.now(),
        });
        this.pendingSymbols.delete(margin.tradingsymbol);
      }

      for (const tradingsymbol of stale) {
        if (!fetched.has(tradingsymbol)) {
          this.margins.set(tradingsymbol, {
            margin: 0,
            status: 'error',
            updatedAt: Date.now(),
          });
          this.pendingSymbols.delete(tradingsymbol);
        }
      }
    } catch (error) {
      logger.error('Failed to refresh margins:', error);
    } finally {
      this.isFetching = false;
    }
  }
}

export const marginBook = new MarginBook();
