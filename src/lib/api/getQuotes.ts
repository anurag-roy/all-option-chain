import env from '@/env.json';
import { PI_CONNECT_API_BASE } from '@/lib/piConnectUrls';
import type { Quote } from '@/types/piConnect';
import { getSessionKey } from './getSessionKey';

export const getQuotes = async (exchange: 'NSE' | 'NFO', instrumentToken: string) => {
  const res = await fetch(`${PI_CONNECT_API_BASE}/GetQuotes`, {
    method: 'POST',
    body:
      'jData=' +
      JSON.stringify({
        uid: env.USER_ID,
        exch: exchange,
        token: instrumentToken,
      }) +
      `&jKey=${getSessionKey()}`,
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const quotes = await res.json();
  if (quotes.stat !== 'Ok') {
    throw new Error(quotes.emsg);
  }
  return quotes as Quote;
};
