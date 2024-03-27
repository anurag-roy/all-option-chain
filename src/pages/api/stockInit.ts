import { CUSTOM_PERCENT } from '@/config';
import { getQuotes } from '@/lib/api/getQuotes';
import { getInstrumentsToSubscribe } from '@/lib/db';
import { getNewTicker, getValidInstruments } from '@/lib/socket';
import type { StockInitResponse } from '@/types';
import { NextApiHandler } from 'next';
import { WebSocket } from 'ws';

const handler: NextApiHandler = async (req, res) => {
  const stock = String(req.query.stock);
  const expiry = String(req.query.expiry);
  const entryPercent = Number(req.query.entryPercent);

  let tempWs: WebSocket | null = null;
  try {
    tempWs = await getNewTicker(stock);
  } catch (error) {
    res.setHeader('Retry-After', 2).status(503).json({ error: 'Failed to connect to Shoonya' });
    return;
  }

  try {
    console.log(`Fetching data for ${stock}...`);
    const { equityStock, optionsStocks } = await getInstrumentsToSubscribe(stock, expiry);

    // Get LTP to calculate lower bound and upper bound
    const response = await getQuotes('NSE', equityStock.token);
    const ltp = Number(response.lp);
    const prevClose = Number(response.c);

    const effectivePercent = CUSTOM_PERCENT[stock] ?? entryPercent;
    const lowerBound = ((100 - effectivePercent) * ltp) / 100;
    const upperBound = ((100 + effectivePercent) * ltp) / 100;

    // Compute filtered stocks to send to socket client
    const validInstruments = await getValidInstruments(tempWs, optionsStocks, ltp, lowerBound, upperBound);
    tempWs.close();

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
    tempWs.close();
    res.status(500).json({ error: error.message });
  }
};

export default handler;
