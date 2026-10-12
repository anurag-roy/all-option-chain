import { calculateGsecScenarios } from '@server/lib/calculators/gsec-analytics';
import { createGsecCashFlows } from '@server/lib/calculators/gsec-cash-flows';
import type { GsecScan } from '@shared/types/gsecs';

/** Reprice the cached seller quotes without changing the scanner or any other browser's base. */
export function withGsecScenarioBase(snapshot: GsecScan, scenarioBase: number): GsecScan {
  if (snapshot.scenarioBase === scenarioBase) return snapshot;
  return {
    ...snapshot,
    scenarioBase,
    rows: snapshot.rows.map((row) => {
      if (!row.analytics || row.sellRate === null) return row;
      const cashFlows = createGsecCashFlows({ ...row, settlementDate: snapshot.settlementDate });
      return {
        ...row,
        analytics: {
          ...row.analytics,
          scenarios: cashFlows
            ? calculateGsecScenarios({ cashFlows, ytm: row.analytics.ytm, dirtyPrice: row.sellRate, scenarioBase })
            : [],
        },
      };
    }),
  };
}
