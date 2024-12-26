import { NSE_STOCKS_TO_INCLUDE } from '@/config';
import { ShoonyaInstrument } from '@/types/shoonya';
import JSZip from 'jszip';

export const getNifty500Stocks = async () => {
  const res = await fetch('https://archives.nseindia.com/content/indices/ind_nifty500list.csv');
  const text = await res.text();

  const rows = text.split('\n').slice(1);
  return rows.map((row) => row.split(',')[2]);
};

export const getInstruments = async (forExchange: 'BSE' | 'NSE' | 'NFO') => {
  const txtFileName = forExchange + '_symbols.txt';
  const zipFileName = txtFileName + '.zip';

  const res = await fetch('https://api.shoonya.com/' + zipFileName);
  const arrayBuffer = await res.arrayBuffer();

  const jsZip = new JSZip();
  const result = await jsZip.loadAsync(arrayBuffer);
  const file = result.file(txtFileName);
  if (!file) {
    ('Did not find the expected .txt file. Exiting...');
    process.exit(1);
  }

  const output: ShoonyaInstrument[] = [];

  const fileContents = await file.async('text');
  const rows = fileContents.split('\n').slice(1);

  for (const row of rows) {
    if (forExchange === 'NSE' || forExchange === 'BSE') {
      const [exchange, token, lotSize, symbol, tradingSymbol, instrument, tickSize] = row.split(',');

      const validInstrumentType = forExchange === 'NSE' ? 'EQ' : 'B';
      if (instrument === validInstrumentType) {
        output.push({
          exchange,
          token,
          lotSize: Number(lotSize),
          symbol,
          tradingSymbol,
          expiry: '',
          instrument: 'EQ',
          optionType: 'XX',
          strikePrice: 0,
          tickSize,
        });
      }
    } else if (forExchange === 'NFO') {
      const [exchange, token, lotSize, symbol, tradingSymbol, expiry, instrument, optionType, strikePrice, tickSize] =
        row.split(',');

      if ((optionType === 'CE' || optionType === 'PE') && NSE_STOCKS_TO_INCLUDE.includes(symbol)) {
        output.push({
          exchange,
          token,
          lotSize: Number(lotSize),
          symbol,
          tradingSymbol,
          expiry,
          instrument,
          optionType,
          strikePrice: Number(strikePrice),
          tickSize,
        });
      }
    }
  }

  return output;
};
