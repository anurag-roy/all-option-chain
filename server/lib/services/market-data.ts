import { env } from '@server/lib/env';
import { logger } from '@server/lib/logger';
import { accessToken } from '@server/lib/services/access-token';
import { chunk } from 'es-toolkit';
import { KiteTicker, type TickFull, type TickLtp } from 'kiteconnect-ts';

type TickHandler = (tick: TickFull | TickLtp) => void;
type Mode = 'ltp' | 'full';
type SubscriptionGroup = { full: number[]; ltp?: number[] };
export const KITE_TICKER_TOKEN_LIMIT = 3000;

export class MarketDataService {
  private ticker: KiteTicker | null = null;
  private groups = new Map<string, Map<number, Mode>>();
  private subscriptions = new Map<number, Mode>();
  private tickHandlers = new Set<TickHandler>();
  private connectionHandlers = new Set<(connected: boolean) => void>();
  private connected = false;
  private connectPromise: Promise<void> | null = null;
  private connectionWaiter: {
    resolve: () => void;
    reject: (error: unknown) => void;
    timeout: ReturnType<typeof setTimeout>;
  } | null = null;

  async connect() {
    if (!accessToken) throw new Error('Kite access token missing. Run npm run login first.');
    if (this.connected) return;
    if (this.connectPromise) return this.connectPromise;

    if (!this.ticker) {
      const ticker = new KiteTicker({ api_key: env.KITE_API_KEY, access_token: accessToken });
      this.ticker = ticker;
      ticker.on('connect', () => {
        if (this.ticker !== ticker) return;
        this.connected = true;
        this.applySubscriptions(new Map());
        logger.info('Connected to Kite ticker');
        this.finishConnection();
        for (const handler of this.connectionHandlers) handler(true);
      });
      ticker.on('ticks', (ticks: (TickLtp | TickFull)[]) => {
        if (this.ticker !== ticker || !this.connected) return;
        for (const tick of ticks) {
          for (const handler of this.tickHandlers) handler(tick);
        }
      });
      ticker.on('error', (error) => {
        if (this.ticker === ticker) this.finishConnection(error);
      });
      ticker.on('close', () => {
        if (this.ticker !== ticker || !this.connected) return;
        this.connected = false;
        logger.warn('Kite ticker disconnected');
        for (const handler of this.connectionHandlers) handler(false);
      });
      // This event announces an attempt; restore subscriptions only on connect.
      ticker.on('reconnect', () => {
        if (this.ticker === ticker) logger.info('Reconnecting to Kite ticker');
      });
    }

    this.connectPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => this.finishConnection(new Error('Kite ticker connection timed out')), 10_000);
      this.connectionWaiter = { resolve, reject, timeout };
    });
    try {
      this.ticker.connect();
      await this.connectPromise;
    } catch (error) {
      this.finishConnection(error);
      // Consume a rejected waiter even if connect() itself threw synchronously.
      await this.connectPromise.catch(() => {});
      throw error;
    } finally {
      this.connectPromise = null;
    }
  }

  private finishConnection(error?: unknown) {
    if (!this.connectionWaiter) return;
    clearTimeout(this.connectionWaiter.timeout);
    const { resolve, reject } = this.connectionWaiter;
    this.connectionWaiter = null;
    if (error) reject(error);
    else resolve();
  }

  onTick(handler: TickHandler) {
    this.tickHandlers.add(handler);
    return () => this.tickHandlers.delete(handler);
  }

  onConnectionChange(handler: (connected: boolean) => void) {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  getSubscribedTokens(owner?: string) {
    return new Set((owner ? this.groups.get(owner) : this.subscriptions)?.keys() ?? []);
  }

  setSubscriptions(owner: string, group: SubscriptionGroup) {
    const requested = new Map<number, Mode>();
    for (const token of group.ltp ?? []) requested.set(token, 'ltp');
    for (const token of group.full) requested.set(token, 'full');
    for (const token of requested.keys()) {
      if (!Number.isSafeInteger(token) || token <= 0) throw new Error('Invalid Kite instrument token');
    }

    const groups = new Map(this.groups);
    if (requested.size) groups.set(owner, requested);
    else groups.delete(owner);
    const next = new Map<number, Mode>();
    for (const subscriptions of groups.values()) {
      for (const [token, mode] of subscriptions) {
        if (!next.has(token) || mode === 'full') next.set(token, mode);
      }
    }
    if (next.size > KITE_TICKER_TOKEN_LIMIT) {
      throw new Error(
        `Kite ticker limit exceeded: ${next.size} instruments requested; maximum is ${KITE_TICKER_TOKEN_LIMIT}. Reduce the option-chain selection.`
      );
    }

    const previous = this.subscriptions;
    this.groups = groups;
    this.subscriptions = next;
    this.applySubscriptions(previous);
  }

  private applySubscriptions(previous: Map<number, Mode>) {
    if (!this.ticker || !this.connected) return;
    const removed = [...previous.keys()].filter((token) => !this.subscriptions.has(token));
    for (const tokens of chunk(removed, 500)) this.ticker.unsubscribe(tokens);
    const added = [...this.subscriptions.keys()].filter((token) => !previous.has(token));
    for (const tokens of chunk(added, 500)) this.ticker.subscribe(tokens);
    for (const mode of ['ltp', 'full'] as const) {
      const changed = [...this.subscriptions]
        .filter(([token, value]) => value === mode && previous.get(token) !== mode)
        .map(([token]) => token);
      for (const tokens of chunk(changed, 500)) this.ticker.setMode(mode, tokens);
    }
  }

  disconnect() {
    this.finishConnection(new Error('Kite ticker shut down'));
    const ticker = this.ticker;
    this.ticker = null;
    const wasConnected = this.connected;
    this.connected = false;
    this.groups.clear();
    this.subscriptions.clear();
    ticker?.autoReconnect(false);
    ticker?.disconnect();
    if (wasConnected) for (const handler of this.connectionHandlers) handler(false);
  }

  isConnected() {
    return this.connected;
  }
}

export const marketDataService = new MarketDataService();
