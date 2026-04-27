import env from '@/env.json';
import { getSessionKey } from '@/lib/api/getSessionKey';
import { PI_CONNECT_API_BASE } from '@/lib/piConnectUrls';
import { NextApiHandler } from 'next';

const handler: NextApiHandler = async (req, res) => {
  const { price, quantity, tradingSymbol } = req.query;
  const tsym = encodeURIComponent(String(tradingSymbol));

  const marginRes = await fetch(`${PI_CONNECT_API_BASE}/GetOrderMargin`, {
    method: 'POST',
    body:
      'jData=' +
      JSON.stringify({
        uid: env.USER_ID,
        actid: env.USER_ID,
        exch: 'NFO',
        tsym,
        qty: String(quantity),
        prc: String(price),
        prd: 'M',
        trantype: 'S',
        prctyp: 'LMT',
      }) +
      `&jKey=${getSessionKey()}`,
  });
  if (!marginRes.ok) {
    throw new Error(await marginRes.text());
  }
  const margin = await marginRes.json();
  if (margin.stat !== 'Ok') {
    throw new Error(margin.emsg);
  }

  return res.json(margin);
};

export default handler;
