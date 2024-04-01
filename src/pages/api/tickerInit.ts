import { getNewTicker } from '@/lib/socket';
import { NextApiHandler } from 'next';

const handler: NextApiHandler = async (req, res) => {
  try {
    if (!global.ticker) {
      global.ticker = await getNewTicker();
    }
    res.json({ message: 'Ticker connected successfully!' });
  } catch (error: any) {
    console.error(error);
    res.setHeader('Retry-After', 2).status(503).json({ error: 'Failed to connect to Shoonya' });
    return;
  }
};

export default handler;
