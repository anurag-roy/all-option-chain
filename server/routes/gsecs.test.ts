import { calculateGsecAnalytics } from '@server/lib/calculators/gsec-analytics';
import { rankGsecs } from '@server/lib/calculators/gsecs';
import { GsecSeedError } from '@server/lib/services/approved-gsecs';
import { gsecsRoute } from '@server/routes/gsecs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  scan: vi.fn(),
  depth: vi.fn(),
  catalog: vi.fn(),
  token: 'test-token',
  logger: vi.fn(),
}));
vi.mock('@server/lib/services/gsec-scanner', () => ({ scanGsecs: mocks.scan, getGsecDepth: mocks.depth }));
vi.mock('@server/lib/services/gsec-catalog', () => ({ getSeededGsecs: mocks.catalog }));
vi.mock('@server/lib/services/access-token', () => ({
  get accessToken() {
    return mocks.token;
  },
}));
vi.mock('@server/lib/logger', () => ({ logger: { error: mocks.logger } }));

beforeEach(() => {
  mocks.token = 'test-token';
  mocks.scan.mockReset().mockResolvedValue({ rows: [] });
  mocks.depth.mockReset().mockResolvedValue(null);
  mocks.catalog.mockReset().mockResolvedValue({
    settlementDate: '2026-10-08',
    fetchedAt: '2026-10-07T09:40:14.226Z',
    securities: [
      {
        exchange: 'NSE',
        tickSize: 0.01,
        tradingsymbol: '733GS2026-GS',
        coupon: 733,
        maturityDate: '2026-10-30',
        maturityYear: 2026,
        isin: 'test',
      },
      {
        exchange: 'BSE',
        tickSize: 0.05,
        tradingsymbol: '733GS2026-GS',
        coupon: 733,
        maturityDate: '2026-10-30',
        maturityYear: 2026,
        isin: 'test',
      },
      {
        exchange: 'NSE',
        tickSize: 0.01,
        tradingsymbol: '800GS2025-GS',
        coupon: 800,
        maturityDate: '2025-01-15',
        maturityYear: 2025,
        isin: 'expired',
      },
    ],
  });
});

describe('G-Sec target-price API', () => {
  it('prices only seeded securities without loading quotes or changing the live scanner', async () => {
    const response = await gsecsRoute.request('/target-prices?targetYtm=8');
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toMatchObject({
      targetYtm: 8,
      settlementDate: '2026-10-08',
      approvedListFetchedAt: '2026-10-07T09:40:14.226Z',
      prices: { 'NSE:733GS2026-GS': 103.16, 'BSE:733GS2026-GS': 103.15, 'NSE:800GS2025-GS': null },
    });
    expect(data.theoreticalPrices['NSE:733GS2026-GS']).toBeCloseTo(103.1692561862, 8);
    expect(data.theoreticalPrices['BSE:733GS2026-GS']).toBe(data.theoreticalPrices['NSE:733GS2026-GS']);
    expect(data.theoreticalPrices['NSE:800GS2025-GS']).toBeNull();
    expect(mocks.scan).not.toHaveBeenCalled();
    expect(mocks.depth).not.toHaveBeenCalled();
  });

  it('keeps independently requested targets separate', async () => {
    const low = await (await gsecsRoute.request('/target-prices?targetYtm=7.5')).json();
    const high = await (await gsecsRoute.request('/target-prices?targetYtm=8.5')).json();
    expect(low.targetYtm).toBe(7.5);
    expect(high.targetYtm).toBe(8.5);
    expect(low.prices['NSE:733GS2026-GS']).toBeGreaterThan(high.prices['NSE:733GS2026-GS']);
    const original = await (await gsecsRoute.request('/target-prices?targetYtm=8')).json();
    expect(original.prices['NSE:733GS2026-GS']).toBe(103.16);
  });

  it.each(['', '?targetYtm=', '?targetYtm=abc', '?targetYtm=-1', '?targetYtm=100.01', '?targetYtm=Infinity'])(
    'rejects an invalid target %s before reading the catalog',
    async (query) => {
      expect((await gsecsRoute.request(`/target-prices${query}`)).status).toBe(400);
      expect(mocks.catalog).not.toHaveBeenCalled();
    }
  );

  it('accepts zero as a target and reports a stale daily seed', async () => {
    expect((await gsecsRoute.request('/target-prices?targetYtm=0')).status).toBe(200);
    mocks.catalog.mockRejectedValueOnce(new GsecSeedError('Run npm run data:prepare for today, then restart the app.'));
    const response = await gsecsRoute.request('/target-prices?targetYtm=8');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ message: 'Run npm run data:prepare for today, then restart the app.' });
  });
});

