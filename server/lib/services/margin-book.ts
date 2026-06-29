import { logger } from '@server/lib/logger';
import { getOrderMargins, type MarginOrderInput } from '@server/lib/services/kite';

type MarginEntry = {
  margin: number;
  status: 'ready' | 'error' | 'unavailable';
  updatedAt: number;
  price?: number;
  quantity?: number;
};

const STALE_MS = 60_000;

export class MarginBook {
  private margins = new Map<string, MarginEntry>();
  private isFetching = false;

  getMargin(tradingsymbol: string) {
    return this.margins.get(tradingsymbol);
  }

  markPending(tradingsymbols: string[]) {
    for (const tradingsymbol of tradingsymbols) {
      if (!this.margins.has(tradingsymbol)) {
        this.margins.set(tradingsymbol, { margin: 0, status: 'unavailable', updatedAt: 0 });
      }
    }
  }

  getStaleOrders(orders: MarginOrderInput[]) {
    const now = Date.now();
    return orders.filter((order) => {
      const entry = this.margins.get(order.tradingsymbol);
      if (!entry || entry.status !== 'ready') {
        return true;
      }
      if (now - entry.updatedAt > STALE_MS) {
        return true;
      }
      return entry.price !== order.price || entry.quantity !== order.quantity;
    });
  }

  async refresh(orders: MarginOrderInput[]) {
    if (this.isFetching) {
      return;
    }

    const staleOrders = this.getStaleOrders(orders);
    if (staleOrders.length === 0) {
      return;
    }

    const staleSymbols = staleOrders.map((order) => order.tradingsymbol);

    this.isFetching = true;
    this.markPending(staleSymbols);

    try {
      const margins = await getOrderMargins(staleOrders);
      const fetched = new Set(margins.map((margin) => margin.tradingsymbol));
      const orderBySymbol = new Map(staleOrders.map((order) => [order.tradingsymbol, order]));

      for (const margin of margins) {
        const order = orderBySymbol.get(margin.tradingsymbol);
        this.margins.set(margin.tradingsymbol, {
          margin: margin.total,
          status: 'ready',
          updatedAt: Date.now(),
          price: order?.price,
          quantity: order?.quantity,
        });
      }

      for (const tradingsymbol of staleSymbols) {
        if (!fetched.has(tradingsymbol)) {
          this.margins.set(tradingsymbol, {
            margin: 0,
            status: 'error',
            updatedAt: Date.now(),
          });
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
