import env from '@/env.json';
import { getSessionKey } from '@/lib/api/getSessionKey';
import { normalizeTradingSymbol } from '@/lib/api/normalizeTradingSymbol';
import { PI_CONNECT_API_BASE } from '@/lib/piConnectUrls';

type PiError = {
  stat: 'Not_Ok';
  emsg: string;
};

type MarginOk = {
  stat: 'Ok';
  ordermargin: string;
  request_time: string;
  remarks?: string;
  [key: string]: unknown;
};

type SearchScripOk = {
  stat: 'Ok';
  values: Array<{
    exch: string;
    token: string;
    tsym: string;
    dname?: string;
    ls?: string;
    ti?: string;
  }>;
};

const DEFAULT_TSYM = 'BHEL28APR26P302.50';
const DEFAULT_QTY = '2625';
const DEFAULT_PRICE = '0.02';
const DEFAULT_EXCHANGE = 'NFO';

const inputTsym = process.argv[2] ?? DEFAULT_TSYM;
const inputQty = process.argv[3] ?? DEFAULT_QTY;
const inputPrice = process.argv[4] ?? DEFAULT_PRICE;
const inputExchange = process.argv[5] ?? DEFAULT_EXCHANGE;

const postPi = async (path: string, jData: Record<string, string>) => {
  const body = `jData=${JSON.stringify(jData)}&jKey=${getSessionKey()}`;
  const res = await fetch(`${PI_CONNECT_API_BASE}/${path}`, {
    method: 'POST',
    body,
  });
  const text = await res.text();
  try {
    return {
      status: res.status,
      data: JSON.parse(text) as Record<string, unknown>,
      raw: text,
    };
  } catch {
    return {
      status: res.status,
      data: { stat: 'Not_Ok', emsg: `Non-JSON response: ${text}` },
      raw: text,
    };
  }
};

const tryMargin = async (tsym: string) => {
  const encoded = encodeURIComponent(tsym);
  const { status, data, raw } = await postPi('GetOrderMargin', {
    uid: env.USER_ID,
    actid: env.USER_ID,
    exch: inputExchange,
    tsym: encoded,
    qty: inputQty,
    prc: inputPrice,
    prd: 'M',
    trantype: 'S',
    prctyp: 'LMT',
  });

  console.log('\nGetOrderMargin attempt');
  console.log(
    JSON.stringify(
      {
        status,
        tsym,
        encodedTsym: encoded,
        qty: inputQty,
        price: inputPrice,
        response: data,
      },
      null,
      2
    )
  );

  if ((data as MarginOk | PiError).stat !== 'Ok') {
    return {
      ok: false as const,
      error: (data as PiError).emsg ?? raw,
    };
  }

  return {
    ok: true as const,
    margin: data as MarginOk,
  };
};

const searchScrip = async (stext: string) => {
  const { status, data } = await postPi('SearchScrip', {
    uid: env.USER_ID,
    exch: inputExchange,
    stext,
  });
  console.log('\nSearchScrip');
  console.log(
    JSON.stringify(
      {
        status,
        stext,
        response: data,
      },
      null,
      2
    )
  );

  if ((data as SearchScripOk | PiError).stat !== 'Ok') return null;
  const values = (data as SearchScripOk).values;
  return values.length > 0 ? values[0].tsym : null;
};

async function main() {
  console.log('Testing margin for symbol', inputTsym);

  const attempts = [inputTsym];
  const normalized = normalizeTradingSymbol(inputTsym);
  if (normalized !== inputTsym) attempts.push(normalized);

  for (const tsym of attempts) {
    const result = await tryMargin(tsym);
    if (result.ok) {
      console.log('\nMargin fetch succeeded.');
      process.exit(0);
    }
  }

  const searchedTsym = await searchScrip(inputTsym);
  if (searchedTsym && !attempts.includes(searchedTsym)) {
    console.log(`\nRetrying with SearchScrip tsym: ${searchedTsym}`);
    const searchedResult = await tryMargin(searchedTsym);
    if (searchedResult.ok) {
      console.log('\nMargin fetch succeeded via SearchScrip tsym.');
      process.exit(0);
    }
  }

  console.error('\nMargin fetch failed for all attempts.');
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
