import { logger } from '@server/lib/logger';
import { accessToken } from '@server/lib/services/access-token';
import { GsecSeedError } from '@server/lib/services/approved-gsecs';
import { getGsecDepth, scanGsecs } from '@server/lib/services/gsec-scanner';
import { routeValidator } from '@server/middlewares/validator';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

function requireAccessToken() {
  if (!accessToken.trim()) {
    throw new HTTPException(503, { message: 'Kite access token missing. Run npm run login first.' });
  }
}

function upstreamError(error: unknown): never {
  if (error instanceof HTTPException) throw error;
  logger.error('G-Sec data request failed:', error);
  if (error instanceof GsecSeedError) throw new HTTPException(503, { message: error.message });
  if (typeof error === 'object' && error !== null && 'error_type' in error && error.error_type === 'TokenException') {
    throw new HTTPException(503, {
      message: 'Kite login is invalid or expired. Run npm run login and restart the server.',
    });
  }
  if (error instanceof Error && error.message.startsWith('Kite ticker limit exceeded:')) {
    throw new HTTPException(400, { message: error.message });
  }
  throw new HTTPException(502, {
    message: 'Could not refresh G-Sec data. Check the Kite login and run npm run data:prepare, then restart the app.',
  });
}

export const gsecsRoute = new Hono()
  .onError((error, c) => {
    if (error instanceof HTTPException) return c.json({ message: error.message }, error.status);
    throw error;
  })
  .get('/', routeValidator('query', z.object({ refresh: z.literal('true').optional() })), async (c) => {
    requireAccessToken();
    try {
      return c.json(await scanGsecs(c.req.valid('query').refresh === 'true'));
    } catch (error) {
      return upstreamError(error);
    }
  })
  .get(
    '/depth',
    routeValidator('query', z.object({ tradingsymbol: z.string().regex(/^\d{2,4}(?:GS|GR)\d{4}[A-Z]?-GS$/) })),
    async (c) => {
      requireAccessToken();
      try {
        const depth = await getGsecDepth(c.req.valid('query').tradingsymbol);
        if (!depth) throw new HTTPException(404, { message: 'This G-Sec is not currently approved for pledging.' });
        return c.json(depth);
      } catch (error) {
        return upstreamError(error);
      }
    }
  );
