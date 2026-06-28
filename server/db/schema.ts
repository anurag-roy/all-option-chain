import { index, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
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
