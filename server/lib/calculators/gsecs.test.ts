import { getGsecSellerDepth, parseGsecSymbol, rankGsecs } from '@server/lib/calculators/gsecs';
import { formatGsecRrr } from '@shared/lib/format-gsec-rrr';
import type { GsecListing } from '@shared/types/gsecs';
import { describe, expect, it } from 'vitest';

function security(symbol: string): GsecListing {
  const parsed = parseGsecSymbol(symbol)!;
  return { ...parsed, exchange: 'NSE', tickSize: 0.01, isin: symbol, maturityDate: `${parsed.maturityYear}-01-15` };
}
const settlementDate = '2026-01-15';

describe('G-Sec coupon parsing', () => {
  it.each([
    ['750GS2056-GS', 750, 2056],
    ['680GS2060-GS', 680, 2060],
    ['1018GS2026-GS', 1018, 2026],
    ['68GS2060', 680, 2060],
    ['75GS2034-GS', 750, 2034],
    ['657GS2033A', 657, 2033],
    ['725GR2028', 725, 2028],
  ])('reads %s', (symbol, coupon, maturityYear) => {
    expect(parseGsecSymbol(symbol)).toMatchObject({ coupon, maturityYear });
  });

  it.each(['RELIANCE', 'SGBSEP31II-GB', '182D070126-TB', 'GS2056', '750GS2056-EQ'])('rejects %s', (symbol) => {
    expect(parseGsecSymbol(symbol)).toBeNull();
  });
});

