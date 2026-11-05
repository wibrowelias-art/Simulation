# Rebuild prompt: one polished phone app, four tools

Paste everything below into Claude Code with this repository attached.

---

## Who you are and what you're building

You are the lead engineer and product designer rebuilding this repository (currently "GOD — The Internet Simulation") into **one polished, phone-first roleplay app that bundles four tools**:

1. **Wallet**: a fictional crypto wallet. Tokens, balances, charts, send/receive history, all virtual.
2. **Trade**: memecoin paper trading on **real public market prices**, with positions, P&L and shareable P&L cards.
3. **Lounge**: the existing group chat where AI characters talk to you and to each other.
4. **Feed**: a fictional social feed (posts, replies, reposts, trends) that reacts to what you do.

The four tools share one world. A big paper trade gets talked about in the Lounge and trends on the Feed. A coin the Lounge is hyping shows up in Trade. Your wallet is where your virtual money lives.

The player's verdict on the current build: *"total trash, doesn't feel real, looks completely fake and made up, unnecessary options."* The bar is a native app you'd mistake for something on the App Store. Priority order: **(1) looks and motion, (2) realistic people, (3) real data.** Cut anything that doesn't serve those.

Deploy target: **Vercel** (existing project; secrets in Vercel env vars).

## Hard rules (never break these)

1. **Original brands only.** Every app, company, logo, icon, colour scheme, wordmark and screen layout is invented for this project. Do not reproduce Phantom, FOMO, Discord, X/Twitter, Instagram, TikTok, Robinhood, Coinbase or any other real product's name, logo, trade dress or signature screens. Use common mobile patterns (tab bars, bottom sheets, token rows, candle charts) in your own visual language. Placeholder names, to be changed if they collide with a real product:
   - **Halcyon** (wallet)
   - **Rally** (trade)
   - **Lounge** (chat)
   - **Chirp** (feed)

   Search before committing to a name and pick another if it's taken by a known app.
2. **Everything is virtual.** No wallet connections, private keys, seed phrases, signing, deposits, withdrawals, real orders or real transfers. Prices may be real; money never is.
3. **No fabrication tools.**
   - Balances and P&L change only through simulated activity: paper trades at real prices, in-world events, the starting cash chosen at setup.
   - Do not build a "backstage" or editor that sets arbitrary balances, invents past trades, edits P&L or fakes transaction history.
   - Resetting the whole account to a new starting amount is fine.
4. **Exports are marked.** Anything that leaves the app (share cards, P&L cards, screenshot exports, video) carries a small, legible "fictional · <app name>" mark in a corner. Inside the app, keep the UI clean with no banners or badges. The single fictional-world note lives in Settings → About.
5. **All people are fictional.** No real people, celebrities, companies or outlets. AI lines pass the existing flavor guard (`src/lib/sim/flavor.ts`). Gemini safety settings stay on.
6. **Never break saves.** The world lives in IndexedDB. Any change to its shape bumps `WORLD_VERSION` (in `src/lib/sim/world.ts`) and adds a migration plus a test that loads an old-shaped world. A rebuild that changes the model completely may start a new storage key, but it must not crash on an old save: detect it, offer "start fresh", and keep the old data until the player confirms.
7. **Never commit secrets.** `GEMINI_API_KEY` and any market-data keys live only in Vercel env vars or `.env.local` (gitignored), never in code, logs, tests or screenshots.

## What to keep from the current codebase

Read `CLAUDE.md` first. Keep what already works, and delete the rest rather than polishing it.

- **Keep and build on:**
  - the seeded deterministic world engine (`src/lib/sim/engine.ts`, `world.ts`, `rng.ts`)
  - characters, memory and life arcs (`characters.ts`, `memory.ts`, `life.ts`)
  - the live AI overlay (`src/lib/live/*`: budgets, group scenes, presence moments, prompt validation)
  - the flavor guard
  - IndexedDB persistence with migrations
  - the single-tab runner
  - the Lounge's mobile navigation (tabs, full-screen chat, swipe back, long-press sheet)
  - the QA harness (`qa/*.mjs`) and perf budgets (`bench/`)
- **Cut or fold in:**
  - GOD MODE (buying islands and jets)
  - the Empire dashboard
  - Platforms (Snapgram/Clipz/Threadit/TubeVerse/Wire)
  - News as a separate app: headlines become Feed posts from fictional outlets
  - the Undernet hacker storyline, unless it fits the new world cleanly
  - any setting that isn't load-bearing
- The player is no longer "the richest man alive". The player is a person with a modest virtual stake (chosen at setup) who gets known through trading and posting. Fame is earned in-world.

## Design: one app, four tools

- **Shell:**
  - one installable PWA with a home screen of four app icons and a shared bottom tab per app
  - an "app switcher" gesture or button, styled like a small phone OS
  - every tool uses the same design system: type scale, 4/8 px spacing grid, radii, elevation, colour tokens, motion curves, haptics (`navigator.vibrate` where available)
- **Look and motion (top priority):**
  - native-feeling spring sheets with drag-to-dismiss
  - 60 fps lists (virtualise long ones)
  - shared-element transitions, for example a token row expanding into the token page
  - number tickers for balances
  - skeletons instead of spinners; no layout shift
  - real tap feedback; safe-area insets; the keyboard never covers inputs
  - every control has a 44 px hit area
  - dark theme first, with an optional light theme
- **Less is more:**
  - each screen has one clear job
  - no option without a clear use
  - defaults that look good with zero setup
- **Fonts and icons:** one open-licence typeface (for example Inter or Geist) and one icon set (lucide). Custom brand marks are simple original SVGs.

