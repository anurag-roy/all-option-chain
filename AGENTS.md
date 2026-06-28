# AGENTS.md — NSE Option Chain (Kite rewrite)

Context for AI agents working on this codebase. The **active rewrite** lives in `proposed_structure/`. The parent repo (`../src/`) is a legacy Next.js 14 + Shoonya app kept for reference only — do not extend it unless explicitly asked.

## What this app does

Real-time NSE F&O option chain for ~200 stocks. The server:

1. Loads instruments + volatility from SQLite (seeded from Kite + NSE)
2. Applies user filters (expiry, SD multiplier, entry value, order %)
3. Selects option strikes via asymmetric sigma bounds
4. Fetches Kite `/quote` snapshots (OI, depth) and filters zero-OI contracts
5. Subscribes to Kite ticker websocket for live bid updates
6. Computes sell value, return %, delta, sigmas, strike position
7. Batches margin lookups via Kite `orderMargins`
8. Streams snapshots to the React SPA over Hono websocket

**The browser never talks to Kite directly.** All broker I/O is server-side.

## Tech stack

| Layer | Stack |
|-------|-------|
| Server | TypeScript, Hono, `@hono/node-server`, `@hono/node-ws`, tsx |
| Client | React 19, Vite 8, Tailwind v4, shadcn-style UI primitives, TanStack Table |
| RPC | `hono/client` typed RPC (`client/src/lib/api.ts` → `server/app.ts` `ApiRoutes`) |
| DB | Drizzle ORM + SQLite via `@libsql/client` |
| Broker | Zerodha Kite (`kiteconnect-ts`) — REST + `KiteTicker` websocket |
| Shared | Zod schemas + types under `server/shared/` |

## Directory layout

```
proposed_structure/
├── .env                    # Root env (PORT, DATABASE_URL, KITE_*)
├── .data/
│   ├── accessToken.txt     # Kite access token (written by login scripts)
│   ├── database.db         # SQLite (gitignored)
│   └── nse_holidays.csv    # NSE holiday list for working-days calc
├── server/
│   ├── index.ts            # Bootstrap: coordinator init, HTTP + WS server
│   ├── app.ts              # Hono app, routes, websocket, static SPA serve
│   ├── db/                 # Drizzle schema + client
│   ├── routes/             # Hono route modules (user, chain)
│   ├── middlewares/        # http-logger, zod validator
│   ├── lib/
│   │   ├── calculators/    # Pure math: delta, sigma, returns
│   │   ├── services/         # Core business logic (see below)
│   │   ├── utils/            # NSE scraping, legacy db helpers
│   │   ├── working-days.ts   # Holiday-aware working day math
│   │   └── env.ts            # Zod-validated env
│   ├── shared/
│   │   ├── config.ts         # NSE_STOCKS_TO_INCLUDE, EXPIRY_OPTION_LENGTH, RISK_FREE_RATE
│   │   ├── schemas/          # Zod: chain-filter, websocket messages
│   │   └── types/            # OptionChainRow, ChainEngineStatus, etc.
│   └── scripts/              # seed, login, auto-login, build
└── client/
    └── src/
        ├── App.tsx
        ├── components/       # chain-filter-form, options-table, header, ui/*
        ├── contexts/         # websocket-context
        ├── hooks/            # use-websocket
        └── lib/              # api.ts (Hono RPC), utils.ts
```

## Path aliases

| Alias | Maps to | Used by |
|-------|---------|---------|
| `@server/*` | `server/*` | Server |
| `@shared/*` | `server/shared/*` | Server + client |
| `@client/*` | `client/src/*` | Client |

- Server tsconfig: `proposed_structure/tsconfig.json` (server only)
- Client tsconfig: `client/tsconfig.json` (also resolves `@server` for `import type { ApiRoutes }`)

**Convention:** kebab-case file names for new files.

## Architecture

```
React SPA ──HTTP (Hono RPC)──► Hono API (/api/*)
React SPA ◄──WebSocket────────► /api/ws
                                    │
                                    ▼
                          ClientBroadcaster
                                    │
                                    ▼
                        OptionChainCoordinator  ◄── central orchestrator
                         ├── InstrumentCatalog (DB queries)
                         ├── SubscriptionPlanner (sigma strike selection)
                         ├── Kite REST (quotes, margins) via kite.ts
                         ├── MarketDataService (KiteTicker websocket)
                         ├── MarginBook (cached margin refresh)
                         └── calculators/ (delta, sigma, returns)
```

## Key services (start here for bugs)

### `server/lib/services/option-chain-coordinator.ts`

**The brain.** Owns in-memory option chain state, filter application, tick handling, periodic recompute (500ms), margin refresh (5s), and publishing snapshots.

Important methods:

- `init()` — warm working-days cache, connect Kite ticker, start intervals
- `applyFilter(filter)` — full pipeline: plan → quote → OI filter → subscribe → rows
- `getSnapshot()` — returns **all** loaded rows (no entry-value filter)
- `getVisibleRowCount()` — rows where `sellValue >= entryValue` (for status UI)
- `updateSdMultiplier(value)` — re-runs `applyFilter` with new multiplier

