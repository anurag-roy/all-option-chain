import { readFileSync } from 'node:fs';
import path from 'node:path';

const TOKEN_FILE = path.join(process.cwd(), 'src', 'data', 'token.txt');

/**
 * Pi session key (`jKey` / `accesstoken`): `process.env.token` if set (e.g. after
 * {@link injectTokenIntoEnv}), otherwise `src/data/token.txt`.
 * Server-side only — do not import from client bundles.
 */
export function getSessionKey(): string {
  const fromEnv = process.env.token?.trim();
  if (fromEnv) return fromEnv;
  return readFileSync(TOKEN_FILE, 'utf8').trim();
}
