import { db } from '@server/db';
import { holidaysTable, instrumentsTable } from '@server/db/schema';
import { logger } from '@server/lib/logger';
import { kiteService } from '@server/lib/services/kite';
import { getNifty500Stocks, getVolatilityData } from '@server/lib/utils/nse';
import { BSE_STOCKS_TO_INCLUDE, NSE_STOCKS_TO_INCLUDE } from '@server/shared/config';
import { format, parse } from 'date-fns';
import { chunk } from 'es-toolkit';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

async function seedInstruments() {
  // Fetch all instrument data
  const bseInstruments = await kiteService.getInstruments(['BSE']);
  const nseInstruments = await kiteService.getInstruments(['NSE']);
  const nfoInstruments = await kiteService.getInstruments(['NFO']);

  const nifty500 = await getNifty500Stocks();
  const equityStocksToInclude = new Set([...nifty500, ...NSE_STOCKS_TO_INCLUDE]);
  const nfoInstrumentTypes = ['FUT', 'CE', 'PE'];
  const instrumentsData = [
    ...nseInstruments.filter((i) => i.name && equityStocksToInclude.has(i.name)),
    ...bseInstruments.filter((i) => i.name && BSE_STOCKS_TO_INCLUDE.includes(i.name)),
    ...nfoInstruments.filter(
      (i) =>
        i.instrument_token &&
        NSE_STOCKS_TO_INCLUDE.includes(i.name) &&
        nfoInstrumentTypes.includes(i.instrument_type) &&
        i.expiry &&
        i.expiry > new Date()
    ),
  ];

  // Fetch volatility data
  const volatilityData = await getVolatilityData();
  const volatilityMap = new Map<string, { dv: number; av: number }>();
  for (const row of volatilityData) {
    volatilityMap.set(row.symbol, { dv: row.dv, av: row.av });
  }

  logger.info(`Seeding ${instrumentsData.length} instruments`);

  const dataToInsert: (typeof instrumentsTable.$inferInsert)[] = instrumentsData.map((instrument) => {
    const volatility = volatilityMap.get(instrument.name);
    return {
      instrumentToken: Number(instrument.instrument_token),
      exchangeToken: instrument.exchange_token,
      tradingsymbol: instrument.tradingsymbol,
      name: instrument.name,
      expiry: instrument.expiry ? instrument.expiry.toISOString().split('T')[0] : null,
      strike: instrument.strike,
      tickSize: instrument.tick_size,
      lotSize: instrument.lot_size,
      instrumentType: instrument.instrument_type,
      segment: instrument.segment,
      exchange: instrument.exchange,
      dv: volatility?.dv || 0,
      av: volatility?.av || 0,
    };
  });

  const CHUNK_SIZE = 1000;
  const chunks = chunk(dataToInsert, CHUNK_SIZE);

  await db.transaction(async (tx) => {
    await tx.delete(instrumentsTable);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      logger.info(`Inserting chunk ${i + 1}/${chunks.length} (${chunk.length} instruments)`);
      await tx.insert(instrumentsTable).values(chunk);
    }
  });

  logger.info(`Seeded ${dataToInsert.length} instruments`);
}

async function seedHolidays() {
  // Read the MCX holidays CSV file
  const csvPath = join(process.cwd(), '.data', 'nse_holidays.csv');
  const csvContent = readFileSync(csvPath, 'utf-8');

  // Parse CSV (skip header: date,holiday,type)
  const lines = csvContent.trim().split('\n').slice(1);
  const holidaysData: (typeof holidaysTable.$inferInsert)[] = [];

  for (const line of lines) {
    const [dateStr, name] = line.split(',');
    if (!dateStr || !name) continue;

    // Parse the date from DD-MMM-YYYY format to proper Date
    const parsedDate = parse(dateStr, 'dd-MMM-yyyy', new Date());

    // Format as YYYY-MM-DD for database storage
    const formattedDate = format(parsedDate, 'yyyy-MM-dd');

    holidaysData.push({
      date: formattedDate,
      name: name.trim(),
      year: parsedDate.getFullYear(),
      month: parsedDate.getMonth() + 1, // getMonth() returns 0-11
      day: parsedDate.getDate(),
    });
  }

  logger.info(`Seeding ${holidaysData.length} NSE holidays`);

  await db.transaction(async (tx) => {
    await tx.delete(holidaysTable);
    await tx.insert(holidaysTable).values(holidaysData);
  });

  logger.info(`Seeded ${holidaysData.length} NSE holidays`);
}

await seedInstruments();
await seedHolidays();
