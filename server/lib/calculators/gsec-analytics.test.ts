import { calculateGsecAnalytics } from '@server/lib/calculators/gsec-analytics';
import { addBondMonths, createGsecCashFlows } from '@server/lib/calculators/gsec-cash-flows';
import { describe, expect, it } from 'vitest';

const workedBond = { coupon: 709, maturityDate: '2054-08-05', settlementDate: '2026-10-08', dirtyPrice: 95.3 };

describe('Tier 1 G-Sec risk and scenarios', () => {
  it('reproduces the 709GS2054 worked-note risk metrics with unrounded seller prices', () => {
    const analytics = calculateGsecAnalytics(workedBond)!;
    expect(analytics.ytm).toBeCloseTo(7.6052326003, 8);
    expect(analytics.nextCouponDate).toBe('2027-02-05');
    expect(analytics.remainingCoupons).toBe(56);
    expect(analytics.risk!.macaulayDuration).toBeCloseTo(11.928501467, 8);
    expect(analytics.risk!.modifiedDuration).toBeCloseTo(11.4915229424, 8);
    expect(analytics.risk!.dv01).toBeCloseTo(0.1095142916, 9);
    expect(analytics.risk!.convexity).toBeCloseTo(215.968726, 5);
  });

  it('reproduces every exact shock price instead of a duration approximation or trading-tick floor', () => {
    const scenarios = calculateGsecAnalytics(workedBond)!.scenarios;
    const expected = [
      104.7617346891, 99.8503375084, 97.5320791562, 96.4055114544, 95.8501535651, 95.3, 94.7549919477, 94.2150713296,
      93.1502636705, 91.0792209306, 87.1594975383,
    ];
    expect(scenarios.map((row) => row.shockBp)).toEqual([-80, -40, -20, -10, -5, 0, 5, 10, 20, 40, 80]);
    scenarios.forEach((row, index) => {
      expect(row.dirtyPrice).toBeCloseTo(expected[index]!, 8);
      expect(row.priceChangePercent).toBeCloseTo((expected[index]! / 95.3 - 1) * 100, 8);
    });
    expect(scenarios[7]!.yieldPercent).toBeCloseTo(7.7052326003, 8);
    expect(scenarios[5]).toMatchObject({ dirtyPrice: 95.3, priceChangePercent: 0 });
  });

  it('supports negative and very high current yields without clamping shocks', () => {
    const negative = calculateGsecAnalytics({
      ...workedBond,
      maturityDate: '2026-10-30',
      coupon: 733,
      dirtyPrice: 104.13,
    })!;
    expect(negative.ytm).toBeLessThan(0);
    expect(negative.risk!.modifiedDuration).toBeGreaterThan(0);
    expect(negative.scenarios[0]!.yieldPercent).toBeCloseTo(negative.ytm - 0.8, 10);
    const high = calculateGsecAnalytics({ ...workedBond, maturityDate: '2028-01-15', dirtyPrice: 1 })!;
    expect(high.ytm).toBeGreaterThan(30);
    expect(high.scenarios.every((row) => Number.isFinite(row.dirtyPrice))).toBe(true);
  });

  it('leaves shocks outside the semiannual yield domain unavailable without losing the current yield', () => {
    const analytics = calculateGsecAnalytics({
      coupon: 0,
      settlementDate: '2026-01-15',
      maturityDate: '2028-01-15',
      dirtyPrice: 2.56e12,
    })!;
    expect(analytics.ytm).toBeCloseTo(-199.5, 8);
    expect(analytics.scenarios[0]).toMatchObject({ dirtyPrice: null, priceChangePercent: null });
    expect(JSON.stringify(analytics)).not.toContain('Infinity');
  });

  it.each([
    { dirtyPrice: 0 },
    { dirtyPrice: NaN },
    { dirtyPrice: Infinity },
    { coupon: -1 },
    { settlementDate: '2026-02-30' },
    { maturityDate: '2026-10-08' },
    { maturityDate: '2025-10-08' },
  ])('rejects invalid or matured analytics: %j', (invalid) => {
    expect(calculateGsecAnalytics({ ...workedBond, ...invalid })).toBeNull();
  });
});

