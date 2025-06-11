import { BSE_STOCKS_TO_INCLUDE, NSE_STOCKS_TO_INCLUDE } from '@/config';
import { db, closeDb } from '@/db';
import { instruments } from '@/db/schema';
import { getInstruments, getNifty500Stocks, getVolatilityData } from './getInstruments';

async function main() {
  console.log('Starting data seeding...');

  try {
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
    await db.delete(instruments);
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
      await db.insert(instruments).values(batch);
      insertedCount += batch.length;
      console.log(`Inserted ${insertedCount}/${instrumentsToInsert.length} instruments...`);
    }

    console.log('Data seeding completed successfully!');
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
