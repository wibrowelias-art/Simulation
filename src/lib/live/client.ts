/** Client side of live conversations: picks who answers @god, asks /api/chat, and swaps the scripted line for the real one. */
import type { Character, Message, WorldState } from "@/lib/sim/types";
import { charById } from "@/lib/sim/world";
import { obsessionOf } from "@/lib/sim/social";
import { crewRole } from "@/lib/sim/undernet";
import type { CastCard, LiveLine, LiveRequest } from "./prompt";
import { LIMITS, resetBudget, spend, used } from "./budget";
import { moodWord, relOf, rememberLong, topMemories } from "@/lib/sim/memory";
import { lifeLabel } from "@/lib/sim/life";

export const LIVE_BUDGET = LIMITS.direct.session; // direct model calls per browser session
export const PER_MIN = LIMITS.direct.perMin;
const TIMEOUT = 16_000; // the other person is "typing" meanwhile
const HOLD = TIMEOUT + 800;

export type LiveStatus = { state: "unknown" | "on" | "off" | "unavailable"; reason?: string; used: number; model?: string };
let status: LiveStatus = { state: "unknown", used: 0 };
const busy = new Set<string>();

export const liveStatus = () => ({ ...status, used: used("direct") });
/** the server said live replies can't work here (no key, no billing): stop asking for the rest of the session */
export const liveUnavailable = () => status.state === "unavailable";
export function noteResult(res: { ok: boolean; status: number }, j: { code?: string; model?: string }, ok: boolean) {
  if (ok) status = { ...status, state: "on", reason: undefined, model: j.model };
  else if (j.code === "no_auth" || j.code === "customer_verification_required" || j.code === "insufficient_funds" || res.status === 404) status = { ...status, state: "unavailable", reason: j.code ?? `http ${res.status}` };
}

export const nameOf = (s: WorldState, id: string) => (id === "god" ? "god" : id.startsWith("c") ? charById(s, id)?.username ?? "someone" : "bot");

export function persona(c: Character, st: WorldState): LiveRequest["persona"] {
  const names = (ids: string[]) => ids.slice(0, 4).map((id) => charById(st, id)?.username).filter((x): x is string => !!x);
  return {
    name: c.displayName, username: c.username, age: c.age, location: c.location, occupation: c.occupation, bio: c.bio, personality: c.personality,
    voice: c.voice, slang: c.slang, emojis: c.emojis, catchphrase: c.catchphrase, interests: c.interests, stance: obsessionOf(c), opinion: Math.round(c.opinion),
    bond: Math.round(c.bond ?? 0), memories: memoryLines(c, st, 6), pastWithGod: (c.godContacts ?? []).slice(-9, -1).map((g) => `${g.text} (${g.where})`),
    godFacts: (c.godFacts ?? []).slice(-12), friends: names(c.friends), rivals: names(c.rivals), crew: !!crewRole(st, c.id),
    mood: moodWord(c), life: lifeLabel(c), warmth: Math.round(relOf(c, "god")),
  };
}

/** long-term memories as short lines (about god, other people, their own life), most important first */
export function memoryLines(c: Character, st: WorldState, n: number): string[] {
  const now = st.simTime;
  const who = (id: string) => (id === "god" ? "god" : id === "self" ? "me" : `@${charById(st, id)?.username ?? "someone"}`);
  const long = topMemories(c, now, n).map((m) => (m.about === "self" || m.about === "god" || m.text.includes("@") ? m.text : `${who(m.about)}: ${m.text}`));
  const short = c.memory.slice(-3).map((m) => m.label);
  return [...new Set([...long, ...short])].slice(0, n);
}

/** the short card used when several characters share one scene prompt */
export function castCard(c: Character, st: WorldState): CastCard {
  const names = (ids: string[]) => ids.slice(0, 3).map((id) => charById(st, id)?.username).filter((x): x is string => !!x);
  const facts = (c.godFacts ?? []).slice(-2).map((f) => `god told them: ${f}`);
  return {
    username: c.username, name: c.displayName, age: c.age, occupation: c.occupation, voice: c.voice, slang: c.slang.slice(0, 4), emojis: c.emojis.slice(0, 3),
    stance: obsessionOf(c), opinion: Math.round(c.opinion + relOf(c, "god") * 0.8), memories: [...facts, ...memoryLines(c, st, 3)].slice(0, 4),
    friends: names(c.friends), rivals: names(c.rivals), crew: !!crewRole(st, c.id), mood: moodWord(c), life: lifeLabel(c),
  };
}

/** the last ~30 visible messages in a channel, oldest first */
export function historyFor(s: WorldState, channelId: string, before: number, skip: string): LiveLine[] {
  const out: LiveLine[] = [];
  for (let i = s.messages.length - 1; i >= 0 && out.length < 30; i--) {
    const m = s.messages[i];
    if (m.channelId !== channelId || m.id === skip || m.t > before || m.deleted || m.kind === "system" || m.threadOf) continue;
    const txt = m.editedAt && m.editedAt <= before && m.editText ? m.editText : m.text;
    out.push({ who: nameOf(s, m.authorId), text: txt.slice(0, 300) });
  }
  return out.reverse();
}

/** which scripted message gets replaced by a real reply */
export function pickLead(s: WorldState, god: Message, fresh: Message[]): Message | undefined {
  const byChar = fresh.filter((m) => m.authorId.startsWith("c") && !m.threadOf && m.kind !== "system");
  if (!byChar.length) return;
  if (god.serverId === "dm") return byChar.filter((m) => m.channelId === god.channelId).sort((a, b) => a.t - b.t)[0];
  const target = god.replyTo ? [...s.messages, ...s.pending].find((m) => m.id === god.replyTo) : undefined;
  if (target?.authorId.startsWith("c")) { const m = byChar.find((x) => x.authorId === target.authorId); if (m) return m; }
  const mentions = [...god.text.matchAll(/@([\w.]+)/g)].map((x) => x[1].toLowerCase());
  for (const u of mentions) { const m = byChar.find((x) => charById(s, x.authorId)?.username.toLowerCase() === u); if (m) return m; }
  return byChar.filter((m) => m.replyTo === god.id && m.channelId === god.channelId).sort((a, b) => a.t - b.t)[0];
}