describe('constant-YTM gross holding returns', () => {
  it('reproduces the one-year baseline without substituting the curve-dependent roll return', () => {
    const carry = calculateGsecAnalytics(workedBond)!.carry;
    expect(carry.map((row) => row.months)).toEqual([1, 3, 6, 12]);
    expect(carry[3]).toMatchObject({
      horizonDate: '2027-10-08',
      effectiveHorizonDate: '2027-10-08',
      couponsReceived: 7.09,
      redemptionReceived: 0,
      maturesBeforeHorizon: false,
    });
    expect(carry[3]!.endingDirtyPrice).toBeCloseTo(95.3657947448, 8);
    expect(carry[3]!.returnPercent).toBeCloseTo(7.5087038245, 8);
    expect(carry[0]!.horizonDate).toBe('2026-11-08'); // Sunday: no business-day shift.
    expect(carry[0]!.couponsReceived).toBe(0);
  });

  it('caps every horizon at maturity and includes principal and final coupon exactly once', () => {
    const carry = calculateGsecAnalytics({
      coupon: 733,
      settlementDate: '2026-10-08',
      maturityDate: '2026-10-30',
      dirtyPrice: 104.13,
    })!.carry;
    for (const row of carry) {
      expect(row).toMatchObject({
        effectiveHorizonDate: '2026-10-30',
        maturesBeforeHorizon: true,
        endingDirtyPrice: 0,
        couponsReceived: 3.665,
        redemptionReceived: 100,
      });
      expect(row.returnPercent).toBeCloseTo(((103.665 - 104.13) / 104.13) * 100, 10);
    }
  });

  it('pays coupons on the horizon and excludes them from the ending bond price', () => {
    const analytics = calculateGsecAnalytics({
      coupon: 800,
      settlementDate: '2026-01-15',
      maturityDate: '2028-01-15',
      dirtyPrice: 116,
    })!;
    expect(analytics.ytm).toBeCloseTo(0, 10);
    expect(analytics.carry[3]).toMatchObject({ couponsReceived: 8, redemptionReceived: 0 });
    expect(analytics.carry[3]!.endingDirtyPrice).toBeCloseTo(108, 10);
    expect(analytics.carry[3]!.returnPercent).toBeCloseTo(0, 10);
    const atMaturity = calculateGsecAnalytics({
      coupon: 800,
      settlementDate: '2026-01-15',
      maturityDate: '2027-01-15',
      dirtyPrice: 108,
    })!.carry[3]!;
    expect(atMaturity).toMatchObject({
      maturesBeforeHorizon: false,
      endingDirtyPrice: 0,
      couponsReceived: 8,
      redemptionReceived: 100,
    });
    expect(atMaturity.returnPercent).toBeCloseTo(0, 10);
  });

  it('does not annualize a short horizon or reinvest intermediate coupons', () => {
    const analytics = calculateGsecAnalytics(workedBond)!;
    const sixMonths = analytics.carry[2]!;
    expect(sixMonths.couponsReceived).toBe(3.545);
    expect(sixMonths.returnPercent).toBeCloseTo(((sixMonths.endingDirtyPrice! + 3.545 - 95.3) / 95.3) * 100, 10);
    expect(sixMonths.returnPercent).toBeLessThan(analytics.carry[3]!.returnPercent!);
  });
});

describe('shared cash-flow calendar', () => {
  it('clamps calendar horizons in leap years without changing the source day', () => {
    expect(addBondMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addBondMonths('2028-01-31', 3)).toBe('2028-04-30');
    expect(addBondMonths('2026-01-31', 1)).toBe('2026-02-28');
  });

  it('anchors each coupon to maturity and excludes a coupon on settlement', () => {
    const flows = createGsecCashFlows({ coupon: 800, settlementDate: '2026-02-28', maturityDate: '2028-08-31' })!;
    expect(flows.map((flow) => flow.date)).toEqual([
      '2026-08-31',
      '2027-02-28',
      '2027-08-31',
      '2028-02-29',
      '2028-08-31',
    ]);
    expect(flows[0]!.periods).toBeCloseTo(182 / 180, 12);
    expect(flows.map((flow) => flow.amount)).toEqual([4, 4, 4, 4, 104]);
  });
});
