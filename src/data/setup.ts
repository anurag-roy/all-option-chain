import { BSE_STOCKS_TO_INCLUDE, NSE_STOCKS_TO_INCLUDE } from '@/config';
import { getKeys } from '@/lib/utils';
import Database from 'better-sqlite3';
import { getInstruments, getNifty500Stocks, getVolatilityData } from './getInstruments';

// Create the sqlite db here
const DB_PATH = 'src/data/data.db';

async function main() {
  const bseInstruments = await getInstruments('BSE');
  const nseInstruments = await getInstruments('NSE');
  const nfoInstruments = await getInstruments('NFO');

  const nifty500 = await getNifty500Stocks();
  const equityStocksToInclude = new Set([...nifty500, ...NSE_STOCKS_TO_INCLUDE]);
  const instruments = [
    ...nseInstruments.filter((i) => equityStocksToInclude.has(i.symbol)),
    ...bseInstruments.filter((i) => BSE_STOCKS_TO_INCLUDE.includes(i.symbol)),
    ...nfoInstruments,
  ];

  const volatilityData = await getVolatilityData();
  const volatilityMap = new Map<string, { dv: number; av: number }>();
  for (const row of volatilityData) {
    volatilityMap.set(row.symbol, { dv: row.dv, av: row.av });
  }

  const columns = getKeys(instruments[0]);

  const TABLE_NAME = 'instrument';
  const INSERT_BATCH_SIZE = 10000;

  // Create DB and table
  const db = new Database(DB_PATH);
  console.log('DB creation successful!');

  const insert = (values: string[]) => {
    if (values.length === 0) return;
    db.exec(`INSERT INTO ${TABLE_NAME} (id, ${columns.join(',')}, dv, av) VALUES ${values.join(',')};`);
  };

  // Variables to insert values in batches
  let currentBatchValues = [];
  let currentIteration = 0;

  console.log('Starting insert...');
  for (const instrument of instruments) {
    const currentRowValues = [];

    // Insert primary key Id
    currentRowValues.push(`'${instrument.tradingSymbol}'`);

    for (const col of columns) {
      currentRowValues.push(`'${instrument[col]}'`);
    }

    const symbol = instrument.symbol;
    const volatility = volatilityMap.get(symbol);
    const dv = volatility?.dv || 0;
    const av = volatility?.av || 0;
    currentRowValues.push(`'${dv}'`);
    currentRowValues.push(`'${av}'`);

    currentBatchValues.push(`(${currentRowValues.join(',')})`);

    // Execute insert statement once a batch is full
    currentIteration++;
    if (currentIteration % INSERT_BATCH_SIZE === 0) {
      insert(currentBatchValues);
      currentBatchValues = [];
    }
  }
  // Fire once more for leftover values
  insert(currentBatchValues);
  console.log('Data insertion successful!');
}

main().catch((error) => {
  console.log('Data preparation failed', error);
});
