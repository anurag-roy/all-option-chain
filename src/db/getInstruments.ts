import { STOCKS_TO_INCLUDE } from '@/config';
import { ShoonyaInstrument } from '@/types/shoonya';
import JSZip from 'jszip';

export const getInstruments = async (forExchange: 'NSE' | 'NFO') => {
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
    if (forExchange === 'NSE') {
      const [
        exchange,
        token,
        lotSize,
        symbol,
        tradingSymbol,
        instrument,
        tickSize,
      ] = row.split(',');

      if (instrument === 'EQ') {
        output.push({
          exchange,
          token,
          lotSize: Number(lotSize),
          symbol,
          tradingSymbol,
          expiry: '',
          instrument,
          optionType: 'XX',
          strikePrice: 0,
          tickSize,
        });
      }
    } else if (forExchange === 'NFO') {
      const [
        exchange,
        token,
        lotSize,
        symbol,
        tradingSymbol,
        expiry,
        instrument,
        optionType,
        strikePrice,
        tickSize,
      ] = row.split(',');

      if (
        (optionType === 'CE' || optionType === 'PE') &&
        STOCKS_TO_INCLUDE.includes(symbol)
      ) {
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
