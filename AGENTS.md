# AGENTS.md — NSE Option Chain (Kite rewrite)

Context for AI agents working on this codebase. The **active app** lives at the repo root (`server/`, `client/`). The parent repo (`../src/`) is a legacy Next.js 14 + Shoonya app kept for reference only — do not extend it unless explicitly asked.

## What this app does

Real-time NSE F&O option chain for ~200 stocks. The server:

1. Loads instruments + volatility from SQLite (seeded from Kite + NSE)
2. Applies user filters (expiry, SD multiplier, entry value, order %)
3. Auto-excludes NSE F&O ban-list symbols and user custom bans
4. Selects option strikes via asymmetric sigma bounds
5. Fetches Kite `/quote` snapshots (OI, depth) and filters zero-OI contracts
6. Subscribes to Kite ticker websocket for live bid updates (options) and equity LTP
7. Computes sell value, return %, delta, sigmas, strike position
8. Batches margin lookups via Kite `orderMargins`
9. Detects alert conditions (order triggers, top-bid changes) and pushes notifications
10. Streams snapshots to the React SPA over Hono websocket

The client provides a sortable option chain table, option **sell** orders (NFO MIS), AMO **buy** orders (CNC equities), ban management, and real-time notifications (toast + sound + history).

**The browser never talks to Kite directly.** All broker I/O is server-side.

## Tech stack

| Layer | Stack |
|-------|-------|
| Server | TypeScript, Hono, `@hono/node-server`, `@hono/node-ws`, tsx |
| Client | React 19, Vite 8, TanStack Router, TanStack Table & Query, Tailwind v4, shadcn-style UI, Sonner |
| RPC | `hono/client` typed RPC (`client/src/lib/api.ts` → `server/app.ts` `ApiRoutes`) |
| DB | Drizzle ORM + SQLite via `@libsql/client` |
| Broker | Zerodha Kite (`kiteconnect-ts`) — REST + `KiteTicker` websocket |
| Shared | Zod schemas + types under `server/shared/` |

## Directory layout

```
├── .env                    # Root env (PORT, DATABASE_URL, KITE_*)
├── .data/
│   ├── accessToken.txt     # Kite access token (written by login scripts)
│   ├── database.db         # SQLite (gitignored)
│   └── nse_holidays.csv    # NSE holiday list for market-minutes calc
├── server/
│   ├── index.ts            # Bootstrap: coordinator init, HTTP + WS server
│   ├── app.ts              # Hono app, routes, websocket, static SPA serve
│   ├── db/                 # Drizzle schema + client
│   ├── routes/             # user, chain, orders, bans
│   ├── middlewares/        # http-logger, zod validator
│   ├── lib/
│   │   ├── calculators/    # Pure math: delta, sigma, returns
│   │   ├── services/       # Core business logic (see below)
│   │   ├── utils/          # NSE scraping, legacy db helpers
│   │   ├── market-minutes.ts # NSE trading-minute math (9:15–15:30 IST)
│   │   └── env.ts          # Zod-validated env
│   ├── shared/
│   │   ├── config.ts       # NSE_STOCKS_TO_INCLUDE, BSE_STOCKS_TO_INCLUDE, RISK_FREE_RATE
│   │   ├── lib/            # calculate-amo-orders.ts (laddered leg → batch orders)
│   │   ├── schemas/        # chain-filter, websocket, bans, orders, amo
│   │   └── types/          # OptionChainRow, ChainEngineStatus, etc.
│   └── scripts/            # seed, login, auto-login, build
└── client/
    └── src/
        ├── routes/         # TanStack Router: /, /amo, /settings
        ├── components/     # chain-filter-form, options-table, order-modal, amo-order-form, bans-management, notification-center, header, ui/*
        ├── contexts/       # websocket, notification, theme
        ├── hooks/          # use-websocket, use-bans, use-theme, chain/user queries
        └── lib/            # api.ts (Hono RPC), utils.ts
```

