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
  rows: [],
  sourceUrl: 'https://zerodha.com/approved-securities/',
  approvedListFetchedAt: '2026-10-05T05:00:00Z',
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
});
