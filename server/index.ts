import { serve } from '@hono/node-server';
import app, { injectWebSocket } from '@server/app';
import { env } from '@server/lib/env';
import { logger } from '@server/lib/logger';
import { accessToken } from '@server/lib/services/access-token';
import { optionChainCoordinator } from '@server/lib/services/option-chain-coordinator';

async function bootstrap() {
  logger.info('Starting option chain server');

  if (!accessToken) {
    logger.warn('No Kite access token found. Run `npm run login` before using live data.');
  } else {
    await optionChainCoordinator.init();
  }

  const server = serve(
    {
      fetch: app.fetch,
      port: env.PORT,
    },
    (info) => {
      logger.info(`Server started on http://localhost:${info.port}`);
    }
  );

  injectWebSocket(server);

  const shutdown = async () => {
    logger.info('Shutting down...');
    await optionChainCoordinator.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
