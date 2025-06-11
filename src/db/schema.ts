import { sqliteTable, text, real } from 'drizzle-orm/sqlite-core';

export const instruments = sqliteTable('instruments', {
  id: text().primaryKey(),
  exchange: text().notNull(),
  token: text().notNull(),
  lotSize: real().notNull(),
  symbol: text().notNull(),
  tradingSymbol: text().notNull(),
  expiry: text().notNull(),
  instrument: text().notNull(),
  optionType: text().notNull(),
  strikePrice: real().notNull(),
  tickSize: text().notNull(),
  dv: real(),
  av: real(),
});
