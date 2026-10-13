import { calculateGsecAnalytics } from '@server/lib/calculators/gsec-analytics';
import { withGsecScenarioBase } from '@server/lib/calculators/gsec-scenarios';
import { calculateGsecDirtyPrice } from '@server/lib/calculators/gsec-ytm';
import { gsecScenarioShocks } from '@shared/lib/gsec-scenario-shocks';
import { gsecScenarioBaseSchema } from '@shared/schemas/gsecs';
import type { GsecRow, GsecScan } from '@shared/types/gsecs';
import { describe, expect, it } from 'vitest';

const terms = { coupon: 709, maturityDate: '2054-08-05', settlementDate: '2026-10-08' };
function listing(exchange: 'NSE' | 'BSE', price: number): GsecRow {
  const analytics = calculateGsecAnalytics({ ...terms, dirtyPrice: price })!;
  return {
    exchange,
    tradingsymbol: exchange === 'NSE' ? '709GS2054-GS' : '709GOI54',
    isin: 'shared-isin',
    coupon: 709,
    maturityDate: terms.maturityDate,
    maturityYear: 2054,
    tickSize: exchange === 'NSE' ? 0.01 : 0.05,
    sellRate: price,
    rrr: analytics.ytm,
    analytics,
    curveAnalytics: null,
    curveUnavailableReason: null,
    bestRrrRank: 1,
    distanceFromFv: Math.abs(price - 100),
    nearFvRank: 1,
    quoteStatus: 'ready',
    quoteUpdatedAt: '2026-10-08T05:00:00Z',
    masterDataStatus: 'ready',
    sellerDepth: [{ price, quantity: 10, orders: 1 }],
  };
}
const source: GsecScan = {
  scenarioBase: 0,
  rows: [listing('NSE', 95.3), listing('BSE', 96)],
  revision: 1,
  sourceUrl: 'https://zerodha.com/approved-securities/',
  approvedListFetchedAt: '2026-10-08T04:00:00Z',
  quotesFetchedAt: '2026-10-08T05:00:00Z',
  tradeDate: '2026-10-07',
  settlementDate: terms.settlementDate,
  streamStatus: 'live',
};

describe('custom G-Sec scenario bases', () => {
  it('uses the agreed default and mirrored nonzero grid', () => {
    expect(gsecScenarioShocks(0)).toEqual([-80, -40, -20, -10, -5, 0, 5, 10, 20, 40, 80]);
    expect(gsecScenarioShocks(10)).toEqual([-240, -120, -60, -30, -15, 10, 15, 30, 60, 120, 240]);
  });

  it('accepts fractional and negative bases and avoids duplicate shock rows', () => {
    expect(gsecScenarioShocks(0.5)).toEqual([-88, -44, -22, -11, -5.5, 0.5, 5.5, 11, 22, 44, 88]);
    expect(gsecScenarioShocks(-5)).toEqual([-5, 0]);
    expect(gsecScenarioShocks(-10)).toEqual([-80, -40, -20, -10, -5, 5, 10, 20, 40, 80]);
    expect(gsecScenarioBaseSchema.safeParse(-10).success).toBe(true);
  });

  it.each([NaN, Infinity, -Infinity, 1e308, -1e308])('rejects a non-finite or overflowing base %s', (base) => {
    expect(gsecScenarioBaseSchema.safeParse(base).success).toBe(false);
  });

  it('reprices both venues from their own seller yield without modifying the source, risk, carry or quotes', () => {
    const original = structuredClone(source);
    const custom = withGsecScenarioBase(source, 10);
    expect(custom.scenarioBase).toBe(10);
    expect(custom.revision).toBe(source.revision);
    custom.rows.forEach((row, index) => {
      const unchanged = source.rows[index]!;
      expect(row.analytics!.risk).toBe(unchanged.analytics!.risk);
      expect(row.analytics!.carry).toBe(unchanged.analytics!.carry);
      expect(row.sellerDepth).toBe(unchanged.sellerDepth);
      for (const scenario of row.analytics!.scenarios) {
        const expected = calculateGsecDirtyPrice({ ...terms, yieldPercent: unchanged.rrr! + scenario.shockBp / 100 });
        expect(scenario.dirtyPrice).toBeCloseTo(expected!, 10);
        expect(scenario.priceChangePercent).toBeCloseTo((expected! / unchanged.sellRate! - 1) * 100, 10);
      }
    });
    expect(custom.rows[0]!.analytics!.scenarios[5]!.dirtyPrice).not.toBe(
      custom.rows[1]!.analytics!.scenarios[5]!.dirtyPrice
    );
    expect(source).toEqual(original);
    expect(withGsecScenarioBase(source, 0)).toBe(source);
  });

  it('preserves missing sellers and keeps valid analytics when an extreme shock cannot be priced', () => {
    const noSellers = { ...source.rows[0]!, sellRate: null, analytics: null, rrr: null };
    const custom = withGsecScenarioBase({ ...source, rows: [noSellers, source.rows[0]!] }, 20000);
    expect(custom.rows[0]).toBe(noSellers);
    expect(custom.rows[1]!.analytics!.scenarios[0]).toMatchObject({ dirtyPrice: null, priceChangePercent: null });
    expect(custom.rows[1]!.analytics!.risk).toBe(source.rows[0]!.analytics!.risk);
    expect(JSON.stringify(custom)).not.toContain('Infinity');
  });
});
