import { login } from '@/lib/api/login';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { getUserDetails } from './getUserDetails';

export const getHash = (input: string) => createHash('sha256').update(input).digest('hex');

export const injectTokenIntoEnv = async () => {
  if (!process.env.token) {
    try {
      const readToken = readFileSync('src/data/token.txt', 'utf-8');
      process.env.token = readToken;

      await getUserDetails();
    } catch (error) {
      const msg = (error as any).code === 'ENOENT' ? 'Token file not found' : 'Invalid session';
      console.log(`${msg}. Trying to log in...`);
      const token = await login();
      writeFileSync('src/data/token.txt', token, 'utf-8');
      process.env.token = token;
    }
  }
};
