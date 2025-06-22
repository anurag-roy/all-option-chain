import { db } from '@/db';
import { eq, asc, inArray, and, like } from 'drizzle-orm';
import { instrumentsTable } from '@/db/schema';

export const getAllEquityStocks = async () => {
  const equityStocks = await db
    .select()
    .from(instrumentsTable)
    .where(eq(instrumentsTable.instrument, 'EQ'))
    .orderBy(asc(instrumentsTable.symbol));
  return equityStocks;
};

export const getInstrumentsToSubscribe = async (symbol: string, expiryPrefix: string) => {
  const [equityStock] = await db
    .select()
    .from(instrumentsTable)
    .where(eq(instrumentsTable.id, `${symbol}-EQ`));

  const optionsStocks = await db
    .select()
    .from(instrumentsTable)
    .where(
      and(
        eq(instrumentsTable.symbol, symbol),
        eq(instrumentsTable.exchange, 'NFO'),
        inArray(instrumentsTable.optionType, ['CE', 'PE']),
        like(instrumentsTable.expiry, `%${expiryPrefix}`)
      )
    )
    .orderBy(asc(instrumentsTable.strikePrice));

  return {
    equityStock,
    optionsStocks,
  };
};

export const getUniqueExpiryDates = async (): Promise<string[]> => {
  const result = await db
    .selectDistinct({ expiry: instrumentsTable.expiry })
    .from(instrumentsTable)
    .where(and(eq(instrumentsTable.exchange, 'NFO'), inArray(instrumentsTable.optionType, ['CE', 'PE'])));

  return result.map((row) => row.expiry).filter((expiry) => expiry && expiry.trim() !== '');
};
