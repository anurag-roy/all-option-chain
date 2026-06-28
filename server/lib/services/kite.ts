import { env } from '@server/lib/env';
import { logger } from '@server/lib/logger';
import { accessToken } from '@server/lib/services/access-token';
import { chunk } from 'es-toolkit';
import { KiteConnect, type CompactMargin, type Exchange } from 'kiteconnect-ts';
import PQueue from 'p-queue';
import { BSE_STOCKS_TO_INCLUDE } from '@server/shared/config';
import type { AmoOrderItem } from '@shared/schemas/amo';

const queue = new PQueue({
  interval: 1000,
  intervalCap: 8,
  carryoverIntervalCount: true,
});

const quoteQueue = new PQueue({
  interval: 1000,
  intervalCap: 3,
  carryoverIntervalCount: true,
});

const orderQueue = new PQueue({
  concurrency: 1,
  interval: 300,
  intervalCap: 1,
});

export const kiteService = new KiteConnect({
  api_key: env.KITE_API_KEY,
  access_token: accessToken,
});

export type KiteFullQuote = {
  instrument_token: number;
  last_price: number;
  oi?: number;
  depth?: {
    buy: Array<{ price: number; quantity: number; orders: number }>;
    sell: Array<{ price: number; quantity: number; orders: number }>;
  };
  ohlc?: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
};

export const getFullQuotes = async (instruments: string[]) => {
  const quotes: Record<string, KiteFullQuote> = {};

  for (const instrumentChunk of chunk(instruments, 500)) {
    const batch = await quoteQueue.add(() => kiteService.getQuote(instrumentChunk));
    Object.assign(quotes, batch);
  }

  return quotes;
};

export const getLtpQuotes = async (instruments: string[]) => {
  const quotes: Record<string, { instrument_token: number; last_price: number }> = {};

  for (const instrumentChunk of chunk(instruments, 1000)) {
    const batch = await quoteQueue.add(() => kiteService.getLTP(instrumentChunk));
    Object.assign(quotes, batch);
  }

  return quotes;
};

const MAX_RETRIES = 3;
const MARGIN_CHUNK_SIZE = 500;

const mapTsToMarginOrder = (tradingsymbol: string) => ({
  exchange: 'NFO' as const,
  order_type: 'LIMIT' as const,
  product: 'MIS' as const,
  quantity: 1,
  tradingsymbol,
  transaction_type: 'SELL' as const,
  variety: 'regular' as const,
});

export const getOrderMargins = async (tradingsymbols: string[]) => {
  const allMargins: CompactMargin[] = [];

  for (const symbolChunk of chunk(tradingsymbols, MARGIN_CHUNK_SIZE)) {
    let remainingSymbols = symbolChunk;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      if (remainingSymbols.length === 0) {
        break;
      }

      try {
        const orders = remainingSymbols.map(mapTsToMarginOrder);
        const margins = await queue.add(() => kiteService.orderMargins(orders, 'compact'));

        const fetchedMargins = margins.filter((margin) => margin.total);
        const fetchedSymbols = new Set(fetchedMargins.map((margin) => margin.tradingsymbol));

        allMargins.push(...fetchedMargins);
        remainingSymbols = remainingSymbols.filter((symbol) => !fetchedSymbols.has(symbol));
      } catch (error) {
        logger.error(
          `Error fetching margins on attempt ${attempt} (chunk ${symbolChunk.length - remainingSymbols.length}/${symbolChunk.length} done):`,
          error
        );
        if (attempt === MAX_RETRIES) {
          break;
        }
      }
    }

    if (remainingSymbols.length > 0) {
      logger.error(
        `Failed to fetch margins for ${remainingSymbols.length} symbols after ${MAX_RETRIES} attempts: ${remainingSymbols.slice(0, 5).join(', ')}${remainingSymbols.length > 5 ? '...' : ''}`
      );
    }
  }

  return allMargins;
};

export const getQuoteDepth = async (exchange: string, tradingsymbol: string) => {
  const key = `${exchange}:${tradingsymbol}`;
  const quotes = await getFullQuotes([key]);
  const quote = quotes[key];

  if (!quote) {
    return null;
  }

  return {
    buy: (quote.depth?.buy ?? []).map((level) => ({ price: level.price, quantity: level.quantity })),
    sell: (quote.depth?.sell ?? []).map((level) => ({ price: level.price, quantity: level.quantity })),
  };
};

export const getMarginForOrder = async (tradingsymbol: string, price: number, quantity: number) => {
  const [margin] = await queue.add(() =>
    kiteService.orderMargins(
      [
        {
          exchange: 'NFO',
          order_type: 'LIMIT',
          product: 'MIS',
          quantity,
          tradingsymbol,
          transaction_type: 'SELL',
          variety: 'regular',
          price,
        },
      ],
      'compact'
    )
  );

  const userMargins = await kiteService.getMargins('equity');
  const orderMargin = margin?.total ?? 0;
  const cash = userMargins.available.cash;
  const marginUsedPrev = userMargins.utilised.debits;
  const remainingCash = userMargins.net - orderMargin;

  return {
    orderMargin,
    cash,
    marginUsedPrev,
    insufficientBalance: remainingCash < 0,
  };
};

export const placeSellOrder = async (tradingsymbol: string, price: number, quantity: number) => {
  return kiteService.placeOrder('regular', {
    exchange: 'NFO',
    tradingsymbol,
    transaction_type: 'SELL',
    quantity,
    product: 'MIS',
    order_type: 'LIMIT',
    validity: 'DAY',
    price,
  });
};

const getEquityExchange = (tradingsymbol: string): Exchange => {
  const symbol = tradingsymbol.replace('-EQ', '');
  return BSE_STOCKS_TO_INCLUDE.includes(symbol) ? 'BSE' : 'NSE';
};

export const placeBuyOrder = async (
  tradingsymbol: string,
  price: number,
  quantity: number,
  isAmo: boolean
) => {
  const exchange = getEquityExchange(tradingsymbol);
  const symbol = tradingsymbol.replace('-EQ', '');

  return kiteService.placeOrder(isAmo ? 'amo' : 'regular', {
    exchange,
    tradingsymbol: symbol,
    transaction_type: 'BUY',
    quantity,
    product: 'CNC',
    order_type: 'LIMIT',
    validity: 'DAY',
    price,
  });
};

export type PlaceBuyOrderResult = {
  tradingsymbol: string;
  price: number;
  quantity: number;
  isAmo: boolean;
  success: boolean;
  orderId?: string;
  error?: string;
};

export const placeBuyOrdersBatch = async (orders: AmoOrderItem[]) => {
  const results: PlaceBuyOrderResult[] = [];

  for (const order of orders) {
    try {
      const response = await orderQueue.add(() =>
        placeBuyOrder(order.tradingsymbol, order.price, order.quantity, order.isAmo)
      );
      results.push({
        ...order,
        success: true,
        orderId: response.order_id,
      });
    } catch (error) {
      logger.error(`Failed to place buy order for ${order.tradingsymbol} @ ${order.price}:`, error);
      results.push({
        ...order,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
};
