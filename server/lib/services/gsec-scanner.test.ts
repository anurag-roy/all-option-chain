import { calculateGsecYtm } from '@server/lib/calculators/gsec-ytm';
import { GsecSeedError } from '@server/lib/services/approved-gsecs';
import type { GsecCurveSnapshot } from '@shared/types/gsec-curve';
import type { GsecListing } from '@shared/types/gsecs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GsecScanner } from './gsec-scanner';

const mocks = vi.hoisted(() => ({
  approved: vi.fn(),
  curve: vi.fn(),
  quotes: vi.fn(),
  connect: vi.fn(),
  subscriptions: vi.fn(),
  connected: true,
  tick: undefined as ((tick: any) => void) | undefined,
  connection: undefined as ((connected: boolean) => void) | undefined,
}));
vi.mock('@server/lib/services/gsec-catalog', () => ({ getSeededGsecs: mocks.approved }));
vi.mock('@server/lib/services/gsec-curve-catalog', () => ({ getSeededGsecCurve: mocks.curve }));
vi.mock('@server/lib/services/kite', () => ({ getFullQuotes: mocks.quotes }));
vi.mock('@server/lib/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('@server/lib/services/market-data', () => ({
  marketDataService: {
    connect: mocks.connect,
    setSubscriptions: mocks.subscriptions,
    isConnected: () => mocks.connected,
    onTick: (handler: typeof mocks.tick) => {
      mocks.tick = handler;
      return () => {
        mocks.tick = undefined;
      };
    },
    onConnectionChange: (handler: typeof mocks.connection) => {
      mocks.connection = handler;
      return () => {
        mocks.connection = undefined;
      };
    },
  },
}));

