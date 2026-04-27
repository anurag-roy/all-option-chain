import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getUserDetails } from './getUserDetails';

const TOKEN_FILE = path.join(process.cwd(), 'src', 'data', 'token.txt');

export const getHash = (input: string) => createHash('sha256').update(input).digest('hex');

export const injectTokenIntoEnv = async () => {
  if (!process.env.token) {
    try {
      const readToken = readFileSync(TOKEN_FILE, 'utf-8').trim();
      process.env.token = readToken;

      await getUserDetails();
    } catch (error) {
      console.error('Invalid session. Please login again.', error);
      process.exit(1);
    }
  }
};
