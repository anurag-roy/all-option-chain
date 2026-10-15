import { calculateGsecAnalytics } from '@server/lib/calculators/gsec-analytics';
import { calculateGsecBondAnalytics } from '@server/lib/calculators/gsec-bond-analytics';
import { addBondHorizonMonths } from '@server/lib/calculators/gsec-cash-flows';
import { calculateGsecCurveAnalytics, valueGsecOnCurve } from '@server/lib/calculators/gsec-curve-analytics';
import { withGsecScenarioBase } from '@server/lib/calculators/gsec-scenarios';
import { calculateGsecDirtyPrice } from '@server/lib/calculators/gsec-ytm';
import type { GsecCurveSnapshot } from '@shared/types/gsec-curve';
import type { GsecRow, GsecScan } from '@shared/types/gsecs';
import { describe, expect, it } from 'vitest';

const curve: GsecCurveSnapshot = {
  id: 'fixture',
  provider: 'CCIL',
  referenceDate: '2026-10-08',
  publicationTimestamp: null,
  firstObservedAt: '2026-10-08T10:00:00.000Z',
  retrievedAt: '2026-10-08T10:00:00.000Z',
  sourceUrl: 'https://example.com',
  sourceHash: 'fixture',
  method: 'NSS',
  parameters: { beta0: 6, beta1: 0, beta2: 0, beta3: 0, tau1: 1, tau2: 2 },
  compounding: 'continuous',
  dayCount: 'ACT/365',
  conventionSource: 'fixture',
  minTenor: 0,
  maxTenor: 50,
};
function snapshot(maturityDate = '2054-08-05'): GsecScan {
  const terms = { coupon: 709, settlementDate: '2026-10-08', maturityDate };
  const sellRate = 95.3;
  const analytics = calculateGsecAnalytics({ ...terms, dirtyPrice: sellRate })!;
  const row: GsecRow = {
    exchange: 'NSE',
    tradingsymbol: '709GS2054-GS',
    isin: 'test',
    maturityYear: 2054,
    tickSize: 0.01,
    ...terms,
    sellRate,
    rrr: analytics.ytm,
    analytics,
    curveAnalytics: calculateGsecCurveAnalytics(terms, valueGsecOnCurve(terms, curve)!, analytics, sellRate, 5),
    curveUnavailableReason: null,
    bestRrrRank: 1,
    distanceFromFv: 4.7,
    nearFvRank: 1,
    quoteStatus: 'ready',
    sellerDepth: [{ price: sellRate, quantity: 100, orders: 1 }],
    quoteUpdatedAt: '2026-10-08T09:30:00.000Z',
    masterDataStatus: 'ready',
  };
  return {
    rows: [row],
    scenarioBase: 0,
    sourceUrl: '',
    approvedListFetchedAt: '2026-10-08T06:00:00Z',
    quotesFetchedAt: row.quoteUpdatedAt!,
    revision: 1,
    tradeDate: '2026-10-08',
    settlementDate: terms.settlementDate,
    streamStatus: 'live',
    curve: { status: 'ready', snapshot: curve, ageDays: 0, rvThresholdBp: 5 },
  };
}

