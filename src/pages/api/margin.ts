import env from '@/env.json';
import { getSessionKey } from '@/lib/api/getSessionKey';
import { normalizeTradingSymbol } from '@/lib/api/normalizeTradingSymbol';
import { PI_CONNECT_API_BASE } from '@/lib/piConnectUrls';
import { NextApiHandler } from 'next';

const handler: NextApiHandler = async (req, res) => {
  const { price, quantity, tradingSymbol } = req.query;
  const rawTradingSymbol = Array.isArray(tradingSymbol) ? tradingSymbol[0] : tradingSymbol;
  const rawQuantity = Array.isArray(quantity) ? quantity[0] : quantity;
  const rawPrice = Array.isArray(price) ? price[0] : price;
  const normalizedTradingSymbol = normalizeTradingSymbol(String(rawTradingSymbol ?? ''));
  const tsym = encodeURIComponent(normalizedTradingSymbol);

  const marginRes = await fetch(`${PI_CONNECT_API_BASE}/GetOrderMargin`, {
    method: 'POST',
    body:
      'jData=' +
      JSON.stringify({
        uid: env.USER_ID,
        actid: env.USER_ID,
        exch: 'NFO',
        tsym,
        qty: String(rawQuantity),
        prc: String(rawPrice),
        prd: 'M',
        trantype: 'S',
        prctyp: 'LMT',
      }) +
      `&jKey=${getSessionKey()}`,
  });
  if (!marginRes.ok) {
    const responseText = await marginRes.text();
    console.error('GetOrderMargin HTTP error', {
      status: marginRes.status,
      tradingSymbol: rawTradingSymbol,
      normalizedTradingSymbol,
      encodedTradingSymbol: tsym,
      quantity: rawQuantity,
      price: rawPrice,
      responseText,
    });
    throw new Error(responseText);
  }
  const margin = await marginRes.json();
  if (margin.stat !== 'Ok') {
    console.error('GetOrderMargin API error', {
      tradingSymbol: rawTradingSymbol,
      normalizedTradingSymbol,
      encodedTradingSymbol: tsym,
      quantity: rawQuantity,
      price: rawPrice,
      response: margin,
    });
    throw new Error(margin.emsg);
  }

  return res.json(margin);
};

export default handler;
