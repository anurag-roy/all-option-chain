import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import env from '@/env.json';

const PORT = 3000;
const APITOKEN_URL = 'https://authapi.flattrade.in/trade/apitoken';

const TOKEN_FILE = path.join(process.cwd(), 'src', 'data', 'token.txt');

type ApitokenResponse = {
  token?: string;
  client?: string;
  /** Some Flattrade responses use `stat` instead of `status`. */
  stat?: string;
  status?: string;
  emsg?: string;
};

function apitokenIsOk(data: ApitokenResponse) {
  return data.stat === 'Ok' || data.status === 'Ok';
}

function getAuthUrl() {
  return `https://auth.flattrade.in/?app_key=${encodeURIComponent(env.API_KEY)}`;
}

function apitokenHash(requestCode: string) {
  return createHash('sha256')
    .update(env.API_KEY + requestCode + env.API_SECRET)
    .digest('hex');
}

function sendHtml(res: ServerResponse, status: number, body: string) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

async function exchangeToken(requestCode: string) {
  const res = await fetch(APITOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: env.API_KEY,
      request_code: requestCode,
      api_secret: apitokenHash(requestCode),
    }),
  });
  const text = await res.text();
  let data: ApitokenResponse;
  try {
    data = JSON.parse(text) as ApitokenResponse;
  } catch {
    throw new Error(`Apitoken: non-JSON response (${res.status}): ${text.slice(0, 500)}`);
  }
  if (!res.ok) {
    throw new Error(`Apitoken: HTTP ${res.status} — ${text.slice(0, 500)}`);
  }
  if (!apitokenIsOk(data) || !data.token) {
    const errMsg = data.emsg || data.stat || data.status || 'unknown';
    throw new Error(`Apitoken: ${errMsg} — ${text.slice(0, 500)}`);
  }
  return data.token;
}

const HTML_OK = `<!doctype html><html><head><meta charset="utf-8"><title>Flattrade</title></head>
<body><p>Login complete. You can close this tab.</p></body></html>`;
const HTML_ERR = (msg: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>Flattrade</title></head>
<body><p>Error: ${msg}</p></body></html>`;

let handled = false;

function stopServerAndExit(s: ReturnType<typeof createServer>, code: number) {
  s.closeAllConnections();
  s.close(() => {
    process.exitCode = code;
    process.exit(code);
  });
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.writeHead(405);
    res.end();
    return;
  }

  // Flattrade redirect uses ?code=... (also accept legacy ?request_code= per docs).
  const requestCode = url.searchParams.get('code') ?? url.searchParams.get('request_code');
  const errParam = url.searchParams.get('error');

  if (handled) {
    sendHtml(res, 400, HTML_ERR('This login session was already completed. Restart the script to try again.'));
    return;
  }

  if (errParam) {
    handled = true;
    console.error('OAuth error from redirect:', errParam);
    sendHtml(res, 400, HTML_ERR(errParam));
    stopServerAndExit(server, 1);
    return;
  }

  if (!requestCode) {
    if (url.pathname === '/') {
      sendHtml(
        res,
        200,
        '<!doctype html><html><head><meta charset="utf-8"></head><body><p>Waiting for redirect with <code>code</code> or <code>request_code</code>…</p></body></html>'
      );
    } else {
      res.writeHead(404);
      res.end();
    }
    return;
  }

  handled = true;
  void (async () => {
    try {
      const token = await exchangeToken(requestCode);
      mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
      writeFileSync(TOKEN_FILE, token, 'utf8');
      console.log('Token saved to', TOKEN_FILE);
      sendHtml(res, 200, HTML_OK);
      stopServerAndExit(server, 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Apitoken failed:', msg);
      sendHtml(res, 500, HTML_ERR(msg));
      stopServerAndExit(server, 1);
    }
  })();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Listening on http://localhost:${PORT}/`);
  console.log('Open this URL in your browser and sign in:');
  console.log(getAuthUrl());
});
