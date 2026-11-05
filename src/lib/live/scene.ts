/**
 * Live group scenes: an overlay on the seeded world. The engine schedules scripted lines into `s.pending`
 * (with times and typing indicators); here we ask the model for a short scene from the same people and swap
 * the text into those slots. Any failure keeps the scripted lines. Nothing here touches the seeded RNG.
 */
import type { Character, Message, WorldState } from "@/lib/sim/types";
import { charById } from "@/lib/sim/world";
import { channelMessages, rememberText, seenText, textAt } from "@/lib/sim/engine";
import { memeFromText } from "@/lib/sim/memes";
import { crewRole } from "@/lib/sim/undernet";
import { canSpend, spend, type Lane } from "./budget";
import { castCard, liveUnavailable, nameOf, noteResult } from "./client";
import { parseScene, voiceNormalize, type LiveLine, type SceneLine, type SceneMode, type SceneRequest } from "./prompt";

export interface SceneHooks { now: () => number; changed: () => void; post?: typeof fetch; active?: () => boolean; random?: () => number }
export interface SceneOpts { mode: SceneMode; lane: Lane; god?: Message; moment?: string; first?: string; about?: string; hold?: boolean }

const TIMEOUT: Record<SceneMode, number> = { ambient: 9000, crowd: 7000, moment: 5000 };
const MAX_HOLD: Record<SceneMode, number> = { ambient: 9000, crowd: 6000, moment: 0 };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** the last ~30 lines visible in a channel (delivered or already landed from pending), oldest first */
export function visibleHistory(s: WorldState, channelId: string, now: number, skip?: string): LiveLine[] {
  return channelMessages(s, channelId, now, 40)
    .filter((m) => m.id !== skip && !m.deleted && m.kind !== "system")
    .slice(-30)
    .map((m) => ({ who: nameOf(s, m.authorId), text: textAt(m, now).slice(0, 240) || (m.meme ? "[meme]" : "") }))
    .filter((l) => l.text);
}

const byUser = (cast: Character[], u: string) => cast.find((c) => c.username.toLowerCase() === u.toLowerCase());
const mood = (c: Character) => (c.opinion > 25 ? "fan" : c.opinion < -25 ? "hater" : "neutral") as "fan" | "hater" | "neutral";

/**
 * Rewrite `group` (scheduled messages of one conversation) as a live scene.
 * hold: keep the first speaker "typing" while the model answers (ambient, crowd). Without hold (moments),
 * only lines that haven't landed yet get swapped.
 */
