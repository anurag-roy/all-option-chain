import { calculateGsecAnalytics } from '@server/lib/calculators/gsec-analytics';
import {
  calculateGsecCurveAnalytics,
  classifyGsecRelativeValue,
  valueGsecOnCurve,
} from '@server/lib/calculators/gsec-curve-analytics';
import { calculateGsecDirtyPrice } from '@server/lib/calculators/gsec-ytm';
import {
  createGsecCurveCashFlows,
  curveDiscountFactor,
  curveYearFraction,
  nssZeroRate,
  priceGsecCurveCashFlows,
  priceGsecOnCurve,
  solveGsecZSpread,
} from '@server/lib/calculators/gsec-zero-curve';
import { rankGsecs, type GsecCurveContext } from '@server/lib/calculators/gsecs';
import type { GsecCurveSnapshot } from '@shared/types/gsec-curve';
import type { GsecListing } from '@shared/types/gsecs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('forward-normalizes a prior-date flat curve to settlement, with a closed-form price and Z-spread', () => {
    const flat = {
      ...curve,
      referenceDate: '2026-01-01',
      parameters: {
        beta0: 6,
        beta1: 0,
        beta2: 0,
        beta3: 0,
        tau1: 1,
        tau2: 2,
      },
    };
    const zero = { coupon: 0, settlementDate: '2026-07-01', maturityDate: '2027-07-01' };
    const flows = createGsecCurveCashFlows(zero, flat)!;
    expect(priceGsecOnCurve(zero, flat)).toBeCloseTo(100 * Math.exp(-0.06), 10);
    for (const spread of [-1000, -150, 0, 150, 1000]) {
      const price = 100 * Math.exp(-0.06 - spread / 10_000);
      expect(solveGsecZSpread(flows, price)).toBeCloseTo(spread, 9);
      expect(priceGsecCurveCashFlows(flows, spread)).toBeCloseTo(price, 10);
    }
    expect(solveGsecZSpread(flows, 0)).toBeNull();
    expect(solveGsecZSpread(flows, NaN)).toBeNull();
    expect(solveGsecZSpread([], 100)).toBeNull();
    expect(solveGsecZSpread([{ amount: 100, years: 0, discountFactor: 1 }], 100)).toBeNull();
    expect(solveGsecZSpread([{ amount: -100, years: 1, discountFactor: 1 }], 100)).toBeNull();
    expect(priceGsecCurveCashFlows(flows, Infinity)).toBeNull();
  });

  it('rejects coverage violations measured from the curve date, and a curve referenced after settlement', () => {
    const dated = { ...curve, referenceDate: '2026-01-01', maxTenor: 1 };
    expect(priceGsecOnCurve({ coupon: 0, settlementDate: '2026-07-01', maturityDate: '2027-01-02' }, dated)).toBeNull();
    expect(priceGsecOnCurve(terms, { ...curve, referenceDate: '2026-10-09' })).toBeNull();
  });

  it('reproduces independent high-precision prices when curve date precedes settlement', () => {
    const dated = { ...curve, referenceDate: '2026-10-09' };
    const short = { coupon: 826, settlementDate: '2026-10-14', maturityDate: '2027-08-02' };
    const valuation = valueGsecOnCurve(short, dated)!;
    const market = calculateGsecAnalytics({ ...short, dirtyPrice: 102.17 })!;
    const result = calculateGsecCurveAnalytics(short, valuation, market, 102.17, 5);
    expect(result.fairDirtyPrice).toBeCloseTo(103.35313483909674, 10);
    expect(result.zSpreadBp).toBeCloseTo(147.52424312818235, 9);
    expect(result.carryRoll[0]!.endingDirtyPrice).toBeCloseTo(102.85235438991185, 10);
    expect(result.carryRoll[2]!.endingDirtyPrice).toBeCloseTo(101.93626494264976, 10);
    expect(result.carryRoll[2]!.returnPercent).toBeCloseTo(3.813511737936533, 10);
    expect(result.carryRoll[3]!.endingDirtyPrice).toBe(0);
  });
});