const security: GsecListing = {
  exchange: 'NSE',
  tickSize: 0.01,
  tradingsymbol: '750GS2056-GS',
  coupon: 750,
  maturityYear: 2056,
  isin: 'IN0020260017',
  maturityDate: '2056-02-28',
};
const second: GsecListing = {
  exchange: 'NSE',
  tickSize: 0.01,
  tradingsymbol: '68GS2060-GS',
  coupon: 680,
  maturityYear: 2060,
  isin: 'IN0020200252',
  maturityDate: '2060-12-15',
};
const seller = (price: number) => ({ price, quantity: 5, orders: 1 });
let scanner: GsecScanner;
function tick(token: number, prices: number[]) {
  mocks.tick?.({ mode: 'full', instrument_token: token, depth: { sell: prices.map(seller), buy: [seller(999)] } });
}
function approved(securities: GsecListing[], settlementDate = '2026-10-06') {
  mocks.approved.mockResolvedValue({
    securities: securities.map((security) => ({
      ...security,
      instrumentToken: security.exchange === 'BSE' ? 3 : security.tradingsymbol === '750GS2056-GS' ? 1 : 2,
    })),
    fetchedAt: new Date().toISOString(),
    day: '2026-10-05',
    tradeDate: '2026-10-05',
    settlementDate,
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-05T05:00:00Z'));
  vi.clearAllMocks();
  mocks.connected = true;
  mocks.connect.mockReset().mockResolvedValue(undefined);
  mocks.subscriptions.mockReset();
  mocks.approved.mockReset();
  mocks.curve.mockReset().mockResolvedValue({ status: 'unavailable', snapshot: null, ageDays: null, rvThresholdBp: 5 });
  approved([security]);
  mocks.quotes.mockReset().mockResolvedValue({
    'NSE:750GS2056-GS': { depth: { sell: [seller(100.5)] } },
    'NSE:68GS2060-GS': { depth: { sell: [seller(100)] } },
  });
  scanner = new GsecScanner();
});
afterEach(() => {
  scanner.shutdown();
  vi.useRealTimers();
});

describe('live G-Sec scanner', () => {
  it('updates curve spreads and roll on seller ticks, reuses quantity-only analytics, and tolerates curve outages', async () => {
    const curve: GsecCurveSnapshot = {
      id: 'live-test-curve',
      provider: 'CCIL',
      referenceDate: '2026-10-02',
      publicationTimestamp: null,
      firstObservedAt: '2026-10-05T04:00:00.000Z',
      retrievedAt: '2026-10-05T04:00:00.000Z',
      sourceUrl: 'https://www.ccilindia.com/zcyc-parameters',
      sourceHash: 'test',
      method: 'NSS',
      parameters: { beta0: 8.27, beta1: -2.9928, beta2: -19.9674, beta3: 19.5976, tau1: 2.0618, tau2: 1.8925 },
      compounding: 'continuous',
      dayCount: 'ACT/365',
      conventionSource: 'test',
      minTenor: 0,
      maxTenor: 50,
    };
    mocks.curve.mockResolvedValue({ status: 'ready', snapshot: curve, ageDays: 3, rvThresholdBp: 5 });
    const initial = await scanner.refresh();
    const first = initial.rows[0]!.curveAnalytics!;
    expect(first.spreadBp).not.toBeNull();
    expect(initial.curvePoints).toHaveLength(201);
    mocks.tick?.({ mode: 'full', instrument_token: 1, depth: { sell: [{ price: 100.5, quantity: 100, orders: 3 }] } });
    await vi.advanceTimersByTimeAsync(250);
    expect(scanner.getCachedSnapshot()!.rows[0]!.curveAnalytics).toBe(first);
    tick(1, [90]);
    await vi.advanceTimersByTimeAsync(250);
    const updated = scanner.getCachedSnapshot()!.rows[0]!;
    expect(updated.curveAnalytics!.fairDirtyPrice).toBe(first.fairDirtyPrice);
    expect(updated.curveAnalytics!.spreadBp).not.toBe(first.spreadBp);
    expect(updated.curveAnalytics!.carryRoll[3]!.returnPercent).not.toBe(first.carryRoll[3]!.returnPercent);
    expect(updated.bestRrrRank).toBe(1);
    mocks.curve.mockResolvedValue({
      status: 'stale',
      snapshot: curve,
      ageDays: 8,
      rvThresholdBp: 5,
      message: 'Curve is stale',
    });
    const stale = await scanner.refresh();
    expect(stale.rows[0]!.curveAnalytics).toBeNull();
    expect(stale.rows[0]!.analytics).toBe(updated.analytics);
    expect(stale.rows[0]!.rrr).toBe(updated.rrr);
    expect(stale.curvePoints).toEqual([]);
    expect(mocks.quotes).toHaveBeenCalledTimes(1);
  });

  it('keeps BSE quotes and depth independent from NSE through ticks, reconnects and venue removal', async () => {
    const bse = { ...security, exchange: 'BSE' as const, tickSize: 0.05 };
    approved([security, bse]);
    mocks.quotes.mockResolvedValue({
      'NSE:750GS2056-GS': { depth: { sell: [seller(100.5)] } },
      'BSE:750GS2056-GS': { depth: { sell: [seller(99.5)] } },
    });
    await scanner.refresh();
    expect(mocks.subscriptions).toHaveBeenLastCalledWith('gsecs', { full: [1, 3] });
    expect(mocks.quotes).toHaveBeenCalledExactlyOnceWith(['NSE:750GS2056-GS', 'BSE:750GS2056-GS']);
    tick(3, [98.5, 98.6]);
    await vi.advanceTimersByTimeAsync(250);
    expect(await scanner.getDepth(security.tradingsymbol, 'BSE')).toMatchObject({
      exchange: 'BSE',
      sell: [seller(98.5), seller(98.6)],
    });
    expect(await scanner.getDepth(security.tradingsymbol)).toMatchObject({ exchange: 'NSE', sell: [seller(100.5)] });
    expect(scanner.getCachedSnapshot()?.rows.map((row) => [row.exchange, row.bestRrrRank])).toEqual([
      ['BSE', 1],
      ['NSE', 2],
    ]);
    const pending = deferred<Record<string, any>>();
    mocks.quotes.mockReturnValueOnce(pending.promise);
    mocks.connection?.(true);
    await vi.waitFor(() => expect(mocks.quotes).toHaveBeenCalledTimes(2));
    tick(3, [97]);
    pending.resolve({
      'NSE:750GS2056-GS': { depth: { sell: [seller(101)] } },
      'BSE:750GS2056-GS': { depth: { sell: [seller(99)] } },
    });
    await scanner.refresh(true);
    expect((await scanner.getDepth(security.tradingsymbol, 'BSE'))?.sell).toEqual([seller(97)]);
    expect((await scanner.getDepth(security.tradingsymbol))?.sell).toEqual([seller(101)]);
    approved([security]);
    await scanner.refresh();
    expect(mocks.subscriptions).toHaveBeenLastCalledWith('gsecs', { full: [1] });
    tick(3, [1]);
    await vi.advanceTimersByTimeAsync(250);
    expect(await scanner.getDepth(security.tradingsymbol, 'BSE')).toBeNull();
    expect(scanner.getCachedSnapshot()?.rows).toEqual([expect.objectContaining({ exchange: 'NSE', sellRate: 101 })]);
  });
  it('shares initial requests, subscribes only approved instruments and never polls prices or depth', async () => {
    const [first, duplicate] = await Promise.all([scanner.refresh(), scanner.refresh()]);
    expect(first).toBe(duplicate);
    expect(mocks.subscriptions).toHaveBeenCalledWith('gsecs', { full: [1] });
    expect(mocks.quotes).toHaveBeenCalledExactlyOnceWith(['NSE:750GS2056-GS']);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    await scanner.refresh();
    expect(mocks.approved.mock.calls.length).toBeGreaterThan(1);
    expect(mocks.quotes).toHaveBeenCalledTimes(1);
    expect(await scanner.getDepth('680GS2060-GS')).toBeNull();
    expect((await scanner.getDepth(security.tradingsymbol))?.sell).toEqual([seller(100.5)]);
    expect(mocks.quotes).toHaveBeenCalledTimes(1);
  });

  it('batches seller ticks and updates rankings, analytics and top-five depth together', async () => {
    approved([security, second]);
    await scanner.refresh();
    const initialAnalytics = scanner
      .getCachedSnapshot()!
      .rows.find((row) => row.tradingsymbol === security.tradingsymbol)!.analytics!;
    const publish = vi.fn();
    scanner.onUpdate(publish);
    tick(1, [120, 119, 118, 117, 116, 115]);
    tick(2, [98, 99]);
    expect(publish).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(250);
    expect(publish).toHaveBeenCalledTimes(1);
    const snapshot = scanner.getCachedSnapshot()!;
    expect(snapshot.rows[0]).toMatchObject({
      tradingsymbol: second.tradingsymbol,
      sellRate: 98,
      bestRrrRank: 1,
      nearFvRank: 1,
    });
    const row = snapshot.rows.find((row) => row.tradingsymbol === security.tradingsymbol)!;
    expect(row).toMatchObject({ sellRate: 115, distanceFromFv: 15, bestRrrRank: 2, nearFvRank: 2 });
    expect(row.rrr).toBeCloseTo(
      calculateGsecYtm({
        dirtyPrice: 115,
        coupon: security.coupon,
        maturityDate: security.maturityDate,
        settlementDate: '2026-10-06',
      })!,
      10
    );
    expect(row.sellerDepth.map((level) => level.price)).toEqual([115, 116, 117, 118, 119]);
    expect(row.analytics?.ytm).toBe(row.rrr);
    expect(row.analytics?.risk?.modifiedDuration).not.toBe(initialAnalytics.risk?.modifiedDuration);
    expect(row.analytics?.scenarios.find((item) => item.shockBp === 0)?.dirtyPrice).toBe(115);
    expect(row.analytics?.carry.find((item) => item.months === 12)?.returnPercent).not.toBe(
      initialAnalytics.carry.find((item) => item.months === 12)?.returnPercent
    );
    expect(row.quoteUpdatedAt).toBe('2026-10-05T05:00:00.000Z');
    expect(mocks.quotes).toHaveBeenCalledTimes(1);
  });

  it('reuses analytics on quantity-only ticks but recalculates when settlement or bond terms change', async () => {
    await scanner.refresh();
    const initial = scanner.getCachedSnapshot()!.rows[0]!.analytics!;
    mocks.tick?.({
      mode: 'full',
      instrument_token: 1,
      depth: { sell: [{ price: 100.5, quantity: 200, orders: 5 }] },
    });
    await vi.advanceTimersByTimeAsync(250);
    expect(scanner.getCachedSnapshot()!.rows[0]!.analytics).toBe(initial);
    expect(scanner.getCachedSnapshot()!.rows[0]!.sellerDepth).toEqual([{ price: 100.5, quantity: 200, orders: 5 }]);

    approved([security], '2026-10-07');
    await scanner.refresh();
    const newSettlement = scanner.getCachedSnapshot()!.rows[0]!.analytics!;
    expect(newSettlement.ytm).not.toBe(initial.ytm);
    approved([{ ...security, coupon: 700 }], '2026-10-07');
    await scanner.refresh();
    expect(scanner.getCachedSnapshot()!.rows[0]!.rrr).toBeCloseTo(
      calculateGsecYtm({
        dirtyPrice: 100.5,
        coupon: 700,
        maturityDate: security.maturityDate,
        settlementDate: '2026-10-07',
      })!,
      10
    );
    expect(scanner.getCachedSnapshot()!.rows[0]!.analytics?.ytm).not.toBe(newSettlement.ytm);
  });

  it('removes securities that lose approval before fetching new quotes and ignores their later ticks', async () => {
    await scanner.refresh();
    approved([second]);
    const pending = deferred<Record<string, any>>();
    mocks.quotes.mockReturnValueOnce(pending.promise);
    const refresh = scanner.refresh();
    await vi.waitFor(() => expect(mocks.quotes).toHaveBeenCalledTimes(2));
    expect(scanner.getCachedSnapshot()?.rows.map((row) => row.tradingsymbol)).toEqual([second.tradingsymbol]);
    expect(mocks.subscriptions).toHaveBeenLastCalledWith('gsecs', { full: [2] });
    tick(1, [1]);
    pending.resolve({});
    await refresh;
    expect(scanner.getCachedSnapshot()?.rows).toEqual([
      expect.objectContaining({ tradingsymbol: second.tradingsymbol, quoteStatus: 'unavailable' }),
    ]);
  });

  it('fails closed on missing daily seed or quote errors and can recover', async () => {
    await scanner.refresh();
    mocks.approved.mockRejectedValueOnce(new GsecSeedError('Run npm run data:prepare'));
    await expect(scanner.refresh()).rejects.toThrow('npm run data:prepare');
    expect(scanner.getCachedSnapshot()).toMatchObject({
      rows: [],
      streamStatus: 'error',
      message: 'Run npm run data:prepare',
    });
    expect(mocks.subscriptions).toHaveBeenLastCalledWith('gsecs', { full: [] });
    await scanner.refresh();
    mocks.quotes.mockRejectedValueOnce({ error_type: 'TokenException' });
    await expect(scanner.refresh(true)).rejects.toMatchObject({ error_type: 'TokenException' });
    expect(scanner.getCachedSnapshot()).toMatchObject({
      rows: [],
      streamStatus: 'error',
      message: expect.stringContaining('login is invalid or expired'),
    });
    expect((await scanner.refresh()).rows[0]?.sellRate).toBe(100.5);
  });

  it('preserves the last prices while disconnected and refreshes quotes on actual reconnect', async () => {
    await scanner.refresh();
    const analytics = scanner.getCachedSnapshot()?.rows[0]?.analytics;
    mocks.connected = false;
    mocks.connection?.(false);
    expect(scanner.getCachedSnapshot()).toMatchObject({
      streamStatus: 'disconnected',
      rows: [expect.objectContaining({ sellRate: 100.5 })],
    });
    expect(mocks.quotes).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(scanner.getCachedSnapshot()?.rows[0]?.sellRate).toBe(100.5);
    expect(scanner.getCachedSnapshot()?.rows[0]?.analytics).toEqual(analytics);
    expect(mocks.quotes).toHaveBeenCalledTimes(1);
    mocks.connected = true;
    mocks.connection?.(true);
    await scanner.refresh(true);
    expect(mocks.quotes).toHaveBeenCalledTimes(2);
    expect(mocks.approved).toHaveBeenLastCalledWith();
    expect(scanner.getCachedSnapshot()?.streamStatus).toBe('live');
  });

  it('does not let a slow REST seed overwrite a newer seller tick', async () => {
    const pending = deferred<Record<string, any>>();
    mocks.quotes.mockReturnValueOnce(pending.promise);
    const refresh = scanner.refresh();
    await vi.waitFor(() => expect(mocks.quotes).toHaveBeenCalledTimes(1));
    tick(1, [99.8]);
    pending.resolve({ 'NSE:750GS2056-GS': { depth: { sell: [seller(100.5)] } } });
    expect((await refresh).rows[0]?.sellRate).toBe(99.8);
  });

  it('leaves empty books and missing snapshots unranked', async () => {
    mocks.quotes.mockResolvedValueOnce({});
    expect((await scanner.refresh()).rows[0]).toMatchObject({
      quoteStatus: 'unavailable',
      bestRrrRank: null,
      nearFvRank: null,
    });
    tick(1, []);
    await vi.advanceTimersByTimeAsync(250);
    expect(scanner.getCachedSnapshot()?.rows[0]).toMatchObject({
      quoteStatus: 'no-sellers',
      sellRate: null,
      sellerDepth: [],
      bestRrrRank: null,
      nearFvRank: null,
    });
  });

  it('recalculates yield when a new daily settlement date arrives without polling prices', async () => {
    const before = await scanner.refresh();
    approved([security], '2026-10-07');
    const after = await scanner.refresh();
    expect(after.settlementDate).toBe('2026-10-07');
    expect(after.rows[0]?.rrr).not.toBe(before.rows[0]?.rrr);
    expect(after.rows[0]?.sellRate).toBe(before.rows[0]?.sellRate);
    expect(mocks.quotes).toHaveBeenCalledTimes(1);
  });

  it('stops timers and pending refreshes without reviving subscriptions after shutdown', async () => {
    const pending = deferred<Record<string, any>>();
    mocks.quotes.mockReturnValueOnce(pending.promise);
    const refresh = scanner.refresh();
    const rejected = expect(refresh).rejects.toThrow('shut down');
    await vi.waitFor(() => expect(mocks.quotes).toHaveBeenCalledTimes(1));
    scanner.shutdown();
    const snapshot = scanner.getCachedSnapshot();
    pending.resolve({});
    await rejected;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(mocks.tick).toBeUndefined();
    expect(mocks.connection).toBeUndefined();
    expect(scanner.getCachedSnapshot()).toBe(snapshot);
    expect(mocks.subscriptions).toHaveBeenLastCalledWith('gsecs', { full: [] });
    expect(mocks.quotes).toHaveBeenCalledTimes(1);
  });
});
