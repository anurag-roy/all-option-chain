import { calculateGsecAnalytics } from '@server/lib/calculators/gsec-analytics';
import { createGsecCashFlows } from '@server/lib/calculators/gsec-cash-flows';
import {
  calculateGsecCurveAnalytics,
  valueGsecOnCurve,
  type GsecCurveValuation,
} from '@server/lib/calculators/gsec-curve-analytics';
import { calculateGsecDirtyPrice, calculateGsecMaxBuyPrice } from '@server/lib/calculators/gsec-ytm';
import { gsecKey } from '@shared/lib/gsec-key';
import type { GsecCurveState } from '@shared/types/gsec-curve';
import type {
  GsecCatalogSnapshot,
  GsecListing,
  GsecRow,
  GsecScan,
  GsecSecurity,
  GsecSellerLevel,
  GsecTargetPrices,
} from '@shared/types/gsecs';

export function priceGsecsAtTarget(
  { securities, settlementDate, fetchedAt }: Pick<GsecCatalogSnapshot, 'securities' | 'settlementDate' | 'fetchedAt'>,
  targetYtm: number
): GsecTargetPrices {
  return {
    targetYtm,
    settlementDate,
    approvedListFetchedAt: fetchedAt,
    prices: Object.fromEntries(
      securities.map((security) => [
        gsecKey(security),
        calculateGsecMaxBuyPrice({ ...security, settlementDate, targetYtm }),
      ])
    ),
    theoreticalPrices: Object.fromEntries(
      securities.map((security) => [
        gsecKey(security),
        calculateGsecDirtyPrice({ ...security, settlementDate, yieldPercent: targetYtm }),
      ])
    ),
  };
}

export function parseGsecSymbol(
  symbol: string
): Pick<GsecSecurity, 'tradingsymbol' | 'coupon' | 'maturityYear'> | null {
  // GR issues also appear in Zerodha's Government Securities category.
  const match = /^(\d{2,4})(?:GS|GR)(\d{4})[A-Z]?(?:-GS)?$/.exec(symbol.trim().toUpperCase());
  if (!match) return null;

  const tradingsymbol = symbol.trim().toUpperCase();
  return {
    tradingsymbol: tradingsymbol.endsWith('-GS') ? tradingsymbol : `${tradingsymbol}-GS`,
    // NSE drops a trailing coupon zero in symbols such as 68GS2060 (6.80%).
    coupon: Number(match[1]!.padEnd(3, '0')),
    maturityYear: Number(match[2]),
  };
}

export function getGsecSellerDepth(levels: GsecSellerLevel[] = []): GsecSellerLevel[] {
  return levels
    .filter(
      (level) =>
        Number.isFinite(level.price) && level.price > 0 && Number.isFinite(level.quantity) && level.quantity > 0
    )
    .sort((a, b) => a.price - b.price)
    .slice(0, 5)
    .map(({ price, quantity, orders }) => ({ price, quantity, orders }));
}

type GsecQuote = { depth?: { sell: GsecSellerLevel[] } };

export type GsecCurveContext = {
  state: GsecCurveState;
  valuations: Map<string, GsecCurveValuation | null>;
  quoteTimes: Map<string, string>;
};

