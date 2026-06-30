import { TZDate } from '@date-fns/tz';
import { db } from '@server/db';
import type { instrumentsTable as instrumentsTableType } from '@server/db/schema';
import { instrumentsTable } from '@server/db/schema';
import { format } from 'date-fns';
import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm';

const INDIA_TIMEZONE = 'Asia/Kolkata';

export type DbInstrument = typeof instrumentsTableType.$inferSelect;

export const getEquityByName = async (name: string) => {
  const [equity] = await db
    .select()
    .from(instrumentsTable)
    .where(and(eq(instrumentsTable.name, name), eq(instrumentsTable.instrumentType, 'EQ')))
    .limit(1);
  return equity;
};

export const getAllEquityNames = async () => {
  const rows = await db
    .select({ name: instrumentsTable.name })
    .from(instrumentsTable)
    .where(eq(instrumentsTable.instrumentType, 'EQ'))
    .orderBy(asc(instrumentsTable.name));
  return rows.map((row) => row.name);
};

export const getAllEquityTradingSymbols = async () => {
  return db
    .select({
      tradingsymbol: instrumentsTable.tradingsymbol,
      name: instrumentsTable.name,
      exchange: instrumentsTable.exchange,
    })
    .from(instrumentsTable)
    .where(eq(instrumentsTable.instrumentType, 'EQ'))
    .orderBy(asc(instrumentsTable.tradingsymbol));
};

export const getFuturesForName = async (name: string) => {
  return db
    .select()
    .from(instrumentsTable)
    .where(
      and(
        eq(instrumentsTable.name, name),
        eq(instrumentsTable.instrumentType, 'FUT'),
        sql`${instrumentsTable.expiry} IS NOT NULL`
      )
    )
    .orderBy(asc(instrumentsTable.expiry));
};

export const getOptionsForNameAndExpiry = async (name: string, expiry: string) => {
  return db
    .select()
    .from(instrumentsTable)
    .where(
      and(
        eq(instrumentsTable.name, name),
        eq(instrumentsTable.exchange, 'NFO'),
        inArray(instrumentsTable.instrumentType, ['CE', 'PE']),
        eq(instrumentsTable.expiry, expiry)
      )
    )
    .orderBy(asc(instrumentsTable.strike));
};

export const getUpcomingOptionExpiries = async (limit = 3) => {
  const today = format(new TZDate(Date.now(), INDIA_TIMEZONE), 'yyyy-MM-dd');
  const rows = await db
    .selectDistinct({ expiry: instrumentsTable.expiry })
    .from(instrumentsTable)
    .where(
      and(
        eq(instrumentsTable.exchange, 'NFO'),
        inArray(instrumentsTable.instrumentType, ['CE', 'PE']),
        gte(instrumentsTable.expiry, today)
      )
    )
    .orderBy(asc(instrumentsTable.expiry))
    .limit(limit);

  return rows.map((row) => row.expiry).filter((expiry): expiry is string => Boolean(expiry));
};

export const getInstrumentByToken = async (instrumentToken: number) => {
  const [instrument] = await db
    .select()
    .from(instrumentsTable)
    .where(eq(instrumentsTable.instrumentToken, instrumentToken))
    .limit(1);
  return instrument;
};
