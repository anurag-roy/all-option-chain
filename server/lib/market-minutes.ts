import { TZDate } from '@date-fns/tz';
import { holidaysTable } from '@server/db/schema';
import { logger } from '@server/lib/logger';
import {
  addDays,
  eachDayOfInterval,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isWeekend,
  parse,
  parseISO,
  startOfDay,
} from 'date-fns';

const INDIA_TIMEZONE = 'Asia/Kolkata';

// NSE cash market session (IST)
const MARKET_OPEN_HOUR = 9;
const MARKET_OPEN_MINUTE = 15;
const MARKET_CLOSE_HOUR = 15;
const MARKET_CLOSE_MINUTE = 30;

export const FULL_TRADING_DAY_MINUTES = 375; // 9:15 AM - 3:30 PM

const MARKET_OPEN_MINUTES = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MINUTE; // 555
const MARKET_CLOSE_MINUTES = MARKET_CLOSE_HOUR * 60 + MARKET_CLOSE_MINUTE; // 930

let holidayCache: Set<string> | null = null;

export async function loadHolidayCache(): Promise<void> {
  const { db } = await import('@server/db');
  const holidays = await db.select({ date: holidaysTable.date }).from(holidaysTable);

  holidayCache = new Set(holidays.map((h) => h.date));
  logger.info(`Loaded ${holidayCache.size} NSE holidays into cache`);
}

export function isHolidayCacheLoaded(): boolean {
  return holidayCache !== null;
}

/** Test helper: seed holiday dates without hitting the database. */
export function setHolidayCacheForTests(holidays: Iterable<string>): void {
  holidayCache = new Set(holidays);
}

/** Test helper: reset holiday cache between tests. */
export function clearHolidayCacheForTests(): void {
  holidayCache = null;
}

function isHoliday(dateStr: string): boolean {
  return holidayCache?.has(dateStr) ?? false;
}

function isTradingDay(date: Date): boolean {
  const indiaDate = new TZDate(date, INDIA_TIMEZONE);
  if (isWeekend(indiaDate)) {
    return false;
  }
  const dateStr = format(indiaDate, 'yyyy-MM-dd');
  return !isHoliday(dateStr);
}

function parseExpiryDate(expiryDate: string): Date {
  if (!expiryDate || typeof expiryDate !== 'string') {
    throw new Error('Invalid expiry date: must be a non-empty string');
  }

  const trimmed = expiryDate.trim();

  if (trimmed.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const parsed = parseISO(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (trimmed.match(/^\d{2}-[A-Z]{3}-\d{4}$/)) {
    const parsed = parse(trimmed, 'dd-MMM-yyyy', new Date());
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) {
    return fallback;
  }

  throw new Error(`Unable to parse expiry date: "${expiryDate}". Expected format: DD-MMM-YYYY or YYYY-MM-DD`);
}

function getMarketMinutesForDay(date: Date): number {
  if (!isTradingDay(date)) {
    return 0;
  }
  return FULL_TRADING_DAY_MINUTES;
}

function getRemainingMinutesToday(now: TZDate): number {
  const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();

  if (!isTradingDay(now)) {
    return 0;
  }

  if (currentTimeInMinutes < MARKET_OPEN_MINUTES) {
    return FULL_TRADING_DAY_MINUTES;
  }

  if (currentTimeInMinutes < MARKET_CLOSE_MINUTES) {
    return MARKET_CLOSE_MINUTES - currentTimeInMinutes;
  }

  return 0;
}

export function calculateMarketMinutesInRange(startDate: Date | string, endDate: Date | string): number {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;

  const indiaStart = new TZDate(startOfDay(start), INDIA_TIMEZONE);
  const indiaEnd = new TZDate(startOfDay(end), INDIA_TIMEZONE);

  if (isAfter(indiaStart, indiaEnd)) {
    throw new Error('Start date must be before or equal to end date');
  }

  const allDays = eachDayOfInterval({ start: indiaStart, end: indiaEnd });

  let totalMinutes = 0;
  for (const day of allDays) {
    totalMinutes += getMarketMinutesForDay(day);
  }

  return totalMinutes;
}

export function calculateMarketMinutesTillExpiry(expiryDate: Date | string): number {
  const now = new TZDate(new Date(), INDIA_TIMEZONE);
  const expiry = typeof expiryDate === 'string' ? parseExpiryDate(expiryDate) : expiryDate;
  const indiaExpiry = new TZDate(startOfDay(expiry), INDIA_TIMEZONE);
  const todayStart = new TZDate(startOfDay(now), INDIA_TIMEZONE);

  if (isBefore(indiaExpiry, todayStart)) {
    return 0;
  }

  if (isSameDay(now, indiaExpiry)) {
    return getRemainingMinutesToday(now);
  }

  let totalMinutes = 0;

  if (isTradingDay(now)) {
    totalMinutes += getRemainingMinutesToday(now);
  }

  const tomorrow = addDays(todayStart, 1);

  if (!isAfter(tomorrow, indiaExpiry)) {
    const futureDays = eachDayOfInterval({ start: tomorrow, end: indiaExpiry });

    for (const day of futureDays) {
      totalMinutes += getMarketMinutesForDay(day);
    }
  }

  return totalMinutes;
}

export function checkDateStatus(date: Date | string) {
  const checkDate = typeof date === 'string' ? parseISO(date) : date;
  const indiaDate = new TZDate(checkDate, INDIA_TIMEZONE);
  const dateStr = format(indiaDate, 'yyyy-MM-dd');

  const isWeekendDay = isWeekend(indiaDate);
  const isHolidayDay = isHoliday(dateStr);

  return {
    isHoliday: isHolidayDay,
    isWeekend: isWeekendDay,
    isTradingDay: !isWeekendDay && !isHolidayDay,
    marketMinutes: isWeekendDay || isHolidayDay ? 0 : FULL_TRADING_DAY_MINUTES,
  };
}
