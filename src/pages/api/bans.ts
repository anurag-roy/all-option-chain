import { getTodayAsParam } from '@/lib/utils';
import { NextApiHandler } from 'next';

const handler: NextApiHandler = async (req, res) => {
  // Example dateParam: 19092023 for 19th September 2023
  const dateParam = req.query.dateParam || getTodayAsParam();
  const response = await fetch(`https://www1.nseindia.com/archives/fo/sec_ban/fo_secban_${dateParam}.csv`);
  let bannedStocks: string[] = [];
  if (response.ok) {
    const csv = await response.text();
    const rows = csv.split('\n');
    // Remove header
    rows.shift();
    bannedStocks = rows.map((row) => row.split(',').pop()!).filter(Boolean);
  }
  res.json(bannedStocks);
};

export default handler;
