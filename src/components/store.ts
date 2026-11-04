"use client";
import { useSyncExternalStore } from "react";
import { indexedDbKV, type KV } from "@/lib/persistence/kv";
import { clearWorld, createProfile, deleteProfile, listProfiles, loadWorld, saveWorld, setPasscode, updateProfile, verifyPasscode, type Profile } from "@/lib/persistence/profiles";
import { applyAction, baseline, bootstrap, godEdit, godPin, godPost, godPostAction, godReact, godSay, resolveEvent, simulate, summarize, type ActionInput, type RippleResult } from "@/lib/sim/engine";
import { createWorld } from "@/lib/sim/world";
import { godJoinVoice, godLeaveVoice, godStopTyping, godTyping } from "@/lib/sim/presence";
import { liveReply } from "@/lib/live/client";
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
  toast?: { text: string; t: number; ms?: number };
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
async function sliced(w: WorldState, to: number, onSlice: (processed: number, compressed: boolean) => void) {
  for (;;) {
    const t0 = performance.now();
    let processed = 0, compressed = false;
    while (performance.now() - t0 < 12) {
      const r = simulate(w, to, { maxBuckets: 12 });
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
  const total = Math.max(1, Math.min(to - w.simTime, 24 * 3600e3) / 10_000);
  let done = 0;
  const progress = (n: number) => { done += n; if (!quiet) set({ progress: Math.min(1, done / total) }); };
  // a brand-new world first builds its history up to the moment you "left"
  if (w.simTime < from) await sliced(w, from, (n) => progress(n));
  const base = baseline(w, from);
  await sliced(w, to, (n, c) => { if (c) base.compressed = true; progress(n); });
  w.lastSeenAt = to;
  const gone = to - from;
  // a tab that stayed open in the background just catches up in place, no "while you were away" card
  const summary = !quiet && gone > 10 * 60e3 ? summarize(w, base, to) : undefined;
  set(quiet ? { world: w, now: to } : { world: w, phase: "ready", now: to, summary, progress: 1 });
  if (w.undernet?.announce) { delete w.undernet.announce; setTimeout(() => toast("New: The Undernet 🕸️ · DM gh0st_", 6000), 1200); }
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
  scheduleSave();
}
function startTick() {
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
  saveTimer = setTimeout(() => {
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
  void liveReply(w, r.message, fresh, { now: () => Date.now(), changed: () => { if (st.world !== w) return; dirty = true; set({ now: Date.now() }); scheduleSave(); } });
  return r;
});
export const doEdit = (id: string, text: string) => mutate((w, now) => godEdit(w, id, text, now));
export const doDelete = (id: string) => mutate((w, now) => godEdit(w, id, null, now));
export const doReact = (id: string, emoji: string) => mutate((w, now) => { simulate(w, now); return godReact(w, id, emoji, now); });
export const doTyping = (serverId: string, channelId: string) => mutate((w, now) => { simulate(w, now); return godTyping(w, serverId, channelId, now); });
export const doStopTyping = (channelId: string) => mutate((w, now) => godStopTyping(w, channelId, now));
export const doJoinVoice = (serverId: string, vcId: string) => mutate((w, now) => { simulate(w, now); return godJoinVoice(w, serverId, vcId, now); });
export const doLeaveVoice = () => mutate((w, now) => { simulate(w, now); return godLeaveVoice(w, now); });
export const doPin = (id: string) => mutate((w, now) => godPin(w, id, now));
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
export const toast = (text: string, ms = 3500) => set({ toast: { text, t: Date.now(), ms } });

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
