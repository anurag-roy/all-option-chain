import { NSE_STOCKS_TO_INCLUDE } from '@/config';
import { ShoonyaInstrument } from '@/types/shoonya';
import JSZip from 'jszip';

export const getVolatilityData = async () => {
  const res = await fetch('https://nsearchives.nseindia.com/archives/nsccl/volt/CMVOLT_25042025.CSV');
  const text = await res.text();

  // The CSV file has the following columns:
  // Date,Symbol,Underlying Close Price (A),Underlying Previous Day Close Price (B),Underlying Log Returns (C) = LN(A/B),Previous Day Underlying Volatility (D),Current Day Underlying Daily Volatility (E) = Sqrt(0.995*D*D + 0.005*C*C),Underlying Annualised Volatility (F) = E*Sqrt(365)
  // 17-APR-2025,20MICRONS,218.40,206.21,0.0574,0.0329,0.0330,0.6305
  // 17-APR-2025,21STCENMGM,76.01,74.16,0.0246,0.0192,0.0193,0.3687
  // 17-APR-2025,360ONE,956.75,943.75,0.0137,0.0269,0.0268,0.5120

  const rows = text.split('\n').slice(1);
  return rows.map((row) => {
    const cols = row.split(',');
    return {
      symbol: cols[1],
      dv: Number(cols[6]),
      av: Number(cols[7]),
    };
  });
};

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
