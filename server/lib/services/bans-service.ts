import { TZDate } from '@date-fns/tz';
import { db } from '@server/db';
import { stockBansTable } from '@server/db/schema';
import { logger } from '@server/lib/logger';
import type { BannedStock, BansResponse } from '@shared/schemas/bans';
import { format } from 'date-fns';
import { and, eq } from 'drizzle-orm';

const INDIA_TIMEZONE = 'Asia/Kolkata';
const NSE_BAN_CSV_URL = 'https://nsearchives.nseindia.com/content/fo/fo_secban.csv';

let nseEnsuredForDate: string | null = null;

export function getTodayBanDate() {
  return format(new TZDate(Date.now(), INDIA_TIMEZONE), 'yyyy-MM-dd');
}

export async function fetchNseBanSymbols() {
  try {
    const response = await fetch(NSE_BAN_CSV_URL);
    if (!response.ok) {
      logger.warn(`NSE ban CSV fetch failed with status ${response.status}`);
      return [];
    }

    const csv = await response.text();
    const rows = csv.split('\n');
    rows.shift();

    return rows.map((row) => row.split(',').pop()?.trim() ?? '').filter(Boolean);
  } catch (error) {
    logger.error('Failed to fetch NSE ban CSV:', error);
    return [];
  }
}

async function hasTodayNseBans(today: string) {
  const [row] = await db
    .select({ name: stockBansTable.name })
    .from(stockBansTable)
    .where(and(eq(stockBansTable.type, 'nse'), eq(stockBansTable.banDate, today)))
    .limit(1);

  return Boolean(row);
}

export async function ensureTodayNseBans() {
  const today = getTodayBanDate();
  if (nseEnsuredForDate === today) {
    return;
  }

  const hasToday = await hasTodayNseBans(today);
  if (hasToday) {
    nseEnsuredForDate = today;
    return;
  }

  const symbols = await fetchNseBanSymbols();
  const now = new Date().toISOString();

  await db.delete(stockBansTable).where(eq(stockBansTable.type, 'nse'));

  if (symbols.length > 0) {
    await db.insert(stockBansTable).values(
      symbols.map((name) => ({
        name,
        type: 'nse' as const,
        banDate: today,
        createdAt: now,
      }))
    );
  }

  nseEnsuredForDate = today;
  logger.info(`Stored ${symbols.length} NSE ban symbols for ${today}`);
}

export async function getBannedStocks(): Promise<BannedStock[]> {
  const today = getTodayBanDate();
  const rows = await db
    .select({
      name: stockBansTable.name,
      type: stockBansTable.type,
      banDate: stockBansTable.banDate,
    })
    .from(stockBansTable);

  return rows
    .filter((row) => row.type === 'custom' || row.banDate === today)
    .map((row) => ({
      name: row.name,
      type: row.type,
    }));
}

export async function getBannedNames() {
  const bans = await getBannedStocks();
  return new Set(bans.map((ban) => ban.name));
}

export async function getBansResponse(): Promise<BansResponse> {
  await ensureTodayNseBans();
  const bans = await getBannedStocks();
  const nseCount = bans.filter((ban) => ban.type === 'nse').length;
  const customCount = bans.filter((ban) => ban.type === 'custom').length;

  return {
    bans,
    nseCount,
    customCount,
    totalCount: bans.length,
  };
}

export async function toggleCustomBan(name: string): Promise<BansResponse> {
  await ensureTodayNseBans();
  const today = getTodayBanDate();

  const [nseBan] = await db
    .select({ name: stockBansTable.name })
    .from(stockBansTable)
    .where(and(eq(stockBansTable.name, name), eq(stockBansTable.type, 'nse'), eq(stockBansTable.banDate, today)))
    .limit(1);

  if (nseBan) {
    throw new Error(`${name} is banned by NSE and cannot be toggled`);
  }

  const [existingCustom] = await db
    .select({ name: stockBansTable.name })
    .from(stockBansTable)
    .where(and(eq(stockBansTable.name, name), eq(stockBansTable.type, 'custom')))
    .limit(1);

  if (existingCustom) {
    await db.delete(stockBansTable).where(and(eq(stockBansTable.name, name), eq(stockBansTable.type, 'custom')));
  } else {
    await db.insert(stockBansTable).values({
      name,
      type: 'custom',
      banDate: today,
      createdAt: new Date().toISOString(),
    });
  }

  return getBansResponse();
}