### `server/lib/services/subscription-planner.ts`

Pure strike selection. Given underlying LTP, AV, expiry, sdMultiplier:

- Computes CE ceiling / PE floor via sigma bounds
- Picks closest floor/ceiling strikes
- Returns PE strikes ≤ floor, CE strikes ≥ ceiling

### `server/lib/services/kite.ts`

Kite REST wrapper + rate-limited queues (`p-queue`):

- `getFullQuotes()` — chunks of 500 (`/quote`)
- `getLtpQuotes()` — chunks of 1000 (`/quote/ltp`)
- `getOrderMargins()` — chunks of **500** (`orderMargins`). Each order is a full NFO MIS SELL LIMIT object.

### `server/lib/services/market-data.ts`

Single `KiteTicker` connection. `applyDiff(added, removed)` for subscription changes. Options use `full` mode (bid + depth); futures would use `ltp`.

### `server/lib/services/margin-book.ts`

Caches margins per tradingsymbol. Refreshes stale entries (>60s). Does not block chain loading.

### `server/lib/services/client-broadcaster.ts`

Manages websocket clients. Validates inbound messages with `wsClientMessageSchema`. Fans out `optionChain` + `status` messages. Per-client symbol filtering if client sends `subscribe` with symbol list.

### `server/lib/services/instrument-catalog.ts`

Canonical DB access (prefer over `lib/utils/db.ts`):

- `getEquityByName`, `getFuturesForName`, `getOptionsForNameAndExpiry`
- `getUpcomingOptionExpiries`, `getAllEquityNames`

### Calculators (`server/lib/calculators/`)

| File | Purpose |
|------|---------|
| `delta.ts` | Black-Scholes delta (uses `RISK_FREE_RATE` from config) |
| `sigma.ts` | σₙ, σₓ, σₓᵢ, asymmetric bounds, strike filtering helpers |
| `returns.ts` | `sellValue = (bid - 0.05) * lotSize`, `returnValue = sellValue * 100 / margin` |

### Working days (`server/lib/working-days.ts` + `working-days-cache.ts`)

Sigma and delta depend on working days till expiry vs last year. Holidays from `holidaysTable` (seeded from `.data/nse_holidays.csv`).

## API routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/user` | Kite profile |
| GET | `/api/user/margin` | Account net margin |
| GET | `/api/chain/status` | Coordinator status + row counts |
| GET | `/api/chain/expiries` | Upcoming option expiry dates (ISO `YYYY-MM-DD`) |
| GET | `/api/chain/symbols` | All equity names in DB |
| POST | `/api/chain/filter` | Apply filter, returns `{ status, data }` |
| WS | `/api/ws` | Live option chain + status stream |

### Chain filter payload (`server/shared/schemas/chain-filter.ts`)

```typescript
{
  expiry: string;        // ISO date from DB, e.g. "2026-06-26"
  sdMultiplier: number;  // default 1
  entryValue: number;    // default 99 — client-side display filter only
  orderPercent: number;  // default 0.5 — for order triggers (not wired in UI yet)
  symbols?: string[];    // optional subset; defaults to NSE_STOCKS_TO_INCLUDE
}
```

## WebSocket protocol (`server/shared/schemas/websocket.ts`)

**Client → server:**

- `{ type: "subscribe", symbols: string[] }`
- `{ type: "unsubscribe", symbols: string[] }`
- `{ type: "updateFilter", filter: ChainFilter }` — re-runs full pipeline
- `{ type: "updateSdMultiplier", value: number }`

**Server → client:**

- `{ type: "optionChain", data: Record<number, OptionChainRow> }`
- `{ type: "status", status, message?, rowCount?, visibleRowCount? }`
- `{ type: "sdMultiplierUpdated", success, value? }`

## Domain types (`server/shared/types/types.ts`)

`OptionChainRow` is the main row shape sent to the client. Key fields:

- `name` — underlying symbol (e.g. `RELIANCE`)
- `underlyingLtp`, `bid`, `sellValue`, `returnValue`, `delta`, `oi`
- `marginStatus` — `'loading' | 'ready' | 'error' | 'unavailable'`
- `sigmaN`, `sigmaX`, `sigmaXI`, `sd`, `strikePosition`

## Database

**Schema:** `server/db/schema.ts`

- `instruments` — Kite instruments + NSE volatility (`av`, `dv`). Keyed by `instrumentToken`. Use `name` + `expiry` for options lookup.
- `holidays` — NSE holidays for working-day calculations

**Seed:** `server/scripts/seed.ts` — downloads Kite instruments (NSE/BSE/NFO), Nifty 500 + `NSE_STOCKS_TO_INCLUDE`, NSE volatility CSV, holidays.

```bash
npm run db:push && npm run db:seed
```

## Auth & scripts

