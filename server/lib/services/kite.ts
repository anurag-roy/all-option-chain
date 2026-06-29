import { env } from '@server/lib/env';
import { logger } from '@server/lib/logger';
import { accessToken } from '@server/lib/services/access-token';
import { BSE_STOCKS_TO_INCLUDE } from '@server/shared/config';
import type { AmoOrderItem } from '@shared/schemas/amo';
import { chunk } from 'es-toolkit';
import { KiteConnect, type CompactMargin, type Exchange } from 'kiteconnect-ts';
import PQueue from 'p-queue';

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

export type MarginOrderInput = {
  tradingsymbol: string;
  quantity: number;
  price: number;
};

const mapToMarginOrder = (input: MarginOrderInput) => ({
  exchange: 'NFO' as const,
  order_type: 'LIMIT' as const,
  product: 'MIS' as const,
  quantity: input.quantity,
  tradingsymbol: input.tradingsymbol,
  transaction_type: 'SELL' as const,
  variety: 'regular' as const,
  price: input.price,
});

export const getOrderMargins = async (orderInputs: MarginOrderInput[]) => {
  const allMargins: CompactMargin[] = [];

  // Kite nets margin across orders in a single batch request (portfolio offset).
  // Fetch one order per API call so table margins match the order modal.
  for (const input of orderInputs) {
    try {
      const [margin] = await queue.add(() => kiteService.orderMargins([mapToMarginOrder(input)], 'compact'));
      if (margin?.total) {
        allMargins.push(margin);
      }
    } catch (error) {
      logger.error(`Error fetching margin for ${input.tradingsymbol}:`, error);
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
    kiteService.orderMargins([mapToMarginOrder({ tradingsymbol, quantity, price })], 'compact')
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

export const placeBuyOrder = async (tradingsymbol: string, price: number, quantity: number, isAmo: boolean) => {
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
