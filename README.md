# NSE Option Chain

Real-time NSE F&O option chain dashboard for ~200 stocks, powered by [Zerodha Kite](https://kite.trade/). The server selects strikes via asymmetric sigma bounds, streams live bids over Kite's ticker websocket, computes delta/returns/margins, and pushes updates to a React SPA.

**All broker I/O runs server-side** — the browser never talks to Kite directly.

## Features

- Live option chain with bid, sell value, return %, delta, sigma metrics, and margin status
- Asymmetric sigma strike selection (CE ceiling / PE floor) with configurable SD multiplier
- Batch margin lookups via Kite `orderMargins` with rate limiting
- SQLite-backed instrument catalog (Kite instruments + NSE volatility)
- Holiday-aware working-day calculations for sigma and delta
- Typed Hono RPC API + WebSocket stream for real-time updates

## Tech stack

| Layer | Stack |
|-------|-------|
| Server | TypeScript, Hono, `@hono/node-server`, `@hono/node-ws` |
| Client | React 19, Vite 8, Tailwind v4, TanStack Table & Router |
| RPC | `hono/client` typed RPC |
| Database | Drizzle ORM + SQLite (`@libsql/client`) |
| Broker | `kiteconnect-ts` (REST + `KiteTicker` websocket) |

## Prerequisites

- Node.js 20+
- A [Zerodha Kite](https://kite.trade/) account with API access (API key + secret)
- For automated login: TOTP secret configured in `.env`

## Quick start

```bash
# Clone and install
git clone https://github.com/anurag-roy/all-option-chain.git
cd all-option-chain/proposed_structure
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Kite credentials

# Initialize database
npm run db:push
npm run db:seed

# Authenticate with Kite (writes .data/accessToken.txt)
npm run login
# Or, with TOTP configured:
npm run auto-login

# Development — run in two terminals
npm run dev          # API + WebSocket on :4000 (or PORT from .env)
npm run dev:client   # Vite dev server on :5173 (proxies /api → :4000)
```

Open [http://localhost:5173](http://localhost:5173), pick an expiry, and load the chain.

### Production

```bash
npm run build   # builds client → client/dist
npm start       # Hono serves the SPA + API on PORT
```

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP server port (default `4000`) |
| `DATABASE_URL` | SQLite path (default `file:.data/database.db`) |
| `KITE_API_KEY` | Kite Connect API key |
| `KITE_API_SECRET` | Kite Connect API secret |
| `KITE_USER_ID` | Zerodha user ID (for login scripts) |
| `KITE_PASSWORD` | Zerodha password (for login scripts) |
| `KITE_TOTP_SECRET` | TOTP secret (for `auto-login`) |

The Kite access token is written to `.data/accessToken.txt` by the login scripts and read at server startup. If missing, the server starts but live market data will not work.

**Do not commit** `.env`, `.data/accessToken.txt`, or `.data/database.db`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start API + WebSocket server with hot reload |
| `npm run dev:client` | Start Vite dev server |
| `npm run build` | Install deps + build client for production |
| `npm start` | Run production server |
| `npm run login` | Interactive Kite login |
| `npm run auto-login` | TOTP-based Kite login |
| `npm run db:push` | Push Drizzle schema to SQLite |
| `npm run db:seed` | Seed instruments, volatility, and holidays |
| `npm run data:prepare` | `db:migrate` + `db:seed` |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run typecheck` | Typecheck server |
| `npm run format` | Prettier on server + client |

## Architecture

```
React SPA ──HTTP (Hono RPC)──► Hono API (/api/*)
React SPA ◄──WebSocket────────► /api/ws
                                    │
                                    ▼
                          ClientBroadcaster
                                    │
                                    ▼
                        OptionChainCoordinator
                         ├── InstrumentCatalog (DB)
                         ├── SubscriptionPlanner (sigma strikes)
                         ├── Kite REST (quotes, margins)
                         ├── MarketDataService (KiteTicker)
                         ├── MarginBook (cached margins)
                         └── calculators/ (delta, sigma, returns)
```

### API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/user` | Kite profile |
| GET | `/api/user/margin` | Account net margin |
| GET | `/api/chain/status` | Engine status + row counts |
| GET | `/api/chain/expiries` | Upcoming option expiry dates |
| GET | `/api/chain/symbols` | All equity names in DB |
| POST | `/api/chain/filter` | Apply filter and load chain |
| WS | `/api/ws` | Live option chain + status stream |

### Chain filter

```typescript
{
  expiry: string;        // ISO date, e.g. "2026-06-26"
  sdMultiplier: number;  // default 1
  entryValue: number;    // default 99 — client-side display filter only
  orderPercent: number;  // default 0.5
  symbols?: string[];    // optional subset
}
```

## Project structure

```
├── .env / .env.example
├── .data/
│   ├── accessToken.txt     # Kite token (gitignored)
│   ├── database.db         # SQLite (gitignored)
│   └── nse_holidays.csv
├── server/
│   ├── index.ts            # Bootstrap
│   ├── app.ts              # Hono routes + WebSocket
│   ├── db/                 # Drizzle schema
│   ├── routes/             # API route modules
│   ├── lib/
│   │   ├── calculators/    # delta, sigma, returns
│   │   └── services/       # coordinator, kite, market-data, etc.
│   ├── shared/             # Zod schemas + shared types
│   └── scripts/            # seed, login, build
└── client/
    └── src/                # React SPA
```

## Tips & gotchas

1. **Entry value filter is client-side.** The server sends all rows; the table filters where `sellValue >= entryValue`. Default `99` hides most rows when markets are closed (bids at 0). Lower to `0` to see data off-hours.

2. **OI filter is server-side.** Contracts with zero open interest are dropped before subscription.

3. **Expiry format.** The database stores ISO dates (`YYYY-MM-DD`). Do not mix with legacy `MAR-2026` style strings.

4. **Avoid duplicate filter calls.** The filter form uses HTTP POST; the WebSocket also supports `updateFilter`. Don't trigger both for the same action.

5. **Rate limits.** Quote and margin requests are queued (`p-queue`). Don't remove these queues.

## Development

```bash
npm run typecheck              # server TypeScript
cd client && npm run typecheck # client TypeScript
cd client && npm run build     # client production build
npm run format                 # Prettier
```

For deeper architecture notes, service internals, and contributor guidelines, see [AGENTS.md](./AGENTS.md).

## License

MIT © [Anurag Roy](https://anuragroy.dev)
