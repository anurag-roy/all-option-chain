import { calculateGsecCarry } from '@server/lib/calculators/gsec-analytics';
import { createGsecCashFlows, priceGsecCashFlows } from '@server/lib/calculators/gsec-cash-flows';
import { calculateGsecCurveAnalytics, valueGsecOnCurve } from '@server/lib/calculators/gsec-curve-analytics';
import { calculateGsecRating } from '@server/lib/calculators/gsec-rating';
import type { GsecBondAnalytics, GsecRow, GsecScan } from '@shared/types/gsecs';

/** Personalize one Bond Card from cached seller data, without changing shared subscriptions. */
export function calculateGsecBondAnalytics(
  snapshot: GsecScan,
  row: GsecRow,
  targetYtm: number | null = null,
  customMonths: number | null = null
): GsecBondAnalytics {
  const terms = { ...row, settlementDate: snapshot.settlementDate };
  const cashFlows = row.analytics && row.sellRate !== null ? createGsecCashFlows(terms) : null;
  const shockPrice = cashFlows ? priceGsecCashFlows(cashFlows, row.analytics!.ytm + 0.8) : null;
  const shockPlus80Percent = shockPrice === null ? null : ((shockPrice - row.sellRate!) / row.sellRate!) * 100;
  const customCarry =
    customMonths !== null && cashFlows
      ? (calculateGsecCarry(terms, cashFlows, row.analytics!.ytm, row.sellRate!, [customMonths])[0] ?? null)
      : null;
  const curve = snapshot.curve?.status === 'ready' && row.curveAnalytics ? snapshot.curve.snapshot : null;
  const customValuation = customCarry && curve ? valueGsecOnCurve(terms, curve, [customCarry.months]) : null;
  const customCarryRoll =
    customValuation && customCarry
      ? (calculateGsecCurveAnalytics(
          terms,
          customValuation,
          { ...row.analytics!, carry: [customCarry] },
          row.sellRate,
          snapshot.curve!.rvThresholdBp
        ).carryRoll[0] ?? null)
      : null;
  return {
    exchange: row.exchange,
    tradingsymbol: row.tradingsymbol,
    settlementDate: snapshot.settlementDate,
    approvedListFetchedAt: snapshot.approvedListFetchedAt,
    sellRate: row.sellRate,
    curveSnapshotId: row.curveAnalytics?.snapshotId ?? null,
    targetYtm,
    customMonths,
    rating: calculateGsecRating({
      currentYtm: row.rrr,
      targetYtm,
      zSpreadBp: row.curveAnalytics?.zSpreadBp ?? null,
      carryRoll1Y: row.curveAnalytics?.carryRoll.find((item) => item.months === 12)?.returnPercent ?? null,
      shockPlus80Percent,
    }),
    customCarry,
    customCarryRoll,
  };
}
