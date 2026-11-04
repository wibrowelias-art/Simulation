# Master prompt: make GOD — The Internet Simulation insanely good

Paste this into Claude (Claude Code or a Claude Project with the pack uploaded). The repo is attached. Read `CLAUDE.md` first, then the code. Do not start writing code until you have read the files listed in section 2.

---

## 0. Who you are working for and what this is

You are the lead engineer on **GOD — The Internet Simulation**, live at https://god-sim.vercel.app. It is a single-player fictional internet in which the player's character, **@god**, is the most famous person online. The world reacts to him all the time: fans "glaze" him, haters and rivals push back, news outlets cover him, a fictional hacker crew (gh0st and the Undernet) adds drama, and when the reactions boil over the world reaches a "breaking point".

The centrepiece is **the Lounge**, a Discord-inspired group chat app (servers, channels, DMs, threads, voice, reactions, pins, members list). Other in-world platforms: **Chirp** (X-like), **Snapgram**, **Clipz**, **Threadit**, **TubeVerse**, **Wire**, plus news outlets such as **GODWATCH**. There are also a dashboard, GOD MODE, random interactive events, and a catch-up summary of what happened while the player was away.

The player's main complaint: *"I can't actually have conversations with them, it doesn't feel real, they don't act like normal people."* Real AI replies already work in DMs and @mentions. Your job is to make the **whole** Lounge feel like a living, obsessed community of real people, and to polish everything else.

## 1. Hard rules (never break these)

1. **Original branding.** The Lounge is an original Discord-inspired chat app with its own name, logo, colours and visual identity. Familiar mobile chat UX patterns are fine (server rail, channel drawer, member list, message grouping, swipe gestures, long-press menus, bottom tab bar). Do **not** copy Discord's trademarks, logo, wordmark, Clyde/Wumpus, exact icon assets, sound files, or a pixel-identical layout or colour palette. The same applies to X, Instagram, TikTok, Reddit and YouTube for the other platforms.
2. **Fiction rules.** Every character, outlet, company and place is fictional. No real people are impersonated; celebrities in `Celebrity` data stay fictional. The gh0st crew and the Undernet are pure story: no real hacking commands, exploits, tools, IPs, URLs, credentials or personal-data patterns. `src/lib/sim/flavor.ts` (the flavor guard) stays, and **every AI-generated line from a crew member must pass through it** (and ideally every AI line in general). Extend its tests if you touch it.
3. **No on-screen simulation tag.** That is the player's choice. Keep exactly one fictional note, in Settings > About. Do not add banners, watermarks or "AI" badges on messages.
4. **Never break saves.** The world lives in the player's IndexedDB. Any change to the shape of `WorldState` needs `WORLD_VERSION` (in `src/lib/sim/world.ts`, currently 6) bumped and a migration step in the migrate function there, plus a test in `tests/persistence.test.ts` that loads an old-shaped world and checks it migrates.
5. **Never commit secrets.** The Gemini key lives only in the Vercel env var `GEMINI_API_KEY` (local: `.env.local`, which is gitignored). It is never sent to the browser, logged, or put in code, tests, or screenshots.
6. **Safety settings stay on** in the Gemini call. Characters can be rude, petty, cringe, and dramatic like real Discord users, but no sexual content, slurs, real-world harm instructions, or harassment of real people.

## 2. The codebase as it is today (read these)

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, `lucide-react` icons, the `ai` SDK (only for the AI Gateway fallback), vitest (+ `fake-indexeddb`), Playwright-core QA scripts driving system Chrome. About 7.7k lines in `src/`.

**Everything runs in the browser.** There is no server database. The only server code is `/api/chat`.

### Key files

