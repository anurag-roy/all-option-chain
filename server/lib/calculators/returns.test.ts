import { describe, expect, it } from 'vitest';
import {
  calculateReturnValue,
  calculateSellValue,
  calculateStrikePosition,
} from '@server/lib/calculators/returns';

describe('returns calculators', () => {
  it('subtracts bid balance and scales by lot size for sell value', () => {
    expect(calculateSellValue(10, 50)).toBe((10 - 0.05) * 50);
  });

  it('computes strike position as percent distance from LTP', () => {
    expect(calculateStrikePosition(110, 100)).toBe(10);
  });

  it('computes return value as sell value over margin', () => {
    expect(calculateReturnValue(500, 10_000)).toBe(5);
  });

  it('returns 0 return when margin is non-positive', () => {
    expect(calculateReturnValue(500, 0)).toBe(0);
    expect(calculateReturnValue(500, -100)).toBe(0);
  });
});
