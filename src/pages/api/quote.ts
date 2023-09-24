import { getQuotes } from '@/lib/api/getQuotes';
import { NextApiHandler } from 'next';

const handler: NextApiHandler = async (req, res) => {
  const exchange = String(req.query.exchange) as 'NSE' | 'NFO';
  const token = String(req.query.token);

  const quotes = await getQuotes(exchange, token as string);

  res.json(quotes);
};

export default handler;