| Path | Role |
|---|---|
| `src/app/page.tsx`, `layout.tsx`, `manifest.ts`, `globals.css` | Shell, PWA manifest, theme tokens |
| `src/components/App.tsx` | Top-level router (hash routes like `#/lounge/<server>/<channel>`), tab bar, layout |
| `src/components/store.ts` | Global store: boot, profiles, open/lock, the tick loop, debounced saves to IndexedDB, BroadcastChannel tab ownership (`god-sim:tabs`), `?demo`, `?seed=`, `?away=2h` debug params |
| `src/components/views/Lounge.tsx` | The Lounge UI (744 lines): rail, channels, messages, composer, threads, reactions, pins, members, voice, DMs |
| `src/components/views/*.tsx` | Chirp, Platforms (Snapgram/Clipz/Threadit/TubeVerse/Wire), News, Dashboard, GodMode, Events, Alerts, Search, Profile, Settings, Auth, Overlays (catch-up summary, breaking point, lightbox) |
| `src/components/ui.tsx`, `MemeImage.tsx` | Shared UI, generated meme rendering |
| `src/lib/sim/types.ts` | The data model: `WorldState`, `Character`, `Server`, `Channel`, `Message`, `Reaction`, `Post`, `Article`, `Outlet`, `Topic`, `Player`, `Holding`, `InteractiveEvent`, `Notification`, `UndernetState`, `VoiceState`, `GodMoment`, `CatchUpSummary` |
| `src/lib/sim/world.ts` | `createWorld(seed)`, `WORLD_VERSION`, migration, `charById` |
| `src/lib/sim/engine.ts` | The sim engine: `BUCKET = 10_000` ms slots, `processBucket`, `simulate`, `catchUp`, `summarize`, `runEpisode` (a conversation burst in a channel), `ripple` (world reaction to a god action), `applyAction`, `godSay/godEdit/godReact/godPin/godPost`, `resolveEvent`, queries (`channelMessages`, `typingIn`, `unreadIndex`, `reactionsAt`, `dmThreads`) |
| `src/lib/sim/godspeak.ts`, `godlines.ts` | How the world reacts when god speaks ("sup guys" -> chat explodes), intents |
| `src/lib/sim/presence.ts` | Typing indicators, voice channels, "omg he's typing", join/leave reactions |
| `src/lib/sim/characters.ts`, `generator.ts`, `style.ts`, `grammar.ts`, `templates.ts`, `topics.ts`, `memes.ts`, `avatar.ts`, `social.ts`, `servers.ts`, `events.ts`, `data.ts` | Seeded character generation (voice, slang, emojis, chronotype, tier, pfp style), text styling per voice, scripted templates, topics/heat, meme specs, avatars, obsession/stance and relationships, server/channel layout, interactive events |
| `src/lib/sim/rng.ts` | Seeded RNG: the world is deterministic for a seed and slot |
| `src/lib/sim/undernet.ts` | The Undernet server and gh0st crew storyline (roles: gh0st, kid, wren, broker, hype), `ensureUndernet` for old saves |
| `src/lib/sim/flavor.ts` | The flavor guard (regex rules: shell, operators, code, sql, paths, network, tools, secrets, email) |
| `src/lib/live/client.ts` | Client side of live AI: `persona()` builds the character card, `historyFor()` last 30 lines, `pickLead()` picks which scripted message gets replaced by a real one; budgets `LIVE_BUDGET = 400` calls per session, `PER_MIN = 30`, 600 ms min gap, 16 s timeout during which the character shows as typing; falls back to scripted lines on any failure |
| `src/lib/live/prompt.ts` | `instructions()`, `promptText()`, `sanitize()` (validates the request), `parseReply()` (JSON lines + `remember` facts) |
| `src/app/api/chat/route.ts` | Server route. If `GEMINI_API_KEY` is set: races the first two `GEMINI_MODEL` models (9 s), then tries backups one by one (3.5 s). Else Vercel AI Gateway (`AI_GATEWAY_MODEL`, `AI_GATEWAY_FALLBACKS`). Per-IP limit 30/min per instance, 24 KB body cap. Setup errors return 200 with a `code` so the client quietly switches to scripted mode |
| `src/lib/persistence/kv.ts`, `profiles.ts` | IndexedDB KV (db `god-sim`, store `kv`) with memory fallback; local profiles with salted SHA-256 passcodes |
| `docs/research.md` | Research on how real Discord users talk, name themselves and pick pfps. Use it |
| `tests/*.test.ts`, `bench/bench.test.ts` | vitest: determinism, persistence, actions, consequences, presence, reactions, realism, memes, undernet, live, polish; perf bench |
| `qa/*.mjs`, `scripts/screenshots.mjs` | Playwright scripts against a running server (`BASE=http://localhost:3100` default): smoke, acceptance, interact, live, ai, perf, rail |

