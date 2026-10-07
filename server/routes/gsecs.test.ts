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
      { tradingsymbol: '733GS2026-GS', coupon: 733, maturityDate: '2026-10-30', maturityYear: 2026, isin: 'test' },
      { tradingsymbol: '800GS2025-GS', coupon: 800, maturityDate: '2025-01-15', maturityYear: 2025, isin: 'expired' },
    ],
  });
});

describe('G-Sec target-price API', () => {
  it('prices only seeded securities without loading quotes or changing the live scanner', async () => {
    const response = await gsecsRoute.request('/target-prices?targetYtm=8');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      targetYtm: 8,
      settlementDate: '2026-10-08',
      approvedListFetchedAt: '2026-10-07T09:40:14.226Z',
      prices: { '733GS2026-GS': 103.16, '800GS2025-GS': null },
    });
    expect(mocks.scan).not.toHaveBeenCalled();
    expect(mocks.depth).not.toHaveBeenCalled();
  });

  it('keeps independently requested targets separate', async () => {
    const low = await (await gsecsRoute.request('/target-prices?targetYtm=7.5')).json();
    const high = await (await gsecsRoute.request('/target-prices?targetYtm=8.5')).json();
    expect(low.targetYtm).toBe(7.5);
    expect(high.targetYtm).toBe(8.5);
    expect(low.prices['733GS2026-GS']).toBeGreaterThan(high.prices['733GS2026-GS']);
    const original = await (await gsecsRoute.request('/target-prices?targetYtm=8')).json();
    expect(original.prices['733GS2026-GS']).toBe(103.16);
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