export function rankGsecs(
  securities: GsecListing[],
  quotes: Record<string, GsecQuote>,
  settlementDate: string,
  previousScan?: Pick<GsecScan, 'rows' | 'settlementDate' | 'curve'> | null,
  curveContext?: GsecCurveContext
): GsecRow[] {
  // Keep only the last snapshot; quantity-only ticks do not change bond analytics.
  const previousRows = new Map(
    previousScan?.settlementDate === settlementDate ? previousScan.rows.map((row) => [gsecKey(row), row]) : []
  );
  const now = Date.now();
  const rows: GsecRow[] = securities.map((security) => {
    const key = gsecKey(security);
    const quote = quotes[key];
    const sellerDepth = getGsecSellerDepth(quote?.depth?.sell);
    const sellRate = sellerDepth[0]?.price ?? null;
    const previous = previousRows.get(key);
    const unchanged =
      previous?.sellRate === sellRate &&
      previous.coupon === security.coupon &&
      previous.maturityDate === security.maturityDate &&
      previous.isin === security.isin;
    const analytics =
      sellRate === null
        ? null
        : unchanged
          ? previous.analytics
          : calculateGsecAnalytics({ ...security, settlementDate, dirtyPrice: sellRate });
    const curve = curveContext?.state.status === 'ready' ? curveContext.state.snapshot : null;
    const quoteTime = curveContext?.quoteTimes.get(key);
    const quoteTimestamp = Date.parse(quoteTime ?? '');
    // The current book uses the latest available curve, even without a tick since its import.
    const canCompareCurve =
      sellRate === null || (Number.isFinite(quoteTimestamp) && quoteTimestamp > 0 && quoteTimestamp <= now);
    const terms = { ...security, settlementDate };
    const validTerms = analytics !== null || createGsecCashFlows(terms) !== null;
    const valuationKey = JSON.stringify([curve?.id, security.coupon, security.maturityDate, settlementDate]);
    if (curve && canCompareCurve && !curveContext!.valuations.has(valuationKey))
      curveContext!.valuations.set(valuationKey, valueGsecOnCurve(terms, curve));
    const valuation = curve && canCompareCurve ? curveContext!.valuations.get(valuationKey) : null;
    const sameCurve =
      previousScan?.curve?.snapshot?.id === curve?.id &&
      previousScan?.curve?.rvThresholdBp === curveContext?.state.rvThresholdBp;
    const curveAnalytics = valuation
      ? unchanged && sameCurve && previous.curveAnalytics
        ? previous.curveAnalytics
        : calculateGsecCurveAnalytics(terms, valuation, analytics, sellRate, curveContext!.state.rvThresholdBp)
      : null;
    return {
      ...security,
      sellRate,
      rrr: analytics?.ytm ?? null,
      analytics,
      curveAnalytics,
      curveUnavailableReason: curveAnalytics
        ? null
        : !validTerms
          ? 'Invalid bond master data.'
          : !curve
            ? (curveContext?.state.message ?? 'CCIL curve unavailable.')
            : !canCompareCurve
              ? !quoteTime
                ? 'Exchange quote time unavailable; curve comparison disabled.'
                : 'Exchange quote time is invalid or in the future; curve comparison disabled.'
              : 'Cash flows exceed curve coverage, or fair yield could not be solved.',
      // Remove binary floating-point noise so equal distances receive equal ranks.
      distanceFromFv: sellRate === null ? null : Number(Math.abs(sellRate - 100).toFixed(8)),
      bestRrrRank: null,
      nearFvRank: null,
      quoteStatus: sellRate !== null ? 'ready' : quote ? 'no-sellers' : 'unavailable',
      sellerDepth,
      quoteUpdatedAt: null,
      masterDataStatus: validTerms ? 'ready' : 'invalid',
    };
  });

  for (const [valueKey, rankKey, direction] of [
    ['rrr', 'bestRrrRank', -1],
    ['distanceFromFv', 'nearFvRank', 1],
  ] as const) {
    const sorted = rows
      .filter((row) => row[valueKey] !== null)
      .sort((a, b) => direction * (a[valueKey]! - b[valueKey]!) || gsecKey(a).localeCompare(gsecKey(b)));
    sorted.forEach((row, index) => {
      const previous = sorted[index - 1];
      row[rankKey] = previous && previous[valueKey] === row[valueKey] ? previous[rankKey] : index + 1;
    });
  }

  return rows.sort(
    (a, b) => (a.bestRrrRank ?? Infinity) - (b.bestRrrRank ?? Infinity) || gsecKey(a).localeCompare(gsecKey(b))
  );
}
