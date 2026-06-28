// Adapted from https://github.com/honojs/hono/blob/main/src/middleware/logger/index.ts

import { logger } from '@server/lib/logger';
import type { MiddlewareHandler } from 'hono/types';
import { getPath, getQueryStrings } from 'hono/utils/url';
import pc from 'picocolors';

const humanize = (times: string[]) => {
  const [delimiter, separator] = [',', '.'];

  const orderTimes = times.map((v) => v.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + delimiter));

  return orderTimes.join(separator);
};

const time = (start: number) => {
  const delta = Date.now() - start;
  return humanize([delta < 1000 ? delta + 'ms' : Math.round(delta / 1000) + 's']);
};

const colorStatus = (status: number) => {
  switch ((status / 100) | 0) {
    case 5: // red = error
      return pc.red(status);
    case 4: // yellow = warning
      return pc.yellow(status);
    case 3: // cyan = redirect
      return pc.cyan(status);
    case 2: // green = success
      return pc.green(status);
    default:
      return `${status}`;
  }
};

export const httpLogger = (): MiddlewareHandler => async (c, next) => {
  const { method } = c.req;
  const path = getPath(c.req.raw) + getQueryStrings(c.req.url);
  const start = Date.now();

  await next();

  logger.info(`${method} ${path} ${colorStatus(c.res.status)} ${time(start)}`);
};
