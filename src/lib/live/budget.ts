/**
 * Call budgets for live AI, in three lanes:
 * - direct: replies to @god (DMs, @mentions, replies) and the crowd reacting to what he just said. Never starved.
 * - moment: one cheap call per presence moment (typing, reacting, voice, pin, edit, delete).
 * - ambient: background chatter in the channel the player is looking at. Lowest priority: it only spends
 *   while the direct lane has clear headroom, and pauses when the tab is hidden or the player is idle.
 * When a lane is out of budget the caller quietly keeps the scripted lines.
 */
export type Lane = "direct" | "moment" | "ambient";

export interface LaneLimits { session: number; perMin: number; gap: number }
export const LIMITS: Record<Lane, LaneLimits> = {
  direct: { session: 400, perMin: 30, gap: 600 },
  moment: { session: 120, perMin: 6, gap: 2500 },
  ambient: { session: 150, perMin: 5, gap: 8000 },
};
/** ambient/moment calls never eat into the last few direct calls of a minute or a session */
const RESERVE_PER_MIN = 10, RESERVE_SESSION = 60;
export const IDLE_MS = 3 * 60_000;

interface LaneState { used: number; recent: number[]; last: number }
const fresh = (): Record<Lane, LaneState> => ({ direct: { used: 0, recent: [], last: 0 }, moment: { used: 0, recent: [], last: 0 }, ambient: { used: 0, recent: [], last: 0 } });
let lanes = fresh();
let loaded = false;
let lastActivity = 0;

const KEY = "god-sim:live-lanes";
function load() {
  if (loaded) return;
  loaded = true;
  try {
    const j = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Record<Lane, number> | null;
    if (j) for (const k of Object.keys(lanes) as Lane[]) lanes[k].used = Number(j[k]) || 0;
    // older builds only tracked direct calls under this key
    const old = Number(sessionStorage.getItem("god-sim:live-used") ?? 0) || 0;
    if (old > lanes.direct.used) lanes.direct.used = old;
  } catch { /* no storage (tests, private mode) */ }
}
function save() {
  try { sessionStorage.setItem(KEY, JSON.stringify({ direct: lanes.direct.used, moment: lanes.moment.used, ambient: lanes.ambient.used })); } catch { /* no storage */ }
}
const prune = (l: LaneState, now: number) => { while (l.recent.length && now - l.recent[0] > 60_000) l.recent.shift(); };

/** would a call in this lane be allowed right now? (does not spend) */
export function canSpend(lane: Lane, now: number): boolean {
  load();
  const l = lanes[lane], lim = LIMITS[lane];
  prune(l, now);
  if (l.used >= lim.session || l.recent.length >= lim.perMin || now - l.last < lim.gap) return false;
  if (lane !== "direct") {
    const d = lanes.direct;
    prune(d, now);
    if (d.recent.length > LIMITS.direct.perMin - RESERVE_PER_MIN || d.used > LIMITS.direct.session - RESERVE_SESSION) return false;
    if (now - d.last < 1500) return false; // a direct reply was just asked for: let it go first
  }
  return true;
}

/** take one call from the lane; false if it is out of budget */
export function spend(lane: Lane, now: number): boolean {
  if (!canSpend(lane, now)) return false;
  const l = lanes[lane];
  l.used++;
  l.recent.push(now);
  l.last = now;
  save();
  return true;
}

export const used = (lane: Lane) => { load(); return lanes[lane].used; };
export const remaining = (lane: Lane) => { load(); return Math.max(0, LIMITS[lane].session - lanes[lane].used); };

/** the player did something (typed, tapped, scrolled) */
export const noteActivity = (now: number) => { lastActivity = now; };
export const idleFor = (now: number) => (lastActivity ? now - lastActivity : 0);
export const isIdle = (now: number) => lastActivity > 0 && now - lastActivity > IDLE_MS;

/** test helper */
export function resetBudget() { lanes = fresh(); loaded = true; lastActivity = 0; }
