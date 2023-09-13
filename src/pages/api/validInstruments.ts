import { CUSTOM_PERCENT } from '@/config';
import { getQuotes } from '@/lib/api/getQuotes';
import { getInstrumentsToSubscribe } from '@/lib/db';
import { getNewTicker, getValidInstruments } from '@/lib/socket';
import { NextApiHandler } from 'next';

const handler: NextApiHandler = async (req, res) => {
  const stock = String(req.query.stock);
  const expiry = String(req.query.expiry);
  const percent = Number(req.query.percent);

  const tempWs = await getNewTicker();

  try {
    console.log(`Fetching data for ${stock}...`);
    const { equityStock, optionsStocks } = await getInstrumentsToSubscribe(
      stock,
      expiry
    );

    // Get LTP to calculate lower bound and upper bound
    const response = await getQuotes('NSE', equityStock.token);
    const ltp = Number(response.lp);

    const effectivePercent = CUSTOM_PERCENT[stock] ?? percent;
    const lowerBound = ((100 - effectivePercent) * ltp) / 100;
    const upperBound = ((100 + effectivePercent) * ltp) / 100;

    // Compute filtered stocks to send to socket client
    const validInstruments = await getValidInstruments(
      tempWs,
      optionsStocks,
      lowerBound,
      upperBound
    );
    tempWs.close();
    res.json(validInstruments);
  } catch (error: any) {
    tempWs.close();
    res.status(500).json({ error: error.message });
  }
};

export default handler;
