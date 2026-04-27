import { BSE_STOCKS_TO_INCLUDE } from '@/config';
import env from '@/env.json';
import { getSessionKey } from '@/lib/api/getSessionKey';
import { PI_CONNECT_API_BASE } from '@/lib/piConnectUrls';
import { NextApiHandler } from 'next';

const handler: NextApiHandler = async (req, res) => {
  const { price, quantity, tradingSymbol } = req.body;
  const exchange = BSE_STOCKS_TO_INCLUDE.includes(tradingSymbol) ? 'BSE' : 'NSE';
  const tsym = encodeURIComponent(String(tradingSymbol));

  const orderRes = await fetch(`${PI_CONNECT_API_BASE}/PlaceOrder`, {
    method: 'POST',
    body:
      'jData=' +
      JSON.stringify({
        uid: env.USER_ID,
        actid: env.USER_ID,
        exch: String(exchange),
        tsym,
        qty: String(quantity),
        dscqty: '0',
        prc: String(price),
        prd: 'C',
        trantype: 'B',
        prctyp: 'LMT',
        ret: 'DAY',
        amo: 'Yes',
      }) +
      `&jKey=${getSessionKey()}`,
  });
  if (!orderRes.ok) {
    throw new Error(await orderRes.text());
  }
  const orderResult = await orderRes.json();
  console.log(`Placed AMO ${tradingSymbol} ${quantity} @ ${price}`);

  res.json(orderResult);
};

export default handler;