describe('G-Sec rankings', () => {
  it('ranks the same bond separately per exchange, including identical symbols, and shares exact yield ties', () => {
    const nse = security('750GS2028');
    const bse = { ...nse, exchange: 'BSE' as const, tickSize: 0.05 };
    const quotes = {
      'NSE:750GS2028-GS': { depth: { sell: [{ price: 100, quantity: 1, orders: 1 }] } },
      'BSE:750GS2028-GS': { depth: { sell: [{ price: 99, quantity: 3, orders: 2 }] } },
    };
    const rows = rankGsecs([nse, bse], quotes, settlementDate);
    expect(rows.map(({ exchange, sellRate, bestRrrRank }) => ({ exchange, sellRate, bestRrrRank }))).toEqual([
      { exchange: 'BSE', sellRate: 99, bestRrrRank: 1 },
      { exchange: 'NSE', sellRate: 100, bestRrrRank: 2 },
    ]);
    expect(rows[0]?.sellerDepth).toEqual([{ price: 99, quantity: 3, orders: 2 }]);
    const tied = rankGsecs([nse, bse], { ...quotes, 'BSE:750GS2028-GS': quotes['NSE:750GS2028-GS'] }, settlementDate);
    expect(tied.map((row) => row.bestRrrRank)).toEqual([1, 1]);
    const missing = rankGsecs([nse, bse], { 'NSE:750GS2028-GS': quotes['NSE:750GS2028-GS'] }, settlementDate);
    expect(missing.find((row) => row.exchange === 'BSE')).toMatchObject({
      sellRate: null,
      quoteStatus: 'unavailable',
      bestRrrRank: null,
    });
  });
  it('ranks quoted YTM using only the lowest seller’s dirty price, ignoring buyers and LTP', () => {
    const securities = ['750GS2028', '680GS2028', '1018GS2028', '720GS2028', '825GS2028'].map(security);
    const prices = [100, 100, 100, 100, 100];
    const quotes = Object.fromEntries(
      securities.map((row, index) => [
        `NSE:${row.tradingsymbol}`,
        {
          last_price: 1,
          depth: {
            buy: [{ price: 1, quantity: 10, orders: 1 }],
            sell: [{ price: prices[index]!, quantity: 10, orders: 1 }],
          },
        },
      ])
    );
    const rows = rankGsecs(securities, quotes, settlementDate);
    expect(rows.map((row) => row.coupon)).toEqual([1018, 825, 750, 720, 680]);
    expect(rows.map((row) => formatGsecRrr(row.rrr!))).toEqual([
      '10.1800%',
      '8.2500%',
      '7.5000%',
      '7.2000%',
      '6.8000%',
    ]);
    expect(rows.map((row) => row.bestRrrRank)).toEqual([1, 2, 3, 4, 5]);
    expect(rows.every((row) => row.nearFvRank === 1)).toBe(true);
  });

  it('leaves missing, zero and empty seller quotes unranked without a bid or LTP fallback', () => {
    const securities = ['750GS2056', '680GS2060', '720GS2034'].map(security);
    const rows = rankGsecs(
      securities,
      {
        'NSE:750GS2056-GS': { depth: { sell: [{ price: 100, quantity: 0, orders: 0 }] } },
        'NSE:680GS2060-GS': { depth: { sell: [{ price: 0, quantity: 10, orders: 1 }] } },
      },
      settlementDate
    );
    expect(
      rows.every(
        (row) => row.rrr === null && row.sellRate === null && row.bestRrrRank === null && row.nearFvRank === null
      )
    ).toBe(true);
    expect(rows.find((row) => row.coupon === 720)?.quoteStatus).toBe('unavailable');
    expect(rows.find((row) => row.coupon === 750)?.quoteStatus).toBe('no-sellers');
  });

  it('ranks equal distances above and below face value equally', () => {
    const securities = ['750GS2056', '680GS2060', '720GS2034', '825GS2035'].map(security);
    const quotes = Object.fromEntries(
      securities.map((row, index) => [
        `NSE:${row.tradingsymbol}`,
        { depth: { sell: [{ price: [100.05, 99.9, 100.1, 98][index]!, quantity: 10, orders: 1 }] } },
      ])
    );
    const rows = rankGsecs(securities, quotes, settlementDate);
    expect(rows.find((row) => row.coupon === 750)?.nearFvRank).toBe(1);
    expect(rows.find((row) => row.coupon === 680)?.nearFvRank).toBe(2);
    expect(rows.find((row) => row.coupon === 720)?.nearFvRank).toBe(2);
    expect(rows.find((row) => row.coupon === 825)?.nearFvRank).toBe(4);
  });

  it('ranks unrounded RRR values even when display values are identical', () => {
    const securities = ['750GS2056', '750GS2056A'].map(security);
    const rows = rankGsecs(
      securities,
      {
        'NSE:750GS2056-GS': { depth: { sell: [{ price: 100.50001, quantity: 1, orders: 1 }] } },
        'NSE:750GS2056A-GS': { depth: { sell: [{ price: 100.50002, quantity: 1, orders: 1 }] } },
      },
      settlementDate
    );
    expect(rows[0]?.rrr?.toFixed(4)).toBe(rows[1]?.rrr?.toFixed(4));
    expect(rows.map((row) => row.bestRrrRank)).toEqual([1, 2]);
    expect(rows[0]?.tradingsymbol).toBe('750GS2056-GS');
  });

  it('leaves expired bonds without a YTM rank while retaining their Near FV rank', () => {
    const rows = rankGsecs(
      ['750GS2025', '750GS2028'].map(security),
      {
        'NSE:750GS2025-GS': { depth: { sell: [{ price: 100, quantity: 1, orders: 1 }] } },
        'NSE:750GS2028-GS': { depth: { sell: [{ price: 101, quantity: 1, orders: 1 }] } },
      },
      settlementDate
    );
    expect(rows[0]?.tradingsymbol).toBe('750GS2028-GS');
    expect(rows[1]).toMatchObject({ rrr: null, bestRrrRank: null, nearFvRank: 1 });
  });

  it('returns only the five cheapest valid seller levels', () => {
    const levels = [105, 0, 102, 101, 104, 103, 106, NaN, Infinity].map((price) => ({
      price,
      quantity: 10,
      orders: 1,
    }));
    levels.push({ price: 99, quantity: 0, orders: 0 });
    expect(getGsecSellerDepth(levels).map((row) => row.price)).toEqual([101, 102, 103, 104, 105]);
    expect(levels[0]?.price).toBe(105);
  });
});
