import { getUserDetails } from '@/lib/api/getUserDetails';
import { NextApiHandler } from 'next';

const handler: NextApiHandler = async (_req, res) => {
  const userDetails = await getUserDetails();
  res.json(userDetails);
};

export default handler;
