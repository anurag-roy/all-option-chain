import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DbInstrument } from './instrument-catalog';
import type { KiteFullQuote } from './kite';
import { OptionChainCoordinator } from './option-chain-coordinator';

const mocks = vi.hoisted(() => ({
  quotes: vi.fn(),
  equity: vi.fn(),
  options: vi.fn(),
  futures: vi.fn(),
  subscriptions: vi.fn(),
  minutes: 100,
  tick: undefined as ((tick: any) => void) | undefined,
}));
vi.mock('@server/lib/services/access-token', () => ({ accessToken: 'test' }));
vi.mock('@server/lib/logger', () => ({ logger: { debug: vi.fn(), error: vi.fn() } }));
vi.mock('@server/lib/services/bans-service', () => ({
  ensureTodayNseBans: vi.fn(),
  getBannedNames: async () => new Set(),
}));
vi.mock('@server/lib/services/instrument-catalog', () => ({
  getEquityByName: mocks.equity,
  getOptionsForNameAndExpiry: mocks.options,
  getFuturesForName: mocks.futures,
}));
vi.mock('@server/lib/services/kite', () => ({ getFullQuotes: mocks.quotes }));
vi.mock('@server/lib/services/market-minutes-cache', () => ({
  marketMinutesCache: {
    initializeRuntimeCache: vi.fn(),
    getMarketMinutesInLastYear: () => 10_000,
    getMarketMinutesTillExpiry: () => mocks.minutes,
  },
}));
vi.mock('@server/lib/services/margin-book', () => ({
  marginBook: {
    markPending: vi.fn(),
    refresh: vi.fn(),
    getMargin: () => ({ status: 'ready', margin: 10_000, price: 0.5, quantity: 100 }),
  },
}));
vi.mock('@server/lib/services/market-data', () => ({
  marketDataService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    setSubscriptions: mocks.subscriptions,
    getSubscribedTokens: () => new Set(),
    onTick: (handler: typeof mocks.tick) => {
      mocks.tick = handler;
      return () => {
        mocks.tick = undefined;
      };
    },
  },
}));