describe('curve fair YTM, relative value and constant-Z-spread roll', () => {
  it('keeps the original fair/YTM fixture and reproduces independently calculated Z-spread carry', () => {
    const valuation = valueGsecOnCurve(terms, curve)!;
    const market = calculateGsecAnalytics({ ...terms, dirtyPrice })!;
    const result = calculateGsecCurveAnalytics(terms, valuation, market, dirtyPrice, 5);
    expect(market.ytm).toBeCloseTo(7.6052326003, 8);
    expect(result.fairDirtyPrice).toBeCloseTo(93.7053059191, 8);
    expect(result.fairYtm).toBeCloseTo(7.7528734851, 8);
    expect(result.spreadBp).toBeCloseTo(-14.76408848, 7);
    expect(result.zSpreadBp).toBeCloseTo(-14.626954570051867, 9);
    expect(result.relativeValue).toBe('RICH');
    expect(result.priceAdvantage).toBeCloseTo(-1.5946940809, 8);
    const annual = result.carryRoll[3]!;
    expect(annual.fairDirtyPrice).toBeCloseTo(93.8539285804, 8);
    expect(annual.fairYtm).toBeCloseTo(7.7465056879, 8);
    expect(annual.assumedYtm).toBeCloseTo(7.598667638552365, 9);
    expect(annual.endingDirtyPrice).toBeCloseTo(95.43700980516941, 9);
    expect(annual.returnPercent).toBeCloseTo(7.5834310652354775, 9);
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

  it('preserves current Z-spread at all four calendar horizons without reinvestment or annualization', () => {
    const market = calculateGsecAnalytics({ ...terms, dirtyPrice })!;
    const valuation = valueGsecOnCurve(terms, curve)!;
    const result = calculateGsecCurveAnalytics(terms, valuation, market, dirtyPrice, 5);
    expect(result.carryRoll.map((item) => item.months)).toEqual([1, 3, 6, 12]);
    result.carryRoll.forEach((roll, index) => {
      expect(solveGsecZSpread(valuation.horizons[index]!.cashFlows!, roll.endingDirtyPrice!)).toBeCloseTo(
        result.zSpreadBp!,
        9
      );
      const carry = market.carry[index]!;
      const price = calculateGsecDirtyPrice({
        ...terms,
        settlementDate: carry.effectiveHorizonDate,
        yieldPercent: roll.assumedYtm!,
      });
      expect(roll.endingDirtyPrice).toBeCloseTo(price!, 9);
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
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-09T15:00:00.000Z'));
  });
  afterEach(() => vi.restoreAllMocks());

  const makeContext = (): GsecCurveContext => ({
    state: { status: 'ready', snapshot: curve, ageDays: 0, rvThresholdBp: 5 },
    valuations: new Map(),
    quoteTimes: new Map([
      ['NSE:709GS2054-GS', '2026-10-08T14:00:00.000Z'],
      ['BSE:BOND', '2026-10-08T14:00:00.000Z'],
    ]),
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
      zSpreadBp: null,
      relativeValue: null,
      priceAdvantage: null,
      carryRoll: [],
    });
    expect(row.bestRrrRank).toBeNull();
  });

  it('values the displayed seller prices even when their last packets predate the current curve import', () => {
    const context = makeContext();
    context.quoteTimes.set('NSE:709GS2054-GS', '2026-10-08T09:00:00.000Z');
    context.quoteTimes.set('BSE:BOND', '2026-10-07T09:00:00.000Z');
    const rows = rankGsecs(
      [security, { ...security, exchange: 'BSE', tradingsymbol: 'BOND' }],
      quotes,
      terms.settlementDate,
      null,
      context
    );
    const nse = rows.find((row) => row.exchange === 'NSE')!;
    expect(nse.rrr).toBeCloseTo(7.6052326003, 8);
    expect(nse.curveAnalytics?.zSpreadBp).toBeCloseTo(-14.626954570051867, 9);
    expect(rows.every((row) => Number.isFinite(row.curveAnalytics?.zSpreadBp))).toBe(true);
    expect(rows.every((row) => row.curveAnalytics?.carryRoll.length === 4)).toBe(true);
    expect(rows.every((row) => row.curveUnavailableReason === null)).toBe(true);
  });

  it.each(['invalid', '1970-01-01T00:00:00.000Z', '2026-10-09T15:00:01.000Z'])(
    'rejects an invalid or future seller packet time: %s',
    (quoteTime) => {
      const context = makeContext();
      context.quoteTimes.set('NSE:709GS2054-GS', quoteTime);
      const row = rankGsecs([security], quotes, terms.settlementDate, null, context)[0]!;
      expect(row.rrr).toBeCloseTo(7.6052326003, 8);
      expect(row.curveAnalytics).toBeNull();
      expect(row.curveUnavailableReason).toContain('quote time is invalid or in the future');
    }
  );

  it('recovers curve metrics from a previously blocked row without a seller price change', () => {
    const context = makeContext();
    const row = rankGsecs([security], quotes, terms.settlementDate, null, context)[0]!;
    const previous = { ...row, curveAnalytics: null, curveUnavailableReason: 'Previously blocked quote.' };
    context.quoteTimes.set('NSE:709GS2054-GS', '2026-10-08T09:00:00.000Z');
    const next = rankGsecs(
      [security],
      quotes,
      terms.settlementDate,
      { rows: [previous], settlementDate: terms.settlementDate, curve: context.state },
      context
    )[0]!;
    expect(next.analytics).toBe(row.analytics);
    expect(next.curveAnalytics?.zSpreadBp).toBeCloseTo(-14.626954570051867, 9);
    expect(next.curveUnavailableReason).toBeNull();
  });

  it('keeps undated sellers out of curve comparisons without substituting receipt time', () => {
    const context = makeContext();
    context.quoteTimes.clear();
    const row = rankGsecs([security], quotes, terms.settlementDate, null, context)[0]!;
    expect(row.rrr).toBeCloseTo(7.6052326003, 8);
    expect(row.curveAnalytics).toBeNull();
    expect(row.curveUnavailableReason).toContain('quote time unavailable');
  });
});
