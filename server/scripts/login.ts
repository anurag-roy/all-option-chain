import { env } from '@server/lib/env';
import { logger } from '@server/lib/logger';
import { KiteConnect } from 'kiteconnect-ts';
import { writeFileSync } from 'node:fs';
import { createServer } from 'node:http';

const app = createServer();

const kc = new KiteConnect({
  api_key: env.KITE_API_KEY,
});

const server = app.listen(8000, () => {
  logger.info(`Please click on this URL to get logged in: ${kc.getLoginURL()}`);
});

app.on('request', async (req, res) => {
  if (!req.url?.startsWith('/login')) return;

  try {
    const requestToken = req.url.split('request_token=')[1]!;

    logger.info('Generating session. Please wait.');
    const result = await kc.generateSession(requestToken, env.KITE_API_SECRET);

    writeFileSync('.data/accessToken.txt', result.access_token);

    res.end('Login flow successful!');
  } catch (error) {
    logger.error('Failed to generate session', error);
    res.end('Login flow failed!');
  }
  server.close();
});