### How the sim works

- Time moves in seeded 10-second slots. Each slot (`processBucket`) decides with the seeded RNG which characters are awake (chronotype + local hour), which channels get an episode, which posts/articles appear, and which events fire. Same seed and slot gives the same world.
- **Single runner:** only one tab per profile runs the tick. A new tab broadcasts `claim`; the old tab saves, stops and shows "elsewhere".
- **Catch-up:** on reopen, or when a background tab wakes up, `catchUp` replays missed slots in batches (compressed when the gap is large) and `summarize` builds the "while you were away" summary. Nothing runs while all tabs are closed.
- **God actions** (`applyAction`, `godSay` …) call `ripple`, which schedules reactions into `s.pending` with future timestamps, so they appear over time with typing indicators first.
- **Live AI** sits on top: when god speaks in a DM or @mentions/replies to someone, `pickLead` picks one scripted reply, the client asks `/api/chat`, and the real lines replace it. `remember` facts are saved on the character (`godFacts`) so they remember what you told them.

### Run, test, deploy

```bash
npm ci
cp .env.example .env.local   # put your own GEMINI_API_KEY in it (optional; without it, scripted replies)
npm run dev                  # http://localhost:3000
npm test                     # vitest
npm run typecheck && npm run lint
npm run build && npm start   # port 3100, used by qa scripts
node qa/smoke.mjs            # needs Chrome at /usr/bin/google-chrome (edit executablePath for your OS)
vercel env add GEMINI_API_KEY production   # once
vercel deploy --prod
```

Useful URLs: `/?demo` (auto profile), `/?demo&seed=abc`, `/?away=6h` (simulate being away), `#/lounge/godhq/godhq-general`.

## 3. Goals, in priority order, with acceptance criteria

### P1. AI group chatter in the channel you are looking at (budgeted)
- When the player is viewing a Lounge channel, the ambient conversation there is (partly) AI-written, using the same personas, recent history and current topics. Other channels stay scripted.
- Batch it: one call returns a short scene of 3–8 lines from 2–5 named characters, which the client schedules over time with typing indicators. Do not make one call per message.
- Budget: an explicit per-session and per-minute budget for ambient calls, separate from and lower priority than direct replies (direct replies must never be starved). Pause ambient calls when the tab is hidden or the player has been idle more than ~3 minutes. Show nothing to the user when the budget is spent; quietly fall back to scripted lines.
- **Accept:** in a 5-minute session in #general, at least 60% of visible lines were AI-written, no line repeats verbatim, it costs no more than ~25 calls, and turning off the key produces a working scripted chat with no errors.

### P2. Many characters replying and talking to each other
- When god says something in a server channel, 2–6 different characters react, and they reply to **each other**, not only to god (agreeing, arguing, dunking, "ratio", inside jokes, quoting with reply arrows).
- Friends back each other up; rivals and haters pick fights; lurkers rarely talk; power users dominate.
- **Accept:** "sup guys" in #general produces at least 4 distinct speakers within 20 s, at least 2 lines that use reply-to on another character's message, and at least one disagreement.

