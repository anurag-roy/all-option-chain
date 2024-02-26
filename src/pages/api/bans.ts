import { NextApiHandler } from 'next';

const handler: NextApiHandler = async (_req, res) => {
  const response = await fetch(`https://nsearchives.nseindia.com/content/fo/fo_secban.csv`);
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
