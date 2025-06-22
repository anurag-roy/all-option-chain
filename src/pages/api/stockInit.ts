import { getQuotes } from '@/lib/api/getQuotes';
import { getInstrumentsToSubscribe } from '@/lib/db';
import { getValidInstruments } from '@/lib/socket';
import { workingDaysCache } from '@/lib/workingDaysCache';
import type { StockInitResponse } from '@/types';
import { NextApiHandler } from 'next';

// Global flag to track cache initialization
let cacheInitialized = false;

const handler: NextApiHandler = async (req, res) => {
  const stock = String(req.query.stock);
  const expiry = String(req.query.expiry);
  const sdMultiplier = Number(req.query.sdMultiplier);

  if (!global.ticker) {
    res.status(500).json({ error: 'Ticker not connected' });
    return;
  }

  try {
    // Initialize cache if not already done
    if (!cacheInitialized) {
      await workingDaysCache.initializeRuntimeCache();
      cacheInitialized = true;
    }

    console.log(`Fetching data for ${stock}...`);
    const { equityStock, optionsStocks } = await getInstrumentsToSubscribe(stock, expiry);

    // Get LTP to calculate lower bound and upper bound
    const response = await getQuotes('NSE', equityStock.token);
    const ltp = Number(response.lp);
    const prevClose = Number(response.c);

    // Calculate SD-based bounds instead of percentage-based bounds
    // We need to get the AV (Annualized Volatility) for the stock to calculate SD
    const stockWithAV = optionsStocks.find((s) => s.av && s.av > 0);
    let sdValue = 0;

    if (stockWithAV && stockWithAV.av && stockWithAV.expiry) {
      try {
        sdValue = await workingDaysCache.calculateSD(stockWithAV.av, stockWithAV.expiry);
      } catch (error) {
        console.error(`Error calculating SD for stock ${stock}:`, error);
        sdValue = 0;
      }
    }

    // Calculate bounds using SD
    const minusSD = (ltp * (100 - sdValue * sdMultiplier)) / 100;
    const plusSD = (ltp * (100 + sdValue * sdMultiplier)) / 100;

    console.log(`LTP: ${ltp}, SD: ${sdValue}, sdMultiplier: ${sdMultiplier}, minusSD: ${minusSD}, plusSD: ${plusSD}`);

    // Compute filtered stocks to send to socket client with new SD-based filtering
    const validInstruments = await getValidInstruments(global.ticker, optionsStocks, ltp, minusSD, plusSD);

    const initResponse: StockInitResponse = {
      equity: {
        token: equityStock.token,
        symbol: equityStock.symbol,
        ltp: ltp,
        prevClose: prevClose,
        gainLossPercent: ((ltp - prevClose) * 100) / prevClose,
      },
      instruments: validInstruments,
    };
    res.json(initResponse);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export default handler;
