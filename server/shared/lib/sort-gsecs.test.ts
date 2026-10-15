import { sortGsecRows, type GsecSortColumn } from '@shared/lib/sort-gsecs';
import type { GsecRow } from '@shared/types/gsecs';
import { describe, expect, it } from 'vitest';

function row(symbol: string, value: number, maturityDate: string, relativeValue: 'CHEAP' | 'FAIR' | 'RICH'): GsecRow {
  return {
    exchange: 'NSE',
    tradingsymbol: symbol,
    isin: symbol,
    coupon: 709,
    maturityDate,
    maturityYear: Number(maturityDate.slice(0, 4)),
    tickSize: 0.01,
    sellRate: value,
    rrr: value,
    bestRrrRank: value,
    distanceFromFv: value,
    nearFvRank: value,
    quoteStatus: 'ready',
    quoteUpdatedAt: null,
    masterDataStatus: 'ready',
    sellerDepth: [],
    curveUnavailableReason: null,
    analytics: {
      ytm: value,
      nextCouponDate: maturityDate,
      remainingCoupons: 1,
      carry: [],
      scenarios: [],
      risk: { macaulayDuration: value, modifiedDuration: value, dv01: value, convexity: value },
    },
    curveAnalytics: {
      snapshotId: 'test',
      fairDirtyPrice: 100,
      fairYtm: value,
      spreadBp: value,
      zSpreadBp: value,
      relativeValue,
      priceAdvantage: 0,
      maturityTenor: value,
      carryRoll: [],
    },
  };
}
const low = row('GS2', 2.2, '2028-01-15', 'CHEAP');
const high = row('GS10', 12.2, '2027-02-15', 'RICH');
const missing: GsecRow = {
  ...row('Missing', 0, '2054-08-05', 'FAIR'),
  bestRrrRank: null,
  sellRate: null,
  rrr: null,
  analytics: null,
  curveAnalytics: null,
};
const numerical: GsecSortColumn[] = [
  'rank',
  'sellRate',
  'ytm',
  'buyRate',
  'modifiedDuration',
  'dv01',
  'convexity',
  'curveSpread',
  'zSpread',
];

describe('G-Sec table sorting', () => {
  it('sorts absolute Z-spreads both ways, preserving the signs and keeping missing values last', () => {
    const rows = [-5.67, 3.12, -2.34, 0.41, 0, 7.84].map((spread, index) => ({
      ...row(`GS${index}`, index + 1, '2054-01-15', 'FAIR'),
      curveAnalytics: { ...low.curveAnalytics!, zSpreadBp: spread },
    }));
    const spreads = (descending: boolean) =>
      sortGsecRows([...rows, missing], { column: 'zSpread', descending }).map(
        (item) => item.curveAnalytics?.zSpreadBp ?? null
      );
    expect(spreads(false)).toEqual([0, 0.41, -2.34, 3.12, -5.67, 7.84, null]);
    expect(spreads(true)).toEqual([7.84, -5.67, 3.12, -2.34, 0.41, 0, null]);
    expect(rows.map((item) => item.curveAnalytics.zSpreadBp)).toEqual([-5.67, 3.12, -2.34, 0.41, 0, 7.84]);
  });
  it.each([...numerical, 'relativeValue' as const])('sorts %s both ways with missing values last', (column) => {
    const rows = [missing, high, low];
    const prices = { 'NSE:GS2': 2.2, 'NSE:GS10': 12.2 };
    expect(sortGsecRows(rows, { column, descending: false }, prices)).toEqual([low, high, missing]);
    expect(sortGsecRows(rows, { column, descending: true }, prices)).toEqual([high, low, missing]);
    expect(rows).toEqual([missing, high, low]);
  });

  it('uses chronological maturity dates', () => {
    expect(sortGsecRows([low, high], { column: 'maturity', descending: false })).toEqual([high, low]);
    expect(sortGsecRows([low, high], { column: 'maturity', descending: true })).toEqual([low, high]);
  });

  it('orders RV as CHEAP, FAIR, RICH and breaks category ties by RRR rank', () => {
    const fair = row('Fair', 3, '2054-08-05', 'FAIR');
    const cheap = row('Cheap', 1, '2054-08-05', 'CHEAP');
    expect(sortGsecRows([high, low, fair, cheap], { column: 'relativeValue', descending: false })).toEqual([
      cheap,
      low,
      fair,
      high,
    ]);
    expect(sortGsecRows([high, low, fair, cheap], { column: 'relativeValue', descending: true })).toEqual([
      high,
      fair,
      cheap,
      low,
    ]);
  });

  it('uses exchange-qualified target ceilings and reorders when the target data changes', () => {
    const bse = { ...low, exchange: 'BSE' as const };
    const sort = { column: 'buyRate' as const, descending: false };
    expect(sortGsecRows([low, bse], sort, { 'NSE:GS2': 103.16, 'BSE:GS2': 103.15 })).toEqual([bse, low]);
    expect(sortGsecRows([low, bse], sort, { 'NSE:GS2': 100, 'BSE:GS2': 101 })).toEqual([low, bse]);
  });

  it('sorts unrounded values, signed yields/spreads and legitimate zeros', () => {
    const preciseLow = { ...low, rrr: -1, curveAnalytics: { ...low.curveAnalytics!, spreadBp: -0.00404 } };
    const preciseHigh = { ...high, rrr: 0, curveAnalytics: { ...high.curveAnalytics!, spreadBp: -0.00403 } };
    expect(sortGsecRows([preciseHigh, preciseLow, missing], { column: 'ytm', descending: false })).toEqual([
      preciseLow,
      preciseHigh,
      missing,
    ]);
    expect(sortGsecRows([preciseLow, preciseHigh, missing], { column: 'curveSpread', descending: true })).toEqual([
      preciseHigh,
      preciseLow,
      missing,
    ]);
  });
});
