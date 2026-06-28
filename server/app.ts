import { serveStatic } from '@hono/node-server/serve-static';
import { createNodeWebSocket } from '@hono/node-ws';
import { logger } from '@server/lib/logger';
import { clientBroadcaster } from '@server/lib/services/client-broadcaster';
import { optionChainCoordinator } from '@server/lib/services/option-chain-coordinator';
import { httpLogger } from '@server/middlewares/http-logger';
import { chainRoute } from '@server/routes/chain';
import { userRoute } from '@server/routes/user';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

const app = new Hono();

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use('*', httpLogger());

clientBroadcaster.setCallbacks({
  updateFilter: async (message) => {
    try {
      await optionChainCoordinator.applyFilter(message.filter);
      return true;
    } catch (error) {
      logger.error('Failed to apply filter from websocket:', error);
      return false;
    }
  },
  updateSdMultiplier: async (value) => optionChainCoordinator.updateSdMultiplier(value),
});

optionChainCoordinator.onUpdate((data, status) => {
  clientBroadcaster.publishOptionChain(data, status);
});

const apiRoutes = app
  .basePath('/api')
  .route('/user', userRoute)
  .route('/chain', chainRoute)
  .get(
    '/ws',
    upgradeWebSocket(() => {
      let clientId = '';

      return {
        onOpen: (_event, ws) => {
          clientId = clientBroadcaster.handleOpen(ws);
        },
        onMessage: async (event) => {
          await clientBroadcaster.handleMessage(clientId, event.data.toString());
        },
        onClose: () => {
          clientBroadcaster.handleClose(clientId);
        },
      };
    })
  );

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    if (err.cause instanceof Error) {
      err.message = err.message + ': ' + err.cause.message;
    }
    return err.getResponse();
  } else if (err instanceof Error) {
    logger.error(err.message);
  } else {
    logger.error(err);
  }
  return c.json({ message: 'Internal server error. Please try again later.' }, 500);
});

app.get('*', serveStatic({ root: './client/dist' }));
app.get('*', serveStatic({ path: './client/dist/index.html' }));

export { injectWebSocket };
export type ApiRoutes = typeof apiRoutes;
export default app;
