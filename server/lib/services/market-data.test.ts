import { MarketDataService } from '@server/lib/services/market-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  instances: [] as Array<{
    handlers: Map<string, (...args: any[]) => void>;
    connect: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
    setMode: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    autoReconnect: ReturnType<typeof vi.fn>;
  }>,
}));
vi.mock('@server/lib/env', () => ({ env: { KITE_API_KEY: 'test-key' } }));
vi.mock('@server/lib/services/access-token', () => ({ accessToken: 'test-token' }));
vi.mock('@server/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));
vi.mock('kiteconnect-ts', () => ({
  KiteTicker: class {
    handlers = new Map<string, (...args: any[]) => void>();
    connect = vi.fn();
    subscribe = vi.fn();
    unsubscribe = vi.fn();
    setMode = vi.fn();
    disconnect = vi.fn();
    autoReconnect = vi.fn();
    constructor() {
      mocks.instances.push(this);
    }
    on(event: string, handler: (...args: any[]) => void) {
      this.handlers.set(event, handler);
    }
  },
}));

let service: MarketDataService;
beforeEach(() => {
  vi.useFakeTimers();
  mocks.instances.length = 0;
  service = new MarketDataService();
});
afterEach(() => {
  service.disconnect();
  vi.useRealTimers();
});
async function connect() {
  const promise = service.connect();
  const ticker = mocks.instances[0]!;
  ticker.handlers.get('connect')!();
  await promise;
  return ticker;
}

describe('shared Kite ticker subscriptions', () => {
  it('replaces the option-chain group without removing G-Secs and counts overlapping tokens once', async () => {
    const ticker = await connect();
    service.setSubscriptions('gsecs', { full: [1] });
    service.setSubscriptions('option-chain', { full: [2], ltp: [1, 3] });
    expect(service.getSubscribedTokens()).toEqual(new Set([1, 2, 3]));
    expect(ticker.setMode).toHaveBeenCalledWith('ltp', [3]);
    expect(ticker.setMode).not.toHaveBeenCalledWith('ltp', [1]);
    ticker.unsubscribe.mockClear();
    service.setSubscriptions('option-chain', { full: [4], ltp: [5] });
    expect(ticker.unsubscribe).toHaveBeenCalledTimes(1);
    expect(new Set(ticker.unsubscribe.mock.calls[0]![0])).toEqual(new Set([2, 3]));
    expect(service.getSubscribedTokens('gsecs')).toEqual(new Set([1]));
    service.setSubscriptions('gsecs', { full: [] });
    expect(service.getSubscribedTokens()).toEqual(new Set([4, 5]));
  });

  it('downgrades an overlapping full subscription when its owner leaves', async () => {
    const ticker = await connect();
    service.setSubscriptions('equities', { full: [], ltp: [1] });
    service.setSubscriptions('gsecs', { full: [1] });
    service.setSubscriptions('gsecs', { full: [] });
    expect(ticker.setMode.mock.calls).toEqual([
      ['ltp', [1]],
      ['full', [1]],
      ['ltp', [1]],
    ]);
    expect(ticker.subscribe).toHaveBeenCalledTimes(1);
    expect(ticker.unsubscribe).not.toHaveBeenCalled();
  });

  it('rejects over 3,000 unique tokens atomically and sends subscriptions in bounded batches', async () => {
    const ticker = await connect();
    const tokens = Array.from({ length: 3000 }, (_, index) => index + 1);
    service.setSubscriptions('option-chain', { full: tokens });
    expect(ticker.subscribe).toHaveBeenCalledTimes(6);
    expect(ticker.subscribe.mock.calls.every(([batch]) => batch.length <= 500)).toBe(true);
    service.setSubscriptions('gsecs', { full: [1] });
    expect(() => service.setSubscriptions('gsecs', { full: [3001] })).toThrow('3001 instruments requested');
    expect(service.getSubscribedTokens()).toEqual(new Set(tokens));
    expect(service.getSubscribedTokens('gsecs')).toEqual(new Set([1]));
    expect(ticker.unsubscribe).not.toHaveBeenCalled();
  });

  it('restores the latest groups and modes on actual reconnect, not the reconnect attempt', async () => {
    service.setSubscriptions('gsecs', { full: [1] });
    service.setSubscriptions('option-chain', { full: [2], ltp: [3] });
    const changes = vi.fn();
    service.onConnectionChange(changes);
    const ticker = await connect();
    ticker.subscribe.mockClear();
    ticker.setMode.mockClear();
    ticker.handlers.get('close')!();
    service.setSubscriptions('option-chain', { full: [4], ltp: [5] });
    ticker.handlers.get('reconnect')!();
    expect(service.isConnected()).toBe(false);
    expect(ticker.subscribe).not.toHaveBeenCalled();
    ticker.handlers.get('connect')!();
    expect(ticker.subscribe).toHaveBeenCalledTimes(1);
    expect(new Set(ticker.subscribe.mock.calls[0]![0])).toEqual(new Set([1, 4, 5]));
    expect(ticker.setMode.mock.calls).toEqual([
      ['ltp', [5]],
      ['full', [1, 4]],
    ]);
    expect(changes.mock.calls).toEqual([[true], [false], [true]]);
  });

  it('shares concurrent connection attempts and registers tick handlers before connecting', async () => {
    const tick = { mode: 'ltp', instrument_token: 1, last_price: 100 };
    const handler = vi.fn();
    const dispose = service.onTick(handler);
    const first = service.connect();
    const second = service.connect();
    const ticker = mocks.instances[0]!;
    expect(mocks.instances).toHaveLength(1);
    expect(ticker.connect).toHaveBeenCalledTimes(1);
    ticker.handlers.get('connect')!();
    ticker.handlers.get('ticks')!([tick]);
    await Promise.all([first, second]);
    expect(handler).toHaveBeenCalledExactlyOnceWith(tick);
    dispose();
    ticker.handlers.get('ticks')!([tick]);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('rejects connection errors and ignores late events after shutdown', async () => {
    const attempt = service.connect();
    const rejected = expect(attempt).rejects.toThrow('bad login');
    const ticker = mocks.instances[0]!;
    ticker.handlers.get('error')!(new Error('bad login'));
    await rejected;
    service.disconnect();
    ticker.handlers.get('connect')!();
    expect(service.isConnected()).toBe(false);
    expect(ticker.subscribe).not.toHaveBeenCalled();
    expect(ticker.autoReconnect).toHaveBeenCalledWith(false);
  });
});
