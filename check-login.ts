import env from '@/env.json';
import { getSessionKey } from '@/lib/api/getSessionKey';
import { PI_CONNECT_API_BASE } from '@/lib/piConnectUrls';
import type { PiConnectApiError, UserDetails } from '@/types/piConnect';
import path from 'node:path';

const USER_DETAILS_URL = `${PI_CONNECT_API_BASE}/UserDetails`;
const TOKEN_FILE = path.join(process.cwd(), 'src', 'data', 'token.txt');

async function main() {
  let jKey: string;
  try {
    jKey = getSessionKey();
  } catch {
    console.error('Missing or empty session key. Ensure', TOKEN_FILE, 'exists or set `process.env.token`.');
    console.error('Run `npx tsx login.ts` to create the token file.');
    process.exit(1);
    return;
  }
  if (!jKey) {
    console.error('Token is empty.');
    process.exit(1);
    return;
  }

  const res = await fetch(USER_DETAILS_URL, {
    method: 'POST',
    body:
      'jData=' +
      JSON.stringify({
        uid: env.USER_ID,
      }) +
      `&jKey=${jKey}`,
  });

  const text = await res.text();
  let data: UserDetails | PiConnectApiError;
  try {
    data = JSON.parse(text) as UserDetails | PiConnectApiError;
  } catch {
    console.error('Non-JSON response', res.status, text.slice(0, 500));
    process.exit(1);
    return;
  }

  if (!res.ok) {
    console.error('HTTP', res.status, text.slice(0, 500));
    process.exit(1);
    return;
  }

  if (data.stat !== 'Ok') {
    console.error('UserDetails failed:', (data as PiConnectApiError).emsg || text);
    process.exit(1);
    return;
  }

  console.log('UserDetails OK — session token is valid for PiConnect API.');
  console.log(JSON.stringify(data, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
