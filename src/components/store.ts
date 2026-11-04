"use client";
import { useSyncExternalStore } from "react";
import { indexedDbKV, type KV } from "@/lib/persistence/kv";
import { clearWorld, createProfile, deleteProfile, listProfiles, loadWorld, saveWorld, setPasscode, updateProfile, verifyPasscode, type Profile } from "@/lib/persistence/profiles";
import { applyAction, baseline, bootstrap, bucketsToSimulate, godEdit, godPin, godPost, godPostAction, godReact, godSay, resolveEvent, simulate, summarize, type ActionInput, type RippleResult } from "@/lib/sim/engine";
import { createWorld } from "@/lib/sim/world";
import { dmChannel } from "@/lib/sim/godspeak";
import { godAbandonTyping, godJoinVoice, godLeaveVoice, godTyping, voiceChannels } from "@/lib/sim/presence";
import { liveReply, pickLead } from "@/lib/live/client";
import { ambientTick, liveMoment, liveScene, type SceneHooks } from "@/lib/live/scene";
import { idleFor, isIdle, noteActivity } from "@/lib/live/budget";
import type { CatchUpSummary, PlatformId, Settings, WorldState } from "@/lib/sim/types";

export type Phase = "boot" | "profiles" | "catchup" | "ready" | "elsewhere";
export type Summary = CatchUpSummary & { netWorthDelta: number; followerDelta: number };

export interface AppState {
  phase: Phase;
  profiles: Profile[];
  profile?: Profile;
  world?: WorldState;
  now: number;
  progress: number; // 0..1 catch-up progress
  summary?: Summary;
  breaking?: RippleResult;
  toast?: { text: string; t: number; ms?: number; link?: string };
  rev: number;
  lastRead: Record<string, number>;
}

const SESSION = "god-sim:unlocked";
let kv: KV;
let st: AppState = { phase: "boot", profiles: [], now: 0, progress: 0, rev: 0, lastRead: {} };
const subs = new Set<() => void>();
const emit = () => { st = { ...st, rev: st.rev + 1 }; subs.forEach((f) => f()); };
const set = (p: Partial<AppState>) => { st = { ...st, ...p }; emit(); };
export const getState = () => st;
export function useApp(): AppState {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => st, () => st);
}

/** Dev/demo: ?away=6h pretends you were gone that long (only for brand-new worlds or ?demo). */
function awayParam(): number {
  if (typeof location === "undefined") return 0;
  const v = new URLSearchParams(location.search).get("away");
  if (!v) return 0;
  const m = /^(\d+(?:\.\d+)?)(m|h|d)?$/.exec(v);
  if (!m) return 0;
  return Number(m[1]) * ({ m: 60e3, h: 3600e3, d: 86400e3 }[m[2] ?? "h"] as number);
}

