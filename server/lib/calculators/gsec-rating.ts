import type { GsecOpportunityRating, GsecRatingColor, GsecRatingFactor } from '@shared/types/gsec-rating';

const clamp = (value: number) => Math.min(100, Math.max(0, value));
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const valid = (value: number | null) => value !== null && Number.isFinite(value);
const finiteOrNull = (value: number | null) => (valid(value) ? value : null);

export const scoreGsecTargetFit = (gapBp: number) => clamp(100 + 4 * gapBp);
export const scoreGsecRelativeValue = (zSpreadBp: number) => clamp(50 + 5 * zSpreadBp);
export const scoreGsecCarryRoll = (ratioPercent: number) => clamp(ratioPercent);
export const scoreGsecRateSensitivity = (shockPlus80Percent: number) =>
  clamp(100 * (1 - Math.abs(shockPlus80Percent) / 12));

function ratingBand(score: number): { color: GsecRatingColor; label: string } {
  if (score < 20) return { color: 'red', label: 'Worst / Danger' };
  if (score < 40) return { color: 'orange', label: 'Very Cautious / Almost Danger' };
  if (score < 60) return { color: 'yellow', label: 'Fair but Cautious' };
  if (score < 80) return { color: 'green', label: 'Fair and Clean' };
  return { color: 'blue', label: 'One of the Best' };
}

// Ignore sub-nanobasis-point floating-point noise at an exact band boundary.
function lowerBoundColor(value: number | null, thresholds: readonly number[]): GsecRatingColor | null {
  if (!valid(value)) return null;
  const colors = ['blue', 'green', 'yellow', 'orange'] as const;
  const index = thresholds.findIndex((threshold) => value! >= threshold - 1e-8);
  return index === -1 ? 'red' : colors[index]!;
}

/** Raw metric bands are independent of the normalized factor-score bands. */
export function calculateGsecRating({
  currentYtm,
  targetYtm,
  zSpreadBp,
  carryRoll1Y,
  shockPlus80Percent,
}: {
  currentYtm: number | null;
  targetYtm: number | null;
  zSpreadBp: number | null;
  carryRoll1Y: number | null;
  shockPlus80Percent: number | null;
}): GsecOpportunityRating {
  const gap = finiteOrNull(valid(currentYtm) && valid(targetYtm) ? (currentYtm! - targetYtm!) * 100 : null);
  const ratio = finiteOrNull(
    valid(carryRoll1Y) && valid(targetYtm) && targetYtm! > 0 ? (100 * carryRoll1Y!) / targetYtm! : null
  );
  const loss = valid(shockPlus80Percent) ? Math.abs(shockPlus80Percent!) : null;
  const factors: GsecRatingFactor[] = [
    {
      id: 'target',
      label: 'Target Fit',
      weight: 40,
      actual: gap,
      score: gap === null ? null : scoreGsecTargetFit(gap),
      color: lowerBoundColor(gap, [0, -5, -10, -20]),
      contribution: null,
    },
    {
      id: 'value',
      label: 'Relative Value',
      weight: 25,
      actual: valid(zSpreadBp) ? zSpreadBp : null,
      score: valid(zSpreadBp) ? scoreGsecRelativeValue(zSpreadBp!) : null,
      color: lowerBoundColor(zSpreadBp, [10, 3, -3, -10]),
      contribution: null,
    },
    {
      id: 'carry',
      label: 'Carry + Roll',
      weight: 20,
      actual: valid(carryRoll1Y) ? carryRoll1Y : null,
      ratioPercent: ratio,
      score: ratio === null ? null : scoreGsecCarryRoll(ratio),
      color: lowerBoundColor(ratio, [100, 90, 75, 50]),
      contribution: null,
    },
    {
      id: 'sensitivity',
      label: 'Rate Sensitivity',
      weight: 15,
      actual: valid(shockPlus80Percent) ? shockPlus80Percent : null,
      score: loss === null ? null : scoreGsecRateSensitivity(shockPlus80Percent!),
      color: lowerBoundColor(loss === null ? null : -loss, [-2, -4.5, -7, -10]),
      contribution: null,
    },
  ];
  for (const factor of factors) {
    factor.contribution = factor.score === null ? null : cents((factor.score * factor.weight) / 100);
  }
  const missing = factors.filter((factor) => factor.score === null);
  if (missing.length)
    return {
      score: null,
      color: null,
      label: 'Unavailable',
      factors,
      unavailableReason:
        targetYtm === 0
          ? 'Rating requires a target YTM above 0%.'
          : `${missing.map((factor) => factor.label).join(', ')} unavailable.`,
    };
  // Sum displayed contributions so the breakdown reconciles to the displayed total.
  const score = cents(factors.reduce((sum, factor) => sum + factor.contribution!, 0));
  return { score, ...ratingBand(score), factors, unavailableReason: null };
}
