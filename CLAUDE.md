# CLAUDE.md — GOD: The Internet Simulation

Single-player fictional internet where the player (@god) is the most famous person online. Next.js 16 + React 19 + TS + Tailwind v4. Everything runs in the browser (IndexedDB); the only server code is `src/app/api/chat/route.ts` (Gemini via `GEMINI_API_KEY`, else Vercel AI Gateway, else scripted fallback in the client).

## Commands
- `npm ci`, `npm run dev`, `npm test` (vitest), `npm run typecheck`, `npm run lint`, `npm run build && npm start` (port 3100)
- QA (needs a running server + Chrome; set `BASE=`): `node qa/smoke.mjs`, `qa/acceptance.mjs`, `qa/interact.mjs`, `qa/live.mjs`, `qa/ai.mjs`, `qa/perf.mjs`, `qa/rail.mjs` (currently hangs, fix it)
- Deploy: `vercel deploy --prod`; secret: `vercel env add GEMINI_API_KEY production`
- Debug URLs: `/?demo`, `/?seed=x`, `/?away=6h`

## Map
- Model: `src/lib/sim/types.ts`. World + `WORLD_VERSION` + migration: `src/lib/sim/world.ts`.
- Engine (10 s seeded slots, `processBucket`, `simulate`, `catchUp`, `ripple`, god actions): `src/lib/sim/engine.ts`.
- Reactions to god: `godspeak.ts`, `godlines.ts`, `presence.ts`. Characters/voice: `characters.ts`, `generator.ts`, `style.ts`, `templates.ts`, `social.ts`. Story: `undernet.ts`; guard: `flavor.ts`.
- Store, tick loop, saves, BroadcastChannel single-runner: `src/components/store.ts`. UI: `src/components/views/*` (Lounge.tsx is the chat).
- Live AI: `src/lib/live/client.ts` (budgets, persona, history, pickLead), `src/lib/live/prompt.ts`.
- Research on real chat behaviour: `docs/research.md`.

## Rules
- The Lounge has its own branding. Discord-like UX patterns are fine; no Discord trademarks, logos, assets, or a pixel-identical copy.
- All people, outlets and the gh0st crew are fictional. No real hacking content; all crew lines (and AI lines) pass `flavor.ts`. No impersonating real people.
- No on-screen sim tag; the only fictional note is in Settings > About.
- Changing the save shape means bumping `WORLD_VERSION`, adding a migration and a test.
- Keep the seeded engine deterministic; AI is an overlay in `src/lib/live/`.
- Small commits; run typecheck, lint and tests before each. Never commit `.env*` or keys.

See `CLAUDE_PROMPT.md` for the full goals and acceptance criteria.
