import { db } from '@/db';
import { eq, asc, inArray, and, like } from 'drizzle-orm';
import { instruments } from '@/db/schema';

export const getAllEquityStocks = async () => {
  const equityStocks = await db
    .select()
    .from(instruments)
    .where(eq(instruments.instrument, 'EQ'))
    .orderBy(asc(instruments.symbol));
  return equityStocks;
};

export const getInstrumentsToSubscribe = async (symbol: string, expiryPrefix: string) => {
  const [equityStock] = await db
    .select()
    .from(instruments)
    .where(eq(instruments.id, `${symbol}-EQ`));

  const optionsStocks = await db
    .select()
    .from(instruments)
    .where(
      and(
        eq(instruments.symbol, symbol),
        eq(instruments.exchange, 'NFO'),
        inArray(instruments.optionType, ['CE', 'PE']),
        like(instruments.expiry, `%${expiryPrefix}`)
      )
    )
    .orderBy(asc(instruments.strikePrice));

  return {
    equityStock,
    optionsStocks,
  };
};
