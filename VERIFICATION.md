# Verification

How each acceptance criterion in `REBUILD_PROMPT.md` was checked. Last run **2026-11-05** against a production build
(`npm run build && npm start`) in headless Chromium at 390×844 unless noted.

## Commands

```bash
npm run typecheck && npm run lint
npx vitest run                    # 141 tests, 19 files
BENCH=1 npx vitest run bench      # perf budgets
npm run build && npm start        # then, in another shell:
node qa/smoke.mjs                 # every screen, phone + desktop: page errors, overflow, dead controls
node qa/targets.mjs               # 44 px tap targets at 390x844 across all four apps + Settings
node qa/acceptance.mjs            # Lounge reacts to you (typing, replies, reactions, badges, echoes)
npx lighthouse@12.6.1 http://localhost:3100/ --form-factor=mobile
```

## Results

| # | Criterion | How it was checked | Result |
|---|---|---|---|
| 1 | First run: name + starting cash, home with four apps, no placeholder screens | Onboarding by hand at 390×844; `smoke.mjs` `home` step checks the app buttons; screenshots below | Pass |
| 2 | Wallet reflects paper holdings at live prices | `tests/wallet.test.ts` "values the wallet at the latest quotes"; screenshot after a real $500 buy | Pass |
| 2 | Send/receive to a character shows on both sides | `tests/world-money.test.ts` "sending money… gets a DM back and they remember it" | Pass |
| 3 | Search real token, real candles, paper buy/sell, P&L tracks price | By hand + `docs/screens/kiteline-*.png` (live DEX Screener quote, GeckoTerminal OHLCV, $500 buy: 2.61% impact, $2.50 fee); maths in `tests/wallet.test.ts` | Pass |
| 3 | Network off: dated cached data, never an invented price | `tests/market-offline.test.ts`: last price kept with its original time, error flagged, 10-minute-old quote refused for a fill, unseen tokens have no price, failed boards show an error, not rows | Pass |
| 4 | Big paper trade → 3+ Lounge characters within a minute, and on the feed | `tests/world-money.test.ts` "a big paper buy…"; seen live in `docs/screens/lounge-trenches.png` run ("alex bought $LOOT im following") | Pass |
| 5 | Exported images carry the fictional mark; no way to set balances or fake history | `drawCard` always draws `exportMark(app)` (code: `src/lib/wallet/share.ts`); no balance editor exists (Settings only offers a full reset). Not covered by an automated canvas test | Pass (by inspection) |
| 6 | Lounge: scenes, 4+ speakers within 20 s, replies to each other, presence, memory across days | `qa/acceptance.mjs`: typing 1.0 s, first reply to you 2.7 s, character-to-character 3.2 s, 15 new messages in 15 s, badge 0 → 3, other servers echo it; `tests/memory.test.ts`, `presence.test.ts`, `scene.test.ts` | Pass |
| 7 | Feed: your post gets replies; trends show real market moves + world events | `smoke.mjs` `feed-compose`; Explore shows "Markets · live price move" trends next to in-world ones (`docs/screens/murmur-explore.png`); `tests/world-money.test.ts` "real coins moving hard become topics, once" | Pass |
| 8 | No control under 44 px | `qa/targets.mjs`: TARGETS PASS (Lounge chat, sheets, tray, members, servers, apps, tabs, Home, Murmur ×3 + compose, Kiteline ×2, Lanternfish ×2, Settings) | Pass |
| 8 | No layout shift as data streams in | Lighthouse CLS 0 on home | Pass |
| 8 | Sheets drag-dismiss | One shared `Sheet` component (pointer-tracked drag, velocity or 30% distance dismisses); checked by hand | Pass (by hand) |
| 8 | QA scripts pass at 390×844 | `smoke.mjs` SMOKE CLEAN, `targets.mjs` PASS, `acceptance.mjs` PASS | Pass |

## Performance

| Check | Target | Result |
|---|---|---|
| Lighthouse mobile, `/` (first run) | ≥ 90 | **93** (FCP 0.8 s, LCP 3.1 s, TBT 130 ms, CLS 0); accessibility 100, best practices 100 |
| Lighthouse mobile, `/?demo` | — | 79: this URL generates a whole new world on load (≈1 s of script on the throttled CPU). A returning user loads a saved world instead |
| Catch-up after 7 days away (node) | phone < 2 s (node is ~3× faster) | 571 ms, worst chunk 72 ms |
| Bench budgets | all within `bench/bench.test.ts` | pass |

## Screenshots (390×844, production build)

`docs/screens/`: `home.png`, `kiteline-discover.png`, `kiteline-token.png`, `kiteline-buy.png`,
`kiteline-portfolio.png`, `lanternfish-wallet.png`, `lanternfish-activity.png`, `lounge-trenches.png`,
`murmur-home.png`, `murmur-explore.png`, `settings.png`.

## Known gaps

- No Playwright `e2e/` suite yet; the `qa/*.mjs` scripts cover the same flows against a running server.
- `qa/interact.mjs` runs the gh0st storyline only with `HACKER=1` (the storyline is paused in this premise).
- Many scripted chat lines still refer to the player as "he"; AI lines use they/them.
- Not deployed from this environment (no Vercel credentials here).