## Path aliases

| Alias | Maps to | Used by |
|-------|---------|---------|
| `@server/*` | `server/*` | Server |
| `@shared/*` | `server/shared/*` | Server + client |
| `@client/*` | `client/src/*` | Client |

- Server tsconfig: `tsconfig.json` (server only)
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
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            optionChain         status      notification
                    │
                    ▼
          OptionChainCoordinator  ◄── central orchestrator
           ├── InstrumentCatalog (DB queries)
           ├── SubscriptionPlanner (sigma strike selection)
           ├── MarketMinutesCache (T/N for sigma + delta)
           ├── BansService (NSE + custom bans → auto-exclude)
           ├── Kite REST (quotes, margins, orders) via kite.ts
           ├── MarketDataService (KiteTicker websocket)
           ├── MarginBook (cached margin refresh)
           └── calculators/ (delta, sigma, returns)
```

## Key services (start here for bugs)

### `server/lib/services/option-chain-coordinator.ts`

**The brain.** Owns in-memory option chain state, filter application, tick handling, periodic recompute (500ms), margin refresh (5s), alert detection, and publishing snapshots.

Important methods:

- `init()` — warm market-minutes cache, connect Kite ticker, start intervals
- `applyFilter(filter)` — full pipeline: plan → quote → OI filter → subscribe → rows. **Auto-excludes** NSE + custom banned symbols server-side.
- `getSnapshot()` — returns **all** loaded rows (no entry-value filter)
- `getVisibleRowCount()` — rows where `sellValue >= entryValue` (for status UI)
- `updateSdMultiplier(value)` — re-runs `applyFilter` with new multiplier
- `onNotification(handler)` — wired in `app.ts` to `clientBroadcaster.publishNotification`
- `detectAlerts()` — order-trigger and top-bid-change notifications (see below)

**Alert detection** (`detectAlerts`):

1. **Priming pass** — on first recompute after filter, records baseline state without notifying (rows already above `orderPercent` at load time are marked triggered; rows still loading are excluded from first trigger).
2. **Order trigger** — when `returnValue >= orderPercent` and `marginStatus === 'ready'` for a row not yet triggered (`shouldTriggerOrder` in `returns.ts`). Severity: `important`.
3. **Top bid change** — when the highest-return row's bid changes. Severity: `important`.

Also tracks equity LTP ticks for `gainLossPercent` on option rows.

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
- `getQuoteDepth()` — bid/ask depth for order modal
- `getMarginForOrder()` — single-order margin lookup
- `placeSellOrder()` — NFO MIS SELL LIMIT (option selling from chain table)
- `placeBuyOrder()` / `placeBuyOrdersBatch()` — NSE/BSE CNC BUY (regular or AMO)

Queues: quotes 3/s, margins 8/s, orders 1 per 300ms.

### `server/lib/services/market-data.ts`

Single `KiteTicker` connection. `applyDiff(added, removed)` for subscription changes. Options use `full` mode (bid + depth); equities use `subscribeLtp()` for underlying price updates.

### `server/lib/services/margin-book.ts`

Caches margins per tradingsymbol. Refreshes stale entries (>60s). Does not block chain loading.

### `server/lib/services/client-broadcaster.ts`

Manages websocket clients. Validates inbound messages with `wsClientMessageSchema`. Fans out `optionChain`, `status`, and `notification` messages. Per-client symbol filtering if client sends `subscribe` with symbol list.

### `server/lib/services/bans-service.ts`

NSE F&O ban list + user custom bans (SQLite `stock_bans`):

- `ensureTodayNseBans()` — fetches `fo_secban.csv` once per IST day, replaces stale NSE rows
- `getBannedNames()` — `Set<string>` used by coordinator to auto-exclude symbols
- `toggleCustomBan(name)` — add/remove custom ban (persists until removed; NSE bans cannot be toggled)

### `server/lib/services/instrument-catalog.ts`

Canonical DB access (prefer over `lib/utils/db.ts`):

- `getEquityByName`, `getFuturesForName`, `getOptionsForNameAndExpiry`
- `getUpcomingOptionExpiries`, `getAllEquityNames`, `getAllEquityTradingSymbols`
- `getInstrumentByToken` — used by order quote endpoint

### Calculators (`server/lib/calculators/`)

| File | Purpose |
|------|---------|
| `delta.ts` | Black-Scholes delta; `timeToExpiry` is year fraction `N/T` (market minutes) |
| `sigma.ts` | σₙ, σₓ, σₓᵢ, asymmetric bounds; uses market-minute `T` and `N` |
| `returns.ts` | `sellValue = (bid - 0.05) * lotSize`, `returnValue = sellValue * 100 / margin`, `shouldTriggerOrder()` |

### Market minutes (`server/lib/market-minutes.ts` + `market-minutes-cache.ts`)

Sigma and delta use **NSE trading minutes**, not calendar or working days.

**Session:** 9:15 AM – 3:30 PM IST (`375` minutes per full trading day). Weekends and rows in `holidaysTable` (seeded from `.data/nse_holidays.csv`) are skipped.

**`calculateMarketMinutesTillExpiry(expiry)`** (intraday-aware):

- Before open on a trading day: today counts full `375` minutes
- During session: remaining minutes until 15:30
- After close: `0` for today
- Future trading days until expiry: `375` each (holiday/weekend = `0`)
- Expiry day: minutes only until market close

**Cache** (`marketMinutesCache`):

- `getMarketMinutesInLastYear()` — `T` in formulas; cached until restart
- `getMarketMinutesTillExpiry(expiry)` — `N` in formulas; 60s TTL so values decay intraday
- Expiry dates validated at startup from DB; unknown expiries return `0`

**Formulas** (same shape as before, but `T` and `N` are minutes):

- `SD = (av * 100) / sqrt(T / N)`
- `σₓ = σₙ / sqrt(T / N)`
- Delta: `timeToExpiry = N / T` (year fraction for Black-Scholes); volatility input is `av` as decimal

### AMO helper (`server/shared/lib/calculate-amo-orders.ts`)

Converts form leg prices + value/LTP into batched `{ tradingsymbol, price, quantity, isAmo }` items for `POST /api/orders/amo`.

## API routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/user` | Kite profile |
| GET | `/api/user/margin` | Account net margin `{ net }` |
| GET | `/api/chain/status` | Coordinator status + row counts + filter snapshot |
| GET | `/api/chain/expiries` | Upcoming option expiry dates (ISO `YYYY-MM-DD`, limit 6) |
| GET | `/api/chain/symbols` | All equity names in DB |
| GET | `/api/chain/equities` | Equity rows `{ tradingsymbol, name, exchange }` — AMO combobox |
| POST | `/api/chain/filter` | Apply filter, returns `{ status, data }`. 503 if access token missing |
| GET | `/api/bans` | NSE + custom banned stocks `{ bans, nseCount, customCount, totalCount }` |
| POST | `/api/bans/toggle` | Toggle custom ban `{ name }` — rejects NSE-banned symbols (400) |
| GET | `/api/orders/quote` | Query `instrumentToken` → bid/ask depth from Kite `/quote` |
| POST | `/api/orders/margin` | Per-order margin `{ tradingsymbol, price, quantity }` |
| POST | `/api/orders/sell` | Place NFO MIS SELL LIMIT order (option sell from modal) |
| POST | `/api/orders/amo` | Batch CNC BUY orders `{ orders: AmoOrderItem[] }` → `{ placed, failed, results }` |
| WS | `/api/ws` | Live option chain + status + notifications |