describe('G-Sec API boundary', () => {
  it('returns server-calculated custom carry and a partial rating from cached exchange-qualified quotes', async () => {
    const catalog = await mocks.catalog();
    const rows = rankGsecs(
      catalog.securities,
      {
        'NSE:733GS2026-GS': { depth: { sell: [{ price: 103, quantity: 10, orders: 1 }] } },
        'BSE:733GS2026-GS': { depth: { sell: [{ price: 102, quantity: 20, orders: 1 }] } },
      },
      catalog.settlementDate
    );
    mocks.scan.mockResolvedValue({
      rows,
      settlementDate: catalog.settlementDate,
      approvedListFetchedAt: catalog.fetchedAt,
    });
    const response = await gsecsRoute.request(
      '/bond-analytics?exchange=BSE&tradingsymbol=733GS2026-GS&targetYtm=8&customMonths=3.4'
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      exchange: 'BSE',
      tradingsymbol: '733GS2026-GS',
      sellRate: 102,
      targetYtm: 8,
      customMonths: 3.4,
      customCarry: { months: 3.4, effectiveHorizonDate: '2026-10-30', redemptionReceived: 100 },
      customCarryRoll: null,
      rating: { score: null },
    });
    expect(mocks.scan).toHaveBeenLastCalledWith(false);
    expect(mocks.depth).not.toHaveBeenCalled();
    // A fraction that rounds to one day must survive validation unchanged.
    expect(
      (await gsecsRoute.request('/bond-analytics?exchange=BSE&tradingsymbol=733GS2026-GS&customMonths=0.02')).status
    ).toBe(200);
    expect((await gsecsRoute.request('/bond-analytics?exchange=NSE&tradingsymbol=999GS2099-GS')).status).toBe(404);
  });

  it.each([
    'customMonths=0',
    'customMonths=-1',
    'customMonths=1201',
    'customMonths=Infinity',
    'customMonths=',
    'targetYtm=101',
    'exchange=NFO',
  ])('rejects invalid Bond Card inputs %s before loading a scan', async (query) => {
    const response = await gsecsRoute.request(`/bond-analytics?tradingsymbol=733GS2026-GS&${query}`);
    expect(response.status).toBe(400);
    expect(mocks.scan).not.toHaveBeenCalled();
  });

  it('returns custom scenarios from the cached scan without changing the original base', async () => {
    const terms = { coupon: 733, maturityDate: '2026-10-30', settlementDate: '2026-10-08', dirtyPrice: 104.13 };
    const source = {
      scenarioBase: 0,
      settlementDate: terms.settlementDate,
      rows: [{ ...terms, sellRate: terms.dirtyPrice, analytics: calculateGsecAnalytics(terms) }],
    };
    mocks.scan.mockResolvedValue(source);
    const response = await gsecsRoute.request('/?scenarioBase=10');
    expect(response.status).toBe(200);
    const custom = await response.json();
    expect(custom.scenarioBase).toBe(10);
    expect(custom.rows[0].analytics.scenarios.map((item: { shockBp: number }) => item.shockBp)).toEqual([
      -240, -120, -60, -30, -15, 10, 15, 30, 60, 120, 240,
    ]);
    expect(mocks.scan).toHaveBeenLastCalledWith(false);
    expect(mocks.depth).not.toHaveBeenCalled();
    expect(mocks.catalog).not.toHaveBeenCalled();
    expect(source.scenarioBase).toBe(0);
    expect((await (await gsecsRoute.request('/')).json()).scenarioBase).toBe(0);
  });

  it.each(['', 'abc', 'Infinity', '1e308'])('rejects invalid scenario base %s before requesting data', async (base) => {
    expect((await gsecsRoute.request(`/?scenarioBase=${base}`)).status).toBe(400);
    expect(mocks.scan).not.toHaveBeenCalled();
  });

  it('requests cached live data by default and a full snapshot only for explicit refresh', async () => {
    expect((await gsecsRoute.request('/')).status).toBe(200);
    expect(mocks.scan).toHaveBeenLastCalledWith(false);
    expect((await gsecsRoute.request('/?refresh=true')).status).toBe(200);
    expect(mocks.scan).toHaveBeenLastCalledWith(true);
    expect((await gsecsRoute.request('/?refresh=false')).status).toBe(400);
  });

  it('explains when the shared ticker has no room for the requested instruments', async () => {
    const message =
      'Kite ticker limit exceeded: 3001 instruments requested; maximum is 3000. Reduce the option-chain selection.';
    mocks.scan.mockRejectedValueOnce(new Error(message));
    const response = await gsecsRoute.request('/');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message });
  });

  it('requires a Kite login and returns a useful JSON error', async () => {
    mocks.token = '';
    const response = await gsecsRoute.request('/');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ message: 'Kite access token missing. Run npm run login first.' });
    expect(mocks.scan).not.toHaveBeenCalled();
  });

  it('returns a data-source error without leaking the upstream error', async () => {
    mocks.scan.mockRejectedValueOnce(new Error('private upstream details'));
    const response = await gsecsRoute.request('/');
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      message: 'Could not refresh G-Sec data. Check the Kite login and run npm run data:prepare, then restart the app.',
    });
  });

  it('shows an actionable error when daily G-Sec data has not been prepared', async () => {
    const message = 'G-Sec data has not been seeded. Run npm run data:prepare, then restart the app.';
    mocks.scan.mockRejectedValueOnce(new GsecSeedError(message));
    const response = await gsecsRoute.request('/');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ message });
  });

  it('validates depth symbols and rejects non-approved securities', async () => {
    expect((await gsecsRoute.request('/depth?tradingsymbol=RELIANCE')).status).toBe(400);
    expect(mocks.depth).not.toHaveBeenCalled();
    const response = await gsecsRoute.request('/depth?tradingsymbol=750GS2056-GS');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: 'This G-Sec is not currently approved for pledging.' });
    expect(mocks.depth).toHaveBeenLastCalledWith('750GS2056-GS', 'NSE');
  });

  it('accepts BSE names only through the approved exchange-specific depth lookup', async () => {
    mocks.depth.mockResolvedValueOnce({ exchange: 'BSE', tradingsymbol: '709GOI54', sell: [], fetchedAt: 'now' });
    const response = await gsecsRoute.request('/depth?exchange=BSE&tradingsymbol=709GOI54');
    expect(response.status).toBe(200);
    expect(mocks.depth).toHaveBeenLastCalledWith('709GOI54', 'BSE');
    expect(await response.json()).toMatchObject({ exchange: 'BSE', tradingsymbol: '709GOI54' });
    expect((await gsecsRoute.request('/depth?exchange=BSE&tradingsymbol=RELIANCE')).status).toBe(404);
    expect((await gsecsRoute.request('/depth?exchange=NSE&tradingsymbol=709GOI54')).status).toBe(400);
    expect((await gsecsRoute.request('/depth?exchange=NFO&tradingsymbol=709GOI54')).status).toBe(400);
  });

  it('identifies a rejected Kite token so the user can refresh the login', async () => {
    mocks.scan.mockRejectedValueOnce({ error_type: 'TokenException', message: 'Incorrect api_key or access_token.' });
    const response = await gsecsRoute.request('/');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      message: 'Kite login is invalid or expired. Run npm run login and restart the server.',
    });
  });
});
