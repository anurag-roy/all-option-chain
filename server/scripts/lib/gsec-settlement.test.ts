import { describe, expect, it } from 'vitest';
import { getGsecSettlementDates, parseGsecCalendar, parseNseBondDate } from './gsec-settlement';

const calendar = (holidays: string[]) => ({ holidays: new Set(holidays), years: new Set([2026]) });
describe('G-Sec T+1 settlement', () => {
  it('settles on the following weekday and skips weekends', () => {
    expect(getGsecSettlementDates('2026-10-06', calendar([]), calendar([]))).toEqual({
      tradeDate: '2026-10-06',
      settlementDate: '2026-10-07',
    });
    expect(getGsecSettlementDates('2026-10-09', calendar([]), calendar([]))).toEqual({
      tradeDate: '2026-10-09',
      settlementDate: '2026-10-12',
    });
  });
  it('uses the next trade day on weekends and trading holidays', () => {
    expect(getGsecSettlementDates('2026-10-10', calendar(['2026-10-12']), calendar(['2026-10-12']))).toEqual({
      tradeDate: '2026-10-13',
      settlementDate: '2026-10-14',
    });
  });
  it('skips clearing-only holidays without skipping an open trade day', () => {
    expect(getGsecSettlementDates('2026-03-31', calendar([]), calendar(['2026-04-01']))).toEqual({
      tradeDate: '2026-03-31',
      settlementDate: '2026-04-02',
    });
  });
  it('refuses dates outside the published calendar year rather than guessing', () => {
    expect(() => getGsecSettlementDates('2026-12-31', calendar([]), calendar([]))).toThrow('does not cover 2027');
  });
  it('validates NSE’s calendar dates and rejects missing or malformed calendars', () => {
    expect(parseNseBondDate('22-feb-2061')).toBe('2061-02-22');
    expect(parseNseBondDate('30-FEB-2061')).toBeNull();
    expect(parseGsecCalendar({ CM: [{ tradingDate: '01-Apr-2026' }] }).holidays.has('2026-04-01')).toBe(true);
    expect(() => parseGsecCalendar({ CM: [] })).toThrow();
    expect(() => parseGsecCalendar({ CM: [{ tradingDate: 'invalid' }] })).toThrow();
  });
});
