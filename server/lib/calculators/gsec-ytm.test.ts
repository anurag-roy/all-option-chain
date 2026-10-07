import {
  calculateGsecDirtyPrice,
  calculateGsecMaxBuyPrice,
  calculateGsecYtm,
  parseBondDate,
} from '@server/lib/calculators/gsec-ytm';
import { describe, expect, it } from 'vitest';

const base = { coupon: 800, settlementDate: '2026-01-15', maturityDate: '2028-01-15' };
const priceAtSixPercent = (coupon: number, count: number, fraction = 1) =>
  Array.from({ length: count }, (_, i) => coupon / 200 / 1.03 ** (fraction + i)).reduce((a, b) => a + b, 0) +
  100 / 1.03 ** (fraction + count - 1);

describe('quoted semiannual G-Sec YTM', () => {
  it('recovers a known 3% half-year yield as 6% quoted annual YTM', () => {
    expect(calculateGsecYtm({ ...base, dirtyPrice: priceAtSixPercent(800, 4) })).toBeCloseTo(6, 10);
  });

  it('reproduces the conversation, but does not add interest to an NSE dirty price', () => {
    const bond = { coupon: 676, settlementDate: '2026-10-06', maturityDate: '2061-02-22' };
    expect(calculateGsecYtm({ ...bond, dirtyPrice: 90.2374 })).toBeCloseTo(7.6339793917, 8);
    expect(calculateGsecYtm({ ...bond, dirtyPrice: 89.43 })).toBeCloseTo(7.707906204, 8);
  });

  it('accounts for the shorter time to absorb a premium before redemption', () => {
    const bond = { coupon: 900, dirtyPrice: 109, settlementDate: '2026-10-06' };
    const short = calculateGsecYtm({ ...bond, maturityDate: '2028-10-06' })!;
    const long = calculateGsecYtm({ ...bond, maturityDate: '2036-10-06' })!;
    expect(short).toBeLessThan(long);
    expect(long).toBeLessThan(900 / 109);
  });

  it('uses 30E/360 fractional periods and anchors February dates without schedule drift', () => {
    expect(
      calculateGsecYtm({
        coupon: 800,
        settlementDate: '2026-03-15',
        maturityDate: '2028-08-31',
        dirtyPrice: priceAtSixPercent(800, 5, 165 / 180),
      })
    ).toBeCloseTo(6, 10);
    expect(
      calculateGsecYtm({
        coupon: 800,
        settlementDate: '2026-02-28',
        maturityDate: '2028-08-31',
        dirtyPrice: priceAtSixPercent(800, 5, 182 / 180),
      })
    ).toBeCloseTo(6, 10);
  });

  it('excludes a coupon on the settlement date and starts at the following coupon', () => {
    expect(calculateGsecYtm({ ...base, dirtyPrice: 100 })).toBeCloseTo(8, 10);
  });

  it('supports negative yields and yields above the example solver’s 30% limit', () => {
    expect(calculateGsecYtm({ ...base, dirtyPrice: 200 })).toBeLessThan(0);
    expect(calculateGsecYtm({ ...base, dirtyPrice: 1 })).toBeGreaterThan(30);
    expect(calculateGsecYtm({ ...base, coupon: 0, maturityDate: '2027-01-15', dirtyPrice: 90 })).toBeCloseTo(
      200 * (Math.sqrt(100 / 90) - 1),
      10
    );
  });

  it.each([
    { dirtyPrice: 0 },
    { dirtyPrice: NaN },
    { dirtyPrice: Infinity },
    { coupon: -1 },
    { settlementDate: '2026-02-30' },
    { maturityDate: '2061' },
    { maturityDate: base.settlementDate },
    { maturityDate: '2025-01-15' },
  ])('leaves invalid or matured bonds without a yield: %j', (invalid) => {
    expect(calculateGsecYtm({ ...base, dirtyPrice: 100, ...invalid })).toBeNull();
  });

  it('validates real leap days instead of rolling invalid dates forward', () => {
    expect(parseBondDate('2028-02-29')).not.toBeNull();
    expect(parseBondDate('2026-02-29')).toBeNull();
  });
});

describe('target-YTM dirty buy-price ceilings', () => {
  // All 18 examples in target_ytm_8pct_tech_note (1).pdf, using T+1 on 8 October.
  it.each([
    [733, '2026-10-30', 103.1693, 103.16],
    [690, '2065-04-15', 90.2333, 90.23],
    [734, '2064-04-22', 95.5635, 95.56],
    [676, '2061-02-22', 86.3969, 86.39],
    [695, '2061-12-16', 89.8517, 89.85],
    [709, '2074-11-25', 91.4917, 91.49],
    [743, '2076-01-19', 94.6368, 94.63],
    [771, '2066-05-18', 99.5224, 99.52],
    [730, '2053-06-19', 94.5209, 94.52],
    [698, '2054-12-16', 90.8025, 90.8],
    [680, '2060-12-15', 88.1456, 88.14],
    [724, '2055-08-18', 92.4788, 92.47],
    [763, '2056-09-15', 96.296, 96.29],
    [667, '2050-12-17', 87.9086, 87.9],
    [719, '2060-09-15', 91.0334, 91.03],
    [750, '2056-04-27', 97.7125, 97.71],
    [709, '2054-08-05', 91.1324, 91.13],
    [740, '2062-09-19', 93.3309, 93.33],
  ] as const)('prices coupon %s maturing %s at 8%%', (coupon, maturityDate, theoretical, ceiling) => {
    const terms = { coupon, maturityDate, settlementDate: '2026-10-08' };
    const price = calculateGsecDirtyPrice({ ...terms, yieldPercent: 8 })!;
    expect(price).toBeCloseTo(theoretical, 4);
    expect(calculateGsecYtm({ ...terms, dirtyPrice: price })).toBeCloseTo(8, 10);
    expect(calculateGsecMaxBuyPrice({ ...terms, targetYtm: 8 })).toBe(ceiling);
    expect(calculateGsecYtm({ ...terms, dirtyPrice: ceiling })).toBeGreaterThanOrEqual(8);
    expect(calculateGsecYtm({ ...terms, dirtyPrice: ceiling + 0.01 })).toBeLessThan(8);
  });

  it('supports zero target yield without a geometric-series division by zero', () => {
    expect(calculateGsecDirtyPrice({ ...base, yieldPercent: 0 })).toBe(116);
    expect(calculateGsecMaxBuyPrice({ ...base, targetYtm: 0 })).toBe(116);
  });

  it('changes the ceiling with the target and the settlement date', () => {
    const bond = { coupon: 733, maturityDate: '2026-10-30', settlementDate: '2026-10-08' };
    const price = calculateGsecMaxBuyPrice({ ...bond, targetYtm: 8 })!;
    expect(calculateGsecMaxBuyPrice({ ...bond, targetYtm: 9 })).toBeLessThan(price);
    expect(calculateGsecMaxBuyPrice({ ...bond, targetYtm: 7 })).toBeGreaterThan(price);
    expect(calculateGsecMaxBuyPrice({ ...bond, settlementDate: '2026-10-09', targetYtm: 8 })).toBeGreaterThan(price);
  });

  it.each([
    { targetYtm: NaN },
    { targetYtm: Infinity },
    { targetYtm: -200 },
    { maturityDate: '2025-01-15' },
    { maturityDate: '2026-01-15' },
    { coupon: -1 },
    { settlementDate: '2026-02-30' },
  ])('leaves invalid or matured bond prices unavailable: %j', (invalid) => {
    expect(calculateGsecMaxBuyPrice({ ...base, targetYtm: 8, ...invalid })).toBeNull();
  });
});
