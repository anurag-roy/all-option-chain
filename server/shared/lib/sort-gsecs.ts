import { gsecKey } from '@shared/lib/gsec-key';
import type { GsecRow } from '@shared/types/gsecs';

export type GsecSortColumn =
  | 'rank'
  | 'maturity'
  | 'sellRate'
  | 'ytm'
  | 'buyRate'
  | 'modifiedDuration'
  | 'dv01'
  | 'convexity'
  | 'curveSpread'
  | 'zSpread'
  | 'relativeValue';
export type GsecSort = { column: GsecSortColumn; descending: boolean };
type SortValue = string | number | null;
const relativeValueOrder = { CHEAP: 0, FAIR: 1, RICH: 2 };

function sortValue(row: GsecRow, column: GsecSortColumn, buyPrices: Record<string, number | null>): SortValue {
  switch (column) {
    case 'rank':
      return row.bestRrrRank;
    case 'maturity':
      return row.maturityDate;
    case 'sellRate':
      return row.sellRate;
    case 'ytm':
      return row.rrr;
    case 'buyRate':
      return buyPrices[gsecKey(row)] ?? null;
    case 'modifiedDuration':
      return row.analytics?.risk?.modifiedDuration ?? null;
    case 'dv01':
      return row.analytics?.risk?.dv01 ?? null;
    case 'convexity':
      return row.analytics?.risk?.convexity ?? null;
    case 'curveSpread':
      return row.curveAnalytics?.spreadBp ?? null;
    case 'zSpread': {
      const spread = row.curveAnalytics?.zSpreadBp;
      return spread == null || !Number.isFinite(spread) ? null : Math.abs(spread);
    }
    case 'relativeValue': {
      const value = row.curveAnalytics?.relativeValue;
      return value ? relativeValueOrder[value] : null;
    }
  }
}

function compareValues(a: SortValue, b: SortValue, descending = false): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  const order =
    typeof a === 'string' && typeof b === 'string'
      ? a.localeCompare(b, 'en', { numeric: true })
      : Number(a) - Number(b);
  return (descending ? -1 : 1) * order;
}

/** Sort raw values (absolute Z-spread) and ISO dates, keeping missing values last and rows intact. */
export function sortGsecRows(
  rows: readonly GsecRow[],
  sort: GsecSort,
  buyPrices: Record<string, number | null> = {}
): GsecRow[] {
  return [...rows].sort(
    (a, b) =>
      compareValues(sortValue(a, sort.column, buyPrices), sortValue(b, sort.column, buyPrices), sort.descending) ||
      compareValues(a.bestRrrRank, b.bestRrrRank) ||
      gsecKey(a).localeCompare(gsecKey(b))
  );
}
