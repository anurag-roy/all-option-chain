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

    // Calculate SD-based bounds using new sigma method
    // We need to get the AV (Annualized Volatility) for the stock to calculate sigmas
    const stockWithAV = optionsStocks.find((s) => s.av && s.av > 0);
    let ceBound = ltp; // Ceiling bound for CE options
    let peBound = ltp; // Floor bound for PE options

    if (stockWithAV && stockWithAV.av && stockWithAV.expiry) {
      try {
        // Calculate sigmas for both CE and PE
        const ceSigmas = await workingDaysCache.calculateAllSigmas(
          stockWithAV.av,
          sdMultiplier,
          stockWithAV.expiry,
          'CE'
        );
        // const peSigmas = await workingDaysCache.calculateAllSigmas(
        //   stockWithAV.av,
        //   sdMultiplier,
        //   stockWithAV.expiry,
        //   'PE'
        // );

        // Calculate asymmetric bounds
        // For CE: Ceiling = LTP + (σₓᵢ %)
        ceBound = ltp + (ltp * ceSigmas.sigmaXI) / 100;

        // For PE: Floor = LTP - (σₓᵢ %)
        peBound = ltp - (ltp * ceSigmas.sigmaXI) / 100;

        console.log(
          `LTP: ${ltp}, AV: ${stockWithAV.av}, sdMultiplier: ${sdMultiplier}`,
          `\nCE Sigmas: σₙ=${ceSigmas.sigmaN.toFixed(3)}, σₓ=${ceSigmas.sigmaX.toFixed(3)}, σₓᵢ=${ceSigmas.sigmaXI.toFixed(3)}`,
          `\nPE Sigmas: σₙ=${ceSigmas.sigmaN.toFixed(3)}, σₓ=${ceSigmas.sigmaX.toFixed(3)}, σₓᵢ=${ceSigmas.sigmaXI.toFixed(3)}`,
          `\nCE Bound (ceiling): ${ceBound.toFixed(2)}, PE Bound (floor): ${peBound.toFixed(2)}`
        );
      } catch (error) {
        console.error(`Error calculating sigmas for stock ${stock}:`, error);
        // Fallback to LTP if calculation fails
        ceBound = ltp;
        peBound = ltp;
      }
    }

    // Compute filtered stocks to send to socket client with new asymmetric bounds
    const validInstruments = await getValidInstruments(global.ticker, optionsStocks, ltp, peBound, ceBound);

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
