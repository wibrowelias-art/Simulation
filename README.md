# GOD — The Internet Simulation

> **Fictional.** Every person, server, outlet, post, article and dollar amount in this app is
> procedurally generated. No real people, companies or platforms are depicted. There is no on-screen
> badge (by request); a one-line "fictional world" note lives in Settings.

You play **@god**: the internet's most-discussed, absurdly wealthy, controversial main character. A whole
fictional internet runs around you, 24/7.

## Features
- **Lounge** (chat servers): 20+ always-on servers with channels, mods, bots, member lists with local times,
  unread pips, typing indicators, threaded replies, reactions and @god pings. You can post as @god.
- **Glazing simulator:** every character holds a stance (worshipper, fan, skeptic, hater, memer, conspiracist,
  indifferent) and an opinion score that drifts with your actions. Servers have their own bias.
- **Platforms:** Chirp (trending, viral posts, quotes, replies, reposts, likes, verified, community notes,
  breaking), Snapgram, Clipz, Threadit, TubeVerse, Wire.
- **News:** GODWATCH, Internet Daily, Global Wealth Report, Crypto Insider, The Digital Times, Billionaire News
  Network. Articles have authors, times, reads, reactions and comments.
- **Empire dashboard:** net worth, cash, investments, income, holdings (businesses, properties, vehicles, jets,
  islands, coins…), followers, community size, reputation, influence, trend status, glaze meter, history chart.
- **GOD MODE:** 12 action types (buy an island, launch a coin, donate, start a feud…) with a cost slider; impact
  magnitude scales the ripple. Magnitude ≥ 7 is a **BREAKING POINT**: #1 trend, breaking news, Lounge chaos,
  influencer takes, memes and alerts all at once.
- **Random events** with choices and consequences, expiry timers and history.
- **Characters:** hundreds of generated people with archetype voices, profiles (personality, age, location,
  occupation, finances, opinion, relationships, style, memory) and original SVG avatars in weighted styles.
  Plenty of chatter is not about @god at all. See `docs/research.md`.
- Search, notifications, editable profiles, settings (activity, glaze ratio, drama), 4 themes, reduced motion,
  and reset universe.

## How the world keeps going while you're away
There is no server and no cron. The world is a **deterministic function of (seed, time)**: the engine steps in
10 s buckets, each seeded from `seed + bucket`. When you open the app, it replays every bucket since
`lastSeenAt` in chunks, showing a progress bar. Gaps over 24 h are compressed (sampled) so a month away still
loads fast. If you've been gone more than 10 minutes, a **"While you were away"** summary lists what changed:
deltas, highlights, trends and the loudest servers. The same seed and the same absence always produce the
same world.

## Persistence and auth
Everything stays in the browser, in **IndexedDB** (db `god-sim`, store `kv`). Profiles are local. Each one can
have an optional passcode, stored as a salted SHA-256 hash (WebCrypto). This is a convenience lock, not real
security. The world autosaves every few seconds and when the tab is hidden or closed.

## Content generator
`src/lib/sim/generator.ts` defines a `ContentGenerator` interface (`chat`, `post`, `article`). The shipped
implementation is purely template/grammar based. `setGenerator()` lets a future model-backed generator plug in.
The UI makes no AI claims.

## Dev
```bash
npm install
npm run dev            # http://localhost:3000
npm test               # vitest: determinism, catch-up, event consequences, variety
npm run build && npm start   # port 3100
npm run screenshots    # needs a running server; writes screenshots/
```
URL params: `?demo` auto-creates a demo profile; `?away=6h` simulates an absence (e.g. `?demo&away=6h`).