describe('custom carry horizons and rating integration', () => {
  it('uses whole calendar months then rounded fractional-month days, including year conversions and leap days', () => {
    expect(addBondHorizonMonths('2026-10-16', 3.4)).toBe('2027-01-28');
    expect(addBondHorizonMonths('2026-10-16', 1.2 * 12)).toBe('2027-12-28');
    expect(addBondHorizonMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addBondHorizonMonths('2028-01-31', 1.5)).toBe('2028-03-15');
    expect(addBondHorizonMonths('2026-10-16', 1 / 30)).toBe('2026-10-17');
    expect(addBondHorizonMonths('2026-10-16', 0.02)).toBe('2026-10-17');
    for (const invalid of [0, -1, NaN, Infinity, 1201]) expect(addBondHorizonMonths('2026-10-16', invalid)).toBeNull();
  });
  it('adds the same fractional date to unchanged-YTM carry and constant-spread roll without mutating the scan', () => {
    const source = snapshot();
    const original = structuredClone(source);
    const details = calculateGsecBondAnalytics(source, source.rows[0]!, 8, 3.4);
    const carry = details.customCarry!;
    expect(carry).toMatchObject({
      months: 3.4,
      horizonDate: '2027-01-20',
      effectiveHorizonDate: '2027-01-20',
      redemptionReceived: 0,
    });
    expect(carry.endingDirtyPrice).toBeCloseTo(
      calculateGsecDirtyPrice({
        ...source.rows[0]!,
        settlementDate: carry.effectiveHorizonDate,
        yieldPercent: source.rows[0]!.rrr!,
      })!,
      10
    );
    expect(details.customCarryRoll).toMatchObject({ months: 3.4 });
    expect(details.customCarryRoll!.endingDirtyPrice).toBeGreaterThan(0);
    expect(details.rating.score).not.toBeNull();
    expect(source).toEqual(original);
  });
  it('matches existing standard carry/roll when requested as a custom horizon', () => {
    const source = snapshot();
    for (const months of [1, 3, 6, 12]) {
      const details = calculateGsecBondAnalytics(source, source.rows[0]!, 8, months);
      expect(details.customCarry).toEqual(source.rows[0]!.analytics!.carry.find((item) => item.months === months));
      expect(details.customCarryRoll).toEqual(
        source.rows[0]!.curveAnalytics!.carryRoll.find((item) => item.months === months)
      );
    }
  });
  it('keeps the rating fixed at +80 bp and one year regardless of scenario base or custom horizon', () => {
    const source = snapshot();
    const customized = withGsecScenarioBase(source, 10);
    expect(customized.rows[0]!.analytics!.scenarios.some((item) => item.shockBp === 80)).toBe(false);
    const baseline = calculateGsecBondAnalytics(source, source.rows[0]!, 8);
    expect(calculateGsecBondAnalytics(customized, customized.rows[0]!, 8, 14.4).rating).toEqual(baseline.rating);
  });
  it('pays coupon and redemption exactly once when a custom horizon reaches or exceeds maturity', () => {
    const source = snapshot('2027-01-20');
    for (const months of [3.4, 12]) {
      const details = calculateGsecBondAnalytics(source, source.rows[0]!, 8, months);
      expect(details.customCarry).toMatchObject({
        endingDirtyPrice: 0,
        couponsReceived: 3.545,
        redemptionReceived: 100,
        effectiveHorizonDate: '2027-01-20',
      });
      expect(details.customCarryRoll).toMatchObject({ endingDirtyPrice: 0, fairDirtyPrice: 0, assumedYtm: null });
      expect(details.customCarryRoll!.returnPercent).toBeCloseTo(((103.545 - 95.3) / 95.3) * 100, 10);
    }
  });
  it('keeps standalone carry when curve comparisons are unavailable and never reweights a partial rating', () => {
    const source = snapshot();
    const row = { ...source.rows[0]!, curveAnalytics: null, curveUnavailableReason: 'Curve unavailable' };
    const details = calculateGsecBondAnalytics(source, row, 8, 3.4);
    expect(details.customCarry).not.toBeNull();
    expect(details.customCarryRoll).toBeNull();
    expect(details.rating.score).toBeNull();
  });
  it('preserves prices without quote-age gating, including disconnected snapshots', () => {
    const source = snapshot();
    source.streamStatus = 'disconnected';
    source.rows[0]!.quoteUpdatedAt = '2000-01-01T00:00:00.000Z';
    expect(calculateGsecBondAnalytics(source, source.rows[0]!, 8).rating.score).not.toBeNull();
  });
  it('does not score or price a missing seller', () => {
    const source = snapshot();
    const row = { ...source.rows[0]!, sellRate: null, rrr: null, analytics: null, curveAnalytics: null };
    expect(calculateGsecBondAnalytics(source, row, 8, 3.4)).toMatchObject({
      rating: { score: null },
      customCarry: null,
      customCarryRoll: null,
    });
  });
});