### Chain filter payload (`server/shared/schemas/chain-filter.ts`)

```typescript
{
  expiry: string;        // ISO date from DB, e.g. "2026-06-26"
  sdMultiplier: number;  // default 1
  entryValue: number;    // default 99 — client-side display filter only
  orderPercent: number;  // default 0.5 — server-side order-trigger alert threshold
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
- `{ type: "sdMultiplierUpdated", success, value?, error? }`
- `{ type: "notification", message, severity: "info" | "important" }`

**Note:** The filter form uses HTTP `POST /api/chain/filter` only. `updateFilter` / `updateSdMultiplier` are implemented in `use-websocket.ts` but not wired in the UI.

## Domain types (`server/shared/types/types.ts`)

`OptionChainRow` is the main row shape sent to the client. Key fields:

- `name` — underlying symbol (e.g. `RELIANCE`)
- `underlyingLtp`, `bid`, `sellValue`, `returnValue`, `delta`, `oi`
- `marginStatus` — `'loading' | 'ready' | 'error' | 'unavailable'`
- `sigmaN`, `sigmaX`, `sigmaXI`, `sd`, `strikePosition`
- `gainLossPercent?` — underlying % change vs prev close (live equity ticks)
- `strikePositionChange?` — delta of strike position between recomputes

## Database

**Schema:** `server/db/schema.ts`

- `instruments` — Kite instruments + NSE volatility (`av`, `dv`). Keyed by `instrumentToken`. Use `name` + `expiry` for options lookup.
- `holidays` — NSE holidays for market-minute calculations
- `stock_bans` — NSE daily bans (`type='nse'`, `ban_date` = IST today) + custom bans (`type='custom'`, persist until removed)

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
| Migrate | `npm run db:migrate` | Run Drizzle migrations |
| Generate | `npm run db:generate` | Generate Drizzle migration |
| Studio | `npm run db:studio` | Open Drizzle Studio |
| Build | `npm run build` | `npm install` + client `vite build` → `client/dist` |
| Dev server | `npm run dev` | tsx watch on `server/index.ts` |
| Dev client | `npm run dev:client` | Vite on :5173, proxies `/api` → server |

**Access token:** read at startup from `.data/accessToken.txt` (`server/lib/services/access-token.ts`). If missing, server starts but live data won't work.

## Client

TanStack Router SPA with three pages:

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `routes/index.tsx` | Chain filter form + options table |
| `/amo` | `routes/amo.tsx` | AMO laddered equity buy order form |
| `/settings` | `routes/settings.tsx` | NSE + custom ban management |

Root layout (`routes/__root.tsx`): `Header`, `StatusBanner`, `NotificationProvider`, `WebSocketProvider`, Sonner `Toaster`.

### Key client modules

| File | Role |
|------|------|
| `lib/api.ts` | Typed Hono RPC client (`api.chain.*`, `api.user.*`, `api.orders.*`, `api.bans.*`) |
| `hooks/use-websocket.ts` | WS connection, reconnect, chain/status/notification handling |
| `contexts/websocket-context.tsx` | React context wrapping the hook |
| `contexts/notification-context.tsx` | In-memory notification history, unread count, sound (`/notification.mp3`) |
| `contexts/theme-context.tsx` | Light/dark/system theme, persisted to `localStorage` (`vite-ui-theme`) |
| `components/chain-filter-form.tsx` | Expiry, entry value, order %, SD multiplier → HTTP filter |
| `components/options-table/` | TanStack Table: sorting (return, strike position, delta), search, client-side entry-value filter |
| `components/options-table/order-action.tsx` | Opens sell order modal when `returnValue > 0.05` |
| `components/order-modal/` | Sell dialog: depth tables, margin lookup, place NFO MIS SELL |
| `components/amo-order-form.tsx` | Multi-row AMO form: combobox, leg ladder, batch submit |
| `components/bans-management.tsx` | NSE + custom ban tables; edit dialog locked when chain is `ready` |
| `components/notification-center.tsx` | Bell icon, unread badge, history sheet |
| `components/header.tsx` | Logo, ban count pill, margin pill, notifications, user menu |
| `components/user-button.tsx` | Profile avatar, WS status dot, theme submenu, links to AMO/settings |
| `components/status-banner.tsx` | Chain status, row counts, WS disconnect warning |
| `hooks/use-bans.ts` | React Query: GET `/api/bans`, toggle mutation, batch apply |

### Order flows

**Option sell (chain table):** Row action → order modal → `GET /api/orders/quote` + `POST /api/orders/margin` → `POST /api/orders/sell`. NFO MIS SELL LIMIT. Disabled if insufficient margin or `strikePosition > 30`.

**AMO buy (equities):** `/amo` page → client computes laddered legs via `calculate-amo-orders.ts` → `POST /api/orders/amo`. CNC BUY on NSE (or BSE for symbols in `BSE_STOCKS_TO_INCLUDE`). Per-row AMO toggle.

### UI conventions (follow when extending)

- Use Tailwind theme variables (`bg-background`, `text-foreground`, `border-border`) — not hardcoded colors
- Use shadcn/ui patterns for new components
- Client filters display only; never re-implement delta/margin/return calculations in the browser
- Entry value filtering is **client-side** in `options-table/`; server sends all rows

### Remaining UI gaps

- Movers panel (from legacy app)
- Symbol subset picker in filter UI (API supports `symbols?` but no UI)
- Filter defaults persistence (sdMultiplier, entry value, order %)
- Expiry date formatting in select (DB stores ISO; display as `DD-MMM-YYYY`)
- Responsive layout polish

## Dev workflow

```bash
npm install          # installs root + client workspace

