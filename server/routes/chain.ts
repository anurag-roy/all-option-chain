import { routeValidator } from '@server/middlewares/validator';
import { optionChainCoordinator } from '@server/lib/services/option-chain-coordinator';
import {
  getAllEquityNames,
  getUpcomingOptionExpiries,
} from '@server/lib/services/instrument-catalog';
import { accessToken } from '@server/lib/services/access-token';
import { chainFilterSchema } from '@server/shared/schemas/chain-filter';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

export const chainRoute = new Hono()
  .get('/status', (c) => c.json(optionChainCoordinator.getStatus()))
  .get('/expiries', async (c) => {
    const expiries = await getUpcomingOptionExpiries(6);
    return c.json({ expiries });
  })
  .get('/symbols', async (c) => {
    const symbols = await getAllEquityNames();
    return c.json({ symbols });
  })
  .post('/filter', routeValidator('json', chainFilterSchema), async (c) => {
    if (!accessToken) {
      throw new HTTPException(503, { message: 'Kite access token missing. Run npm run login first.' });
    }

    const filter = c.req.valid('json');
    await optionChainCoordinator.applyFilter(filter);
    return c.json({
      status: optionChainCoordinator.getStatus(),
      data: optionChainCoordinator.getSnapshot(),
    });
  });
