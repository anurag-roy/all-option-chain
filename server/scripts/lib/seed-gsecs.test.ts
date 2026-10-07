import { fetchGsecSeed } from '@server/scripts/lib/seed-gsecs';
import { strToU8, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const approved = {
  symbol: '75GS2034',
  isin: 'IN0020040039',
  security_type: 'Government Securities',
  is_unapproved: 0,
  limit_breached: false,
};
const instruments = [
  {
    exchange: 'NSE' as const,
    tradingsymbol: '75GS2034-GS',
    instrument_token: '1',
    exchange_token: '1',
    tick_size: 0.01,
  },
];
let fetchMock: ReturnType<typeof vi.fn>;
const master =
  'SYMBOL,NAME OF COMPANY,SERIES,FACE VALUE,IP RATE,REDEMPTION DATE,ISIN\n676GS2061,Government of India,GS,100,6.76,22-FEB-2061,IN0020200401\n';
const bseCsv =
  'FinInstrmId,TckrSymb,SctySrs,ISIN,ParVal,SctyTpFlg,BidIntrvl,Xchg,Sts,FinInstrmTp\n800002,75GOI34,G,IN0020040039,10000,GS,0.05,BSE,A,D\n';
const bseZip = zipSync({ 'SCRIP/BSE_EQ_SCRIP_05102026.csv': strToU8(bseCsv) });
const calendar = { CM: [{ tradingDate: '02-Oct-2026' }, { tradingDate: '25-Dec-2026' }] };
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-05T05:00:00Z'));
  fetchMock = vi
    .fn()
    .mockImplementation(
      async (url: string) =>
        new Response(
          url.includes('approved-securities')
            ? JSON.stringify([approved])
            : url.includes('SCRIP.zip')
              ? new Uint8Array(bseZip)
              : url.includes('DEBT.csv')
                ? master
                : JSON.stringify(calendar)
        )
    );
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('daily G-Sec seed preparation', () => {
  it('adds available BSE counterparts by ISIN using exactly the resolved NSE bond terms', async () => {
    const result = await fetchGsecSeed(instruments, [
      { exchange: 'BSE', exchange_token: '800002', instrument_token: '2', tradingsymbol: '75GOI34', tick_size: 0.05 },
    ]);
    expect(result.securities).toHaveLength(2);
    expect(result.securities[1]).toEqual({
      ...result.securities[0],
      exchange: 'BSE',
      tradingsymbol: '75GOI34',
      instrumentToken: 2,
      tickSize: 0.05,
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('aborts on BSE metadata failure or a bad NSE tick before producing a daily snapshot', async () => {
    await expect(fetchGsecSeed([{ ...instruments[0]!, tick_size: 0 }], [])).rejects.toThrow('valid NSE tick size');
    const original = fetchMock.getMockImplementation() as (url: string) => Promise<Response>;
    fetchMock.mockImplementation((url: string) =>
      url.includes('SCRIP.zip') ? Promise.resolve(new Response('error', { status: 503 })) : original(url)
    );
    await expect(fetchGsecSeed(instruments, [])).rejects.toThrow('503');
  });
  it('fetches metadata only at seed time, reuses NSE instruments, and includes verified legacy terms and settlement', async () => {
    expect(await fetchGsecSeed(instruments, [])).toEqual({
      securities: [
        {
          tradingsymbol: '75GS2034-GS',
          instrumentToken: 1,
          exchange: 'NSE',
          tickSize: 0.01,
          coupon: 750,
          maturityYear: 2034,
          isin: approved.isin,
          maturityDate: '2034-08-10',
        },
      ],
      fetchedAt: '2026-10-05T05:00:00.000Z',
      day: '2026-10-05',
      tradeDate: '2026-10-05',
      settlementDate: '2026-10-06',
    });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    await fetchGsecSeed(instruments, []);
    expect(fetchMock).toHaveBeenCalledTimes(10);
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
    expect((await fetchGsecSeed([], [])).securities).toEqual([]);
  });

  it('rejects missing, invalid or non-NSE tokens instead of seeding a partial list', async () => {
    await expect(fetchGsecSeed([], [])).rejects.toThrow('75GS2034-GS');
    await expect(fetchGsecSeed([{ ...instruments[0]!, instrument_token: 'NaN' }], [])).rejects.toThrow(
      'valid NSE instrument token'
    );
    await expect(fetchGsecSeed([{ ...instruments[0]!, exchange: 'BSE' }], [])).rejects.toThrow(
      'valid NSE instrument token'
    );
  });

  it('does not accept upstream HTTP failures or a malformed approved list', async () => {
    fetchMock.mockResolvedValueOnce(new Response('error', { status: 503 }));
    await expect(fetchGsecSeed(instruments, [])).rejects.toThrow('503');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: [approved] })));
    await expect(fetchGsecSeed(instruments, [])).rejects.toThrow();
  });

  it('records the IST seed date rather than the UTC date', async () => {
    vi.setSystemTime(new Date('2026-10-05T18:31:00Z'));
    expect((await fetchGsecSeed(instruments, [])).day).toBe('2026-10-06');
  });

  it('uses exact maturity terms from the daily NSE master for newer issues', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([{ ...approved, symbol: '676GS2061', isin: 'IN0020200401' }]))
    );
    const result = await fetchGsecSeed([{ ...instruments[0]!, tradingsymbol: '676GS2061-GS' }], []);
    expect(result.securities[0]).toMatchObject({ coupon: 676, maturityDate: '2061-02-22' });
  });

  it('does not silently seed unknown bond terms or a missing settlement calendar', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([{ ...approved, isin: 'IN0000000000' }])));
    await expect(fetchGsecSeed(instruments, [])).rejects.toThrow('Missing verified maturity date');
    fetchMock.mockImplementation(
      async (url: string) =>
        new Response(
          url.includes('approved-securities')
            ? JSON.stringify([approved])
            : url.includes('SCRIP.zip')
              ? new Uint8Array(bseZip)
              : url.includes('DEBT.csv')
                ? master
                : JSON.stringify({ CM: [] })
        )
    );
    await expect(fetchGsecSeed(instruments, [])).rejects.toThrow();
  });
});