# Terminal 1
npm run dev          # server on PORT from .env (default 4000)

# Terminal 2
npm run dev:client   # Vite on :5173, proxies /api to server
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

9. **Vite dev proxy port.** `client/vite.config.ts` proxies `/api` to `localhost:3000` but `.env.example` sets `PORT=4000`. Match these when running `dev:client`, or API calls will fail.

10. **`orderPercent` drives server alerts**, not just UI. Changing it in the filter form affects `detectAlerts()` order-trigger notifications.

11. **Ban edit lock.** Custom ban editing is disabled in the UI while the chain is `ready` (subscribed). Stop/reload chain before bulk ban changes.

12. **Market minutes decay intraday.** `minutesTillExpiry` is not a static day count — it updates during the session via a 60s cache TTL. Sigma and delta shift as the clock moves.

## Legacy app reference (`../src/`)

The old app used Next.js 14 pages router + Shoonya websocket from the **browser**. Key pain points that motivated this rewrite:

- Dual websocket (server init + browser live)
- `global.ticker` singleton
- Per-tick `/api/delta` and per-row `/api/margin` HTTP polling from client
- Broker types leaked into UI (`TouchlineResponse`, etc.)

Useful reference files for **business logic parity**:

- `../src/lib/delta.ts`, `../src/lib/workingDaysCache.ts` — day-based calculations (rewritten as market minutes in `server/lib/market-minutes.ts` + `market-minutes-cache.ts`)
- `../src/lib/socket.ts` — asymmetric sigma strike selection (ported to `subscription-planner.ts`)
- `../src/components/options-table/columns.tsx` — column definitions (ported to `client/src/components/options-table/columns.tsx`)
- `../src/components/subscription-form.tsx` — old filter UX

## What NOT to do

- Do not connect to Kite from the browser
- Do not put broker-specific types in `@shared/types` — keep Kite shapes inside `kite.ts`
- Do not use Next.js API routes or `global.ticker` patterns
- Do not commit `.env`, `.data/accessToken.txt`, or `.data/database.db`
- Do not create commits unless the user asks

## Typecheck & format

```bash
npm run typecheck              # server only (tsc)
cd client && npm run typecheck # client tsc
cd client && npm run build     # client vite build
npm run format                 # prettier on server + client/src
```
