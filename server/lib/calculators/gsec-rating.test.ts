import { calculateGsecRating } from '@server/lib/calculators/gsec-rating';
import { describe, expect, it } from 'vitest';

const worked = { currentYtm: 7.8496, targetYtm: 8, zSpreadBp: 0.41, carryRoll1Y: 7.7218, shockPlus80Percent: -8.34 };

describe('G-Sec opportunity rating', () => {
  it('reproduces the technical note and reconciles displayed contributions', () => {
    const rating = calculateGsecRating(worked);
    expect(rating).toMatchObject({
      score: 52.83,
      color: 'yellow',
      label: 'Fair but Cautious',
      unavailableReason: null,
    });
    const [target, value, carry, sensitivity] = rating.factors;
    expect(target!.actual).toBeCloseTo(-15.04, 10);
    expect(rating.factors.map((factor) => Number(factor.score!.toFixed(2)))).toEqual([39.84, 52.05, 96.52, 30.5]);
    expect(rating.factors.map((factor) => factor.contribution)).toEqual([15.94, 13.01, 19.3, 4.58]);
    expect(rating.factors.map((factor) => factor.color)).toEqual(['orange', 'yellow', 'green', 'orange']);
    expect(carry!.ratioPercent).toBeCloseTo(96.5225, 10);
    expect(value!.actual).toBe(0.41);
    expect(sensitivity!.actual).toBe(-8.34);
  });

  it.each([
    { currentYtm: 8, target: 'blue' },
    { currentYtm: 7.95, target: 'green' },
    { currentYtm: 7.9, target: 'yellow' },
    { currentYtm: 7.8, target: 'orange' },
    { currentYtm: 7.799, target: 'red' },
  ])('uses target raw-metric thresholds including exact boundaries: %j', ({ currentYtm, target }) => {
    expect(calculateGsecRating({ ...worked, currentYtm }).factors[0]!.color).toBe(target);
  });

  it.each([
    [10, 'blue'],
    [3, 'green'],
    [-3, 'yellow'],
    [-10, 'orange'],
    [-10.01, 'red'],
  ] as const)('classifies signed Z-spread %s as %s', (zSpreadBp, color) => {
    expect(calculateGsecRating({ ...worked, zSpreadBp }).factors[1]!.color).toBe(color);
  });
  it.each([
    [8, 'blue'],
    [7.2, 'green'],
    [6, 'yellow'],
    [4, 'orange'],
    [3.99, 'red'],
  ] as const)('classifies carry %s as %s', (carryRoll1Y, color) => {
    expect(calculateGsecRating({ ...worked, carryRoll1Y }).factors[2]!.color).toBe(color);
  });
  it.each([
    [-2, 'blue'],
    [-4.5, 'green'],
    [-7, 'yellow'],
    [-10, 'orange'],
    [-10.01, 'red'],
  ] as const)('classifies exact stress %s as %s', (shockPlus80Percent, color) => {
    expect(calculateGsecRating({ ...worked, shockPlus80Percent }).factors[3]!.color).toBe(color);
  });
  it('clamps extreme factor scores and reaches both overall scale endpoints', () => {
    const best = calculateGsecRating({
      currentYtm: 9,
      targetYtm: 8,
      zSpreadBp: 100,
      carryRoll1Y: 20,
      shockPlus80Percent: 0,
    });
    expect(best).toMatchObject({ score: 100, color: 'blue' });
    const worst = calculateGsecRating({
      currentYtm: 1,
      targetYtm: 8,
      zSpreadBp: -100,
      carryRoll1Y: -10,
      shockPlus80Percent: -50,
    });
    expect(worst).toMatchObject({ score: 0, color: 'red' });
  });
  it.each(['currentYtm', 'targetYtm', 'zSpreadBp', 'carryRoll1Y', 'shockPlus80Percent'] as const)(
    'does not invent a total or reweight remaining factors when %s is missing or invalid',
    (key) => {
      for (const invalid of [null, NaN, Infinity]) {
        const rating = calculateGsecRating({ ...worked, [key]: invalid });
        expect(rating.score).toBeNull();
        expect(rating.color).toBeNull();
        expect(rating.unavailableReason).toBeTruthy();
      }
    }
  );
  it('reports zero-target division as unavailable', () => {
    expect(calculateGsecRating({ ...worked, targetYtm: 0 })).toMatchObject({
      score: null,
      unavailableReason: 'Rating requires a target YTM above 0%.',
    });
  });
  it('reconciles rounded contributions over a range of targets and spreads', () => {
    for (const targetYtm of [5.5, 7.777, 8, 9.333])
      for (const zSpreadBp of [-12.3456, 0, 7.239]) {
        const rating = calculateGsecRating({ ...worked, targetYtm, zSpreadBp });
        const totalCents = rating.factors.reduce((sum, factor) => sum + Math.round(factor.contribution! * 100), 0);
        expect(rating.score).toBe(totalCents / 100);
      }
  });
});
