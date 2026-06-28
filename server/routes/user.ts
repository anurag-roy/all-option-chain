import { logger } from '@server/lib/logger';
import { kiteService } from '@server/lib/services/kite';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

export const userRoute = new Hono()
  .get('/', async (c) => {
    try {
      const userDetails = await kiteService.getProfile();
      return c.json(userDetails);
    } catch (error) {
      logger.error('Error fetching user details:', error);
      throw new HTTPException(500, { message: 'Failed to fetch user details', cause: error });
    }
  })
  .get('/margin', async (c) => {
    try {
      const userMargins = await kiteService.getMargins('equity');
      return c.json({ net: userMargins.net });
    } catch (error) {
      logger.error('Error fetching user margin:', error);
      throw new HTTPException(500, { message: 'Failed to fetch user margin', cause: error });
    }
  });
