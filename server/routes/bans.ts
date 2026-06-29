import { logger } from '@server/lib/logger';
import { getBansResponse, toggleCustomBan } from '@server/lib/services/bans-service';
import { routeValidator } from '@server/middlewares/validator';
import { toggleBanSchema } from '@shared/schemas/bans';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

export const bansRoute = new Hono()
  .get('/', async (c) => {
    try {
      const response = await getBansResponse();
      return c.json(response);
    } catch (error) {
      logger.error('Error fetching bans:', error);
      throw new HTTPException(500, { message: 'Failed to fetch bans', cause: error });
    }
  })
  .post('/toggle', routeValidator('json', toggleBanSchema), async (c) => {
    const { name } = c.req.valid('json');

    try {
      const response = await toggleCustomBan(name);
      return c.json(response);
    } catch (error) {
      if (error instanceof Error && error.message.includes('banned by NSE')) {
        throw new HTTPException(400, { message: error.message });
      }
      logger.error('Error toggling ban:', error);
      throw new HTTPException(500, { message: 'Failed to toggle ban', cause: error });
    }
  });
