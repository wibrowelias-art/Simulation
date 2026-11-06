# Lanternfish

Four apps in one phone-first web app, all sharing one fictional world:

| App | What it is |
|---|---|
| **Lanternfish** | A wallet for **virtual** money: balance, history chart, accounts, send/receive to in-world people, activity. |
| **Kiteline** | **Paper trading** on **real** token prices: discover, search by name or contract, real candles, buy/sell with fee and price impact, portfolio and P&L, share cards. |
| **Lounge** | Group chat servers full of AI characters who live their own lives, notice your trades and remember you. |
| **Murmur** | A feed: For you / Following, Explore with trends and search, your profile, compose, reply, quote. |

Nothing here touches a real wallet, exchange or account. There are no keys, no signing, no wallet connections and no
real orders. The single fictional-world note lives in **Settings → About**; every exported image carries a
"fictional · <app name>" mark.

## What's real and what's simulated

| Real | Simulated |
|---|---|
| Token prices, market cap, FDV, liquidity, 24 h volume, buys/sells, pool age (DEX Screener) | Your cash and every balance (starts at the amount you pick: $1K, $10K or $50K) |
| Trending pools and OHLCV candles (GeckoTerminal) | Fills: live price + estimated impact (2 · size / liquidity, capped at 25%) + 0.5% fee |
| Token names, symbols, chains, contract addresses | All people, servers, posts, outlets, follower counts and engagement |
| | Transfers to characters, their replies, memories and moods |

Balances and P&L only change through simulated activity (trades, transfers, price moves). There is no screen to set
a balance or edit history; **Settings → Start over** resets everything to a new starting amount.

Offline, or when a provider is down, the app shows the last real price with its age and refuses to fill an order on a
quote older than 60 s. It never makes a price up.

## Market data providers

Both are public, keyless and read-only. Limits checked **2026-11-05**.

| Provider | Used for | Documented limit | Our budget |
|---|---|---|---|
| [DEX Screener API](https://docs.dexscreener.com/api/reference) | search, quotes (30 tokens per call), new pairs, boosted tokens | ~300 req/min for pair/search endpoints, ~60 req/min for profile/boost endpoints | 200 req/min per server instance |
| [GeckoTerminal public API](https://apiguide.geckoterminal.com/faq) | trending pools, OHLCV candles | 30 calls/min | 9 calls/min per server instance |

`src/app/api/market/route.ts` proxies both with a TTL cache (quotes 10 s, search 30 s, boards 60 s, trending and
candles 5 min), in-flight de-duplication, per-provider budgets and a stale last-good fallback. On static hosting
(no API route) the browser calls the providers directly (both allow CORS) and keeps a last-good snapshot in
`localStorage` (`lf:market:v1`). Prices refresh every 15 s, only while the app is visible.

When GeckoTerminal trending is unavailable the Discover board falls back to DEX Screener **boosted** tokens and says
so: boosts are paid promotion, not organic trending.

## Live AI (optional)

`src/app/api/chat/route.ts` is the only other server code. It uses `GEMINI_API_KEY` (Gemini, safety settings on),
else the Vercel AI Gateway (`AI_GATEWAY_API_KEY`), else the client falls back to scripted lines. Every AI line passes
the `flavor.ts` guard. Keys live only in env vars and are never sent to the browser.

```bash
cp .env.example .env.local   # then fill GEMINI_API_KEY (optional)
```

## Develop

```bash
npm ci
npm run dev                  # http://localhost:3000
npm test                     # vitest
npm run typecheck && npm run lint
npm run build && npm start   # http://localhost:3100
BENCH=1 npx vitest run bench # performance budgets
```

Debug URLs: `/?demo` (makes a demo profile), `/?seed=x`, `/?away=6h` (simulate time away).

QA scripts (need a running server and Chrome; `BASE=`, `CHROME=` override): `node qa/smoke.mjs`,
`qa/targets.mjs` (44 px tap targets at 390×844), `qa/acceptance.mjs`, `qa/interact.mjs`, `qa/live.mjs`,
`qa/ai.mjs`, `qa/perf.mjs`, `qa/rail.mjs`. See [VERIFICATION.md](VERIFICATION.md).

## Deploy

Vercel: `vercel deploy --prod`; secret: `vercel env add GEMINI_API_KEY production`. Without the env var the app
still works (scripted chat). A static export also works (prices come straight from the providers).

## How the world runs

The world is a deterministic function of (seed, time): the engine steps in 10 s seeded buckets and replays the gap
when you come back (a week away catches up in well under a second in node). Saves live in IndexedDB; changing the
save shape bumps `WORLD_VERSION` (now 9) with a migration and a test. Map of the code: [CLAUDE.md](CLAUDE.md).
Design tokens and motion: [docs/design.md](docs/design.md).

## Content rules

Original brands only. All people, outlets and servers are fictional; no real people are impersonated. No real
hacking content. Trend tags, posts and chat about you use your handle.
