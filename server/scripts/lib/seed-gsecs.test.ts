import { fetchGsecSeed } from '@server/scripts/lib/seed-gsecs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const approved = {
  symbol: '75GS2034',
  isin: 'IN0020230036',
  security_type: 'Government Securities',
  is_unapproved: 0,
  limit_breached: false,
};
const instruments = [{ exchange: 'NSE' as const, tradingsymbol: '75GS2034-GS', instrument_token: '1' }];
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-05T05:00:00Z'));
  fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify([approved])));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('daily G-Sec seed preparation', () => {
  it('fetches once per seed, reuses the supplied NSE instruments and stores normalized coupons and tokens', async () => {
    expect(await fetchGsecSeed(instruments)).toEqual({
      securities: [
        { tradingsymbol: '75GS2034-GS', instrumentToken: 1, coupon: 750, maturityYear: 2034, isin: approved.isin },
      ],
      fetchedAt: '2026-10-05T05:00:00.000Z',
      day: '2026-10-05',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await fetchGsecSeed(instruments);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('can seed an empty pledgeable list and excludes securities that cannot be pledged', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { ...approved, is_unapproved: 1 },
          { ...approved, symbol: '680GS2060', limit_breached: true },
          { ...approved, symbol: 'RELIANCE', security_type: 'Equity' },
        ])
      )
    );
    expect((await fetchGsecSeed([])).securities).toEqual([]);
  });

  it('rejects missing, invalid or non-NSE tokens instead of seeding a partial list', async () => {
    await expect(fetchGsecSeed([])).rejects.toThrow('75GS2034-GS');
    await expect(fetchGsecSeed([{ ...instruments[0]!, instrument_token: 'NaN' }])).rejects.toThrow(
      'valid NSE instrument token'
    );
    await expect(fetchGsecSeed([{ ...instruments[0]!, exchange: 'BSE' }])).rejects.toThrow(
      'valid NSE instrument token'
    );
  });

  it('does not accept upstream HTTP failures or a malformed approved list', async () => {
    fetchMock.mockResolvedValueOnce(new Response('error', { status: 503 }));
    await expect(fetchGsecSeed(instruments)).rejects.toThrow('503');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [approved] })));
    await expect(fetchGsecSeed(instruments)).rejects.toThrow();
  });

  it('records the IST seed date rather than the UTC date', async () => {
    vi.setSystemTime(new Date('2026-10-05T18:31:00Z'));
    expect((await fetchGsecSeed(instruments)).day).toBe('2026-10-06');
  });
});