export async function liveScene(s: WorldState, group: Message[], o: SceneOpts, h: SceneHooks): Promise<"live" | "fallback" | "skipped"> {
  if (s.settings.liveReplies === false || liveUnavailable()) return "skipped";
  const now = h.now();
  const slots = group.filter((m) => m.authorId.startsWith("c") && m.kind === "chat" && !m.threadOf && !m.meme && !m.ai && m.t > now + 150).sort((a, b) => a.t - b.t).slice(0, 8);
  if (slots.length < 2) return "skipped";
  const srv = s.servers.find((x) => x.id === slots[0].serverId);
  const ch = srv?.channels.find((c) => c.id === slots[0].channelId);
  if (!srv || !ch || srv.id === "undernet") return "skipped"; // the crew's own server stays scripted story
  const ids: string[] = [];
  if (o.first) { const f = s.characters.find((c) => c.username === o.first); if (f && slots.some((m) => m.authorId === f.id)) ids.push(f.id); }
  for (const m of slots) if (!ids.includes(m.authorId) && ids.length < 5) ids.push(m.authorId);
  const cast = ids.map((id) => charById(s, id)).filter((c): c is Character => !!c);
  if (cast.length < 1 || !spend(o.lane, now)) return "skipped";

  // hold: the whole conversation slides back while the first person keeps typing
  const moving = group.filter((m) => m.t > now).sort((a, b) => a.t - b.t);
  let held = 0;
  const shift = (d: number) => { for (const m of moving) { m.t = Math.round(m.t + d); if (m.typingFrom) m.typingFrom = Math.round(m.typingFrom + d); } held += d; };
  let timer: ReturnType<typeof setInterval> | undefined;
  if (o.hold && MAX_HOLD[o.mode]) {
    const want = now + 2200 - slots[0].t;
    if (want > 0) shift(want);
    timer = setInterval(() => {
      if (slots[0].t - h.now() < 700 && held < MAX_HOLD[o.mode]) { shift(1200); h.changed(); }
    }, 300);
  }

  const body: SceneRequest = {
    kind: "scene", mode: o.mode, cast: cast.map((c) => castCard(c, s)),
    place: { server: srv.name, channel: ch.name, topic: ch.topic },
    history: visibleHistory(s, ch.id, now, o.god?.id), about: o.about, god: o.god?.text, moment: o.moment, first: o.first,
    lines: clamp(slots.length, 3, 8), memes: o.mode !== "moment" && (h.random ?? Math.random)() < 0.3,
    player: s.player.handle ?? "god",
  };
  let lines: SceneLine[] = [];
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT[o.mode]);
    const res = await (h.post ?? fetch)("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
    clearTimeout(t);
    const j = (await res.json().catch(() => ({}))) as { lines?: unknown; code?: string; model?: string };
    // validate again on this side: only the cast speaks, every line passes the flavor guard
    lines = res.ok && Array.isArray(j.lines) ? parseScene(JSON.stringify({ lines: j.lines }), cast.map((c) => c.username), body.lines + 2, body.player) : [];
    noteResult(res, j, lines.length > 0);
  } catch { /* timeout / offline */ }
  if (timer) clearInterval(timer);

  const at = h.now();
  const pend = new Set(s.pending);
  const open = slots.filter((m) => pend.has(m) && m.t > at + 100);
  lines = lines.filter((l) => { if (seenText(s, l.text)) return false; rememberText(s, l.text); return true; });
  if (!lines.length || !open.length) {
    // fall back: let the scripted lines land where they would have (but not in the past)
    if (held) { const back = Math.max(-held, at + 400 - (moving[0]?.t ?? at)); if (back < 0) shift(back); }
    h.changed();
    return "fallback";
  }

  // map the scene onto the open slots, keeping their rhythm; extra lines follow as quick messages
  const lastBy = new Map<string, string>(); // username -> message id, for reply arrows
  for (const m of channelMessages(s, ch.id, at, 30)) lastBy.set(nameOf(s, m.authorId).toLowerCase(), m.id);
  const mode = o.mode;
  let prevT = Math.max(at + 300, 0);
  const written: Message[] = [];
  lines.forEach((l, i) => {
    const c = byUser(cast, l.who)!;
    const slot = open[i];
    const len = l.text.length;
    const t = Math.round(Math.max(slot ? slot.t : 0, prevT + (i ? 700 + Math.min(3200, len * 40) : 0)));
    const m: Message = slot ?? { ...open[open.length - 1], id: `${open[0].id}s${i}`, reactions: [], reactionLog: [], pinnedAt: undefined, cascaded: undefined };
    m.authorId = c.id;
    m.text = voiceNormalize(l.text, c.voice);
    m.editText = undefined; m.editedAt = undefined; m.meme = undefined;
    m.t = t;
    m.typingFrom = Math.round(Math.max(at, t - clamp(len * 55, 900, 5000)));
    m.ai = true;
    const to = l.to?.toLowerCase();
    m.replyTo = to === "god" ? o.god?.id ?? lastBy.get("god") : to ? lastBy.get(to) : undefined;
    m.mentionsGod = (to === "god" && !!o.god) || /@god\b/i.test(l.text) || new RegExp(`@${(s.player.handle ?? "god").replace(/[.]/g, "\\.")}\\b`, "i").test(l.text) || undefined;
    if (l.meme) m.meme = memeFromText(l.meme, mood(c), (at + i * 7919) % 1e6);
    if (!slot) { s.pending.push(m); s.stats.messages++; c.postCount++; }
    lastBy.set(c.username.toLowerCase(), m.id);
    prevT = t;
    written.push(m);
  });
  // a scene replaces the whole scripted conversation: unused scripted slots never get sent
  if (open.length > lines.length && mode !== "moment") {
    const drop = new Set(open.slice(lines.length));
    s.pending = s.pending.filter((m) => !drop.has(m));
    for (const m of drop) for (const x of s.pending) if (x.replyTo === m.id) x.replyTo = written.at(-1)?.id;
  } else if (open.length > lines.length) {
    for (const m of open.slice(lines.length)) m.t = Math.max(m.t, prevT + 900);
  }
  // notifications that quoted a replaced scripted line now quote the real one
  for (const m of written) if (m.mentionsGod) for (const n of s.notifications) if (n.t >= now - 1000 && n.text.includes(`@${nameOf(s, m.authorId)}`) && n.kind === "mention" && /: "/.test(n.text)) n.text = n.text.replace(/: ".*"$/, `: "${m.text.slice(0, 70)}"`);
  h.changed();
  return "live";
}

