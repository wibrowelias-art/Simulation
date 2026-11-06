# Rebuild plan

Source brief: `REBUILD_PROMPT.md`. Design: `docs/design.md`. One commit per phase, each with typecheck, lint and tests green.

## Decisions

- **Names:**
  - Lanternfish (wallet)
  - Kiteline (trade)
  - Lounge (chat)
  - Murmur (feed)
- **Accent:** electric lime `#c6f432`.
- **Market data:**
  - DEX Screener for search, boards and quotes.
  - GeckoTerminal for candles. It is rate-limited and cached, with an honest local-samples fallback.
  - Everything goes through `/api/market` on Vercel, which falls back to direct browser calls when there is no server (a static build).
- **Money:** `decimal.js`, stored as strings. Token identity is chain + contract.
- **The player:** a handle chosen at setup and a starting virtual cash amount. The internal author id stays `"god"`, so existing saves and the engine keep working; everything visible uses the handle.
- **Saves:**
  - `WORLD_VERSION` 9 adds `wallet` (accounts, cash, holdings, trades, transfers, value history) and `player.handle`.
  - Old saves migrate with the default starting cash and keep their chat history.

## Phases

| # | Phase | Main files |
|---|---|---|
| R1 | Shell, home screen, onboarding, global tokens; cut GOD MODE / Empire / Platforms / Events / News nav | `App.tsx`, `views/Home.tsx` (new), `views/Auth.tsx`, `globals.css`, `lib/brand.ts` (new), `store.ts` |
| R2 | Price layer + Kiteline | `app/api/market/route.ts`, `lib/market/*` (new), `lib/wallet/*` (new), `views/trade/*` (new), `sim/types.ts`, `sim/world.ts` |
| R3 | Lanternfish | `views/wallet/*` (new) |
| R4 | Shared world: trades ripple into Lounge and Murmur; real trending coins become topics | `lib/wallet/world.ts`, `sim/topics.ts`, `sim/templates.ts` |
| R5 | Murmur | `views/Chirp.tsx` → `views/Feed.tsx` |
| R6 | Lounge re-theme: servers and talk around trading and the player's rise | `sim/servers.ts`, `sim/godlines.ts`, `sim/templates.ts`, `live/prompt.ts` |
| R7 | Polish pass | everywhere |
| R8 | README, VERIFICATION, Playwright/QA, Lighthouse, deploy notes | `README.md`, `VERIFICATION.md`, `qa/*`, `e2e/*` |
