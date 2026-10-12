import { createGsecCashFlows, priceGsecCashFlows, type GsecBondTerms } from '@server/lib/calculators/gsec-cash-flows';

export { parseBondDate } from '@server/lib/calculators/gsec-cash-flows';

// Forward pricing and inverse YTM must use exactly the same coupon schedule.
function createBondPricer(terms: GsecBondTerms) {
  const cashFlows = createGsecCashFlows(terms);
  return cashFlows ? (yieldRate: number) => priceGsecCashFlows(cashFlows, yieldRate * 100) : null;
}

/** Theoretical dirty price per ₹100 FV at a quoted annual yield in percent. */
export function calculateGsecDirtyPrice({
  yieldPercent,
  ...terms
}: GsecBondTerms & { yieldPercent: number }): number | null {
  if (!Number.isFinite(yieldPercent) || yieldPercent <= -200) return null;
  const presentValue = createBondPricer(terms);
  if (!presentValue) return null;
  const price = presentValue(yieldPercent / 100);
  return Number.isFinite(price) && price > 0 ? price : null;
}

/** Dirty price ceiling floored to the listing's trading tick, never rounded up. */
export function calculateGsecMaxBuyPrice({
  targetYtm,
  tickSize = 0.01,
  ...terms
}: GsecBondTerms & { targetYtm: number; tickSize?: number }): number | null {
  const tickPaise = tickSize * 100;
  if (!Number.isSafeInteger(tickPaise) || tickPaise <= 0) return null;
  const price = calculateGsecDirtyPrice({ ...terms, yieldPercent: targetYtm });
  if (price === null) return null;
  return (Math.floor((price * 100) / tickPaise) * tickPaise) / 100;
}

/** Quoted annual YTM in percent, using the seller's dirty price per ₹100 FV. */
export function calculateGsecYtm({ dirtyPrice, ...terms }: GsecBondTerms & { dirtyPrice: number }): number | null {
  if (!Number.isFinite(dirtyPrice) || dirtyPrice <= 0) return null;
  const presentValue = createBondPricer(terms);
  if (!presentValue) return null;

  // Check the bracket; a fixed 0–30% search silently clamps negative/high yields.
  let low = -1.999999;
  let high = 0.3;
  if (presentValue(low) < dirtyPrice) return null;
  for (let i = 0; presentValue(high) > dirtyPrice && i < 40; i++) high *= 2;
  if (presentValue(high) > dirtyPrice) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    if (presentValue(mid) > dirtyPrice) low = mid;
    else high = mid;
  }
  const yieldPercent = ((low + high) / 2) * 100;
  return Number.isFinite(yieldPercent) ? yieldPercent : null;
}