let tick: ReturnType<typeof setInterval> | undefined;
/* ---------- one tab runs the world: the others step aside ---------- */
let bc: BroadcastChannel | undefined;
const TAB = Math.random().toString(36).slice(2);
function tabChannel() {
  if (bc || typeof BroadcastChannel === "undefined") return bc;
  bc = new BroadcastChannel("god-sim:tabs");
  bc.onmessage = async (e: MessageEvent<{ type: string; profile: string; tab: string }>) => {
    const d = e.data;
    if (d.tab === TAB || !st.profile || d.profile !== st.profile.id) return;
    if (d.type === "claim" && st.phase === "ready") {
      if (tick) clearInterval(tick);
      tick = undefined;
      await flushNow();
      set({ phase: "elsewhere" });
      bc?.postMessage({ type: "released", profile: d.profile, tab: TAB });
    }
  };
  return bc;
}
/** ask other tabs running this profile to save and pause; resolves when they did (or nobody answered) */
function claim(profileId: string): Promise<void> {
  const ch = tabChannel();
  if (!ch) return Promise.resolve();
  return new Promise((res) => {
    const done = () => { clearTimeout(timer); ch.removeEventListener("message", on); res(); };
    const on = (e: MessageEvent<{ type: string; profile: string }>) => { if (e.data.type === "released" && e.data.profile === profileId) done(); };
    const timer = setTimeout(done, 350);
    ch.addEventListener("message", on);
    ch.postMessage({ type: "claim", profile: profileId, tab: TAB });
  });
}
export async function takeOverHere() {
  if (!st.profile) return;
  await openProfile(st.profile, st.profiles);
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let dirty = false;

export async function init() {
  if (st.phase !== "boot") return;
  kv = indexedDbKV("god-sim");
  const profiles = await listProfiles(kv);
  const params = new URLSearchParams(location.search);
  if (params.get("demo") !== null && !profiles.length) {
    const p = await createProfile(kv, "God", undefined, params.get("seed") ?? "demo-universe");
    return openProfile(p, [p]);
  }
  const unlocked = sessionStorage.getItem(SESSION);
  const auto = profiles.find((p) => p.id === unlocked) ?? (profiles.length === 1 && !profiles[0].passHash ? profiles[0] : undefined);
  if (auto) return openProfile(auto, profiles);
  set({ phase: "profiles", profiles });
}

export async function newProfile(name: string, passcode?: string) {
  const p = await createProfile(kv, name, passcode || undefined);
  await openProfile(p, await listProfiles(kv));
}

export async function unlock(p: Profile, passcode: string): Promise<boolean> {
  if (!(await verifyPasscode(p, passcode))) return false;
  await openProfile(p, st.profiles);
  return true;
}

export async function removeProfile(id: string) {
  await deleteProfile(kv, id);
  set({ profiles: await listProfiles(kv) });
}

export function lock() {
  flush();
  sessionStorage.removeItem(SESSION);
  if (tick) clearInterval(tick);
  set({ phase: "profiles", world: undefined, profile: undefined, summary: undefined });
}

async function openProfile(p: Profile, profiles: Profile[]) {
  sessionStorage.setItem(SESSION, p.id);
  set({ profiles, profile: p, phase: "catchup", progress: 0, world: undefined });
  await claim(p.id);
  const now = Date.now();
  const away = awayParam();
  let w = await loadWorld(kv, p.id);
  if (!w) {
    // brand-new universe: 3h of history, then (optionally) a pretend absence
    w = createWorld(p.seed, now - away);
    bootstrap(w, now - away, 3, { defer: true }); // history is simulated in small slices below
    w.player.displayName = p.name;
  } else if (away && new URLSearchParams(location.search).get("demo") !== null) {
    w.lastSeenAt = Math.min(w.lastSeenAt, now - away);
  }
  try { st.lastRead = JSON.parse(localStorage.getItem(`god-sim:read:${p.id}`) ?? "{}"); } catch { st.lastRead = {}; }
  await runCatchUp(w, now);
}

let catching = false;
async function runCatchUp(w: WorldState, to: number, quiet = false) {
  if (catching) return;
  catching = true;
  try { await runCatchUpInner(w, to, quiet); } finally { catching = false; }
}
/** simulate up to `to` in ~12ms slices, yielding to the browser in between */
async function sliced(w: WorldState, to: number, onSlice: (processed: number, compressed: boolean) => void, full = false) {
  for (;;) {
    const t0 = performance.now();
    let processed = 0, compressed = false;
    while (performance.now() - t0 < 12) {
      const r = simulate(w, to, { maxBuckets: 12, full });
      compressed ||= r.compressed;
      processed += r.processed;
      if (!r.processed) break;
    }
    if (!processed) return;
    onSlice(processed, compressed);
    await new Promise((res) => setTimeout(res, 0));
  }
}
async function runCatchUpInner(w: WorldState, to: number, quiet = false) {
  const from = w.lastSeenAt;
  const total = (w.simTime < from ? Math.max(0, (from - w.simTime) / 10_000) : 0) + bucketsToSimulate(w, to);
  let done = 0;
  const progress = (n: number) => { done += n; if (!quiet) set({ progress: Math.min(1, done / total) }); };
  // a brand-new world first builds its history up to the moment you "left"
  if (w.simTime < from) await sliced(w, from, (n) => progress(n), true);
  const base = baseline(w, from);
  await sliced(w, to, (n, c) => { if (c) base.compressed = true; progress(n); });
  w.lastSeenAt = to;
  const gone = to - from;
  // a tab that stayed open in the background just catches up in place, no "while you were away" card
  const summary = !quiet && gone > 10 * 60e3 ? summarize(w, base, to) : undefined;
  set(quiet ? { world: w, now: to } : { world: w, phase: "ready", now: to, summary, progress: 1 });
  if (w.undernet?.announce) {
    delete w.undernet.announce;
    // the one-time tip for saves from before The Undernet: tap it to open gh0st's DMs
    const g = w.undernet.crew.gh0st;
    setTimeout(() => toast("New: The Undernet 🕸️ · DM gh0st_", 9000, g ? `/lounge/dm/${dmChannel("god", g)}` : "/lounge/undernet"), 1200);
  }
  dirty = true;
  scheduleSave();
  startTick();
}

/** is anything about to change on screen (a message landing, someone typing, a reaction)? */
function hot(w: WorldState, from: number, to: number) {
  for (const m of w.pending) {
    if (m.t > from && m.t <= to + 4000) return true;
    if (m.typingFrom && m.typingFrom > from && m.typingFrom <= to) return true;
  }
  return false;
}
let lastEmit = 0;
const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";
/** one simulation step up to the wall clock. Runs in background tabs too (timers there are throttled, so it uses elapsed time) */
function step(forceEmit = false) {
  const w = st.world;
  if (!w || catching || st.phase !== "ready") return;
  const now = Date.now();
  if (now - w.simTime > 5 * 60e3) { void runCatchUp(w, now, true); return; } // throttled tab or device slept: catch up in slices
  if (focus) w.focus = { ...focus, t: now };
  const r = simulate(w, now);
  w.lastSeenAt = now;
  if (r.processed) dirty = true;
  // nobody is looking: keep simulating but skip re-rendering
  if (!hidden() && (forceEmit || now - lastEmit >= 950 || hot(w, st.now, now))) { lastEmit = now; set({ now }); }
  // the channel on screen: turn the next scripted conversation into a live one (budgeted, visible + active only)
  if (r.processed && focus) void ambientTick(w, liveHooks(w));
  scheduleSave();
}
/** hooks for live overlays: they only repaint/save while this world is still the one on screen */
function liveHooks(w: WorldState): SceneHooks {
  return {
    now: () => Date.now(),
    changed: () => { if (st.world !== w) return; dirty = true; set({ now: Date.now() }); scheduleSave(); },
    active: () => !hidden() && !isIdle(Date.now()),
  };
}
let activityBound = false;
function bindActivity() {
  if (activityBound || typeof window === "undefined") return;
  activityBound = true;
  const on = () => noteActivity(Date.now());
  for (const ev of ["pointerdown", "keydown", "wheel", "touchstart", "scroll"]) window.addEventListener(ev, on, { passive: true, capture: true });
  on();
}
function startTick() {
  bindActivity();
  if (tick) clearInterval(tick);
  tick = setInterval(() => step(), 250);
  if (typeof document !== "undefined") {
    document.onvisibilitychange = () => { if (hidden()) flush(); else step(true); };
    window.onpagehide = () => flush();
  }
}

type Idle = (cb: () => void, o?: { timeout: number }) => number;
function scheduleSave() {
  if (saveTimer || !dirty) return;
  // save when the browser is idle (at most every ~8s), never in the middle of an animation frame
  saveTimer = setTimeout(function attempt(tries = 0) {
    // never serialise the world under the player's fingers: wait for a pause in typing/scrolling (up to ~6 s)
    if (idleFor(Date.now()) < 1200 && tries < 4) { saveTimer = setTimeout(() => attempt(tries + 1), 1500); return; }
    const ric = (globalThis as { requestIdleCallback?: Idle }).requestIdleCallback;
    if (ric) ric(() => { saveTimer = undefined; flush(); }, { timeout: 4000 });
    else { saveTimer = undefined; flush(); }
  }, 8000);
}
export function flush() { void flushNow(); }
async function flushNow() {
  if (!st.world || !st.profile || !dirty || st.phase === "elsewhere") return;
  dirty = false;
  st.world.lastSeenAt = Math.max(st.world.lastSeenAt, Date.now());
  try { await saveWorld(kv, st.profile.id, st.world); } catch { dirty = true; }
}

const mutate = <T,>(fn: (w: WorldState, now: number) => T): T | undefined => {
  const w = st.world;
  if (!w || st.phase !== "ready") return;
  const now = Date.now();
  const r = fn(w, now);
  dirty = true;
  set({ now });
  scheduleSave();
  return r;
};

export function doAction(input: ActionInput) {
  return mutate((w, now) => {
    const r = applyAction(w, input, now);
    if (!("error" in r) && r.breaking) set({ breaking: r });
    return r;
  });
}
export function doEvent(id: string, choice: string) {
  return mutate((w, now) => {
    const r = resolveEvent(w, id, choice, now);
    if (!("error" in r) && r.ripple?.breaking) set({ breaking: r.ripple });
    return r;
  });
}
export const doSay = (serverId: string, channelId: string, text: string, replyTo?: string) => mutate((w, now) => {
  const before = new Set(w.pending);
  const r = godSay(w, serverId, channelId, text, now, replyTo);
  const fresh = w.pending.filter((m) => !before.has(m) && m.authorId !== "god");
  const h = liveHooks(w);
  // talking to someone (DM, reply, @mention): that person answers for real
  const addressed = serverId === "dm" || !!replyTo || /@[\w.]+/.test(text);
  if (addressed) void liveReply(w, r.message, fresh, h);
  if (serverId !== "dm") {
    // the rest of the room reacts to him and to each other as one live scene
    const lead = addressed ? pickLead(w, r.message, fresh) : undefined;
    const skip = new Set(lead ? fresh.filter((m) => m === lead || m.replyTo === lead.id || (m.authorId === lead.authorId && m.channelId === lead.channelId)) : []);
    const crowd = fresh.filter((m) => m.channelId === channelId && !m.threadOf && !skip.has(m) && m.t <= now + 25_000);
    void liveScene(w, crowd, { mode: "crowd", lane: "direct", god: r.message, hold: true }, h);
  }
  return r;
});
/** run a god presence action, then let the room's scripted reaction be rewritten live (one call per moment) */
const withMoment = <T,>(fn: (w: WorldState, now: number) => T, describe: (w: WorldState, r: T) => { text: string; first?: string } | undefined) => mutate((w, now) => {
  const before = new Set(w.pending);
  const r = fn(w, now);
  const fresh = w.pending.filter((m) => !before.has(m));
  const d = fresh.length >= 2 ? describe(w, r) : undefined;
  if (d) void liveMoment(w, fresh, d.text, liveHooks(w), d.first);
  return r;
});
const findMsg = (w: WorldState, id: string) => w.messages.find((x) => x.id === id) ?? w.pending.find((x) => x.id === id);
const quote = (t: string) => `"${t.length > 80 ? t.slice(0, 78) + "…" : t}"`;
const chName = (w: WorldState, channelId: string) => w.servers.flatMap((x) => x.channels).find((c) => c.id === channelId)?.name ?? "the chat";
const userOf = (w: WorldState, id: string) => (id.startsWith("c") ? w.characters[Number(id.slice(1))]?.username : undefined);

export const doEdit = (id: string, text: string) => {
  const old = st.world && findMsg(st.world, id)?.text;
  return withMoment((w, now) => godEdit(w, id, text, now), () => (old ? { text: `god edited his message from ${quote(old)} to ${quote(text)} and people noticed` } : undefined));
};
export const doDelete = (id: string) => {
  const old = st.world && findMsg(st.world, id)?.text;
  return withMoment((w, now) => godEdit(w, id, null, now), () => (old ? { text: `god deleted his message ${quote(old)} a few seconds after sending it, but people saw it` } : undefined));
};
export const doReact = (id: string, emoji: string) => withMoment((w, now) => { simulate(w, now); return godReact(w, id, emoji, now); }, (w) => {
  const m = findMsg(w, id);
  const u = m && userOf(w, m.authorId);
  return m && u ? { text: `god reacted ${emoji} to @${u}'s message ${quote(m.text)}`, first: u } : undefined;
});
export const doTyping = (serverId: string, channelId: string) => withMoment((w, now) => { simulate(w, now); return godTyping(w, serverId, channelId, now); }, (w) => ({ text: `the typing indicator shows god is typing in #${chName(w, channelId)} (he hasn't sent anything yet)` }));
export const doStopTyping = (channelId: string) => withMoment((w, now) => godAbandonTyping(w, channelId, now), (w) => ({ text: `god was typing in #${chName(w, channelId)}, then stopped and sent nothing` }));
export const doJoinVoice = (serverId: string, vcId: string) => withMoment((w, now) => { simulate(w, now); return godJoinVoice(w, serverId, vcId, now); }, (w) => {
  const srv = w.servers.find((x) => x.id === serverId);
  const vc = srv && voiceChannels(srv).find((v) => v.id === vcId);
  return { text: `god just joined the voice channel "${vc?.name ?? "voice"}" and people are rushing in to join him` };
});
export const doLeaveVoice = () => withMoment((w, now) => { const since = w.voice?.god?.since ?? now; simulate(w, now); godLeaveVoice(w, now); return Math.round((now - since) / 60e3); }, (_w, mins) => ({ text: `god just left the voice channel after ${Math.max(1, mins)} minutes` }));
export const doPin = (id: string) => withMoment((w, now) => godPin(w, id, now), (w) => {
  const m = findMsg(w, id);
  if (!m?.pinnedAt) return undefined;
  const u = userOf(w, m.authorId);
  return { text: u ? `god pinned @${u}'s message ${quote(m.text)} to the channel` : `god pinned his own message ${quote(m.text)}`, first: u };
});
export const doPostAction = (id: string, kind: "like" | "repost") => mutate((w) => godPostAction(w, id, kind));
export const doPost = (platform: PlatformId, text: string, quoteOf?: string, replyTo?: string) =>
  mutate((w, now) => { const r = godPost(w, platform, text, now, quoteOf, replyTo); if (r.breaking) set({ breaking: r }); return r; });
/** the channel on screen: the world keeps it alive while you're looking at it */
let focus: { serverId: string; channelId: string } | undefined;
export function setFocus(f?: { serverId: string; channelId: string }) {
  focus = f;
  if (st.world) st.world.focus = f ? { ...f, t: Date.now() } : undefined;
}
export const editWorld = (fn: (w: WorldState) => void) => mutate((w) => fn(w));
export const updateSettings = (p: Partial<Settings>) => mutate((w) => { Object.assign(w.settings, p); });
export const dismissSummary = () => set({ summary: undefined });
export const dismissBreaking = () => set({ breaking: undefined });
export const dismissToast = () => set({ toast: undefined });
export const toast = (text: string, ms = 3500, link?: string) => set({ toast: { text, t: Date.now(), ms, link } });

let readTimer: ReturnType<typeof setTimeout> | undefined;
export function markRead(channelId: string) {
  st.lastRead[channelId] = Date.now();
  if (readTimer || !st.profile) return;
  const id = st.profile.id;
  readTimer = setTimeout(() => { readTimer = undefined; localStorage.setItem(`god-sim:read:${id}`, JSON.stringify(st.lastRead)); }, 3000);
}

export async function resetUniverse(newSeed?: string) {
  if (!st.profile) return;
  if (tick) clearInterval(tick);
  const p = st.profile;
  if (newSeed) { p.seed = newSeed; await updateProfile(kv, p); }
  await clearWorld(kv, p.id);
  localStorage.removeItem(`god-sim:read:${p.id}`);
  st.lastRead = {};
  set({ phase: "catchup", world: undefined, summary: undefined, progress: 0 });
  const now = Date.now();
  const w = createWorld(p.seed, now);
  bootstrap(w, now, 3, { defer: true });
  w.player.displayName = p.name;
  w.lastSeenAt = now;
  await runCatchUp(w, now);
}

export async function changePasscode(passcode: string | null) {
  if (!st.profile) return;
  await setPasscode(st.profile, passcode);
  await updateProfile(kv, st.profile);
  set({ profiles: await listProfiles(kv) });
}
