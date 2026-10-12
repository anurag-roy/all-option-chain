import { calculateGsecAnalytics } from '@server/lib/calculators/gsec-analytics';
import {
  calculateGsecCurveAnalytics,
  classifyGsecRelativeValue,
  valueGsecOnCurve,
} from '@server/lib/calculators/gsec-curve-analytics';
import { calculateGsecDirtyPrice } from '@server/lib/calculators/gsec-ytm';
import {
  curveDiscountFactor,
  curveYearFraction,
  nssZeroRate,
  priceGsecOnCurve,
} from '@server/lib/calculators/gsec-zero-curve';
import { rankGsecs, type GsecCurveContext } from '@server/lib/calculators/gsecs';
import type { GsecCurveSnapshot } from '@shared/types/gsec-curve';
import type { GsecListing } from '@shared/types/gsecs';
import { describe, expect, it } from 'vitest';

export const curve: GsecCurveSnapshot = {
  id: 'ccil-2026-10-08-fixture',
  provider: 'CCIL',
  referenceDate: '2026-10-08',
  publicationTimestamp: null,
  firstObservedAt: '2026-10-08T13:30:00.000Z',
  retrievedAt: '2026-10-08T13:30:00.000Z',
  sourceUrl: 'https://www.ccilindia.com/zcyc-parameters',
  sourceHash: 'fixture',
  method: 'NSS',
  parameters: { beta0: 8.27, beta1: -2.9928, beta2: -19.9674, beta3: 19.5976, tau1: 2.0618, tau2: 1.8925 },
  compounding: 'continuous',
  dayCount: 'ACT/365',
  conventionSource: 'Approved PDF fixture',
  minTenor: 0,
  maxTenor: 50,
};
const terms = { coupon: 709, maturityDate: '2054-08-05', settlementDate: '2026-10-08' };
const dirtyPrice = 95.3;
const security: GsecListing = {
  exchange: 'NSE',
  tickSize: 0.01,
  tradingsymbol: '709GS2054-GS',
  isin: 'IN0020240086',
  coupon: 709,
  maturityDate: '2054-08-05',
  maturityYear: 2054,
};

describe('CCIL NSS discounting', () => {
  it('handles zero and near-zero tenor without numerical cancellation', () => {
    expect(nssZeroRate(curve.parameters, 0)).toBeCloseTo(5.2772, 12);
    expect(nssZeroRate(curve.parameters, 1e-10)).toBeCloseTo(5.2772, 8);
    expect(curveDiscountFactor(curve, 0)).toBe(1);
    expect(nssZeroRate({ ...curve.parameters, tau1: 0 }, 1)).toBeNull();
    expect(nssZeroRate({ ...curve.parameters, beta0: NaN }, 1)).toBeNull();
    expect(nssZeroRate(curve.parameters, -1)).toBeNull();
  });

  it('discounts by multiplying each cash flow and reproduces the PDF fair dirty price', () => {
    expect(priceGsecOnCurve(terms, curve)).toBeCloseTo(93.7053059191, 8);
    const rate = nssZeroRate(curve.parameters, 10)!;
    expect(curveDiscountFactor(curve, 10)).toBeCloseTo(Math.exp((-rate / 100) * 10), 14);
  });

  it('records and applies conventions separately from bond YTM day-count', () => {
    expect(curveYearFraction('2027-03-01', '2028-03-01', 'ACT/365')).toBe(366 / 365);
    expect(curveYearFraction('2027-03-01', '2028-03-01', 'ACT/360')).toBe(366 / 360);
    expect(curveYearFraction('2027-03-01', '2028-03-01', '30E/360')).toBe(1);
    expect(curveYearFraction('2026-02-30', '2028-03-01', 'ACT/365')).toBeNull();
    const annual = { ...curve, compounding: 'annual' as const };
    const semiannual = { ...curve, compounding: 'semiannual' as const };
    expect(curveDiscountFactor(annual, 10)).toBeCloseTo((1 + nssZeroRate(curve.parameters, 10)! / 100) ** -10, 14);
    expect(curveDiscountFactor(semiannual, 10)).toBeCloseTo((1 + nssZeroRate(curve.parameters, 10)! / 200) ** -20, 14);
    expect(priceGsecOnCurve(terms, annual)).not.toBe(priceGsecOnCurve(terms, curve));
  });

  it('supports short dated cash flows but refuses unsupported tenors and matured bonds', () => {
    expect(priceGsecOnCurve({ ...terms, maturityDate: '2026-10-30' }, curve)).toBeGreaterThan(100);
    expect(priceGsecOnCurve(terms, { ...curve, maxTenor: 20 })).toBeNull();
    expect(priceGsecOnCurve({ ...terms, maturityDate: '2026-10-30' }, { ...curve, minTenor: 0.25 })).toBeNull();
    expect(priceGsecOnCurve({ ...terms, maturityDate: terms.settlementDate }, curve)).toBeNull();
  });
});

