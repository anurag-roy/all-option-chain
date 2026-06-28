import { logger } from '@server/lib/logger';
import { readFile } from 'node:fs/promises';

let accessToken: string = '';

try {
  accessToken = await readFile('.data/accessToken.txt', 'utf8');
} catch (error) {
  logger.error('No access token found. Starting without access token.');
}

export { accessToken };
