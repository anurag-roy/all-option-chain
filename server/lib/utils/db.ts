import { db } from '@server/db';
import { instrumentsTable } from '@server/db/schema';
import { and, asc, eq, inArray, like } from 'drizzle-orm';

export const getAllEquityStocks = async () => {
  const equityStocks = await db
    .select()
    .from(instrumentsTable)
    .where(eq(instrumentsTable.instrumentType, 'EQ'))
    .orderBy(asc(instrumentsTable.tradingsymbol));
  return equityStocks;
};

export const getInstrumentsToSubscribe = async (symbol: string, expiryPrefix: string) => {
  const [equityStock] = await db.select().from(instrumentsTable).where(eq(instrumentsTable.tradingsymbol, symbol));

  const optionsStocks = await db
    .select()
    .from(instrumentsTable)
    .where(
      and(
        eq(instrumentsTable.tradingsymbol, symbol),
        eq(instrumentsTable.exchange, 'NFO'),
        inArray(instrumentsTable.instrumentType, ['CE', 'PE']),
        like(instrumentsTable.expiry, `%${expiryPrefix}`)
      )
    )
    .orderBy(asc(instrumentsTable.strike));

  return {
    equityStock,
    optionsStocks,
  };
};

export const getUniqueExpiryDates = async () => {
  const result = await db
    .selectDistinct({ expiry: instrumentsTable.expiry })
    .from(instrumentsTable)
    .where(and(eq(instrumentsTable.exchange, 'NFO'), inArray(instrumentsTable.instrumentType, ['CE', 'PE'])));

  return result.map((row) => row.expiry).filter((expiry) => expiry && expiry.trim() !== '') as string[];
};
