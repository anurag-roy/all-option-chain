import { calculateGsecYtm, parseBondDate } from '@server/lib/calculators/gsec-ytm';
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