const expiry = '2026-10-27';
const filter = { expiry, sdMultiplier: 1, entryValue: 40, symbols: ['TEST'] };
function instrument(token: number, type: 'EQ' | 'FUT' | 'CE' | 'PE', strike: number): DbInstrument {
  return {
    instrumentToken: token,
    exchangeToken: String(token),
    tradingsymbol: `TEST${type}${strike}`,
    name: 'TEST',
    expiry: type === 'EQ' ? null : expiry,
    strike,
    tickSize: 0.05,
    lotSize: 100,
    instrumentType: type,
    segment: type === 'EQ' ? 'NSE' : 'NFO-OPT',
    exchange: type === 'EQ' ? 'NSE' : 'NFO',
    av: 0.2,
    dv: 0.01,
  };
}
const options = [
  instrument(10, 'PE', 90),
  instrument(11, 'PE', 95),
  instrument(12, 'PE', 100),
  instrument(13, 'CE', 100),
  instrument(14, 'CE', 105),
  instrument(15, 'CE', 110),
  instrument(16, 'CE', 102),
  instrument(17, 'PE', 98),
];
let coordinator: OptionChainCoordinator;
let quotes: Record<string, KiteFullQuote>;
function tokens() {
  return Object.keys(coordinator.getSnapshot())
    .map(Number)
    .sort((a, b) => a - b);
}
function equityTick(ltp: number) {
  mocks.tick?.({ mode: 'ltp', instrument_token: 1, last_price: ltp });
}
function optionTick(token: number, oi: number, bid?: number) {
  mocks.tick?.({
    mode: 'full',
    instrument_token: token,
    oi,
    depth: { buy: bid === undefined ? [] : [{ price: bid, quantity: 1, orders: 1 }], sell: [] },
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-27T10:00:00+05:30'));
  vi.clearAllMocks();
  mocks.minutes = 100;
  mocks.subscriptions.mockReset();
  mocks.equity.mockResolvedValue(instrument(1, 'EQ', 0));
  mocks.options.mockResolvedValue(options);
  mocks.futures.mockResolvedValue([instrument(2, 'FUT', 0)]);
  quotes = Object.fromEntries(
    options.map((option) => [
      `NFO:${option.tradingsymbol}`,
      {
        instrument_token: option.instrumentToken,
        last_price: 0.5,
        oi: 10,
        depth: { buy: [{ price: 0.5, quantity: 1, orders: 1 }], sell: [] },
      },
    ])
  );
  quotes['NSE:TESTEQ0'] = {
    instrument_token: 1,
    last_price: 100,
    ohlc: { open: 100, high: 100, low: 100, close: 100 },
  };
  mocks.quotes
    .mockReset()
    .mockImplementation(async (keys: string[]) =>
      Object.fromEntries(keys.filter((key) => quotes[key]).map((key) => [key, quotes[key]]))
    );
  coordinator = new OptionChainCoordinator();
  await coordinator.init();
});

describe('closing-session option-chain protection', () => {
  const closingFilter = { ...filter, sdMultiplier: 0 };
  const setTime = (time: string, day = '2026-10-27') => vi.setSystemTime(new Date(`${day}T${time}+05:30`));

  it('freezes the last pre-cutoff LTP, removes both sides of the band and keeps option bids live', async () => {
    setTime('15:35:00.500');
    await coordinator.applyFilter(closingFilter);
    expect(tokens()).toEqual([10, 11, 12, 13, 14, 15, 16, 17]);

    await vi.advanceTimersByTimeAsync(500);
    expect(tokens()).toEqual([10, 11, 14, 15]);
    equityTick(104);
    optionTick(14, 10, 1.5);
    await vi.advanceTimersByTimeAsync(500);
    expect(tokens()).toEqual([10, 11, 14, 15]);
    expect(coordinator.getSnapshot()[14]).toMatchObject({ underlyingLtp: 100, gainLossPercent: 0, bid: 1.5 });
    expect(coordinator.getStatus()).toMatchObject({ rowCount: 4, visibleRowCount: 4 });
  });

  it('captures the latest tick before 15:35:01 even between recompute passes', async () => {
    setTime('15:35:00.500');
    await coordinator.applyFilter(closingFilter);
    setTime('15:35:00.999');
    equityTick(101);
    setTime('15:35:01.000');
    equityTick(110);
    await vi.advanceTimersByTimeAsync(500);
    expect(tokens()).toEqual([10, 11, 14, 15, 17]);
    expect(coordinator.getSnapshot()[14]).toMatchObject({ underlyingLtp: 101, gainLossPercent: 1 });
  });

  it('preserves the frozen price when filters are reapplied with different REST LTPs', async () => {
    setTime('15:35:00.500');
    await coordinator.applyFilter(closingFilter);
    setTime('15:35:01.000');
    equityTick(110);
    quotes['NSE:TESTEQ0']!.last_price = 110;
    await coordinator.applyFilter({ ...closingFilter, entryValue: 0 });
    expect(tokens()).toEqual([10, 11, 14, 15]);
    expect(coordinator.getSnapshot()[14]?.underlyingLtp).toBe(100);
  });

  it('uses the first available underlying quote when the chain starts inside the window', async () => {
    setTime('15:36:00');
    await coordinator.applyFilter(closingFilter);
    expect(tokens()).toEqual([10, 11, 14, 15]);
    equityTick(110);
    await vi.advanceTimersByTimeAsync(500);
    expect(coordinator.getSnapshot()[14]?.underlyingLtp).toBe(100);
  });

  it('hides in-band rows while an earlier option quote request is still pending', async () => {
    setTime('15:34:59');
    await coordinator.applyFilter(filter);
    mocks.minutes = 25;
    const pending = deferred<Record<string, KiteFullQuote>>();
    mocks.quotes.mockReturnValueOnce(pending.promise);
    await vi.advanceTimersByTimeAsync(500);
    expect(mocks.quotes).toHaveBeenLastCalledWith(['NFO:TESTCE102', 'NFO:TESTPE98']);
    setTime('15:35:01');
    pending.resolve(quotes);
    await vi.advanceTimersByTimeAsync(0);
    expect(tokens()).toEqual([10, 11, 14, 15]);
  });

  it('excludes exact band boundaries from snapshots and counts even during pending reselection', async () => {
    const boundaryOptions = [
      instrument(20, 'PE', 97.5),
      instrument(21, 'CE', 102.5),
      instrument(22, 'PE', 97.45),
      instrument(23, 'CE', 102.55),
    ];
    mocks.options.mockResolvedValue(boundaryOptions);
    for (const option of boundaryOptions) {
      quotes[`NFO:${option.tradingsymbol}`] = { ...quotes['NFO:TESTCE105']!, instrument_token: option.instrumentToken };
    }
    setTime('15:35:00.500');
    await coordinator.applyFilter(closingFilter);
    expect(tokens()).toEqual([20, 21, 22, 23]);
    setTime('15:35:01');
    expect(tokens()).toEqual([22, 23]);
    expect(coordinator.getStatus()).toMatchObject({ rowCount: 2, visibleRowCount: 2 });
  });

  it('removes the exclusion after 15:40:00 and resumes using prices received during the freeze', async () => {
    setTime('15:35:00.500');
    await coordinator.applyFilter(closingFilter);
    setTime('15:35:01');
    equityTick(104);
    await vi.advanceTimersByTimeAsync(500);
    expect(tokens()).toEqual([10, 11, 14, 15]);
    setTime('15:40:00');
    expect(tokens()).toEqual([10, 11, 14, 15]);
    setTime('15:40:00.001');
    await vi.advanceTimersByTimeAsync(500);
    expect(tokens()).toEqual([10, 11, 12, 14, 15, 17]);
    expect(coordinator.getSnapshot()[14]?.underlyingLtp).toBe(104);
  });

  it('resets the freeze for the following day', async () => {
    setTime('15:35:01');
    await coordinator.applyFilter(closingFilter);
    setTime('10:00:00', '2026-10-28');
    equityTick(110);
    await vi.advanceTimersByTimeAsync(500);
    setTime('15:35:01', '2026-10-28');
    equityTick(100);
    await vi.advanceTimersByTimeAsync(500);
    expect(coordinator.getSnapshot()[10]?.underlyingLtp).toBe(110);
    expect(tokens()).toEqual([10, 11, 12, 17]);
  });
});
afterEach(async () => {
  await coordinator.shutdown();
  vi.useRealTimers();
});

describe('live option-chain membership', () => {
  it('adds and removes strikes on underlying ticks without reapplying the filter', async () => {
    const updates = vi.fn();
    coordinator.onUpdate(updates);
    await coordinator.applyFilter(filter);
    expect(tokens()).toEqual([10, 11, 14, 15]);
    const catalogReads = mocks.options.mock.calls.length;
    mocks.quotes.mockClear();

    equityTick(104);
    await vi.advanceTimersByTimeAsync(500);
    expect(tokens()).toEqual([10, 11, 12, 15, 17]);
    expect(mocks.quotes).toHaveBeenCalledExactlyOnceWith(['NFO:TESTPE100', 'NFO:TESTPE98']);
    expect(mocks.subscriptions).toHaveBeenLastCalledWith('option-chain', { full: [10, 11, 12, 15, 17], ltp: [1] });
    expect(Object.keys(updates.mock.lastCall![0]).map(Number)).toEqual(tokens());
    expect(coordinator.getStatus()).toMatchObject({ status: 'ready', rowCount: 5, visibleRowCount: 5 });

    equityTick(100);
    await vi.advanceTimersByTimeAsync(500);
    expect(tokens()).toEqual([10, 11, 14, 15]);
    expect(mocks.options).toHaveBeenCalledTimes(catalogReads);
  });

  it('reselects strikes as expiry time decays even without an equity tick', async () => {
    await coordinator.applyFilter(filter);
    mocks.minutes = 25;
    await vi.advanceTimersByTimeAsync(500);
    expect(tokens()).toEqual([10, 11, 14, 15, 16, 17]);
  });

  it('retains the applied SD multiplier during live selection', async () => {
    await coordinator.applyFilter({ ...filter, sdMultiplier: 3.3 });
    expect(tokens()).toEqual([10, 15]);
    equityTick(104);
    await vi.advanceTimersByTimeAsync(500);
    expect(tokens()).toEqual([10, 11]);
  });

  it('removes zero-OI rows and adds them back when OI becomes positive', async () => {
    quotes['NFO:TESTCE110']!.oi = 0;
    await coordinator.applyFilter(filter);
    expect(tokens()).toEqual([10, 11, 14]);
    expect(mocks.subscriptions).toHaveBeenLastCalledWith('option-chain', { full: [10, 11, 14], ltp: [1] });
    quotes['NFO:TESTCE110']!.oi = 5;
    mocks.quotes.mockClear();
    await vi.advanceTimersByTimeAsync(59_000);
    expect(tokens()).toEqual([10, 11, 14]);
    expect(mocks.quotes).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(mocks.quotes).toHaveBeenCalledExactlyOnceWith(['NFO:TESTCE110']);
    expect(tokens()).toEqual([10, 11, 14, 15]);
    expect(mocks.subscriptions).toHaveBeenLastCalledWith('option-chain', { full: [10, 11, 14, 15], ltp: [1] });
    optionTick(15, 5, 0.5);
    await vi.advanceTimersByTimeAsync(500);
    expect(tokens()).toEqual([10, 11, 14, 15]);
    optionTick(15, 0, 0.5);
    await vi.advanceTimersByTimeAsync(500);
    expect(tokens()).toEqual([10, 11, 14]);
    optionTick(15, 10, 0.5);
    expect(tokens()).toEqual([10, 11, 14, 15]);
  });

  it('lets bid changes cross entry value in both directions and clears an empty bid book', async () => {
    await coordinator.applyFilter(filter);
    expect(coordinator.getVisibleRowCount()).toBe(4);
    optionTick(14, 10);
    await vi.advanceTimersByTimeAsync(500);
    expect(coordinator.getSnapshot()[14]).toMatchObject({ bid: 0, sellValue: -5 });
    expect(coordinator.getVisibleRowCount()).toBe(3);
    // All eligible rows still reach the browser; entry value remains a client display filter.
    expect(tokens()).toEqual([10, 11, 14, 15]);
    optionTick(14, 10, 0.5);
    await vi.advanceTimersByTimeAsync(500);
    expect(coordinator.getVisibleRowCount()).toBe(4);
  });

  it('uses the latest price when a quote request finishes and does not overlap refreshes', async () => {
    await coordinator.applyFilter(filter);
    const pending = deferred<Record<string, KiteFullQuote>>();
    mocks.quotes.mockClear().mockReturnValueOnce(pending.promise);
    equityTick(104);
    await vi.advanceTimersByTimeAsync(1500);
    expect(mocks.quotes).toHaveBeenCalledTimes(1);
    equityTick(100);
    pending.resolve(quotes);
    await vi.advanceTimersByTimeAsync(0);
    expect(tokens()).toEqual([10, 11, 14, 15]);
  });

  it('discards a background selection when a different filter has been applied', async () => {
    await coordinator.applyFilter(filter);
    const pending = deferred<Record<string, KiteFullQuote>>();
    mocks.quotes.mockReturnValueOnce(pending.promise);
    equityTick(104);
    await vi.advanceTimersByTimeAsync(500);
    await coordinator.applyFilter({ ...filter, sdMultiplier: 0 });
    expect(tokens()).toEqual([10, 11, 12, 13, 14, 15, 16, 17]);
    pending.resolve(quotes);
    await vi.advanceTimersByTimeAsync(0);
    expect(tokens()).toEqual([10, 11, 12, 13, 14, 15, 16, 17]);
    expect(coordinator.getStatus().filter?.sdMultiplier).toBe(0);
  });

  it('preserves the chain after a failed quote refresh and retries on the next pass', async () => {
    await coordinator.applyFilter(filter);
    mocks.quotes.mockRejectedValueOnce(new Error('temporary quote failure'));
    equityTick(104);
    await vi.advanceTimersByTimeAsync(500);
    expect(tokens()).toEqual([10, 11, 14, 15]);
    await vi.advanceTimersByTimeAsync(500);
    expect(tokens()).toEqual([10, 11, 12, 15, 17]);
  });

  it('continues selecting strikes when the underlying has no previous close', async () => {
    quotes['NSE:TESTEQ0']!.ohlc!.close = 0;
    await coordinator.applyFilter(filter);
    equityTick(104);
    await vi.advanceTimersByTimeAsync(500);
    expect(tokens()).toEqual([10, 11, 12, 15, 17]);
  });

  it('does not make quote or subscription requests when eligibility is unchanged', async () => {
    await coordinator.applyFilter(filter);
    mocks.quotes.mockClear();
    mocks.subscriptions.mockClear();
    equityTick(100.01);
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.quotes).not.toHaveBeenCalled();
    expect(mocks.subscriptions).not.toHaveBeenCalled();
  });

  it('removes ineligible strikes even when no new contracts need quotes', async () => {
    await coordinator.applyFilter(filter);
    mocks.minutes = 625;
    mocks.quotes.mockClear();
    await vi.advanceTimersByTimeAsync(500);
    expect(tokens()).toEqual([10, 15]);
    expect(mocks.quotes).not.toHaveBeenCalled();
    expect(mocks.subscriptions).toHaveBeenLastCalledWith('option-chain', { full: [10, 15], ltp: [1] });
  });

  it('keeps the previous selection intact when the ticker rejects a subscription change', async () => {
    await coordinator.applyFilter(filter);
    mocks.subscriptions.mockImplementationOnce(() => {
      throw new Error('Kite ticker limit exceeded');
    });
    equityTick(104);
    await vi.advanceTimersByTimeAsync(500);
    expect(tokens()).toEqual([10, 11, 14, 15]);
    await vi.advanceTimersByTimeAsync(500);
    expect(tokens()).toEqual([10, 11, 12, 15, 17]);
  });

  it('discards a pending quote refresh after shutdown', async () => {
    await coordinator.applyFilter(filter);
    const pending = deferred<Record<string, KiteFullQuote>>();
    mocks.quotes.mockReturnValueOnce(pending.promise);
    equityTick(104);
    await vi.advanceTimersByTimeAsync(500);
    await coordinator.shutdown();
    mocks.subscriptions.mockClear();
    pending.resolve(quotes);
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.subscriptions).not.toHaveBeenCalled();
    expect(tokens()).toEqual([10, 11, 14, 15]);
  });
});
