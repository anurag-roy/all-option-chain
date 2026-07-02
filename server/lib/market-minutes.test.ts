import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FULL_TRADING_DAY_MINUTES,
  calculateMarketMinutesInRange,
  calculateMarketMinutesTillExpiry,
  checkDateStatus,
  clearHolidayCacheForTests,
  setHolidayCacheForTests,
} from '@server/lib/market-minutes';

function istInstant(isoDate: string, hour: number, minute = 0): Date {
  const [year, month, day] = isoDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day, hour - 5, minute - 30));
}

describe('market minutes', () => {
  beforeEach(() => {
    clearHolidayCacheForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearHolidayCacheForTests();
  });

  it('uses a full 375-minute NSE session', () => {
    expect(FULL_TRADING_DAY_MINUTES).toBe(375);
  });

  it('counts only weekdays in a date range', () => {
    const minutes = calculateMarketMinutesInRange('2026-06-29', '2026-07-03');
    expect(minutes).toBe(5 * FULL_TRADING_DAY_MINUTES);
  });

  it('excludes configured holidays from range totals', () => {
    setHolidayCacheForTests(['2026-07-01']);
    const minutes = calculateMarketMinutesInRange('2026-06-29', '2026-07-03');
    expect(minutes).toBe(4 * FULL_TRADING_DAY_MINUTES);
  });

  it('throws when the start date is after the end date', () => {
    expect(() => calculateMarketMinutesInRange('2026-07-03', '2026-06-29')).toThrow(
      'Start date must be before or equal to end date'
    );
  });

  it('marks weekends as non-trading days', () => {
    const status = checkDateStatus('2026-07-05');
    expect(status.isWeekend).toBe(true);
    expect(status.isTradingDay).toBe(false);
    expect(status.marketMinutes).toBe(0);
  });

  it('marks holidays as non-trading days', () => {
    setHolidayCacheForTests(['2026-07-02']);
    const status = checkDateStatus('2026-07-02');
    expect(status.isHoliday).toBe(true);
    expect(status.isTradingDay).toBe(false);
    expect(status.marketMinutes).toBe(0);
  });

  it('returns remaining session minutes on expiry day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(istInstant('2026-07-02', 10));

    expect(calculateMarketMinutesTillExpiry('2026-07-02')).toBe(330);
    expect(calculateMarketMinutesTillExpiry('02-JUL-2026')).toBe(330);
  });

  it('includes future trading days until expiry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(istInstant('2026-07-02', 10));

    expect(calculateMarketMinutesTillExpiry('2026-07-03')).toBe(330 + FULL_TRADING_DAY_MINUTES);
  });

  it('returns 0 for expiries before today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(istInstant('2026-07-02', 10));

    expect(calculateMarketMinutesTillExpiry('2026-07-01')).toBe(0);
  });

  it('returns full session minutes before market open on expiry day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(istInstant('2026-07-02', 8));

    expect(calculateMarketMinutesTillExpiry('2026-07-02')).toBe(FULL_TRADING_DAY_MINUTES);
  });

  it('returns 0 after market close on expiry day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(istInstant('2026-07-02', 16));

    expect(calculateMarketMinutesTillExpiry('2026-07-02')).toBe(0);
  });
});
