import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { getUserDetails } from './getUserDetails';

export const getHash = (input: string) =>
  createHash('sha256').update(input).digest('hex');

export const injectTokenIntoEnv = async (token?: string) => {
  if (token) {
    process.env.token = token;
  } else {
    try {
      const readToken = readFileSync('src/data/token.txt', 'utf-8');
      process.env.token = readToken;

      try {
        await getUserDetails();
      } catch (error) {
        console.log('Token expired');
        delete process.env.token;
      }
    } catch (error) {
      console.log('Token file not found. Skipping token setting...');
    }
  }
};
