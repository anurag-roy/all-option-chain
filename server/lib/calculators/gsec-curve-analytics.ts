import { addBondMonths, type GsecBondTerms } from '@server/lib/calculators/gsec-cash-flows';
import { calculateGsecYtm } from '@server/lib/calculators/gsec-ytm';
import {
  createGsecCurveCashFlows,
  curveYearFraction,
  priceGsecCurveCashFlows,
  solveGsecZSpread,
  type GsecCurveCashFlow,
} from '@server/lib/calculators/gsec-zero-curve';
import type { GsecCurveAnalytics, GsecCurveSnapshot, GsecRelativeValue } from '@shared/types/gsec-curve';
import type { GsecAnalytics } from '@shared/types/gsecs';

export type GsecCurveValuation = {
  snapshotId: string;
  fairDirtyPrice: number;
  fairYtm: number;
  maturityTenor: number;
  cashFlows: GsecCurveCashFlow[];
  horizons: {
    months: 1 | 3 | 6 | 12;
    fairDirtyPrice: number | null;
    fairYtm: number | null;
    cashFlows: GsecCurveCashFlow[] | null;
  }[];
};

/** Independent of market prices: cache once per bond, settlement and snapshot. */
export function valueGsecOnCurve(terms: GsecBondTerms, curve: GsecCurveSnapshot): GsecCurveValuation | null {
  const cashFlows = createGsecCurveCashFlows(terms, curve);
  const fairDirtyPrice = cashFlows ? priceGsecCurveCashFlows(cashFlows) : null;
  const fairYtm = fairDirtyPrice === null ? null : calculateGsecYtm({ ...terms, dirtyPrice: fairDirtyPrice });
  if (!cashFlows || fairDirtyPrice === null || fairYtm === null) return null;
  return {
    snapshotId: curve.id,
    fairDirtyPrice,
    fairYtm,
    maturityTenor: curveYearFraction(terms.settlementDate, terms.maturityDate, curve.dayCount)!,
    cashFlows,
    horizons: ([1, 3, 6, 12] as const).map((months) => {
      const horizon = addBondMonths(terms.settlementDate, months)!;
      if (horizon >= terms.maturityDate) return { months, fairDirtyPrice: 0, fairYtm: null, cashFlows: [] };
      const horizonTerms = { ...terms, settlementDate: horizon };
      const horizonFlows = createGsecCurveCashFlows(horizonTerms, curve, terms.settlementDate);
      const price = horizonFlows ? priceGsecCurveCashFlows(horizonFlows) : null;
      return {
        months,
        fairDirtyPrice: price,
        fairYtm: price === null ? null : calculateGsecYtm({ ...horizonTerms, dirtyPrice: price }),
        cashFlows: horizonFlows,
      };
    }),
  };
}

export function classifyGsecRelativeValue(spreadBp: number, thresholdBp: number): GsecRelativeValue {
  if (!Number.isFinite(spreadBp) || !Number.isFinite(thresholdBp) || thresholdBp < 0)
    throw new Error('Invalid relative-value spread or threshold');
  // Forward pricing followed by solving YTM can put an exact boundary a few
  // floating-point ulps outside the band. This is far below quote precision.
  const toleranceBp = 1e-8;
  return spreadBp > thresholdBp + toleranceBp ? 'CHEAP' : spreadBp < -thresholdBp - toleranceBp ? 'RICH' : 'FAIR';
}

export function calculateGsecCurveAnalytics(
  terms: GsecBondTerms,
  valuation: GsecCurveValuation,
  analytics: GsecAnalytics | null,
  dirtyPrice: number | null,
  thresholdBp: number
): GsecCurveAnalytics {
  const spreadBp = analytics === null ? null : (analytics.ytm - valuation.fairYtm) * 100;
  const zSpreadBp =
    analytics === null || dirtyPrice === null ? null : solveGsecZSpread(valuation.cashFlows, dirtyPrice);
  return {
    snapshotId: valuation.snapshotId,
    fairDirtyPrice: valuation.fairDirtyPrice,
    fairYtm: valuation.fairYtm,
    maturityTenor: valuation.maturityTenor,
    spreadBp,
    zSpreadBp,
    relativeValue: spreadBp === null ? null : classifyGsecRelativeValue(spreadBp, thresholdBp),
    priceAdvantage: dirtyPrice === null ? null : valuation.fairDirtyPrice - dirtyPrice,
    carryRoll: (analytics?.carry ?? []).map((carry) => {
      const horizon = valuation.horizons.find((item) => item.months === carry.months)!;
      const price = carry.redemptionReceived
        ? 0
        : horizon.cashFlows === null || zSpreadBp === null
          ? null
          : priceGsecCurveCashFlows(horizon.cashFlows, zSpreadBp);
      const assumedYtm =
        price === null || price === 0
          ? null
          : calculateGsecYtm({
              ...terms,
              settlementDate: carry.effectiveHorizonDate,
              dirtyPrice: price,
            });
      const result =
        price === null || dirtyPrice === null
          ? null
          : ((price + carry.couponsReceived + carry.redemptionReceived - dirtyPrice) / dirtyPrice) * 100;
      return {
        months: carry.months,
        fairDirtyPrice: horizon.fairDirtyPrice,
        fairYtm: horizon.fairYtm,
        assumedYtm,
        endingDirtyPrice: price,
        returnPercent: result !== null && Number.isFinite(result) ? result : null,
      };
    }),
  };
}
