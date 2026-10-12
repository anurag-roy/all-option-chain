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

/** Freeze the curve shape and measure each cash flow from the valuation date. */
export function priceGsecOnCurve(terms: GsecBondTerms, curve: GsecCurveSnapshot): number | null {
  const flows = createGsecCashFlows(terms);
  if (!flows) return null;
  let price = 0;
  for (const flow of flows) {
    const tenor = curveYearFraction(terms.settlementDate, flow.date, curve.dayCount);
    const discount = tenor === null ? null : curveDiscountFactor(curve, tenor);
    if (discount === null) return null; // Never extrapolate beyond the stored range.
    price += flow.amount * discount;
  }
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function sampleGsecCurve(curve: GsecCurveSnapshot): GsecCurvePoint[] {
  return Array.from({ length: 201 }, (_, index) => {
    const tenor = curve.minTenor + ((curve.maxTenor - curve.minTenor) * index) / 200;
    return { tenor, zeroRate: nssZeroRate(curve.parameters, tenor)! };
  }).filter((point) => Number.isFinite(point.zeroRate));
}
