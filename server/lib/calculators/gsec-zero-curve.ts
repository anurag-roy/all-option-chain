import { createGsecCashFlows, parseBondDate, type GsecBondTerms } from '@server/lib/calculators/gsec-cash-flows';
import type { GsecCurvePoint, GsecCurveSnapshot, NssParameters } from '@shared/types/gsec-curve';

/** NSS spot rate in percent. expm1 preserves accuracy at very short tenors. */
export function nssZeroRate(parameters: NssParameters, tenor: number): number | null {
  if (
    !Number.isFinite(tenor) ||
    tenor < 0 ||
    !Object.values(parameters).every(Number.isFinite) ||
    parameters.tau1 <= 0 ||
    parameters.tau2 <= 0
  )
    return null;
  const { beta0, beta1, beta2, beta3, tau1, tau2 } = parameters;
  if (tenor === 0) return beta0 + beta1;
  const x1 = tenor / tau1;
  const x2 = tenor / tau2;
  const value =
    beta0 +
    (beta1 + beta2) * (-Math.expm1(-x1) / x1) -
    beta2 * Math.exp(-x1) +
    beta3 * (-Math.expm1(-x2) / x2) -
    beta3 * Math.exp(-x2);
  return Number.isFinite(value) ? value : null;
}

export function curveYearFraction(from: string, to: string, dayCount: GsecCurveSnapshot['dayCount']): number | null {
  const start = parseBondDate(from);
  const end = parseBondDate(to);
  if (!start || !end || to < from) return null;
  if (dayCount === '30E/360') {
    return (
      ((end.year - start.year) * 360 +
        (end.month - start.month) * 30 +
        Math.min(end.day, 30) -
        Math.min(start.day, 30)) /
      360
    );
  }
  return (
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
    86_400_000 /
    (dayCount === 'ACT/365' ? 365 : 360)
  );
}

export function curveDiscountFactor(curve: GsecCurveSnapshot, tenor: number): number | null {
  if (tenor < curve.minTenor || tenor > curve.maxTenor) return null;
  const rate = nssZeroRate(curve.parameters, tenor);
  if (rate === null) return null;
  const decimal = rate / 100;
  let discount: number;
  if (curve.compounding === 'continuous') discount = Math.exp(-decimal * tenor);
  else {
    const frequency = curve.compounding === 'semiannual' ? 2 : 1;
    if (1 + decimal / frequency <= 0) return null;
    discount = (1 + decimal / frequency) ** (-frequency * tenor);
  }
  return Number.isFinite(discount) && discount > 0 ? discount : null;
}

export type GsecCurveCashFlow = { amount: number; years: number; discountFactor: number };

/**
 * Normalize the dated curve to settlement: D(C,T) / D(C,S).
 * For carry/roll, keep today's settlement-adjusted shape and shorten each
 * remaining tenor, rather than replacing it with an implied forward curve.
 */
export function createGsecCurveCashFlows(
  terms: GsecBondTerms,
  curve: GsecCurveSnapshot,
  curveSettlementDate = terms.settlementDate
): GsecCurveCashFlow[] | null {
  const flows = createGsecCashFlows(terms);
  const offset = curveYearFraction(curve.referenceDate, curveSettlementDate, curve.dayCount);
  if (!flows || offset === null || curveSettlementDate > terms.settlementDate) return null;
  const settlementDiscount = curveDiscountFactor(curve, offset);
  if (settlementDiscount === null) return null;
  const discounted: GsecCurveCashFlow[] = [];
  for (const flow of flows) {
    const years = curveYearFraction(terms.settlementDate, flow.date, curve.dayCount);
    const discount = years === null ? null : curveDiscountFactor(curve, offset + years);
    if (discount === null) return null; // Never extrapolate beyond the stored range.
    const discountFactor = discount / settlementDiscount;
    if (!Number.isFinite(discountFactor) || discountFactor <= 0 || years === null || years <= 0) return null;
    discounted.push({ amount: flow.amount, years, discountFactor });
  }
  return discounted;
}

function curvePrice(cashFlows: GsecCurveCashFlow[], zSpreadBp: number): number {
  return cashFlows.reduce(
    (price, flow) =>
      flow.amount === 0
        ? price
        : price + flow.amount * flow.discountFactor * Math.exp((-zSpreadBp / 10_000) * flow.years),
    0
  );
}

/** Continuous Z-spread, in basis points, applied to every normalized cash flow. */
export function priceGsecCurveCashFlows(cashFlows: GsecCurveCashFlow[], zSpreadBp = 0): number | null {
  if (!Number.isFinite(zSpreadBp)) return null;
  const price = curvePrice(cashFlows, zSpreadBp);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function priceGsecOnCurve(terms: GsecBondTerms, curve: GsecCurveSnapshot): number | null {
  const flows = createGsecCurveCashFlows(terms, curve);
  return flows ? priceGsecCurveCashFlows(flows) : null;
}

/** Solve the monotone cash-flow price, allowing both negative and positive spreads. */
export function solveGsecZSpread(cashFlows: GsecCurveCashFlow[], dirtyPrice: number): number | null {
  if (
    !Number.isFinite(dirtyPrice) ||
    dirtyPrice <= 0 ||
    !cashFlows.length ||
    cashFlows.some(
      (flow) =>
        !Number.isFinite(flow.amount) ||
        flow.amount < 0 ||
        !Number.isFinite(flow.years) ||
        flow.years <= 0 ||
        !Number.isFinite(flow.discountFactor) ||
        flow.discountFactor <= 0
    ) ||
    !cashFlows.some((flow) => flow.amount > 0)
  )
    return null;
  let low = -100;
  let high = 100;
  for (let i = 0; curvePrice(cashFlows, low) < dirtyPrice && i < 40; i++) low *= 2;
  for (let i = 0; curvePrice(cashFlows, high) > dirtyPrice && i < 40; i++) high *= 2;
  if (!(curvePrice(cashFlows, low) >= dirtyPrice) || !(curvePrice(cashFlows, high) <= dirtyPrice)) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (curvePrice(cashFlows, mid) > dirtyPrice) low = mid;
    else high = mid;
  }
  const spread = (low + high) / 2;
  const price = priceGsecCurveCashFlows(cashFlows, spread);
  return price !== null && Math.abs(price - dirtyPrice) <= Math.max(1e-8, dirtyPrice * 1e-10) ? spread : null;
}

export function sampleGsecCurve(curve: GsecCurveSnapshot): GsecCurvePoint[] {
  return Array.from({ length: 201 }, (_, index) => {
    const tenor = curve.minTenor + ((curve.maxTenor - curve.minTenor) * index) / 200;
    return { tenor, zeroRate: nssZeroRate(curve.parameters, tenor)! };
  }).filter((point) => Number.isFinite(point.zeroRate));
}