/* ------------------------------------------------------------------ ambient chatter in the focused channel */

const handled = new Set<string>();
let inflight = false;

/**
 * Called after each tick: if the engine just scheduled a conversation in the channel the player is looking at,
 * and the ambient lane has budget (tab visible, player not idle), turn it into a live scene.
 */
export function ambientTick(s: WorldState, h: SceneHooks): Promise<"live" | "fallback" | "skipped"> | undefined {
  const f = s.focus;
  if (!f || f.serverId === "dm" || f.serverId === "undernet" || inflight) return;
  if (s.settings.liveReplies === false || liveUnavailable()) return;
  const now = h.now();
  if (h.active && !h.active()) return;
  const groups = new Map<string, Message[]>();
  for (const m of s.pending) {
    if (m.channelId !== f.channelId || !m.episodeId || !m.episodeId.startsWith("e") || handled.has(m.episodeId)) continue;
    (groups.get(m.episodeId) ?? groups.set(m.episodeId, []).get(m.episodeId)!).push(m);
  }
  let pick: [string, Message[]] | undefined;
  for (const [id, g] of groups) {
    const first = Math.min(...g.map((m) => m.t));
    if (first <= now + 300) { handled.add(id); continue; } // already playing: too late to rewrite
    if (!pick || first < Math.min(...pick[1].map((m) => m.t))) pick = [id, g];
  }
  if (!pick || !canSpend("ambient", now)) return;
  handled.add(pick[0]);
  if (handled.size > 500) for (const x of [...handled].slice(0, 250)) handled.delete(x);
  const g = pick[1];
  if (g.some((m) => crewRole(s, m.authorId) && m.serverId === "undernet")) return;
  const topic = g[0].topicId ? s.topics.find((t) => t.id === g[0].topicId) : undefined;
  const about = topic ? `${topic.label}${topic.about === "world" ? "" : " (something god did)"}` : "their own lives, plans and whatever is going on in the server";
  inflight = true;
  return liveScene(s, g, { mode: "ambient", lane: "ambient", hold: true, about }, h).finally(() => { inflight = false; });
}

/* ------------------------------------------------------------------ presence moments */

const lastMoment = new Map<string, number>();
export const MOMENT_DEBOUNCE = 3000;

/**
 * God did something (typing, reacting, voice, pin, edit, delete) and the engine already queued the scripted
 * reaction in `fresh`. One cheap call per moment rewrites the lines that haven't landed yet; a run of moments
 * in the same channel within 3 s counts as one (no second call).
 */
export function liveMoment(s: WorldState, fresh: Message[], moment: string, h: SceneHooks, first?: string): Promise<"live" | "fallback" | "skipped"> | undefined {
  const mine = fresh.filter((m) => m.authorId.startsWith("c") && m.kind === "chat");
  if (mine.length < 2) return;
  const ch = mine[0].channelId;
  const now = h.now();
  if (now - (lastMoment.get(ch) ?? -Infinity) < MOMENT_DEBOUNCE) return;
  lastMoment.set(ch, now);
  if (lastMoment.size > 200) lastMoment.clear();
  return liveScene(s, mine.filter((m) => m.channelId === ch), { mode: "moment", lane: "moment", moment, first }, h);
}

/** test helper */
export function resetScenes() { handled.clear(); inflight = false; lastMoment.clear(); }
