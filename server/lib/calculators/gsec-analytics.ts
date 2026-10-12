import {
  addBondMonths,
  createGsecCashFlows,
  priceGsecCashFlows,
  type GsecBondTerms,
  type GsecCashFlow,
} from '@server/lib/calculators/gsec-cash-flows';
import { calculateGsecDirtyPrice, calculateGsecYtm } from '@server/lib/calculators/gsec-ytm';
import type { GsecAnalytics, GsecCarry, GsecRisk, GsecScenario } from '@shared/types/gsecs';

const SHOCKS_BP = [-100, -50, -25, -10, 0, 10, 25, 50, 100];
const HORIZONS = [1, 3, 6, 12] as const;
const finite = (value: number) => (Number.isFinite(value) ? value : null);

function scenarioPrice(cashFlows: GsecCashFlow[], yieldPercent: number): number | null {
  if (yieldPercent <= -200) return null;
  const price = priceGsecCashFlows(cashFlows, yieldPercent);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function calculateRisk(cashFlows: GsecCashFlow[], ytm: number, dirtyPrice: number): GsecRisk | null {
  const base = 1 + ytm / 200;
  const weightedTime = cashFlows.reduce(
    (sum, flow) => sum + (flow.periods / 2) * (flow.amount / base ** flow.periods),
    0
  );
  const macaulayDuration = weightedTime / dirtyPrice;
  const modifiedDuration = macaulayDuration / base;
  if (!Number.isFinite(macaulayDuration) || !Number.isFinite(modifiedDuration)) return null;
  const lowerPrice = scenarioPrice(cashFlows, ytm - 0.01);
  const higherPrice = scenarioPrice(cashFlows, ytm + 0.01);
  const repricingAvailable = lowerPrice !== null && higherPrice !== null;
  return {
    macaulayDuration,
    modifiedDuration,
    dv01: repricingAvailable ? finite((lowerPrice - higherPrice) / 2) : null,
    convexity: repricingAvailable
      ? finite((lowerPrice + higherPrice - 2 * dirtyPrice) / (dirtyPrice * 0.0001 ** 2))
      : null,
  };
}

function calculateCarry(terms: GsecBondTerms, cashFlows: GsecCashFlow[], ytm: number, dirtyPrice: number): GsecCarry[] {
  return HORIZONS.map((months) => {
    const horizonDate = addBondMonths(terms.settlementDate, months)!;
    const effectiveHorizonDate = horizonDate < terms.maturityDate ? horizonDate : terms.maturityDate;
    // Cash flows on the horizon are paid and excluded from the ending price.
    const paidCoupons = cashFlows.filter((flow) => flow.date <= effectiveHorizonDate).length;
    const couponsReceived = paidCoupons * (terms.coupon / 200);
    const redemptionReceived = effectiveHorizonDate === terms.maturityDate ? 100 : 0;
    const endingDirtyPrice = redemptionReceived
      ? 0
      : calculateGsecDirtyPrice({ ...terms, settlementDate: effectiveHorizonDate, yieldPercent: ytm });
    return {
      months,
      horizonDate,
      effectiveHorizonDate,
      maturesBeforeHorizon: terms.maturityDate < horizonDate,
      endingDirtyPrice,
      couponsReceived,
      redemptionReceived,
      returnPercent:
        endingDirtyPrice === null
          ? null
          : finite(((endingDirtyPrice + couponsReceived + redemptionReceived - dirtyPrice) / dirtyPrice) * 100),
    };
  });
}

/** Tier 1 analytics from the same seller price, schedule and YTM as the scanner. */
export function calculateGsecAnalytics({
  dirtyPrice,
  ...terms
}: GsecBondTerms & { dirtyPrice: number }): GsecAnalytics | null {
  const ytm = calculateGsecYtm({ ...terms, dirtyPrice });
  if (ytm === null) return null;
  const cashFlows = createGsecCashFlows(terms)!;
  const scenarios: GsecScenario[] = SHOCKS_BP.map((shockBp) => {
    const yieldPercent = ytm + shockBp / 100;
    const price = shockBp === 0 ? dirtyPrice : scenarioPrice(cashFlows, yieldPercent);
    return {
      shockBp,
      yieldPercent,
      dirtyPrice: price,
      priceChangePercent: price === null ? null : finite(((price - dirtyPrice) / dirtyPrice) * 100),
    };
  });
  return {
    ytm,
    nextCouponDate: cashFlows[0]!.date,
    remainingCoupons: cashFlows.length,
    risk: calculateRisk(cashFlows, ytm, dirtyPrice),
    scenarios,
    carry: calculateCarry(terms, cashFlows, ytm, dirtyPrice),
  };
}