describe('curve fair YTM, relative value and constant-spread roll', () => {
  it('reproduces every golden Tier 2 value in the latest resolution PDF', () => {
    const valuation = valueGsecOnCurve(terms, curve)!;
    const market = calculateGsecAnalytics({ ...terms, dirtyPrice })!;
    const result = calculateGsecCurveAnalytics(terms, valuation, market, dirtyPrice, 5);
    expect(market.ytm).toBeCloseTo(7.6052326003, 8);
    expect(result.fairDirtyPrice).toBeCloseTo(93.7053059191, 8);
    expect(result.fairYtm).toBeCloseTo(7.7528734851, 8);
    expect(result.spreadBp).toBeCloseTo(-14.76408848, 7);
    expect(result.relativeValue).toBe('RICH');
    expect(result.priceAdvantage).toBeCloseTo(-1.5946940809, 8);
    const annual = result.carryRoll[3]!;
    expect(annual.fairDirtyPrice).toBeCloseTo(93.8539285804, 8);
    expect(annual.fairYtm).toBeCloseTo(7.7465056879, 8);
    expect(annual.assumedYtm).toBeCloseTo(7.5988648031, 8);
    expect(annual.endingDirtyPrice).toBeCloseTo(95.4348697599, 8);
    expect(annual.returnPercent).toBeCloseTo(7.5811854774, 8);
    expect(market.carry[3]!.couponsReceived).toBe(7.09);
    expect(market.carry[3]!.returnPercent).toBeCloseTo(7.5087038245, 8);
    // Full convergence is a different (deferred) scenario; do not silently use it.
    expect(annual.returnPercent).not.toBeCloseTo(5.9222755304, 4);
  });

  it.each([
    [-5, 'FAIR'],
    [5, 'FAIR'],
    [-5.001, 'RICH'],
    [5.001, 'CHEAP'],
    [0, 'FAIR'],
  ])('uses inclusive FAIR boundaries at %s bp', (spread, expected) => {
    expect(classifyGsecRelativeValue(spread as number, 5)).toBe(expected);
  });
  it('makes the threshold configurable without changing fair prices or target eligibility', () => {
    expect(classifyGsecRelativeValue(-14.7641, 20)).toBe('FAIR');
    expect(classifyGsecRelativeValue(0.001, 0)).toBe('CHEAP');
    expect(() => classifyGsecRelativeValue(1, -1)).toThrow();
  });

  it('keeps a bond priced exactly at either FAIR boundary inside the band after solving its YTM', () => {
    const valuation = valueGsecOnCurve(terms, curve)!;
    for (const difference of [-0.05, 0.05]) {
      const price = calculateGsecDirtyPrice({ ...terms, yieldPercent: valuation.fairYtm + difference })!;
      const market = calculateGsecAnalytics({ ...terms, dirtyPrice: price })!;
      expect(calculateGsecCurveAnalytics(terms, valuation, market, price, 5).relativeValue).toBe('FAIR');
    }
  });

  it('preserves current spread at all four calendar horizons without reinvestment or annualization', () => {
    const market = calculateGsecAnalytics({ ...terms, dirtyPrice })!;
    const valuation = valueGsecOnCurve(terms, curve)!;
    const result = calculateGsecCurveAnalytics(terms, valuation, market, dirtyPrice, 5);
    expect(result.carryRoll.map((item) => item.months)).toEqual([1, 3, 6, 12]);
    result.carryRoll.forEach((roll, index) => {
      expect((roll.assumedYtm! - roll.fairYtm!) * 100).toBeCloseTo(result.spreadBp!, 10);
      const carry = market.carry[index]!;
      const price = calculateGsecDirtyPrice({
        ...terms,
        settlementDate: carry.effectiveHorizonDate,
        yieldPercent: roll.assumedYtm!,
      });
      expect(roll.endingDirtyPrice).toBe(price);
      expect(roll.returnPercent).toBeCloseTo(((price! + carry.couponsReceived - dirtyPrice) / dirtyPrice) * 100, 10);
    });
  });

  it('caps roll at maturity, counting final coupon and redemption once', () => {
    const short = { ...terms, coupon: 733, maturityDate: '2026-10-30' };
    const market = calculateGsecAnalytics({ ...short, dirtyPrice: 104.13 })!;
    const result = calculateGsecCurveAnalytics(short, valueGsecOnCurve(short, curve)!, market, 104.13, 5);
    for (const roll of result.carryRoll) {
      expect(roll).toMatchObject({ fairDirtyPrice: 0, fairYtm: null, assumedYtm: null, endingDirtyPrice: 0 });
      expect(roll.returnPercent).toBeCloseTo(((103.665 - 104.13) / 104.13) * 100, 10);
    }
  });
});

