import { describe, expect, it } from 'vitest';
import { calculateDelta } from '@server/lib/calculators/delta';

describe('calculateDelta', () => {
  it('returns ~0.5 for at-the-money call with moderate time value', () => {
    const delta = calculateDelta(100, 100, 0.3, 0.25, 'CE');
    expect(delta).toBeCloseTo(0.576, 2);
  });

  it('returns call delta minus one for puts', () => {
    const callDelta = calculateDelta(100, 100, 0.3, 0.25, 'CE');
    const putDelta = calculateDelta(100, 100, 0.3, 0.25, 'PE');
    expect(putDelta).toBeCloseTo(callDelta - 1, 6);
  });

  it('approaches 1 for deep in-the-money calls', () => {
    const delta = calculateDelta(200, 100, 0.25, 0.5, 'CE');
    expect(delta).toBeGreaterThan(0.95);
  });

  it('approaches 0 for deep out-of-the-money calls', () => {
    const delta = calculateDelta(50, 100, 0.25, 0.1, 'CE');
    expect(delta).toBeLessThan(0.05);
  });

  it('returns 0 for non-positive inputs', () => {
    expect(calculateDelta(0, 100, 0.3, 0.25, 'CE')).toBe(0);
    expect(calculateDelta(100, 0, 0.3, 0.25, 'CE')).toBe(0);
    expect(calculateDelta(100, 100, 0, 0.25, 'CE')).toBe(0);
    expect(calculateDelta(100, 100, 0.3, 0, 'CE')).toBe(0);
    expect(calculateDelta(100, 100, -0.3, 0.25, 'CE')).toBe(0);
  });
});
