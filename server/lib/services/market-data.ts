import { env } from '@server/lib/env';
import { logger } from '@server/lib/logger';
import { accessToken } from '@server/lib/services/access-token';
import { chunk } from 'es-toolkit';
import { KiteTicker, type TickFull, type TickLtp } from 'kiteconnect-ts';

type TickHandler = (tick: TickFull | TickLtp) => void;

export class MarketDataService {
  private ticker: KiteTicker | null = null;
  private subscribedTokens = new Set<number>();
  private tickHandlers = new Set<TickHandler>();
  private connected = false;

  async connect() {
    if (!accessToken) {
      logger.warn('No Kite access token; market data websocket will not connect');
      return;
    }

    if (this.connected) {
      return;
    }

    this.ticker = new KiteTicker({
      api_key: env.KITE_API_KEY,
      access_token: accessToken,
    });

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('Kite ticker connection timed out')), 10000);

      this.ticker!.on('connect', () => {
        clearTimeout(timeoutId);
        this.connected = true;
        logger.info('Connected to Kite ticker');
        resolve();
      });

      this.ticker!.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });

      this.ticker!.connect();
    });

    this.ticker.on('ticks', (ticks: (TickLtp | TickFull)[]) => {
      for (const tick of ticks) {
        for (const handler of this.tickHandlers) {
          handler(tick);
        }
      }
    });

    this.ticker.on('close', () => {
      this.connected = false;
      logger.warn('Kite ticker disconnected');
    });

    this.ticker.on('reconnect', () => {
      this.connected = true;
      logger.info('Kite ticker reconnected');
      this.applySubscriptions();
    });
  }

  onTick(handler: TickHandler) {
    this.tickHandlers.add(handler);
    return () => this.tickHandlers.delete(handler);
  }

  getSubscribedTokens() {
    return new Set(this.subscribedTokens);
  }

  applyDiff(added: number[], removed: number[]) {
    if (!this.ticker || !this.connected) {
      for (const token of removed) {
        this.subscribedTokens.delete(token);
      }
      for (const token of added) {
        this.subscribedTokens.add(token);
      }
      return;
    }

    if (removed.length > 0) {
      this.ticker.unsubscribe(removed);
      for (const token of removed) {
        this.subscribedTokens.delete(token);
      }
    }

    for (const token of added) {
      this.subscribedTokens.add(token);
    }

    if (added.length > 0) {
      for (const tokenChunk of chunk(added, 500)) {
        this.ticker.subscribe(tokenChunk);
        this.ticker.setMode('full', tokenChunk);
      }
    }
  }

  setSubscriptions(tokens: number[]) {
    this.subscribedTokens = new Set(tokens);
    this.applySubscriptions();
  }

  private applySubscriptions() {
    if (!this.ticker || !this.connected) {
      return;
    }

    const tokens = [...this.subscribedTokens];
    if (tokens.length === 0) {
      return;
    }

    // Subscribe in chunks to avoid overwhelming the ticker
    for (const tokenChunk of chunk(tokens, 500)) {
      this.ticker.subscribe(tokenChunk);
      this.ticker.setMode('full', tokenChunk);
    }
  }

  subscribeLtp(tokens: number[]) {
    if (!this.ticker || !this.connected || tokens.length === 0) {
      return;
    }

    for (const tokenChunk of chunk(tokens, 500)) {
      this.ticker.subscribe(tokenChunk);
      this.ticker.setMode('ltp', tokenChunk);
    }
  }

  disconnect() {
    this.ticker?.disconnect();
    this.connected = false;
    this.subscribedTokens.clear();
  }

  isConnected() {
    return this.connected;
  }
}

export const marketDataService = new MarketDataService();