describe('market rows against an independent benchmark', () => {
  const makeContext = (): GsecCurveContext => ({
    state: { status: 'ready', snapshot: curve, ageDays: 0, rvThresholdBp: 5 },
    valuations: new Map(),
    quoteTimes: new Map(),
  });
  const quotes = {
    'NSE:709GS2054-GS': { depth: { sell: [{ price: 95.3, quantity: 10, orders: 1 }] } },
    'BSE:BOND': { depth: { sell: [{ price: 91, quantity: 20, orders: 1 }] } },
  };
  it('shares fair valuation by bond terms while preserving venue prices, spreads and ranks', () => {
    const context = makeContext();
    const rows = rankGsecs(
      [security, { ...security, exchange: 'BSE', tradingsymbol: 'BOND' }],
      quotes,
      terms.settlementDate,
      null,
      context
    );
    expect(context.valuations.size).toBe(1);
    expect(rows.map((row) => row.exchange)).toEqual(['BSE', 'NSE']);
    expect(rows[0]!.curveAnalytics!.relativeValue).toBe('CHEAP');
    expect(rows[1]!.curveAnalytics!.relativeValue).toBe('RICH');
    expect(rows[0]!.curveAnalytics!.fairYtm).toBe(rows[1]!.curveAnalytics!.fairYtm);
    const next = rankGsecs(
      [security],
      quotes,
      terms.settlementDate,
      { rows, settlementDate: terms.settlementDate, curve: context.state },
      context
    );
    expect(next[0]!.curveAnalytics).toBe(rows[1]!.curveAnalytics);
    context.state = { ...context.state, rvThresholdBp: 20 };
    const retagged = rankGsecs(
      [security],
      quotes,
      terms.settlementDate,
      { rows, settlementDate: terms.settlementDate, curve: { ...context.state, rvThresholdBp: 5 } },
      context
    );
    expect(retagged[0]!.curveAnalytics!.relativeValue).toBe('FAIR');
  });

  it('keeps fair values without sellers, but leaves spread, RV and carry+roll unavailable', () => {
    const row = rankGsecs([security], {}, terms.settlementDate, null, makeContext())[0]!;
    expect(row.curveAnalytics?.fairDirtyPrice).toBeCloseTo(93.7053059191, 8);
    expect(row.curveAnalytics).toMatchObject({
      spreadBp: null,
      relativeValue: null,
      priceAdvantage: null,
      carryRoll: [],
    });
    expect(row.bestRrrRank).toBeNull();
  });

  it('never applies an evening curve to a seller quote received before that curve was available', () => {
    const context = makeContext();
    context.quoteTimes.set('NSE:709GS2054-GS', '2026-10-08T09:00:00.000Z');
    const row = rankGsecs([security], quotes, terms.settlementDate, null, context)[0]!;
    expect(row.rrr).toBeCloseTo(7.6052326003, 8);
    expect(row.curveAnalytics).toBeNull();
    expect(row.curveUnavailableReason).toContain('after this seller quote');
  });
});
