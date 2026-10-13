import { calculateGsecAnalytics } from '@server/lib/calculators/gsec-analytics';
import type { GsecScan } from '@shared/types/gsecs';
import type { WSContext } from 'hono/ws';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientBroadcaster } from './client-broadcaster';

const mocks = vi.hoisted(() => ({ snapshot: vi.fn(), refresh: vi.fn() }));
vi.mock('@server/lib/services/gsec-scanner', () => ({
  gsecScanner: { getCachedSnapshot: mocks.snapshot, refresh: mocks.refresh },
}));
vi.mock('@server/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const snapshot: GsecScan = {
  scenarioBase: 0,
  rows: [],
  sourceUrl: 'https://zerodha.com/approved-securities/',
  approvedListFetchedAt: '2026-10-05T05:00:00Z',
  tradeDate: '2026-10-05',
  settlementDate: '2026-10-06',
  quotesFetchedAt: '2026-10-05T05:00:00Z',
  revision: 1,
  streamStatus: 'live',
};
let broadcaster: ClientBroadcaster;
beforeEach(() => {
  broadcaster = new ClientBroadcaster();
  mocks.snapshot.mockReset().mockReturnValue(snapshot);
  mocks.refresh.mockReset().mockResolvedValue(snapshot);
});
function client() {
  const send = vi.fn();
  const id = broadcaster.handleOpen({ send } as unknown as WSContext);
  return { send, id };
}

describe('G-Sec browser subscriptions', () => {
  it('sends the latest snapshot on subscribe and updates only interested browsers', async () => {
    const interested = client();
    const chainOnly = client();
    broadcaster.publishGsecs(snapshot);
    expect(interested.send).not.toHaveBeenCalled();
    expect(chainOnly.send).not.toHaveBeenCalled();
    await broadcaster.handleMessage(interested.id, JSON.stringify({ type: 'subscribeGsecs', enabled: true }));
    expect(JSON.parse(interested.send.mock.calls[0]![0])).toEqual({ type: 'gsecs', data: snapshot });
    const next = { ...snapshot, revision: 2 };
    broadcaster.publishGsecs(next);
    expect(JSON.parse(interested.send.mock.calls[1]![0])).toEqual({ type: 'gsecs', data: next });
    expect(chainOnly.send).not.toHaveBeenCalled();
    await broadcaster.handleMessage(interested.id, JSON.stringify({ type: 'subscribeGsecs', enabled: false }));
    broadcaster.publishGsecs(next);
    expect(interested.send).toHaveBeenCalledTimes(2);
  });

  it('starts an uncached scanner after a server restart and rejects malformed subscription messages', async () => {
    const valid = client();
    const invalid = client();
    mocks.snapshot.mockReturnValue(null);
    await broadcaster.handleMessage(valid.id, JSON.stringify({ type: 'subscribeGsecs', enabled: true }));
    await broadcaster.handleMessage(invalid.id, JSON.stringify({ type: 'subscribeGsecs', enabled: 'true' }));
    expect(mocks.refresh).toHaveBeenCalledExactlyOnceWith(true);
    broadcaster.publishGsecs(snapshot);
    expect(valid.send).toHaveBeenCalledTimes(1);
    expect(invalid.send).not.toHaveBeenCalled();
    broadcaster.handleClose(valid.id);
    broadcaster.publishGsecs(snapshot);
    expect(valid.send).toHaveBeenCalledTimes(1);
  });

  it('keeps bases independent, applies a change immediately, and reprices live seller changes without a quote request', async () => {
    const row = {
      exchange: 'NSE' as const,
      tradingsymbol: '709GS2054-GS',
      isin: 'test',
      coupon: 709,
      maturityYear: 2054,
      maturityDate: '2054-08-05',
      tickSize: 0.01,
      sellRate: 95.3,
      rrr: 7.6,
      analytics: calculateGsecAnalytics({
        coupon: 709,
        maturityDate: '2054-08-05',
        settlementDate: snapshot.settlementDate,
        dirtyPrice: 95.3,
      }),
      curveAnalytics: null,
      curveUnavailableReason: null,
      bestRrrRank: 1,
      distanceFromFv: 4.7,
      nearFvRank: 1,
      quoteStatus: 'ready' as const,
      quoteUpdatedAt: snapshot.quotesFetchedAt,
      masterDataStatus: 'ready' as const,
      sellerDepth: [{ price: 95.3, quantity: 10, orders: 1 }],
    };
    const source = { ...snapshot, rows: [row] };
    mocks.snapshot.mockReturnValue(source);
    const custom = client();
    const ordinary = client();
    await broadcaster.handleMessage(
      custom.id,
      JSON.stringify({ type: 'subscribeGsecs', enabled: true, scenarioBase: 10 })
    );
    await broadcaster.handleMessage(ordinary.id, JSON.stringify({ type: 'subscribeGsecs', enabled: true }));
    const customData = JSON.parse(custom.send.mock.calls[0]![0]).data;
    expect(customData.scenarioBase).toBe(10);
    expect(customData.rows[0].analytics.scenarios.map((item: { shockBp: number }) => item.shockBp)).toEqual([
      -240, -120, -60, -30, -15, 10, 15, 30, 60, 120, 240,
    ]);
    expect(JSON.parse(ordinary.send.mock.calls[0]![0]).data).toEqual(source);
    expect(source.rows[0]!.analytics!.scenarios[5]!.shockBp).toBe(0);

    const next = {
      ...source,
      revision: 2,
      rows: [
        {
          ...row,
          sellRate: 96,
          analytics: calculateGsecAnalytics({
            coupon: 709,
            maturityDate: row.maturityDate,
            settlementDate: snapshot.settlementDate,
            dirtyPrice: 96,
          }),
        },
      ],
    };
    broadcaster.publishGsecs(next);
    const updated = JSON.parse(custom.send.mock.calls[1]![0]).data;
    expect(updated.scenarioBase).toBe(10);
    expect(updated.rows[0].analytics.scenarios[5].dirtyPrice).not.toBe(
      customData.rows[0].analytics.scenarios[5].dirtyPrice
    );
    expect(JSON.parse(ordinary.send.mock.calls[1]![0]).data).toEqual(next);
    await broadcaster.handleMessage(
      custom.id,
      JSON.stringify({ type: 'subscribeGsecs', enabled: true, scenarioBase: 0 })
    );
    expect(JSON.parse(custom.send.mock.calls[2]![0]).data).toEqual(source);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it.each(['10', null, 1e308])('rejects an invalid scenario base %s before subscribing', async (scenarioBase) => {
    const invalid = client();
    await broadcaster.handleMessage(
      invalid.id,
      JSON.stringify({ type: 'subscribeGsecs', enabled: true, scenarioBase })
    );
    broadcaster.publishGsecs(snapshot);
    expect(invalid.send).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
