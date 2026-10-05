import { GsecSeedError } from '@server/lib/services/approved-gsecs';
import { gsecsRoute } from '@server/routes/gsecs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ scan: vi.fn(), depth: vi.fn(), token: 'test-token', logger: vi.fn() }));
vi.mock('@server/lib/services/gsec-scanner', () => ({ scanGsecs: mocks.scan, getGsecDepth: mocks.depth }));
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
