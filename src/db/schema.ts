import { sqliteTable, text, real, index } from 'drizzle-orm/sqlite-core';

export const instrumentsTable = sqliteTable('instruments', {
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

export const holidaysTable = sqliteTable(
  'holidays',
  {
    // Primary key: date in YYYY-MM-DD format for efficient querying and sorting
    date: text().primaryKey(), // e.g., '2024-01-26'

    // Holiday name/description
    name: text().notNull(), // e.g., 'Republic Day'

    // Additional fields for easier filtering/analysis
    year: real().notNull(), // e.g., 2024
    month: real().notNull(), // e.g., 1 for January
    day: real().notNull(), // e.g., 26
  },
  (table) => ({
    // Indexes for efficient querying
    yearIdx: index('holidays_year_idx').on(table.year),
    monthIdx: index('holidays_month_idx').on(table.month),
    yearMonthIdx: index('holidays_year_month_idx').on(table.year, table.month),
  })
);