| Script | Command | Purpose |
|--------|---------|---------|
| Login | `npm run login` | Interactive Kite login → `.data/accessToken.txt` |
| Auto-login | `npm run auto-login` | TOTP-based login |
| Seed | `npm run db:seed` | Populate instruments + holidays |
| Build | `npm run build` | `npm install` + client `vite build` → `client/dist` |
| Dev server | `npm run dev` | tsx watch on `server/index.ts` |
| Dev client | `npm run dev:client` | Vite on :5173, proxies `/api` → :4000 |

**Access token:** read at startup from `.data/accessToken.txt` (`server/lib/services/access-token.ts`). If missing, server starts but live data won't work.

## Client (current state — UI work in progress)

Minimal SPA. **Server-side calculations are done; UI needs polish.**

| File | Role |
|------|------|
| `client/src/lib/api.ts` | Typed Hono RPC client (`api.chain.*`, `api.user.*`) |
| `client/src/hooks/use-websocket.ts` | WS connection, reconnect, message handling |
| `client/src/contexts/websocket-context.tsx` | React context wrapping the hook |
| `client/src/components/chain-filter-form.tsx` | Filter form → POST `/api/chain/filter`, loads data into context |
| `client/src/components/options-table.tsx` | TanStack table; **client-side** `sellValue >= entryValue` filter |
| `client/src/components/header.tsx` | User name + account margin |
| `client/src/components/ui/*` | shadcn-style primitives (button, input, select, table, label) |

**UI conventions (follow when extending):**

- Use Tailwind theme variables (`bg-background`, `text-foreground`, `border-border`) — not hardcoded colors
- Use shadcn/ui patterns for new components
- Client filters display only; never re-implement delta/margin/return calculations in the browser
- Entry value filtering is **client-side** in `options-table.tsx`; server sends all rows

### UI gaps / next work

- Port features from legacy app: column sorting UI, order modal, bans, movers, AMO orders, alerts/toasts on return threshold
- Dark mode toggle
- Better expiry date formatting (DB stores ISO, display as `DD-MMM-YYYY`)
- Order placement flow (Kite basket or direct API)
- Settings persistence (sdMultiplier, entry value defaults)
- Responsive layout

## Dev workflow

```bash
cd proposed_structure
npm install          # installs root + client workspace

# Terminal 1
npm run dev          # server on PORT from .env (default 4000)

# Terminal 2
npm run dev:client   # Vite on :5173, proxies /api to :4000
```

Production: `npm run build && npm start` — Hono serves `client/dist` as static files.

## Known gotchas

1. **Entry value filter is client-side.** Server `getSnapshot()` returns all rows. Default entry value 99 hides most rows on market holidays when bids are 0 (sell value goes negative). Lower entry value to 0 to see data on closed markets.

2. **OI filter is server-side.** Options with `oi === 0` in Kite `/quote` are dropped before subscription. On some off-hours you may still get OI from last close.

3. **Margin API chunking.** `getOrderMargins` sends 500 orders per request. If you still get `Request too big`, lower `MARGIN_CHUNK_SIZE` in `kite.ts`.

4. **Margin rate limit.** `p-queue` at 8 req/s for margins, 3 req/s for quotes. Don't remove the queues.

5. **Expiry format.** DB stores ISO `YYYY-MM-DD`. The old Next.js app used `MAR-2026` strings — do not mix formats.

6. **`lib/utils/db.ts` is legacy.** Use `instrument-catalog.ts` for new code. `getInstrumentsToSubscribe` in db.ts has incorrect column references.

7. **Do not filter by entry value in `getSnapshot()`** — that was a bug that made the table appear empty while status showed N instruments loaded.

8. **Websocket + HTTP both apply filters.** Form submits via HTTP POST; websocket `updateFilter` re-runs the pipeline. Avoid calling both for the same action.

## Legacy app reference (`../src/`)

The old app used Next.js 14 pages router + Shoonya websocket from the **browser**. Key pain points that motivated this rewrite:

- Dual websocket (server init + browser live)
- `global.ticker` singleton
- Per-tick `/api/delta` and per-row `/api/margin` HTTP polling from client
- Broker types leaked into UI (`TouchlineResponse`, etc.)

Useful reference files for **business logic parity**:

- `../src/lib/delta.ts`, `../src/lib/workingDaysCache.ts` — calculations (ported to `server/lib/calculators/`)
- `../src/lib/socket.ts` — asymmetric sigma strike selection (ported to `subscription-planner.ts`)
- `../src/components/options-table/columns.tsx` — column definitions to port to new UI
- `../src/components/subscription-form.tsx` — old filter UX

## What NOT to do

- Do not connect to Kite from the browser
- Do not put broker-specific types in `@shared/types` — keep Kite shapes inside `kite.ts`
- Do not use Next.js API routes or `global.ticker` patterns
- Do not commit `.env`, `.data/accessToken.txt`, or `.data/database.db`
- Do not create commits unless the user asks

## Typecheck & format

```bash
npm run typecheck    # server only (tsc)
cd client && npm run build   # client vite build
npm run format       # prettier on server + client/src
```