### P3. AI lines for presence moments
- Typing ("omg he's typing", "HE'S TYPING EVERYONE SHUT UP"), stopping typing without sending, joining voice (people pile into voice, screaming, "W", "he actually joined"), leaving voice, reacting to a message (that message's author freaks out, others pile on with the same emoji), pinning, editing and deleting ("he deleted it, i saw it").
- One cheap batched call per moment, with a scripted fallback that already exists in `presence.ts`/`godspeak.ts`. Debounce: a run of reactions within 3 s is one moment.
- **Accept:** each moment type produces a contextual reaction within 3 s (scripted instantly, AI swaps in if it is in time), and nothing fires twice for one moment.

### P4. Persistent memory, relationships and lives of their own
- Extend `Character` with: long-term memories (facts about god, about other characters, and about their own life), a relationship score with god and with key characters, mood, and a short "current life" state (exams, new job, breakup, a game they are grinding) that changes over days of sim time.
- Memories are summarised and capped (e.g. 20 per character) so prompts stay small. Characters bring things up later ("you said your dog was called biscuit"), hold grudges, and remember being ignored.
- Bump `WORLD_VERSION`, migrate, and test.
- **Accept:** tell a character a fact, close the tab, come back with `?away=1d`, and they still know it; a character god insulted is colder for days; at least 5 characters visibly mention their own life events over a day of sim time.

### P5. Memes and media
- Better generated memes (`memes.ts`, `MemeImage.tsx`): templates that use current topics and god's quotes, reaction images, fake screenshots of god's posts, sticker-like emoji spam, GIF-like animated CSS reactions. Original art only, no copyrighted meme images.
- AI can ask for a meme by returning a structured `meme` field the client renders.
- **Accept:** memes show up naturally (not every message), are readable on mobile, and open in the lightbox.

### P6. Mobile polish (primary device is a phone, ~390×844)
- Smooth 60 fps scrolling for long channels (virtualise or window messages; `channelMessages` limit is 120 now), stick-to-bottom with a "new messages" jump pill, swipe to open the drawer and members, long-press message menu, haptic-feeling animations, safe-area insets, keyboard that does not cover the composer, and fast cold start.
- Its own identity: a distinctive palette, logo and naming for the Lounge, consistent across the app.
- **Accept:** Lighthouse mobile performance at least 85, no layout shift when messages stream in, every control at least 44 px, and all `qa/*` scripts pass at 390×844.

### P7. Performance and robustness
- Catch-up after `?away=7d` finishes in under 2 s on a mid-range phone and keeps the save under a sensible size (prune old messages/posts by keeping summaries). Saves are debounced and never block typing. `bench/bench.test.ts` gets budgets that fail the test if exceeded.
- The AI route: keep the model race, add a short server cache per identical request, and keep secrets out of logs.

### P8. Fix `qa/rail.mjs` (it hangs)
- It strips the Undernet from a saved world (opening IndexedDB from a `/__blank` route page) and reloads to check that migration restores it. It hangs. Likely causes: the app's open IndexedDB connection blocks, the `onblocked`/`versionchange` path is not handled, the `getAllKeys` key match fails, or the `ready()` wait never matches. Make it deterministic: close the app's DB on `versionchange`, add timeouts to every wait, and exit non-zero with a clear message instead of hanging.
- **Accept:** `node qa/rail.mjs` finishes in under 60 s and passes, both locally and against the live URL.

### P9. Known issues to check
- Random scripted lines that make no sense in context (the player asked "why did you say 'I just made it rain cereal over port lumen'"). Tighten templates so scripted lines match the channel topic, and grep templates for nonsense.
- Characters must not sound like bots: no "As an AI", no perfect grammar from zoomers, no helpful assistant tone, no over-long replies. Use `docs/research.md` for realistic voice.
- The Undernet should be easy to find and enter for old saves (migration + one-time "DM gh0st_" tip).

## 4. How to work

- First write a short plan with the files you will touch per goal. Then work goal by goal, P1 first.
- Small, focused commits with clear messages. After each one: `npm run typecheck && npm run lint && npm test`. Run the relevant `qa/*.mjs` against `npm run build && npm start` for UI changes.
- Keep the engine deterministic: anything AI-driven lives in `src/lib/live/` and is applied as an overlay on top of the seeded world. Do not let AI calls change the RNG stream.
- Add tests for every new behaviour (prompt parsing, budget, migration, flavor guard on AI output, memory caps).
- Keep the prompt sent to the model short: persona card + capped memories + last ~30 lines. Responses are JSON; validate and clamp them in `parseReply`.
- Never commit `.env*`, keys, or tokens. Never print the key.
- At the end of each goal, give me a short summary: what changed, how to test it, and any trade-offs.

Start by reading `CLAUDE.md`, `src/lib/sim/types.ts`, `src/lib/sim/engine.ts`, `src/components/store.ts`, `src/lib/live/client.ts`, `src/lib/live/prompt.ts`, `src/app/api/chat/route.ts` and `src/components/views/Lounge.tsx`, then post your plan.
