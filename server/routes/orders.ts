import { logger } from '@server/lib/logger';
import { getInstrumentByToken } from '@server/lib/services/instrument-catalog';
import { getMarginForOrder, getQuoteDepth, placeSellOrder } from '@server/lib/services/kite';
import { routeValidator } from '@server/middlewares/validator';
import { orderMarginRequestSchema, orderSellRequestSchema } from '@shared/schemas/orders';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const quoteQuerySchema = z.object({
  instrumentToken: z.coerce.number().int().positive(),
});

export const ordersRoute = new Hono()
  .get('/quote', routeValidator('query', quoteQuerySchema), async (c) => {
    const { instrumentToken } = c.req.valid('query');

    try {
      const instrument = await getInstrumentByToken(instrumentToken);
      if (!instrument) {
        throw new HTTPException(404, { message: 'Instrument not found' });
      }

      if (!instrument.exchange) {
        throw new HTTPException(400, { message: 'Instrument exchange missing' });
      }

      const depth = await getQuoteDepth(instrument.exchange, instrument.tradingsymbol);
      if (!depth) {
        throw new HTTPException(404, { message: 'Quote not found' });
      }

      return c.json(depth);
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error;
      }
      logger.error('Error fetching quote depth:', error);
      throw new HTTPException(500, { message: 'Failed to fetch quote', cause: error });
    }
  })
  .post('/margin', routeValidator('json', orderMarginRequestSchema), async (c) => {
    const { tradingsymbol, price, quantity } = c.req.valid('json');

    try {
      const margin = await getMarginForOrder(tradingsymbol, price, quantity);
      return c.json(margin);
    } catch (error) {
      logger.error('Error fetching order margin:', error);
      throw new HTTPException(500, { message: 'Failed to fetch order margin', cause: error });
    }
  })
  .post('/sell', routeValidator('json', orderSellRequestSchema), async (c) => {
    const { tradingsymbol, price, quantity } = c.req.valid('json');

    try {
      const result = await placeSellOrder(tradingsymbol, price, quantity);
      return c.json(result);
    } catch (error) {
      logger.error('Error placing sell order:', error);
      throw new HTTPException(500, { message: 'Failed to place sell order', cause: error });
    }
  });
