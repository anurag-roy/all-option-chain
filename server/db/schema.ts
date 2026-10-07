import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { Exchange } from 'kiteconnect-ts';

export const instrumentsTable = sqliteTable(
  'instruments',
  {
    instrumentToken: real().primaryKey().notNull(),
    exchangeToken: text().notNull(),
    tradingsymbol: text().notNull(),
    name: text().notNull(),
    expiry: text(),
    strike: real(),
    tickSize: real(),
    lotSize: real(),
    instrumentType: text().$type<'EQ' | 'FUT' | 'CE' | 'PE'>(),
    segment: text(),
    exchange: text().$type<Exchange>(),
    dv: real(),
    av: real(),
  },
  (table) => [index('name_idx').on(table.name), index('expiry_idx').on(table.expiry)]
);

export const holidaysTable = sqliteTable(
  'holidays',
  {
    date: text().primaryKey(),
    name: text().notNull(),
    year: real().notNull(),
    month: real().notNull(),
    day: real().notNull(),
  },
  (table) => [
    index('holidays_year_idx').on(table.year),
    index('holidays_month_idx').on(table.month),
    index('holidays_year_month_idx').on(table.year, table.month),
  ]
);

export const stockBansTable = sqliteTable(
  'stock_bans',
  {
    name: text().primaryKey().notNull(),
    type: text().$type<'nse' | 'custom'>().notNull(),
    banDate: text().notNull(),
    createdAt: text().notNull(),
  },
  (table) => [index('stock_bans_type_idx').on(table.type), index('stock_bans_ban_date_idx').on(table.banDate)]
);

export const gsecsTable = sqliteTable(
  'gsecs',
  {
    instrumentToken: integer().primaryKey().notNull(),
    exchange: text().$type<'NSE' | 'BSE'>().notNull().default('NSE'),
    tradingsymbol: text().notNull(),
    isin: text().notNull(),
    coupon: integer().notNull(),
    maturityYear: integer().notNull(),
    // Empty defaults mark pre-YTM seeds; the catalog requires a fresh daily seed.
    maturityDate: text().notNull().default(''),
    tickSize: real().notNull().default(0.01),
  },
  (table) => [uniqueIndex('gsecs_exchange_symbol_unique').on(table.exchange, table.tradingsymbol)]
);

// A successful empty approved list must be distinguishable from an unseeded DB.
export const gsecSeedStateTable = sqliteTable('gsec_seed_state', {
  id: integer().primaryKey().notNull(),
  seededDate: text().notNull(),
  fetchedAt: text().notNull(),
  tradeDate: text().notNull().default(''),
  settlementDate: text().notNull().default(''),
});
