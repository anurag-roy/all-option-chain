import { calculateDeltas } from '@/lib/delta';
import { workingDaysCache } from '@/lib/workingDaysCache';
import { NextApiHandler } from 'next';

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { ltp, strikePrice, expiry, av, optionType } = req.body;

  if (!ltp || !strikePrice || !expiry || !av || !optionType) {
    res.status(400).json({ error: 'Missing required parameters' });
    return;
  }

  try {
    // Calculate delta using the existing logic from socket.ts
    const workingDaysTillExpiry = await workingDaysCache.getWorkingDaysTillExpiry(expiry);
    const workingDaysInLastYear = await workingDaysCache.getWorkingDaysInLastYear();
    const T = workingDaysTillExpiry / workingDaysInLastYear;

    const delta = calculateDeltas(Number(ltp), Number(strikePrice), Number(av), T, optionType as 'CE' | 'PE');

    res.json({ delta });
  } catch (error) {
    console.error('Error calculating delta:', error);
    res.status(500).json({ error: 'Failed to calculate delta' });
  }
};

export default handler;