### Wallet (Halcyon)
- **Home:**
  - total balance with a 24 h change
  - a line chart (1H/1D/1W/1M/All)
  - token list (icon, name, amount, value, change)
  - send / receive / swap / buy buttons
  - swap and buy route to Trade; send and receive move virtual tokens between your accounts and in-world characters
- **Other screens:**
  - token detail
  - activity history with filters
  - transaction detail sheet
  - account switcher (multiple virtual accounts)
  - settings
- **Data:**
  - token prices come from the same real price layer as Trade
  - holdings come only from your paper activity
  - token icons are generated (monogram/gradient) unless a public, licence-free source is confirmed

### Trade (Rally)
- **Discovery:**
  - Trending, Gainers and New boards from **DEX Screener** and **GeckoTerminal** public endpoints (no keys)
  - show provenance and "updated Xs ago"
  - say "stale" honestly when data is old
- **Token page:**
  - real candles (OHLCV from GeckoTerminal)
  - market cap, liquidity, volume, holders where available
  - buy/sell sheet with amount presets
  - slippage and fees simulated realistically
  - fills at the live quote
- **Portfolio and P&L:**
  - realised and unrealised P&L
  - position cards
  - a weekly recap card
- **Share cards:** carry the fictional mark from rule 4.
- **Money maths:** use `decimal.js`, never floats. Identity is chain + contract, never ticker alone.
- **Rate limits:** stay inside documented public limits, with a per-provider budget, request de-duplication, cancelled superseded searches and a short server cache.
- **Data failures:** fall back gracefully (cached last-good data, clearly dated); never invent prices.
- **Optional practice mode:** replay a past day's real candles at speed, so trading feels alive when markets are slow.

### Lounge (chat)
- Keep the current engine and mobile UX:
  - live AI group scenes in the channel you're viewing
  - the crowd reacting to you and to each other
  - presence moments
  - long-term memory, relationships and life arcs
  - budgets that never starve direct replies
- Servers re-themed around the new world: trading groups, a meme coin's community, friends, a news room.
- Characters notice your trades ("you bought $X at the top??"), argue about coins, share P&L brags and losses, and remember what you told them.
- Remove anything that reads as an imitation of another chat app's brand.

### Feed (Chirp)
- **Timeline:** For You / Following; post, reply, repost, quote, like.
- **Trends:** driven by the shared world: your trades, coins pumping on real data, Lounge drama.
- **People:** AI characters post in their own voices, using the same personas as the Lounge. Fictional outlets post headlines.
- **Your profile:** followers grow from engagement, not from a slider.

## Engineering bar (match the reference projects' rigour)

- `README.md` covers:
  - setup and env vars
  - every external provider, with links to its docs, limits and the date you checked them
  - what's real (prices) and what's simulated (everything else)
- `VERIFICATION.md` lists:
  - how each acceptance criterion below was checked
  - the commands to run
  - screenshots at 390×844
- **Tests:**
  - unit tests for money maths, P&L, fills, slippage, migrations, prompt parsing, the flavor guard, budgets
  - Playwright end-to-end tests for each tool's core flow at 390×844 and desktop
  - extend the existing `qa/*.mjs` and `bench/` budgets
- **Performance:**
  - Lighthouse mobile ≥ 90 on the home screen
  - cold start under 2 s on a mid-range phone
  - no long tasks over 200 ms during normal use
  - catch-up after a week away under 2 s
- **Accessibility:** labelled controls, visible focus, reduced-motion support, contrast AA.
- **Commits:** small and focused. Run typecheck, lint and tests before each. Deploy with `vercel deploy --prod` once the acceptance criteria pass.

## Acceptance criteria

1. **First run (on a phone):**
   - pick a name and starting virtual cash
   - land on a home screen with four app icons
   - every screen looks finished, with no empty states without guidance and no placeholder text
2. **Wallet:**
   - balance and chart reflect paper holdings at live prices
   - send/receive to an in-world character shows up in both sides' history
3. **Trade:**
   - search a real token by name or contract, see real candles, paper-buy, watch P&L move with the real price, sell
   - with the network off, the app shows dated cached data and never invents a price
4. **Shared world:** within a minute of a large paper trade, at least 3 Lounge characters mention it and it appears on the Feed.
5. **Share cards:**
   - every exported image carries the fictional mark
   - there is no UI anywhere to set arbitrary balances or fabricate history
6. **Lounge:** keeps its existing acceptance:
   - live group scenes
   - 4+ speakers reacting to you within 20 s, replying to each other
   - presence moments
   - memory across days
7. **Feed:** your post gets replies from characters in their own voices, and trends reflect real market moves plus in-world events.
8. **Polish:**
   - no control under 44 px
   - no layout shift when data streams in
   - sheets drag-dismiss smoothly
   - all QA scripts and Playwright tests pass at 390×844

## How to work

1. Read `CLAUDE.md`, `src/lib/sim/types.ts`, `engine.ts`, `src/lib/live/*`, `src/components/store.ts` and `Lounge.tsx`.
2. Write a short plan (files per phase) and a design-system sheet (tokens, type, motion) as `docs/design.md`. Show both before writing code.
3. Phases, each ending with tests green, a commit and a short summary (what changed, how to test, trade-offs):
   1. shell and design system
   2. price layer and Trade
   3. Wallet
   4. shared world wiring
   5. Feed
   6. Lounge re-theme
   7. polish pass
   8. docs, verification and deploy
4. Ask the player before any choice that changes what they'll see on screen in a big way (names, colours, which servers exist). Default sensibly for everything else.
