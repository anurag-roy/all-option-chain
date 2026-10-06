import { parseBondDate } from '@server/lib/calculators/gsec-ytm';
import { z } from 'zod';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function parseNseBondDate(value: string): string | null {
  const match = /^(\d{1,2})-([A-Z]{3})-(\d{4})$/.exec(value.trim().toUpperCase());
  if (!match) return null;
  const month = MONTHS.indexOf(match[2]!) + 1;
  const iso = `${match[3]}-${String(month).padStart(2, '0')}-${match[1]!.padStart(2, '0')}`;
  return parseBondDate(iso) ? iso : null;
}

type Calendar = { holidays: Set<string>; years: Set<number> };
const calendarSchema = z.object({ CM: z.array(z.object({ tradingDate: z.string() })).min(1) });

export function parseGsecCalendar(payload: unknown): Calendar {
  const holidays = new Set<string>();
  const years = new Set<number>();
  for (const row of calendarSchema.parse(payload).CM) {
    const date = parseNseBondDate(row.tradingDate);
    if (!date) throw new Error(`Invalid NSE calendar date: ${row.tradingDate}`);
    holidays.add(date);
    years.add(Number(date.slice(0, 4)));
  }
  return { holidays, years };
}

// Use trading holidays to find T, and clearing holidays to find T+1. Bank-only
// holidays (e.g. 1 April) must not be treated as ordinary settlement days.
export function getGsecSettlementDates(day: string, trading: Calendar, clearing: Calendar) {
  if (!parseBondDate(day)) throw new Error('Invalid G-Sec seed date');
  const nextOpen = (start: string, calendar: Calendar) => {
    const date = new Date(`${start}T00:00:00Z`);
    for (let i = 0; i < 30; i++) {
      if (!calendar.years.has(date.getUTCFullYear())) {
        throw new Error(`NSE calendar does not cover ${date.getUTCFullYear()}; cannot determine G-Sec settlement.`);
      }
      const iso = date.toISOString().slice(0, 10);
      if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6 && !calendar.holidays.has(iso)) return iso;
      date.setUTCDate(date.getUTCDate() + 1);
    }
    throw new Error('Could not determine G-Sec settlement within 30 days');
  };
  const tradeDate = nextOpen(day, trading);
  const next = new Date(`${tradeDate}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { tradeDate, settlementDate: nextOpen(next.toISOString().slice(0, 10), clearing) };
}
