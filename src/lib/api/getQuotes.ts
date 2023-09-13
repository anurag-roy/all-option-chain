import env from '@/env.json';
import type { Quote } from '@/types/shoonya';

export const getQuotes = async (
  exchange: 'NSE' | 'NFO',
  instrumentToken: string
) => {
  const res = await fetch('https://api.shoonya.com/NorenWClientTP/GetQuotes', {
    method: 'POST',
    body:
      'jData=' +
      JSON.stringify({
        uid: env.USER_ID,
        exch: exchange,
        token: instrumentToken,
      }) +
      `&jKey=${process.env.token}`,
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