interface Hooks { now: () => number; changed: () => void; post?: typeof fetch }

/**
 * After @god speaks: hold the lead reply (its author keeps "typing"), ask the model, then land the real lines.
 * Any failure (no key, budget, timeout, error) lands the original scripted line instead.
 */
export async function liveReply(s: WorldState, god: Message, fresh: Message[], h: Hooks): Promise<"live" | "fallback" | "skipped"> {
  if (s.settings.liveReplies === false || status.state === "unavailable") return "skipped";
  if (used("direct") >= LIVE_BUDGET) { status.state = "off"; status.reason = "session budget used up"; return "skipped"; }
  const lead = pickLead(s, god, fresh);
  if (!lead || busy.has(lead.channelId)) return "skipped";
  // soft commands land instantly from the scripted bank, and the gh0st crew stays fully scripted (story flavor only)
  // crew stays scripted in The Undernet channels (story beats); their DMs go live, filtered by the flavor guard
  if (lead.intent?.startsWith("cmd:") || god.serverId === "undernet" || (crewRole(s, lead.authorId) && god.serverId !== "dm")) return "skipped";
  const now = h.now();
  const c = charById(s, lead.authorId);
  if (!c || !spend("direct", now)) return "skipped";
  busy.add(lead.channelId);

  // hold: the lead keeps typing; anything replying to it, and the same author's follow-ups, wait behind it
  const T0 = lead.t;
  const sameAuthor = fresh.filter((m) => m !== lead && m.authorId === lead.authorId && m.channelId === lead.channelId);
  const deps = fresh.filter((m) => m.replyTo === lead.id && !sameAuthor.includes(m));
  const orig = new Map(deps.map((m) => [m.id, [m.t, m.typingFrom] as const]));
  const hold = Math.max(T0, now + HOLD);
  lead.t = hold;
  for (const d of deps) { d.t += hold - T0; if (d.typingFrom) d.typingFrom += hold - T0; }
  const target = god.replyTo ? [...s.messages, ...s.pending].find((m) => m.id === god.replyTo) : undefined;
  const srv = s.servers.find((x) => x.id === god.serverId);
  const body: LiveRequest = {
    persona: persona(c, s),
    place: { dm: god.serverId === "dm", server: srv?.name ?? "DMs", channel: srv?.channels.find((x) => x.id === god.channelId)?.name ?? "dm" },
    history: historyFor(s, god.channelId, now, god.id),
    god: god.text,
    replyingTo: target && target.authorId === c.id ? target.text : undefined,
    allowBreak: !!s.settings.breakCharacter,
  };

  let lines: string[] | undefined, remember: string | undefined;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT);
    const res = await (h.post ?? fetch)("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
    clearTimeout(timer);
    const j = (await res.json().catch(() => ({}))) as { lines?: string[]; remember?: string; code?: string; model?: string };
    const good = res.ok && !!j.lines?.length;
    if (good) { lines = j.lines!.filter((x) => typeof x === "string" && x.trim()).slice(0, 3); remember = typeof j.remember === "string" ? j.remember.slice(0, 120) : undefined; }
    noteResult(res, j, good);
  } catch { /* timeout or offline: fall back */ }
  busy.delete(lead.channelId);

  const at = h.now();
  const pend = new Set(s.pending);
  if (!pend.has(lead)) return "fallback"; // already delivered (shouldn't happen) - leave it
  if (!lines) {
    const F = Math.max(T0, at + 300);
    lead.t = F;
    for (const d of deps) { const o = orig.get(d.id)!; d.t = o[0] + (F - T0); if (o[1]) d.typingFrom = o[1] + (F - T0); }
    h.changed();
    return "fallback";
  }
  if (remember && !(c.godFacts ??= []).includes(remember)) { c.godFacts.push(remember); if (c.godFacts.length > 20) c.godFacts.shift(); }
  if (remember) rememberLong(c, { about: "god", text: remember, t: at, w: 0.9 });
  const old = lead.text;
  const F = Math.max(T0, at + 250);
  lead.text = lines[0];
  lead.editText = undefined; lead.editedAt = undefined;
  lead.t = F;
  lead.mentionsGod = true;
  lead.ai = true;
  // the same author's scripted follow-ups go; extra real lines land as quick follow-ups
  s.pending = s.pending.filter((m) => !sameAuthor.includes(m) || !pend.has(m));
  let t = F;
  for (const txt of lines.slice(1)) {
    const gap = 700 + Math.min(4000, txt.length * 45);
    const m: Message = { ...lead, id: `${lead.id}x${t}`, text: txt, ai: true, typingFrom: t + 150, t: t + gap, replyTo: undefined, reactions: [], reactionLog: [] };
    t += gap;
    s.pending.push(m);
  }
  for (const d of deps) { const o = orig.get(d.id)!; d.t = Math.max(o[0] + (F - T0), t + 600); if (o[1]) d.typingFrom = Math.max(o[1] + (F - T0), F); }
  for (const n of s.notifications) if (n.text.includes(old.slice(0, 40))) { n.text = n.text.replace(old.slice(0, 60), lines[0].slice(0, 60)); n.t = Math.max(n.t, F); }
  h.changed();
  return "live";
}

/** test helper */
export function resetLive() { status = { state: "unknown", used: 0 }; busy.clear(); resetBudget(); }
