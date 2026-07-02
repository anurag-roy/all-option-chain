import { describe, expect, it } from 'vitest';
import {
  calculateAsymmetricBounds,
  calculateSd,
  calculateSigmaN,
  calculateSigmaX,
  calculateSigmaXi,
} from '@server/lib/calculators/sigma';

describe('sigma calculators', () => {
  const marketMinutesInLastYear = 100_000;
  const marketMinutesTillExpiry = 10_000;

  it('scales sigma by the SD multiplier', () => {
    expect(calculateSigmaN(2, 1.5)).toBe(3);
  });

  it('computes sigmaX from market-minute year fraction', () => {
    const sigmaX = calculateSigmaX(2, marketMinutesInLastYear, marketMinutesTillExpiry);
    expect(sigmaX).toBeCloseTo(2 / Math.sqrt(10), 6);
  });

  it('returns 0 for sigmaX when inputs are invalid', () => {
    expect(calculateSigmaX(0, marketMinutesInLastYear, marketMinutesTillExpiry)).toBe(0);
    expect(calculateSigmaX(2, 0, marketMinutesTillExpiry)).toBe(0);
    expect(calculateSigmaX(2, marketMinutesInLastYear, 0)).toBe(0);
  });

  it('adds sigmaX for calls and subtracts for puts', () => {
    expect(calculateSigmaXi(2, 1, 'CE')).toBe(3);
    expect(calculateSigmaXi(2, 1, 'PE')).toBe(1);
  });

  it('returns 0 for sigmaXi when inputs are invalid', () => {
    expect(calculateSigmaXi(0, 1, 'CE')).toBe(0);
    expect(calculateSigmaXi(2, -1, 'CE')).toBe(0);
  });

  it('computes SD from annualized volatility and minute ratio', () => {
    const sd = calculateSd(0.3, marketMinutesInLastYear, marketMinutesTillExpiry);
    expect(sd).toBeCloseTo((0.3 * 100) / Math.sqrt(10), 6);
  });

  it('returns 0 for SD when minute counts are zero', () => {
    expect(calculateSd(0.3, 0, marketMinutesTillExpiry)).toBe(0);
    expect(calculateSd(0.3, marketMinutesInLastYear, 0)).toBe(0);
  });

  it('computes asymmetric CE/PE bounds from LTP and sigmaXi', () => {
    const { ceBound, peBound } = calculateAsymmetricBounds(1000, 4);
    expect(ceBound).toBe(1040);
    expect(peBound).toBe(960);
  });
});
