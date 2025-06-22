import { BSE_STOCKS_TO_INCLUDE, NSE_STOCKS_TO_INCLUDE } from '@/config';
import { db, closeDb } from '@/db';
import { instrumentsTable, holidaysTable } from '@/db/schema';
import { getInstruments, getNifty500Stocks, getVolatilityData } from './getInstruments';
import { getUniqueExpiryDates } from '@/lib/db';
import { workingDaysCache } from '@/lib/workingDaysCache';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse, format } from 'date-fns';

// Function to parse and import holidays data
async function importHolidays() {
  console.log('Importing holidays data...');

  try {
    // Read the CSV file
    const csvPath = join(process.cwd(), 'src/data/holidays.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');

    // Parse CSV (skip header)
    const lines = csvContent.trim().split('\n').slice(1);
    const holidaysData = [];

    for (const line of lines) {
      const [dateStr, name] = line.split(',');

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

    // Clear existing holidays data
    await db.delete(holidaysTable);
    console.log('Cleared existing holidays data');

    // Insert holidays data
    await db.insert(holidaysTable).values(holidaysData);
    console.log(`Inserted ${holidaysData.length} holidays`);
  } catch (error) {
    console.error('Failed to import holidays:', error);
    throw error;
  }
}

async function main() {
  console.log('Starting data seeding...');

  try {
    // Import holidays first
    await importHolidays();

    // Fetch all instrument data
    const bseInstruments = await getInstruments('BSE');
    const nseInstruments = await getInstruments('NSE');
    const nfoInstruments = await getInstruments('NFO');

    const nifty500 = await getNifty500Stocks();
    const equityStocksToInclude = new Set([...nifty500, ...NSE_STOCKS_TO_INCLUDE]);
    const instrumentsData = [
      ...nseInstruments.filter((i) => equityStocksToInclude.has(i.symbol)),
      ...bseInstruments.filter((i) => BSE_STOCKS_TO_INCLUDE.includes(i.symbol)),
      ...nfoInstruments,
    ];

    // Fetch volatility data
    const volatilityData = await getVolatilityData();
    const volatilityMap = new Map<string, { dv: number; av: number }>();
    for (const row of volatilityData) {
      volatilityMap.set(row.symbol, { dv: row.dv, av: row.av });
    }

    console.log(`Preparing to insert ${instrumentsData.length} instruments...`);

    // Clear existing data
    await db.delete(instrumentsTable);
    console.log('Cleared existing instruments data');

    // Prepare data for insertion
    const instrumentsToInsert = instrumentsData.map((instrument) => {
      const volatility = volatilityMap.get(instrument.symbol);
      return {
        id: instrument.tradingSymbol,
        exchange: instrument.exchange,
        token: instrument.token,
        lotSize: instrument.lotSize,
        symbol: instrument.symbol,
        tradingSymbol: instrument.tradingSymbol,
        expiry: instrument.expiry,
        instrument: instrument.instrument,
        optionType: instrument.optionType,
        strikePrice: instrument.strikePrice,
        tickSize: instrument.tickSize,
        dv: volatility?.dv || 0,
        av: volatility?.av || 0,
      };
    });

    // Insert data in batches for better performance
    const BATCH_SIZE = 1000;
    let insertedCount = 0;

    for (let i = 0; i < instrumentsToInsert.length; i += BATCH_SIZE) {
      const batch = instrumentsToInsert.slice(i, i + BATCH_SIZE);
      await db.insert(instrumentsTable).values(batch);
      insertedCount += batch.length;
      console.log(`Inserted ${insertedCount}/${instrumentsToInsert.length} instruments...`);
    }

    console.log('Data seeding completed successfully!');

    // Initialize working days cache after all data is inserted
    console.log('Initializing working days cache...');

    // Pre-populate the working days in last year cache
    await workingDaysCache.getWorkingDaysInLastYear();

    // Get unique expiry dates and pre-populate the expiry cache
    const uniqueExpiryDates = await getUniqueExpiryDates();
    console.log('Raw expiry dates from database:', uniqueExpiryDates);

    await workingDaysCache.prePopulateExpiryCache(uniqueExpiryDates);

    console.log('Working days cache initialized successfully!');
  } catch (error) {
    console.error('Data seeding failed:', error);
    throw error;
  } finally {
    // Close the database connection
    await closeDb();
  }
}

main().catch((error) => {
  console.error('Setup script failed:', error);
  process.exit(1);
});
