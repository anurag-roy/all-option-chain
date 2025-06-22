import { db } from '@/db';
import { holidaysTable } from '@/db/schema';
import { sql } from 'drizzle-orm';
import {
  eachDayOfInterval,
  isWeekend,
  format,
  parseISO,
  startOfDay,
  isAfter,
  isBefore,
  isSameDay,
  parse,
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const INDIA_TIMEZONE = 'Asia/Kolkata';

/**
 * Get all holidays from database for a given date range
 */
async function getHolidaysInRange(startDate: Date, endDate: Date): Promise<Set<string>> {
  const start = format(startDate, 'yyyy-MM-dd');
  const end = format(endDate, 'yyyy-MM-dd');

  const holidays = await db
    .select({ date: holidaysTable.date })
    .from(holidaysTable)
    .where(sql`date BETWEEN ${start} AND ${end}`);

  return new Set(holidays.map((h) => h.date));
}

/**
 * Check if a date is a working day (not weekend, not holiday)
 * @param date - Date to check
 * @param holidaySet - Set of holiday dates in YYYY-MM-DD format
 * @returns true if it's a working day
 */
function isWorkingDay(date: Date, holidaySet: Set<string>): boolean {
  // Convert to India timezone for accurate weekend calculation
  const indiaDate = toZonedTime(date, INDIA_TIMEZONE);

  // Check if it's a weekend (Saturday = 6, Sunday = 0)
  if (isWeekend(indiaDate)) {
    return false;
  }

  // Check if it's a holiday
  const dateStr = format(indiaDate, 'yyyy-MM-dd');
  if (holidaySet.has(dateStr)) {
    return false;
  }

  return true;
}

/**
 * Calculate the number of working days between two dates (inclusive)
 * Working days exclude weekends (Saturday, Sunday) and holidays
 *
 * @param startDate - Start date (inclusive)
 * @param endDate - End date (inclusive)
 * @returns Promise<number> - Number of working days
 */
export async function calculateWorkingDays(startDate: Date | string, endDate: Date | string): Promise<number> {
  // Parse dates if they're strings
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;

  // Convert to India timezone
  const indiaStart = toZonedTime(startOfDay(start), INDIA_TIMEZONE);
  const indiaEnd = toZonedTime(startOfDay(end), INDIA_TIMEZONE);

  // Validate date range
  if (isAfter(indiaStart, indiaEnd)) {
    throw new Error('Start date must be before or equal to end date');
  }

  // Get holidays in the date range
  const holidaySet = await getHolidaysInRange(indiaStart, indiaEnd);

  // Get all days in the interval
  const allDays = eachDayOfInterval({ start: indiaStart, end: indiaEnd });

  // Count working days
  let workingDaysCount = 0;
  for (const day of allDays) {
    if (isWorkingDay(day, holidaySet)) {
      workingDaysCount++;
    }
  }

  return workingDaysCount;
}

/**
 * Parse expiry date string to Date object
 * Handles both ISO format (YYYY-MM-DD) and Shoonya format (DD-MMM-YYYY)
 */
function parseExpiryDate(expiryDate: string): Date {
  if (!expiryDate || typeof expiryDate !== 'string') {
    throw new Error('Invalid expiry date: must be a non-empty string');
  }

  const trimmed = expiryDate.trim();

  // Try ISO format first (YYYY-MM-DD)
  if (trimmed.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const parsed = parseISO(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Try Shoonya format (DD-MMM-YYYY)
  if (trimmed.match(/^\d{2}-[A-Z]{3}-\d{4}$/)) {
    const parsed = parse(trimmed, 'dd-MMM-yyyy', new Date());
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Fallback: try native Date parsing
  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) {
    return fallback;
  }

  throw new Error(`Unable to parse expiry date: "${expiryDate}". Expected format: DD-MMM-YYYY or YYYY-MM-DD`);
}

/**
 * Calculate working days to expiry from today
 * @param expiryDate - Expiry date of the option contract (DD-MMM-YYYY or YYYY-MM-DD format)
 * @returns Promise<number> - Number of working days from today to expiry
 */
export async function calculateWorkingDaysToExpiry(expiryDate: Date | string): Promise<number> {
  const today = toZonedTime(new Date(), INDIA_TIMEZONE);
  const expiry = typeof expiryDate === 'string' ? parseExpiryDate(expiryDate) : expiryDate;
  const indiaExpiry = toZonedTime(expiry, INDIA_TIMEZONE);

  // If expiry is today, return 0
  if (isSameDay(today, indiaExpiry)) {
    return 0;
  }

  // If expiry is in the past, return 0
  if (isBefore(indiaExpiry, today)) {
    return 0;
  }

  return calculateWorkingDays(today, indiaExpiry);
}

/**
 * Check if a specific date is a holiday or weekend
 * @param date - Date to check
 * @returns Promise<{ isHoliday: boolean; isWeekend: boolean; isWorkingDay: boolean; holidayName?: string }>
 */
export async function checkDateStatus(date: Date | string) {
  const checkDate = typeof date === 'string' ? parseISO(date) : date;
  const indiaDate = toZonedTime(checkDate, INDIA_TIMEZONE);
  const dateStr = format(indiaDate, 'yyyy-MM-dd');

  // Check if it's a weekend
  const isWeekendDay = isWeekend(indiaDate);

  // Check if it's a holiday
  const holiday = await db
    .select({ name: holidaysTable.name })
    .from(holidaysTable)
    .where(sql`date = ${dateStr}`)
    .limit(1);

  const isHoliday = holiday.length > 0;
  const holidayName = isHoliday ? holiday[0].name : undefined;

  return {
    isHoliday,
    isWeekend: isWeekendDay,
    isWorkingDay: !isWeekendDay && !isHoliday,
    holidayName,
  };
}

// Import sql from drizzle-orm for the WHERE clause
