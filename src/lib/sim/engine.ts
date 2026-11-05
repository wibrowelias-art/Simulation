import { Rng, rngFor } from "./rng";
import type { Article, ArticleKind, CatchUpSummary, Channel, Character, InteractiveEvent, Message, Notification, PlatformId, Post, Reaction, Server, Topic, WorldState } from "./types";
import { getGenerator, type Intent } from "./generator";
import { REACTIONS } from "./data";
import { BOT_LINES } from "./templates";
import { expand } from "./grammar";
import { actionDef, autoGodTopic, magnitudeFor, tagify, worldTopic, type ActionKind } from "./topics";
import { EVENT_DEFS } from "./events";
import { charById, netWorth } from "./world";
import { fmtMoney } from "./format";
import { STRICT_BEATS } from "./servers";
import { ambientDm, godSpeak, handleBus } from "./godspeak";
import { undernetBus, undernetOnAction, undernetTick, type EngineHooks } from "./undernet";
import { editReact, pinReact, reactCascade, voiceTick } from "./presence";
import { makeMeme, MEME_LINES, type MemeSpec } from "./memes";
import { lifeTick } from "./life";
import { adjustRel, easeDay, nudgeMood, rememberLong, relOf } from "./memory";

export const BUCKET = 10_000;
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
export const EPISODES_PER_HOUR = 105;
export const POSTS_PER_HOUR = 70;
export const MAX_FULL_SIM = 24 * HOUR;

// ---------- rhythm (docs/research.md §4) ----------
const bump = (h: number, mu: number, sd: number) => {
  let d = Math.abs(h - mu);
  d = Math.min(d, 24 - d);
  return Math.exp(-(d * d) / (2 * sd * sd));
};
export function diurnalAt(chronotype: Character["chronotype"], localHour: number): number {
  const h = localHour;
  if (chronotype === "morning") return 0.06 + 0.9 * bump(h, 9.5, 2.3) + 0.5 * bump(h, 13, 2.2) + 0.45 * bump(h, 20.5, 2.4);
  if (chronotype === "owl") return 0.08 + 0.3 * bump(h, 14, 3) + 1.0 * bump(h, 1, 2.8);
  return 0.05 + 0.4 * bump(h, 12.5, 2.4) + 1.0 * bump(h, 22, 2.6);
}
export const localHour = (c: Pick<Character, "tz">, t: number) => (((t / HOUR + c.tz) % 24) + 24) % 24;
// diurnal() runs for every candidate of every weighted pick: tabulate it per chronotype at 1-minute resolution
const DIURNAL: Record<Character["chronotype"], Float64Array> = (() => {
  const out = {} as Record<Character["chronotype"], Float64Array>;
  for (const ct of ["morning", "evening", "owl"] as const) { const a = new Float64Array(1440); for (let i = 0; i < 1440; i++) a[i] = diurnalAt(ct, i / 60); out[ct] = a; }
  return out;
})();
export const diurnal = (c: Character, t: number) => (DIURNAL[c.chronotype] ?? DIURNAL.evening)[Math.floor(localHour(c, t) * 60) % 1440];

const profileCache = new WeakMap<object, Float64Array>();
/** Activity-weighted presence for a set of members by UTC hour (normalised to mean 1). */
function profile(key: object, members: Character[]): Float64Array {
  let p = profileCache.get(key);
  if (p) return p;
  p = new Float64Array(48);
  let total = 0;
  for (let i = 0; i < 48; i++) {
    const t = (i / 2) * HOUR;
    let v = 0;
    for (const c of members) v += c.activity * diurnal(c, t);
    p[i] = v;
    total += v;
  }
  const mean = total / 48 || 1;
  for (let i = 0; i < 48; i++) p[i] /= mean;
  profileCache.set(key, p);
  return p;
}
const profAt = (p: Float64Array, t: number) => p[Math.floor((((t / HOUR) % 24) + 24) % 24 * 2) % 48];
export const globalActivity = (s: WorldState, t: number) => profAt(profile(s.characters, s.characters), t);
const serverActivity = (s: WorldState, srv: Server, t: number) => profAt(profileCache.get(srv.members) ?? profile(srv.members, srv.members.map((id) => charById(s, id))), t);

// ---------- helpers ----------
export const nid = (s: WorldState, p: string) => `${p}${(s.counter++).toString(36)}`;
const HOOKS: EngineHooks = { ripple: (s, t, now, rng) => ripple(s, t, now, rng), notify: (...a) => notify(...a), nid: (s, p) => nid(s, p) };
const pro = (c: Character) => (c.opinion > 15 ? 1 : c.opinion < -15 ? -1 : 0);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function glazeAdj(s: WorldState, c: Character) {
  const g = s.settings.glazeRatio;
  return c.opinion > 20 ? 0.3 + 1.4 * g : c.opinion < -20 ? 1.7 - 1.4 * g : 1;
}
const gapLogNormal = (rng: Rng, median = 7) => clamp(Math.exp(rng.gauss() * 0.85 + Math.log(median)), 1.5, 200) * 1000;

function remember(c: Character, topic: Topic, t: number, feeling: number) {
  if (topic.about !== "god" || topic.magnitude < 3) return;
  if (c.memory.some((m) => m.topicId === topic.id)) return;
  c.memory.push({ topicId: topic.id, label: topic.label, t, feeling });
  if (c.memory.length > 6) c.memory.shift();
}

export function notify(s: WorldState, t: number, kind: Notification["kind"], text: string, link?: string) {
  s.notifications.push({ id: nid(s, "n"), t, kind, text, link, read: false });
}

// ---------- memes ----------
export const moodOf = (c: Character): "fan" | "hater" | "neutral" => (c.opinion > 25 ? "fan" : c.opinion < -25 ? "hater" : "neutral");
/** an original meme from `c` about the topic (or what god just said) */
export function memeFor(s: WorldState, rng: Rng, c: Character, topic?: Topic, godText?: string): MemeSpec {
  const g = godText ?? (topic?.about === "god" ? s.godLog.filter((x) => x.serverId !== "dm").at(-1)?.text : undefined); // DMs stay private
  const post = topic ? [...s.posts].reverse().find((p) => p.topicId === topic.id && p.platform === "chirp" && !p.media) : undefined;
  const pa = post && post.authorId.startsWith("c") ? charById(s, post.authorId) : undefined;
  const shot = godText ? { name: s.player.displayName || "god", handle: "god", text: godText, likes: rng.int(20_000, 900_000), seed: 1, gold: true }
    : post ? { name: pa?.displayName ?? "god", handle: pa?.username ?? "god", text: post.text, likes: post.likes, seed: pa?.avatarSeed ?? 1, pfp: pa?.pfp, gold: !pa } : undefined;
  return makeMeme(rng, { q: g, topic: topic?.label ?? (godText ? "god being online" : undefined), tag: topic?.tag, mood: moodOf(c), shot });
}

// ---------- topics ----------
function channelMatch(ch: Channel, topic: Topic): number {
  const tags = ch.tags;
  if (topic.about === "god") return tags.includes("god") ? 1.6 : tags.includes("world") || tags.includes("drama") || tags.includes("rumor") ? 0.6 : 0.25;
  const map: Record<string, string[]> = { celebrity: ["celebrity", "drama", "world"], crypto: ["crypto", "memecoins", "finance"], gaming: ["gaming"], tech: ["tech", "business"], sports: ["sports", "world"], meme: ["memes", "world"], markets: ["wealth", "finance", "business", "news"], drama: ["drama", "world", "rumor"] };
  return (map[topic.category] ?? []).some((x) => tags.includes(x)) ? 1.4 : 0.15;
}

function pickTopic(s: WorldState, rng: Rng, ch: Channel): Topic | undefined {
  const live = s.topics.filter((t) => t.heat > 0.4);
  const lifeW = ch.tags.includes("life") || ch.name === "general" || ch.name === "off-topic" ? 9 : 2.5;
  const opts: [Topic | undefined, number][] = [[undefined, lifeW]];
  for (const t of live) opts.push([t, Math.sqrt(t.heat) * channelMatch(ch, t) * (t.about === "god" ? 1.4 : 1)]);
  return rng.weighted(opts, (o) => o[1])[0];
}

// ---------- chat episodes (research §5: bursts, replies, pile-ons, drift) ----------
interface EpisodeOpts { mode?: "normal" | "reaction" | "godReply"; starter?: Character; minLen?: number }

function pickSpeaker(s: WorldState, rng: Rng, srv: Server, t: number, topic: Topic | undefined, exclude?: string): Character {
  const id = rng.weighted(srv.members, (id) => {
    if (id === exclude) return 0;
    const c = charById(s, id);
    const interest = topic && topic.about === "world" && c.interests.includes(topic.category) ? 1.6 : 1;
    return c.activity * diurnal(c, t) * glazeAdj(s, c) * interest;
  });
  return charById(s, id);
}

function reactionsFor(s: WorldState, rng: Rng, srv: Server, c: Character | undefined, intent: string, heat: number) {
  const p = intent === "open" ? 0.45 : intent === "joke" || intent === "pileon" || intent === "godReply" ? 0.4 : 0.12;
  if (!rng.chance(p)) return [];
  const pool = REACTIONS[srv.vibe] ?? REACTIONS.culture;
  const n = rng.int(1, 3);
  const out: { emoji: string; count: number }[] = [];
  for (let i = 0; i < n; i++) {
    const e = i === 0 && c && rng.chance(0.3) ? c.emojis[0] : rng.pick(pool);
    if (out.some((x) => x.emoji === e)) continue;
    out.push({ emoji: e, count: Math.max(1, Math.round(Math.exp(rng.gauss() * 0.8) * (1 + heat / 6) * (i === 0 ? 2 : 1))) });
  }
  return out;
}

/** dedupe key: case, emoji, punctuation and @handles don't make a line "new" */
export const textKey = (t: string) => t.toLowerCase().replace(/@[\w.]+/g, "").replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();
// a Set mirror of the (persisted) dedupe ring, rebuilt whenever the ring array is replaced
const seenSets = new WeakMap<string[], Set<string>>();
const seenSet = (s: WorldState) => { let set = seenSets.get(s.recentTexts); if (!set) seenSets.set(s.recentTexts, (set = new Set(s.recentTexts))); return set; };
export const seenText = (s: WorldState, t: string) => seenSet(s).has(textKey(t));
export function rememberText(s: WorldState, t: string) {
  const k = textKey(t), set = seenSet(s);
  s.recentTexts.push(k);
  set.add(k);
  // trim in batches (the ring holds 600-700): rebuilding the mirror on every push would be O(n) per line
  if (s.recentTexts.length > 700) {
    s.recentTexts.splice(0, s.recentTexts.length - 600);
    seenSets.set(s.recentTexts, new Set(s.recentTexts));
  }
}

function chatText(s: WorldState, rng: Rng, c: Character, intent: Intent, srv: Server, ch: Channel, t: number, topic?: Topic, target?: Character, typoWord?: string): { text: string; typoWord?: string; clean?: string; life?: boolean } {
  const gen = getGenerator();
  let out = gen.chat({ rng, state: s, speaker: c, intent, topic, target, server: srv, channel: ch, t, typoWord });
  for (let i = 0; i < 5 && out.text.length > 14 && seenText(s, out.clean ?? out.text); i++) out = gen.chat({ rng, state: s, speaker: c, intent, topic, target, server: srv, channel: ch, t, typoWord });
  if (out.text.length > 14) rememberText(s, out.clean ?? out.text);
  return out;
}

export function runEpisode(s: WorldState, rng: Rng, srv: Server, ch: Channel, t: number, topic: Topic | undefined, opts: EpisodeOpts = {}): Message[] {
  const epId = nid(s, "e");
  const msgs: Message[] = [];
  let cur = t;
  let conflicts = 0;
  let modded = false;
  let pendingTypo: { who: Character; word: string } | undefined;
  let lastIntent = "open" as Intent;
  const heat = topic?.heat ?? 2;

  const emit = (c: Character, intent: Intent, target?: Character, replyTo?: string) => {
    const r = chatText(s, rng, c, intent, srv, ch, cur, topic, target, pendingTypo?.word);
    const m: Message = {
      id: nid(s, "m"), episodeId: epId, serverId: srv.id, channelId: ch.id, authorId: c.id, text: r.text, t: Math.round(cur), topicId: topic?.id, replyTo,
      reactions: reactionsFor(s, rng, srv, c, intent, heat), kind: intent === "mod" ? "system" : "chat", intent: r.life ? "life" : intent, score: 0,
    };
    // relationships shift with every exchange; a feud that boils over gets remembered
    if (target && target.id !== c.id) {
      const d = intent.startsWith("disagree") ? -3 : intent === "backup" || intent === "agree" ? 1.5 : 0;
      if (d) {
        const before = relOf(c, target.id);
        adjustRel(c, target.id, d);
        adjustRel(target, c.id, d * 0.6);
        if (before > -40 && relOf(c, target.id) <= -40) rememberLong(c, { about: target.id, text: `@${target.username} and i keep fighting${topic ? ` about ${topic.label}` : ""}`, t: cur, w: 0.5 });
        if (before < 40 && relOf(c, target.id) >= 40) rememberLong(c, { about: target.id, text: `@${target.username} always has my back`, t: cur, w: 0.45 });
      }
    }
    if (/@god\b/i.test(r.text)) m.mentionsGod = true;
    if (r.clean && r.clean !== r.text && rng.chance(0.45)) { m.editText = r.clean; m.editedAt = Math.round(cur + rng.range(4, 20) * 1000); }
    m.score = (c.tier === "power" ? 2 : c.tier === "regular" ? 1 : 0.5) + m.reactions.reduce((a, x) => a + x.count, 0) + (c.influencer ? 3 : 0);
    msgs.push(m);
    s.stats.messages++;
    c.postCount++;
    lastIntent = intent;
    pendingTypo = r.typoWord && !m.editText ? { who: c, word: r.typoWord } : undefined;
    if (topic) {
      const feel = intent.startsWith("disagree") || c.opinion < -15 ? -0.6 : c.opinion > 15 ? 0.7 : 0;
      remember(c, topic, cur, feel);
      if (topic.about === "god") c.opinion = clamp(c.opinion + topic.valence * 0.25 + (rng.next() - 0.5) * 0.4, -100, 100);
    }
    if (c.tier !== "lurker" && srv.id !== "dm" && /@god\b/i.test(r.text) && rng.chance(0.04)) notify(s, cur, "mention", `@${c.username} mentioned you in ${srv.name} #${ch.name}`, `lounge:${srv.id}:${ch.id}`);
    return m;
  };

  const starter = opts.starter ?? pickSpeaker(s, rng, srv, t, topic);
  const r0 = rng.next();
  const godish = srv.id !== "dm" && (ch.tags.includes("god") || srv.bias > 0.3);
  const openIntent: Intent = opts.mode === "godReply" ? (starter.opinion < -20 ? "godReplyHater" : "godReply") : topic ? "open" : r0 < 0.07 && srv.insideJokes.length ? "inside" : godish && r0 < 0.4 ? "ambient" : "personal";
  emit(starter, openIntent);

  const mag = topic?.magnitude ?? 2;
  let n = Math.round(clamp(Math.exp(rng.gauss() * 0.75 + Math.log(topic ? 4 + heat / 12 : 3)), 0, 32));
  if (opts.mode === "reaction" || opts.mode === "godReply") n = Math.max(n, Math.round(4 + mag * 1.6 + rng.poisson(mag)));
  if (opts.minLen) n = Math.max(n, opts.minLen);
  // a few "chatty" pile-on threads are much longer
  if (topic && topic.about === "god" && rng.chance(0.05 + s.settings.drama * 0.08)) n += rng.int(6, 16);

  for (let i = 0; i < n; i++) {
    const last = msgs[msgs.length - 1];
    const lastA = last.authorId.startsWith("c") ? charById(s, last.authorId) : starter;
    // typo self-correction (research §2)
    if (pendingTypo && rng.chance(0.45)) {
      cur += rng.range(2, 7) * 1000;
      const w = pendingTypo.who;
      emit(w, "fix");
      continue;
    }
    // self follow-up / burst (research §5)
    let streak = 0;
    for (let k = msgs.length - 1; k >= 0 && msgs[k].authorId === lastA.id; k--) streak++;
    if (streak < 3 && rng.chance(lastA.tier === "power" ? 0.24 : 0.14) && lastA.id !== "god") {
      cur += rng.range(1.5, 9) * 1000;
      emit(lastA, rng.chance(0.55) ? "followup" : topic ? "open" : "personal");
      continue;
    }
    // mod steps in after sustained conflict
    if (conflicts >= 3 && !modded && srv.moderators.length) {
      modded = true;
      const mod = charById(s, rng.pick(srv.moderators));
      cur += gapLogNormal(rng, 20);
      emit(mod, "mod");
      if (rng.chance(0.5)) break;
      continue;
    }
    // responder: friends/rivals of last author, previous participants, or anyone online
    const participants = [...new Set(msgs.map((m) => m.authorId))].filter((id) => id !== lastA.id);
    const social = [...lastA.friends, ...lastA.rivals].filter((id) => srv.members.includes(id));
    const roll = rng.next();
    const resp = roll < 0.3 && social.length ? charById(s, rng.pick(social)) : roll < 0.55 && participants.length ? charById(s, rng.pick(participants)) : pickSpeaker(s, rng, srv, cur, topic, lastA.id);
    if (resp.id === lastA.id) continue;
    let intent: Intent;
    if (lastIntent === "question") intent = "answer";
    else if (i > 2 && rng.chance(0.07)) intent = "drift";
    else if (topic?.about === "god") {
      const a = pro(resp), b = pro(lastA);
      if (a === 0) intent = rng.weighted<Intent>(["question", "joke", "open", "agree", "memory"], (x) => ({ question: 3, joke: 2, open: 2, agree: 1, memory: resp.memory.length ? 1 : 0 } as Record<string, number>)[x]);
      else if (a === b || b === 0) intent = conflicts > 0 && rng.chance(0.45) ? "pileon" : rng.weighted<Intent>(["agree", "backup", "joke", "open", "memory"], (x) => ({ agree: 4, backup: lastA.friends.includes(resp.id) ? 3 : 0.5, joke: resp.stance === "memer" ? 4 : 1.5, open: 2.5, memory: resp.memory.length ? 1.2 : 0 } as Record<string, number>)[x]);
      else { intent = a > 0 ? "disagreeFan" : "disagreeHater"; conflicts++; }
      if (resp.stance === "memer" && rng.chance(0.3)) intent = "joke";
    } else {
      intent = rng.weighted<Intent>(["agree", "joke", "question", "disagreeNeutral", "open", "followup"], (x) => ({ agree: 3, joke: 2.5, question: topic ? 1 : 0.3, disagreeNeutral: 1.2, open: topic ? 2 : 0.5, followup: 0 } as Record<string, number>)[x]);
      if (!topic && intent === "open") intent = "personal";
    }
    cur += lastIntent === "pileon" || intent === "pileon" ? rng.range(2, 10) * 1000 : gapLogNormal(rng);
    let replyTo = rng.chance(intent.startsWith("disagree") || intent === "answer" ? 0.55 : 0.22) ? (rng.chance(0.75) ? last.id : rng.pick(msgs).id) : undefined;
    let older: Message | undefined;
    if (!replyTo && i === 0 && rng.chance(0.06)) older = olderInChannel(s, rng, ch.id, t);
    if (older) replyTo = older.id;
    const rm = older ?? (replyTo ? msgs.find((m) => m.id === replyTo) : undefined);
    const target = rm ? (rm.authorId.startsWith("c") ? charById(s, rm.authorId) : lastA) : lastA;
    if (intent === "drift") {
      emit(resp, "drift", target, replyTo);
      const nt = s.topics.filter((x) => x.about === "world" && x.heat > 1);
      topic = nt.length && rng.chance(0.6) ? rng.pick(nt) : undefined;
      continue;
    }
    emit(resp, intent, target, replyTo);
  }
  // occasional bot output after a busy thread (fictional bots: Tally, Starboard+)
  if (srv.id !== "dm" && msgs.length > 6 && rng.chance(0.12)) {
    const top = msgs.reduce((a, b) => (b.score > a.score ? b : a));
    const who = charById(s, top.authorId.startsWith("c") ? top.authorId : starter.id);
    cur += rng.range(1, 4) * 1000;
    msgs.push({
      id: nid(s, "m"), episodeId: epId, serverId: srv.id, channelId: ch.id, authorId: rng.chance(0.5) ? "bot-tally" : "bot-starboard", t: Math.round(cur), kind: "bot", reactions: [], score: 0.2,
      text: expand(rng.pick(BOT_LINES.slice(0, 2)), { user: who.username, n: String(rng.int(3, 60)), label: topic?.label ?? "this" }, rng),
    });
    s.stats.messages++;
  }
  // sometimes someone drops a meme into the conversation
  const mr = rngFor(s.seed, "meme", epId);
  const memeP = (ch.tags.includes("memes") || ch.name.includes("meme") ? 0.45 : 0.1) * (opts.mode === "reaction" ? 1.6 : 1);
  if (msgs.length >= 2 && mr.chance(memeP)) {
    const cands = msgs.slice(1).filter((m) => m.kind === "chat" && !m.threadOf);
    const m = cands.length ? mr.weighted(cands, (x) => (charById(s, x.authorId).stance === "memer" ? 4 : 1)) : undefined;
    if (m) {
      m.meme = memeFor(s, mr, charById(s, m.authorId), topic);
      if (mr.chance(0.6)) { m.text = mr.pick(MEME_LINES); m.editText = undefined; m.editedAt = undefined; }
      m.score += 2;
    }
  }
  s.pending.push(...msgs);
  return msgs;
}

function olderInChannel(s: WorldState, rng: Rng, channelId: string, t: number): Message | undefined {
  const out: Message[] = [];
  for (let i = s.messages.length - 1, n = 0; i >= 0 && n < 400 && out.length < 12; i--, n++) {
    const m = s.messages[i];
    if (m.channelId === channelId && m.kind === "chat" && t - m.t > 3 * MIN && !m.threadOf) out.push(m);
  }
  return out.length ? rng.pick(out) : undefined;
}

function startRandomEpisode(s: WorldState, rng: Rng, t: number) {
  const srv = rng.weighted(s.servers, (x) => Math.sqrt(x.members.length) * serverActivity(s, x, t) * (1 + (x.bias > 0.3 ? 0.2 : 0)));
  const w = srv.channels.map((c, i) => {
    // the Undernet's drop/ransom channels belong to the crew; random chatter lives in #lobby
    const def = (c.announce ? 0 : 1) * (c.name === "general" || c.name === "lobby" ? 5 : 1) * (srv.id === "undernet" && c.name !== "lobby" ? 0.04 : 1);
    return [c, def, i] as const;
  });
  const ch = rng.weighted(w, (x) => x[1])[0];
  const topic = pickTopic(s, rng, ch);
  // the channel on screen hears it live, not as a backlog from a bucket that already passed (no extra rng)
  const f = s.focus;
  const t0 = Math.floor(t / BUCKET) * BUCKET;
  if (f && f.channelId === ch.id && f.t > t0 && f.t - t0 < 90_000) t = f.t + 600 + (t - t0) * 0.6;
  runEpisode(s, rng, srv, ch, t, topic);
}

// ---------- platforms ----------
const PLATFORM_W: [PlatformId, number][] = [["chirp", 55], ["snapgram", 12], ["clipz", 12], ["threadit", 10], ["tubeverse", 5], ["wire", 6]];
const THREADIT_SUBS: Record<string, string> = { god: "t/GodWatchers", crypto: "t/CryptoMoonshots", gaming: "t/PixelArena", celebrity: "t/Fauxpopculture", tech: "t/gadgets_sim", markets: "t/WealthTalk", meme: "t/memes_sim", drama: "t/SimDrama", sports: "t/sportsball" };

export function engagementFor(rng: Rng, author: Character | undefined, heat: number, godAuthor = false, followers = 0) {
  const f = godAuthor ? followers : author?.followers ?? 100;
  const views = Math.round(f * Math.exp(rng.gauss() * 0.9) * (0.08 + heat / 40) * (godAuthor ? 1.2 : 1) + rng.int(20, 400));
  const likes = Math.round(views * 0.035 * Math.exp(rng.gauss() * 0.6));
  // views/likes/reposts are derived from audience size; replies only count stored replies
  return { views, likes, reposts: Math.round(likes * rng.range(0.05, 0.2)), replies: 0 };
}

export function makePost(s: WorldState, rng: Rng, t: number, o: { topic?: Topic | null; author?: Character; platform?: PlatformId; quote?: boolean; replyToId?: string } = {}): Post {
  const platform = o.platform ?? rng.weighted(PLATFORM_W, (x) => x[1])[0];
  // the gh0st crew only posts through the storyline (undernet.ts), never generic takes
  const crew = s.undernet?.crew;
  const isCrew = (id: string) => !!crew && (crew.gh0st === id || crew.kid === id || crew.wren === id || crew.broker === id || crew.hype === id);
  const author = o.author ?? rng.weighted(s.characters, (c) => (isCrew(c.id) ? 0 : c.activity * diurnal(c, t) * (c.influencer ? 6 : 1) * glazeAdj(s, c)));
  let topic: Topic | undefined = o.topic === null ? undefined : o.topic;
  if (o.topic === undefined) {
    const r = rng.next();
    const god = s.topics.filter((x) => x.about === "god" && x.heat > 0.5), world = s.topics.filter((x) => x.about === "world" && x.heat > 0.5);
    topic = r < 0.5 && god.length ? rng.weighted(god, (x) => x.heat) : r < 0.78 && world.length ? rng.weighted(world, (x) => x.heat) : undefined;
  }
  const recent = s.posts.slice(-80).filter((p) => p.platform === platform && p.t <= t);
  let quoteOf: string | undefined, replyTo: string | undefined, text: string, title: string | undefined;
  const gen = getGenerator();
  const forced = o.replyToId ? s.posts.find((p) => p.id === o.replyToId) : undefined;
  if (forced || (platform === "chirp" && recent.length && rng.chance(0.22))) {
    const target = forced ?? rng.weighted(recent, (p) => p.score + 1);
    const tc = target.authorId.startsWith("c") ? charById(s, target.authorId) : undefined;
    const srv = s.servers[0];
    topic = target.topicId ? s.topics.find((x) => x.id === target.topicId) : topic;
    const intent: Intent = tc && pro(tc) * pro(author) < 0 ? (pro(author) > 0 ? "disagreeFan" : "disagreeHater") : rng.pick(["agree", "joke", "question", "open"] as Intent[]);
    text = gen.chat({ rng, state: s, speaker: author, intent, topic, target: tc, server: srv, channel: srv.channels[0], t }).text;
    if (!forced && rng.chance(0.4)) quoteOf = target.id; else { replyTo = target.id; target.replies += 1; }
  } else {
    const seen = new Set(s.posts.slice(-200).map((p) => p.text.toLowerCase()));
    let r = gen.post({ rng, state: s, author, topic, t, platform });
    for (let k = 0; k < 4 && seen.has(r.text.toLowerCase()); k++) r = gen.post({ rng, state: s, author, topic, t, platform });
    text = r.text; title = r.title;
  }
  const e = engagementFor(rng, author, topic?.heat ?? 1);
  const post: Post = {
    id: nid(s, "p"), platform, authorId: author.id, text, title, t: Math.round(t), topicId: topic?.id, quoteOf, replyTo, ...e,
    community: platform === "threadit" ? THREADIT_SUBS[topic?.about === "god" ? "god" : topic?.category ?? "meme"] ?? "t/AskAnything" : undefined,
    media: platform === "snapgram" || platform === "clipz" || platform === "tubeverse" || rng.chance(0.15) ? { hue: rng.int(0, 360), label: topic?.tag ?? rng.pick(["sunset", "coffee", "gym", "setup", "city"]), kind: platform === "clipz" || platform === "tubeverse" ? "video" : rng.chance(0.2) ? "meme" : "photo" } : undefined,
    score: 0,
  };
  if (post.media?.kind === "meme") post.media.meme = memeFor(s, rngFor(s.seed, "pm", post.id), author, topic);
  if (topic && ["rumor", "allegation", "leak"].includes(topic.category) && (author.stance === "conspiracist" || author.stance === "worshipper" || author.stance === "hater") && rng.chance(0.4))
    post.communityNote = rng.pick(["Readers added context: No primary source confirms this claim. The earliest version traces to an anonymous account.", "Readers added context: The image in this post is from an unrelated event in 2024 (in-sim).", "Readers added context: The figure cited is an estimate from a fan spreadsheet, not a filing."]);
  if (topic?.amount && author.stance === "worshipper" && rng.chance(0.15)) post.communityNote = `Readers added context: Reported value is ${fmtMoney(topic.amount)}, not the larger figure claimed in this post.`;
  post.score = Math.log10(post.likes + 10) + (author.influencer ? 1 : 0);
  s.posts.push(post);
  s.stats.posts++;
  author.postCount++;
  return post;
}

// ---------- news ----------
function pickOutlet(s: WorldState, rng: Rng, topic: Topic) {
  return rng.weighted(s.outlets, (o) => {
    const strict = STRICT_BEATS[o.id];
    if (strict) return strict.includes(topic.category) ? 3 : 0;
    return topic.about === "god" ? (o.beats.includes("god") ? 3 : 1) : o.beats.includes(topic.category) || (topic.category === "celebrity" && o.beats.includes("drama")) ? 3 : 0.4;
  });
}

export function makeArticle(s: WorldState, rng: Rng, topic: Topic, t: number, kind?: ArticleKind): Article {
  const outlet = pickOutlet(s, rng, topic);
  const k: ArticleKind = kind ?? (topic.breaking && t - topic.startedAt < 30 * MIN ? "breaking" : rng.weighted<ArticleKind>(["report", "opinion", "rumor", "financial", "interview", "investigation"], (x) => ({ report: 4, opinion: 2, rumor: ["rumor", "leak", "allegation"].includes(topic.category) ? 4 : 0.5, financial: topic.amount ? 3 : 0.3, interview: 1, investigation: topic.about === "god" ? 0.8 : 0.2 } as Record<string, number>)[x]));
  const pool = [...s.messages.slice(-1500), ...s.pending].filter((m) => m.topicId === topic.id && m.t <= t && m.serverId !== "dm" && m.authorId.startsWith("c") && m.text.length > 22);
  const quotes = rng.shuffle(pool.slice(-40)).slice(0, 3).map((m) => ({ who: charById(s, m.authorId), text: m.text, where: s.servers.find((x) => x.id === m.serverId)!.name }));
  const body = getGenerator().article({ rng, state: s, outlet, topic, kind: k, t, quotes });
  const comments: Article["comments"] = [];
  let ct = t + rng.range(1, 5) * MIN;
  for (let i = 0, n = rng.int(3, 10); i < n; i++) {
    const c = rng.weighted(s.characters, (x) => x.activity * (topic.about === "world" && x.interests.includes(topic.category) ? 2 : 1));
    const srv = s.servers.find((x) => x.id === c.servers[0])!;
    const intent: Intent = rng.pick(["open", "agree", "joke", "question", c.opinion < -20 ? "disagreeHater" : "disagreeFan"] as Intent[]);
    comments.push({ authorId: c.id, text: getGenerator().chat({ rng, state: s, speaker: c, intent, topic, server: srv, channel: srv.channels[0], t: ct }).text, t: Math.round(ct), likes: Math.round(Math.exp(rng.gauss() + 2)) });
    ct += gapLogNormal(rng, 90);
  }
  const a: Article = {
    id: nid(s, "a"), outletId: outlet.id, kind: k, ...body, author: rng.pick(outlet.authors).name, t: Math.round(t), topicId: topic.id, comments,
    reactions: [["🔥", 4], ["😮", 2], ["😂", 2], ["🤡", topic.valence < 0 ? 3 : 1], ["👑", topic.valence > 0 ? 3 : 0.5]].map(([e, w]) => ({ emoji: e as string, count: Math.round((w as number) * topic.magnitude * Math.exp(rng.gauss() * 0.5) * 40) })),
    reads: Math.round(Math.exp(rng.gauss() * 0.6) * topic.magnitude * 18000),
  };
  s.articles.push(a);
  s.stats.articles++;
  // outlet echoes on Chirp
  const p: Post = { id: nid(s, "p"), platform: "chirp", authorId: `o-${outlet.id}`, text: a.headline + (k === "breaking" ? " 🚨" : ""), t: Math.round(t + 20_000), topicId: topic.id, breaking: k === "breaking", likes: 0, reposts: 0, replies: 0, views: 0, score: 3, quoteOf: undefined };
  Object.assign(p, engagementFor(rng, undefined, topic.heat, true, 900_000 + topic.magnitude * 200_000));
  p.title = a.id; // link to article
  s.posts.push(p);
  s.stats.posts++;
  if (topic.about === "god" && (k === "breaking" || topic.magnitude >= 5.5)) notify(s, t, "news", `${outlet.name}: ${a.headline}`, `article:${a.id}`);
  return a;
}

// ---------- events ----------
function spawnEvent(s: WorldState, rng: Rng, t: number) {
  const def = rng.weighted(EVENT_DEFS, (d) => d.weight);
  const m = def.make(rng, s);
  const ev: InteractiveEvent = { id: nid(s, "ev"), type: def.type, title: m.title, body: m.body, fromId: m.fromId, t: Math.round(t), choices: def.choices, expiresAt: Math.round(t + 8 * HOUR), data: m.data };
  s.events.push(ev);
  notify(s, t, "event", `New situation: ${ev.title}`, `event:${ev.id}`);
}

// ---------- the bucket step ----------
function decay(s: WorldState, dt: number) {
  for (const tp of s.topics) {
    const half = (1.2 + tp.magnitude * 0.45) * HOUR;
    tp.heat *= Math.pow(0.5, dt / half);
  }
}

function drift(s: WorldState, rng: Rng | null, dt: number) {
  const vol: Record<string, [number, number]> = { coin: [0, 0.012], investment: [0.00002, 0.0025], business: [0.00003, 0.0018], property: [0.00001, 0.0005], island: [0.00001, 0.0004], jet: [-0.00001, 0.0002], vehicle: [-0.00002, 0.0003], organization: [0, 0.0002], account: [0, 0.001] };
  const steps = dt / (5 * MIN);
  for (const h of s.player.holdings) {
    const [mu, sd] = vol[h.kind] ?? [0, 0.001];
    h.value = Math.max(1000, h.value * Math.exp(mu * steps + (rng ? rng.gauss() * sd * Math.sqrt(steps) : 0)));
    if (h.yieldPerDay) s.player.cash += h.yieldPerDay * (dt / DAY);
  }
  s.player.followers = Math.round(s.player.followers * (1 + 0.000015 * (s.player.influence / 50) * steps));
}

/** reactions that landed over an hour ago become plain counts (same display, a fraction of the bytes) */
function settleReactions(s: WorldState) {
  const cut = s.simTime - HOUR;
  for (let i = s.messages.length - 1; i >= 0; i--) {
    const m = s.messages[i];
    if (!m.reactionLog?.length) continue;
    const last = m.reactionLog[m.reactionLog.length - 1][1];
    if (last > cut || m.t > cut) continue;
    m.reactions = reactionsAt(m, Infinity);
    delete m.reactionLog;
  }
}

function prune(s: WorldState) {
  settleReactions(s);
  const before = s.messages.length;
  if (before > 7000) {
    // keep the newest 5000 overall, plus each channel's last 40 and its 10 best older messages
    const keep = new Set<string>(s.messages.slice(-5000).map((m) => m.id));
    const byCh = new Map<string, Message[]>();
    for (const m of s.messages) (byCh.get(m.channelId) ?? byCh.set(m.channelId, []).get(m.channelId)!).push(m);
    for (const list of byCh.values()) {
      for (const m of list.slice(-40)) keep.add(m.id);
      for (const m of list.slice(0, -40).sort((a, b) => b.score - a.score).slice(0, 10)) keep.add(m.id);
    }
    s.messages = s.messages.filter((m) => keep.has(m.id));
    s.stats.pruned += before - s.messages.length;
  }
  if (s.posts.length > 2000) {
    // keep the newest 1600 plus anything god wrote, liked or reposted (and the posts those reply to)
    const tail = new Set(s.posts.slice(-1600));
    const mine = new Set(s.posts.filter((p) => p.authorId === "god" || p.godLiked || p.godReposted).map((p) => p.id));
    s.posts = s.posts.filter((p) => tail.has(p) || mine.has(p.id) || (p.replyTo && mine.has(p.replyTo)));
  }
  if (s.recentTexts.length > 700) s.recentTexts = s.recentTexts.slice(-600);
  if (s.articles.length > 180) s.articles = s.articles.slice(-150);
  if (s.notifications.length > 160) s.notifications = s.notifications.slice(-140);
  if (s.player.history.length > 200) s.player.history = s.player.history.slice(-200);
  if (s.events.length > 40) s.events = s.events.filter((e) => !e.resolved).concat(s.events.filter((e) => e.resolved).slice(-20));
  s.topics = s.topics.filter((t) => t.heat > 0.15 || t.about === "god" && t.magnitude >= 7).slice(-70);
  if (s.player.netWorthHistory.length > 600) s.player.netWorthHistory = s.player.netWorthHistory.filter((_, i) => i % 2 === 0);
}

function celebPick(s: WorldState, rng: Rng) {
  const c = rng.pick(s.celebrities);
  return charById(s, c.id);
}

export function processBucket(s: WorldState, b: number) {
  const t0 = b * BUCKET, t1 = t0 + BUCKET;
  const rng = rngFor(s.seed, "b", b);
  const act = s.settings.activity;
  const ga = globalActivity(s, t0);
  const godHeat = s.topics.reduce((a, t) => a + (t.about === "god" ? t.heat : 0), 0);
  const heatBoost = 1 + Math.min(2.5, godHeat / 80) * (0.5 + s.settings.drama);
  const nEp = rng.poisson((EPISODES_PER_HOUR / 360) * act * ga * heatBoost);
  for (let i = 0; i < nEp; i++) startRandomEpisode(s, rng, t0 + rng.next() * BUCKET);
  const nPost = rng.poisson((POSTS_PER_HOUR / 360) * act * ga * heatBoost);
  for (let i = 0; i < nPost; i++) makePost(s, rng, t0 + rng.next() * BUCKET);
  // characters DM each other now and then
  if (rng.chance(0.03 * act * ga)) ambientDm(s, rng, t0 + rng.next() * BUCKET);
  // people react to messages that are already there
  if (s.messages.length && rng.chance(0.5 * act)) {
    for (let k = 0, n = rng.int(1, 3); k < n; k++) {
      const m = s.messages[s.messages.length - 1 - rng.int(0, Math.min(250, s.messages.length - 1))];
      if (m.kind !== "chat" || t0 - m.t > 30 * MIN || m.serverId === "dm") continue;
      const srv = s.servers.find((x) => x.id === m.serverId);
      if (!srv) continue;
      const by = rng.pick(srv.members);
      const pool = REACTIONS[srv.vibe] ?? REACTIONS.culture;
      const existing = m.reactions.length && rng.chance(0.6) ? rng.pick(m.reactions).emoji : rng.pick(pool);
      (m.reactionLog ??= []).push([existing, Math.round(t0 + rng.next() * BUCKET), by]);
    }
  }
  // the channel the player is looking at never goes dead while it's "active"
  const f = s.focus;
  if (f && t0 - f.t < 90_000 && f.serverId !== "dm") {
    const srv = s.servers.find((x) => x.id === f.serverId);
    const ch = srv?.channels.find((c) => c.id === f.channelId);
    if (srv && ch && !ch.announce) {
      let lastT = 0, upcoming = false;
      const ref = Math.max(t0, f.t);
      for (const m of s.pending) if (m.channelId === ch.id) { if (m.t >= ref) upcoming = true; else lastT = Math.max(lastT, m.t); }
      for (let i = s.messages.length - 1, n = 0; i >= 0 && n < 600; i--, n++) if (s.messages[i].channelId === ch.id) { lastT = Math.max(lastT, s.messages[i].t); break; }
      const quietFor = ref - lastT;
      const busy = clamp(serverActivity(s, srv, t0) * act * (ch.name === "general" ? 1.4 : 0.8), 0.15, 2);
      // anchored to when the player last looked (live only), so it plays out in front of them
      if (!upcoming && quietFor > 12_000 / busy && rng.chance(clamp(0.35 * busy, 0.08, 0.8))) runEpisode(s, rng, srv, ch, Math.max(t0, f.t) + rng.range(1, 6) * 1000, pickTopic(s, rng, ch));
    }
  }
  // shared event bus: deliver world events whose time has come
  if (s.bus.length) {
    const due = s.bus.filter((e) => e.t < t1).sort((a, b) => a.t - b.t);
    if (due.length) {
      s.bus = s.bus.filter((e) => e.t >= t1);
      for (const e of due) { if (e.kind === "undernet") undernetBus(s, e, HOOKS); else handleBus(s, e); }
    }
  }

  if (s.voice?.god && !s.voice.god.leftAt) voiceTick(s, t1);
  if (b % 30 === 0) {
    decay(s, 5 * MIN);
    undernetTick(s, t0);
    if (rng.chance(0.24 * act)) {
      const c = celebPick(s, rng);
      s.topics.push(worldTopic(rng, nid(s, "t"), t0, c.displayName, c.id));
    }
    if (rng.chance(0.055 * act * (0.6 + s.settings.drama))) {
      const c = celebPick(s, rng);
      const tp = autoGodTopic(rng, nid(s, "t"), t0, c.displayName, c.id);
      s.topics.push(tp);
      if (tp.magnitude > 4) notify(s, t0, "trend", `#${tp.tag} is trending: ${tp.label}`, `chirp:${tp.tag}`);
    }
    for (const tp of s.topics) {
      const have = s.articles.filter((a) => a.topicId === tp.id).length;
      const cap = tp.about === "god" ? Math.ceil(tp.magnitude / 1.6) : Math.ceil(tp.magnitude / 3);
      if (tp.category !== "chat" && tp.heat > 3 && have < cap && rng.chance(0.22)) makeArticle(s, rng, tp, t0 + rng.next() * 5 * MIN);
    }
    if (s.events.filter((e) => !e.resolved).length < 3 && rng.chance(0.07)) spawnEvent(s, rng, t0);
    for (const e of s.events) if (!e.resolved && e.expiresAt <= t0) e.resolved = { choiceId: "expired", outcome: "You didn't respond. The internet moved on.", t: e.expiresAt };
    drift(s, rng, 5 * MIN);
  }
  if (b % 360 === 0) hourly(s, t0);
  if (b % 90 === 0) s.player.netWorthHistory.push({ t: t0, v: Math.round(netWorth(s)) });
  if (b % 180 === 0) prune(s);

  // deliver scheduled messages whose time has come
  if (s.pending.length) {
    const due: Message[] = [], later: Message[] = [];
    for (const m of s.pending) (m.t < t1 ? due : later).push(m);
    if (due.length) {
      due.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
      s.messages.push(...due);
      s.pending = later;
    }
  }
  s.simTime = t1;
}

/** once an hour of sim time: lives move on, grudges ease, unanswered DMs sting */
function hourly(s: WorldState, t: number) {
  lifeTick(s, t);
  for (const c of s.characters) if (c.rel || c.mood) easeDay(c, 1 / 24);
  leftOnRead(s, t);
}

/** a character DMed god and he never answered (6h+): they remember, and it shows */
function leftOnRead(s: WorldState, t: number) {
  const last = new Map<string, Message>();
  for (let i = s.messages.length - 1; i >= 0; i--) {
    const m = s.messages[i];
    if (t - m.t > 3 * DAY) break; // delivered in time order
    if (m.serverId !== "dm" || !m.channelId.endsWith(":god") || last.has(m.channelId)) continue;
    last.set(m.channelId, m);
  }
  for (const m of last.values()) {
    if (!m.authorId.startsWith("c") || t - m.t < 6 * HOUR || t - m.t > 3 * DAY) continue;
    const c = charById(s, m.authorId);
    if (!c || (c.ignored ?? 0) >= m.t) continue;
    c.ignored = m.t;
    rememberLong(c, { about: "god", text: `god left me on read after i DMed him "${m.text.slice(0, 50)}"`, t, w: 0.55 });
    adjustRel(c, "god", -8);
    nudgeMood(c, -0.15);
  }
}

export interface SimProgress { done: number; total: number }

/**
 * Advance the world to `to`. Long absences are compressed so catch-up stays fast on a phone:
 * - the last FULL_SIM is simulated bucket by bucket, so opening the app every 20 min or once after 6 h gives the
 *   same world,
 * - (after 24 h+ away only the last FULL_SIM_LONG is full)
 * - the rest of the last 24 h is sampled at one bucket per 5 minutes: the 5-minute and hourly clocks (topics,
 *   news, events, money, lives, pruning) stay exact while chatter is thinned to a highlight reel,
 * - anything older is skipped analytically (money drift, topic decay, lives).
 * `full` forces bucket-by-bucket (a new world's first hours of history).
 */
export const FULL_SIM = 6 * HOUR;
export const FULL_SIM_LONG = 2 * HOUR; // after a day or more away: only the last 2 h in full
const SPARSE_EVERY = 30; // buckets: 5 minutes
/** a catch-up that started from a 24 h+ gap keeps its (shorter) full window across sliced calls */
const longCatchUp = new WeakMap<WorldState, { target: number; from: number }>();
export function simulate(s: WorldState, to: number, opts: { maxBuckets?: number; full?: boolean } = {}): { compressed: boolean; processed: number } {
  let compressed = false;
  const target = Math.floor(to / BUCKET);
  let b = Math.floor(s.simTime / BUCKET);
  const memo = longCatchUp.get(s);
  let fullFrom = opts.full ? b : memo && memo.target === target ? memo.from : target - FULL_SIM / BUCKET;
  if (!opts.full && (target - b) * BUCKET > MAX_FULL_SIM) {
    fullFrom = target - FULL_SIM_LONG / BUCKET;
    longCatchUp.set(s, { target, from: fullFrom });
    const skipTo = target - MAX_FULL_SIM / BUCKET;
    const dt = (skipTo - b) * BUCKET;
    drift(s, null, dt);
    decay(s, dt);
    // lives keep moving while nobody watches (cheap: one pass per skipped hour)
    for (let h = Math.ceil(s.simTime / HOUR) * HOUR; h < skipTo * BUCKET; h += HOUR) hourly(s, h);
    s.simTime = skipTo * BUCKET;
    b = skipTo;
    compressed = true;
  }
  let processed = 0;
  const limit = opts.maxBuckets ?? Infinity;
  while (b < target && processed < limit) {
    if (b < fullFrom && b % SPARSE_EVERY !== 0) {
      // sparse stretch: jump to the next 5-minute mark (or the start of full simulation)
      b = Math.min(fullFrom, Math.ceil((b + 1) / SPARSE_EVERY) * SPARSE_EVERY);
      s.simTime = b * BUCKET;
      compressed = true;
      continue;
    }
    processBucket(s, b);
    b++;
    processed++;
  }
  return { compressed, processed };
}

/** how many buckets a catch-up to `to` will actually process (for progress bars) */
export function bucketsToSimulate(s: WorldState, to: number): number {
  const target = Math.floor(to / BUCKET), b = Math.floor(s.simTime / BUCKET);
  const full = Math.min(target - b, ((target - b) * BUCKET > MAX_FULL_SIM ? FULL_SIM_LONG : FULL_SIM) / BUCKET);
  const sparse = Math.max(0, Math.min(target - b, MAX_FULL_SIM / BUCKET) - full);
  return Math.max(1, full + Math.ceil(sparse / SPARSE_EVERY));
}

export interface CatchUpBaseline { from: number; simFrom: number; stats: WorldState["stats"]; opinion: number; events: number; netWorth: number; followers: number; compressed: boolean }
const avgOpinion = (s: WorldState) => s.characters.reduce((a, c) => a + c.opinion, 0) / s.characters.length;

export function baseline(s: WorldState, from: number): CatchUpBaseline {
  return { from, simFrom: s.simTime, stats: { ...s.stats }, opinion: avgOpinion(s), events: s.events.length, netWorth: netWorth(s), followers: s.player.followers, compressed: false };
}

export function summarize(s: WorldState, base: CatchUpBaseline, to: number): CatchUpSummary & { netWorthDelta: number; followerDelta: number } {
  const from = base.from;
  const inRange = s.messages.filter((m) => m.t >= from && m.t <= to);
  const bySrv = new Map<string, number>();
  for (const m of inRange) bySrv.set(m.serverId, (bySrv.get(m.serverId) ?? 0) + 1);
  const topServers = [...bySrv.entries()].sort((a, b) => b[1] - a[1]).filter(([id]) => id !== "dm").slice(0, 5).map(([id, count]) => ({ name: s.servers.find((x) => x.id === id)?.name ?? "DMs", count }));
  const topTopics = s.topics.filter((t) => t.startedAt >= from - HOUR || t.heat > 3).sort((a, b) => b.heat - a.heat).slice(0, 6).map((t) => ({ tag: t.tag, heat: Math.round(t.heat * 10) / 10 }));
  const arts = s.articles.filter((a) => a.t >= from && a.t <= to).sort((a, b) => b.reads - a.reads);
  const posts = s.posts.filter((p) => p.t >= from && p.t <= to && p.authorId.startsWith("c")).sort((a, b) => b.likes - a.likes);
  const highlights: string[] = [];
  for (const a of arts.slice(0, 3)) highlights.push(`📰 ${s.outlets.find((o) => o.id === a.outletId)!.name}: ${a.headline}`);
  if (posts[0]) highlights.push(`🔥 Top Chirp: @${charById(s, posts[0].authorId).username}: "${posts[0].text.slice(0, 90)}"`);
  const newEvents = s.events.slice(base.events).filter((e) => !e.resolved);
  for (const e of newEvents.slice(0, 2)) highlights.push(`⚡ Waiting on you: ${e.title}`);
  const newTopics = s.topics.filter((t) => t.startedAt >= from && t.about === "god");
  for (const t of newTopics.slice(0, 2)) highlights.push(`👀 New storyline: ${t.label}`);
  for (const g of (s.godMoments ?? []).filter((g) => g.t >= from - 10 * MIN && g.t <= to).slice(-4)) highlights.push(g.text);
  return {
    from, to, simulatedFrom: base.simFrom,
    messages: s.stats.messages - base.stats.messages, posts: s.stats.posts - base.stats.posts, articles: s.stats.articles - base.stats.articles,
    events: newEvents.length, mentions: inRange.filter((m) => m.authorId !== "god" && (m.mentionsGod || /@god\b/i.test(m.text))).length, topTopics, topServers, opinionShift: Math.round((avgOpinion(s) - base.opinion) * 10) / 10, highlights, compressed: base.compressed,
    netWorthDelta: netWorth(s) - base.netWorth, followerDelta: s.player.followers - base.followers,
  };
}

/** Synchronous catch-up (tests, server). The UI uses the chunked variant in store.ts. */
export function catchUp(s: WorldState, to: number) {
  const base = baseline(s, s.lastSeenAt);
  const r = simulate(s, to);
  base.compressed = r.compressed;
  s.lastSeenAt = to;
  return summarize(s, base, to);
}

// ---------- @god actions & ripples ----------
export interface RippleResult { topic: Topic; magnitude: number; breaking: boolean; servers: string[]; posts: number; articles: Article[]; headline?: string }

export function ripple(s: WorldState, topic: Topic, now: number, rng: Rng, focus?: { serverId: string; channelId: string }): RippleResult {
  const mag = topic.magnitude;
  const breaking = mag >= 7;
  topic.breaking = breaking;
  const serverCount = Math.min(s.servers.length, Math.round(2 + mag * (breaking ? 2.4 : 1.3)));
  const ranked = [...s.servers].sort((a, b) => (b.tags.includes("god") ? 1 : 0) - (a.tags.includes("god") ? 1 : 0) || Math.abs(b.bias) - Math.abs(a.bias));
  const chosen = rng.shuffle(ranked.slice(0, Math.min(s.servers.length, serverCount + 3))).slice(0, serverCount);
  if (focus && focus.serverId !== "dm" && !chosen.some((x) => x.id === focus.serverId)) chosen.unshift(s.servers.find((x) => x.id === focus.serverId)!);
  const window = breaking ? 90_000 : 6 * MIN;
  for (const srv of chosen) {
    const chs = srv.channels.filter((c) => !c.announce);
    const early = breaking && (srv.tags.includes("god") || chosen.indexOf(srv) < 3);
    const ch = focus && srv.id === focus.serverId ? srv.channels.find((c) => c.id === focus.channelId)! : early ? chs.find((c) => c.name === "general") ?? chs[0] : rng.weighted(chs, (c) => channelMatch(c, topic) * (c.name === "general" ? 2 : 1));
    const t = early ? now + 1500 + rng.next() * 6000 : now + 2000 + rng.next() * window;
    runEpisode(s, rng, srv, ch, t, topic, { mode: focus && srv.id === focus.serverId ? "godReply" : "reaction" });
    if (breaking && rng.chance(0.6)) {
      const ch2 = rng.pick(chs);
      runEpisode(s, rng, srv, ch2, t + rng.range(20, 240) * 1000, topic, { mode: "reaction" });
    }
  }
  const nPosts = Math.round(mag * (breaking ? 5 : 2.5));
  const influencers = s.characters.filter((c) => c.influencer);
  let posts = 0;
  for (let i = 0; i < nPosts; i++) {
    const author = i < Math.ceil(nPosts / 3) ? rng.pick(influencers) : undefined;
    makePost(s, rng, breaking && i < 5 ? now + 2500 + i * 1500 + rng.next() * 2000 : now + 4000 + rng.next() * window * 2, { topic, author, platform: i < nPosts * 0.6 ? "chirp" : undefined });
    posts++;
  }
  // event chain: the discourse comes back in waves
  if (mag >= 4) {
    s.bus.push({ id: nid(s, "v"), kind: "followup", t: Math.round(now + rng.range(15, 40) * MIN), topicId: topic.id, data: {} });
    if (mag >= 6) s.bus.push({ id: nid(s, "v"), kind: "followup", t: Math.round(now + rng.range(2, 6) * HOUR), topicId: topic.id, data: {} });
  }
  const articles: Article[] = [];
  const nArt = breaking ? rng.int(3, 6) : mag >= 4.5 ? 1 : 0;
  for (let i = 0; i < nArt; i++) articles.push(makeArticle(s, rng, topic, now + 15_000 + i * rng.range(20, 70) * 1000, i === 0 && breaking ? "breaking" : undefined));
  if (breaking) {
    notify(s, now, "trend", `🚨 #${topic.tag} is #1 trending worldwide`, `chirp:${topic.tag}`);
    notify(s, now + 5000, "mention", `Mentions of @god are spiking across ${chosen.length} servers`, `chirp:${topic.tag}`);
  } else if (mag >= 4) notify(s, now, "trend", `#${topic.tag} is trending`, `chirp:${topic.tag}`);
  return { topic, magnitude: mag, breaking, servers: chosen.map((x) => x.name), posts, articles, headline: articles[0]?.headline };
}

export interface ActionInput { kind: ActionKind; name: string; cost: number; boost?: number }

export function applyAction(s: WorldState, input: ActionInput, now: number): RippleResult | { error: string } {
  simulate(s, now);
  const def = actionDef(input.kind);
  const cost = Math.max(0, input.cost);
  if (cost > s.player.cash) return { error: `Not enough cash. You have ${fmtMoney(s.player.cash)}.` };
  const rng = rngFor(s.seed, "action", s.counter, input.kind, input.name);
  s.player.cash -= cost;
  const name = input.name.trim() || def.names[0];
  if (def.holding) {
    const mult: Record<string, number> = { business: 1.1, coin: rng.range(2, 9), vehicle: 0.92, jet: 0.95, property: 1.02, island: 1.05, investment: 1, organization: 0.3 };
    s.player.holdings.push({
      id: nid(s, "h"), kind: def.holding, name: input.kind === "coin" ? `$${name.replace(/^\$/, "").toUpperCase()}` : name, value: Math.round(cost * (mult[def.holding] ?? 1)), acquiredAt: now,
      detail: def.title, employees: input.kind === "business" ? rng.int(12, 900) : undefined, yieldPerDay: input.kind === "business" ? Math.round(cost * 0.0009) : input.kind === "investment" ? Math.round(cost * 0.0003) : undefined,
    });
  }
  if (input.kind === "hire") {
    const hq = s.player.holdings.find((h) => h.id === "h-holdings");
    if (hq) hq.employees = (hq.employees ?? 0) + rng.int(5, 500);
  }
  const mag = magnitudeFor(input.kind, cost, input.boost ?? 0);
  const subject = input.kind === "coin" ? name.replace(/^\$/, "").toUpperCase() : name;
  const topic: Topic = {
    id: nid(s, "t"), tag: input.kind === "coin" ? subject : tagify(`${def.kind === "announcement" || def.kind === "controversy" ? def.kind : subject}`), label: def.label(subject), about: "god", category: input.kind,
    valence: def.valence + (rng.next() - 0.5) * 0.2, magnitude: mag, heat: mag * 7, startedAt: now, subject, amount: cost || undefined, facts: { action: input.kind, coin: input.kind === "coin" ? subject : "GOD", ticker: subject },
  };
  s.topics.push(topic);
  s.player.followers += Math.round(mag * mag * 30_000 * rng.range(0.6, 1.6));
  s.player.influence = clamp(s.player.influence + mag * 0.35, 0, 100);
  s.player.reputation = clamp(s.player.reputation + topic.valence * mag * 0.7, 0, 100);
  s.player.history.push({ t: now, text: `${def.icon} ${def.title}: ${name}${cost ? ` (${fmtMoney(cost)})` : ""}`, topicId: topic.id });
  if (cost) notify(s, now, "money", `${fmtMoney(-cost)} · ${def.title}: ${name}`);
  const res = ripple(s, topic, now, rng);
  undernetOnAction(s, topic, now);
  return res;
}

export function resolveEvent(s: WorldState, eventId: string, choiceId: string, now: number): { outcome: string; ripple?: RippleResult } | { error: string } {
  simulate(s, now);
  const ev = s.events.find((e) => e.id === eventId);
  if (!ev || ev.resolved) return { error: "Event not available" };
  const def = EVENT_DEFS.find((d) => d.type === ev.type)!;
  const rng = rngFor(s.seed, "event", ev.id, choiceId);
  const eff = def.resolve(choiceId, rng, ev.data, s);
  const p = s.player;
  if (eff.cash) p.cash = Math.max(0, p.cash + eff.cash);
  if (eff.reputation) p.reputation = clamp(p.reputation + eff.reputation, 0, 100);
  if (eff.influence) p.influence = clamp(p.influence + eff.influence, 0, 100);
  if (eff.followers) p.followers += eff.followers;
  if (eff.opinion) for (const c of s.characters) c.opinion = clamp(c.opinion + eff.opinion * (0.5 + rng.next()), -100, 100);
  ev.resolved = { choiceId, outcome: eff.outcome, t: now };
  p.history.push({ t: now, text: `⚡ ${ev.title} → ${ev.choices.find((c) => c.id === choiceId)?.label}: ${eff.outcome}` });
  if (eff.cash) notify(s, now, "money", `${fmtMoney(eff.cash, { sign: true })} · ${ev.title}`);
  let rip: RippleResult | undefined;
  if (eff.topic) {
    const tp: Topic = { id: nid(s, "t"), tag: tagify(eff.topic.label), label: eff.topic.label, about: "god", category: eff.topic.category, valence: eff.topic.valence, magnitude: eff.topic.magnitude, heat: eff.topic.magnitude * 6, startedAt: now, subject: eff.topic.subject, amount: eff.topic.amount, facts: {} };
    s.topics.push(tp);
    rip = ripple(s, tp, now, rng);
  }
  return { outcome: eff.outcome, ripple: rip };
}

/** @god types in a Lounge channel or DM — see godspeak.ts for the reaction pipeline. */
export function godSay(s: WorldState, serverId: string, channelId: string, text: string, now: number, replyTo?: string) {
  simulate(s, now);
  return godSpeak(s, serverId, channelId, text, now, replyTo);
}

/** @god edits or deletes one of his own messages. */
export function godEdit(s: WorldState, id: string, text: string | null, now: number) {
  const m = s.messages.find((x) => x.id === id) ?? s.pending.find((x) => x.id === id);
  if (!m || m.authorId !== "god") return false;
  const old = m.text;
  if (text === null) { m.deleted = true; m.text = ""; m.reactionLog = []; m.reactions = []; }
  else { m.text = text; m.editedAt = now; delete m.editText; }
  if (old && old !== text) editReact(s, m, old, text === null, now);
  const g = s.godLog.find((x) => x.id === id);
  if (g) { if (text === null) s.godLog = s.godLog.filter((x) => x.id !== id); else g.text = text; }
  return true;
}

/** @god toggles a reaction on any message. Adding one (with `now`) sets off the room. */
export function godReact(s: WorldState, id: string, emoji: string, now?: number) {
  const m = s.messages.find((x) => x.id === id) ?? s.pending.find((x) => x.id === id);
  if (!m) return 0;
  const r = m.reactions.find((x) => x.emoji === emoji);
  if (r?.me) { r.count--; r.me = false; if (r.count <= 0) m.reactions = m.reactions.filter((x) => x !== r); return 0; }
  if (r) { r.count++; r.me = true; }
  else m.reactions.push({ emoji, count: 1, me: true });
  return now === undefined ? 0 : reactCascade(s, m, emoji, now);
}

export function godPin(s: WorldState, id: string, now: number) {
  const m = s.messages.find((x) => x.id === id) ?? s.pending.find((x) => x.id === id);
  if (!m) return;
  if (m.pinnedAt && m.pinnedAt <= now) delete m.pinnedAt;
  else { m.pinnedAt = now; if (m.serverId !== "dm" && !m.pinReacted) { m.pinReacted = true; pinReact(s, m, now); } }
}

/** @god likes / reposts a post (toggle). Counts move by exactly one. */
export function godPostAction(s: WorldState, postId: string, kind: "like" | "repost") {
  const p = s.posts.find((x) => x.id === postId);
  if (!p) return;
  if (kind === "like") { p.godLiked = !p.godLiked; p.likes += p.godLiked ? 1 : -1; }
  else { p.godReposted = !p.godReposted; p.reposts += p.godReposted ? 1 : -1; }
}

/** @god posts on a platform. */
export function godPost(s: WorldState, platform: PlatformId, text: string, now: number, quoteOf?: string, replyTo?: string): RippleResult {
  simulate(s, now);
  const rng = rngFor(s.seed, "post", s.counter);
  const topic: Topic = { id: nid(s, "t"), tag: tagify(text.split(" ").slice(0, 3).join(" ")) || "NewPost", label: `god's post`, about: "god", category: "announcement", valence: 0.15, magnitude: clamp(3.5 + text.length / 120 + rng.range(0, 2), 1, 8), heat: 20, startedAt: now, subject: text.slice(0, 80), facts: {} };
  s.topics.push(topic);
  const e = engagementFor(rng, undefined, topic.heat, true, s.player.followers);
  const post: Post = { id: nid(s, "p"), platform, authorId: "god", text, t: now, topicId: topic.id, quoteOf, replyTo, ...e, score: 20 };
  s.posts.push(post);
  if (replyTo) { const parent = s.posts.find((x) => x.id === replyTo); if (parent) parent.replies++; topic.magnitude = Math.min(topic.magnitude, 3.5); }
  // real replies under god's post (the reply count is the number of stored replies)
  for (let i = 0, n = Math.round(clamp(3 + topic.magnitude, 3, 12)); i < n; i++) makePost(s, rng, now + 3000 + Math.exp(rng.gauss() * 0.8 + Math.log(40)) * 1000, { topic, platform: "chirp", replyToId: post.id });
  s.stats.posts++;
  s.player.history.push({ t: now, text: `📝 Posted on ${platform}: "${text.slice(0, 60)}"`, topicId: topic.id });
  return ripple(s, topic, now, rng);
}

// ---------- views ----------
export function channelMessages(s: WorldState, channelId: string, now: number, limit = 120): Message[] {
  const a = s.messages.filter((m) => m.channelId === channelId && !m.threadOf);
  const b = s.pending.filter((m) => m.channelId === channelId && m.t <= now && !m.threadOf);
  return [...a, ...b].sort((x, y) => x.t - y.t || (x.id < y.id ? -1 : 1)).slice(-limit);
}
export function threadMessages(s: WorldState, rootId: string, now: number): Message[] {
  return [...s.messages, ...s.pending].filter((m) => m.threadOf === rootId && m.t <= now).sort((x, y) => x.t - y.t);
}
/** who is typing in a channel right now (backed by scheduled messages) */
export function typingIn(s: WorldState, channelId: string, now: number, threadOf?: string): string[] {
  const out: string[] = [];
  for (const m of s.pending) {
    if (m.channelId !== channelId || m.t <= now || m.authorId === "god" || m.kind !== "chat" || (m.threadOf ?? undefined) !== threadOf) continue;
    const from = m.typingFrom ?? m.t - clamp(m.text.length * 60, 1200, 8000);
    if (from <= now && !out.includes(m.authorId)) out.push(m.authorId);
  }
  return out;
}
export interface UnreadInfo { n: number; mentions: number }
/** one pass over everything: unread + mention counts per channel */
export function unreadIndex(s: WorldState, now: number, lastRead: Record<string, number>, fallback: number): Map<string, UnreadInfo> {
  const out = new Map<string, UnreadInfo>();
  const godIds = new Set(s.godLog.map((g) => g.id));
  const add = (m: Message) => {
    if (m.t > now || m.authorId === "god" || m.threadOf || m.kind === "bot") return;
    if (m.t <= (lastRead[m.channelId] ?? fallback)) return;
    const u = out.get(m.channelId) ?? { n: 0, mentions: 0 };
    u.n++;
    if (m.mentionsGod || (m.replyTo && godIds.has(m.replyTo)) || (m.serverId === "dm" && m.channelId.includes("god"))) u.mentions++;
    out.set(m.channelId, u);
  };
  // messages are delivered in time order, so scan back from the end and stop once we're well past the
  // oldest read marker that matters (capped at a day; older unread isn't surfaced as a badge)
  let floor = fallback;
  for (const v of Object.values(lastRead)) if (v < floor) floor = v;
  floor = Math.max(floor, now - 24 * 3600e3) - 10 * 60e3;
  for (let i = s.messages.length - 1; i >= 0; i--) { const m = s.messages[i]; if (m.t < floor) break; add(m); }
  for (const m of s.pending) add(m);
  return out;
}
/** reactions as visible at `now` (stored + those that have landed since) */
export function reactionsAt(m: Message, now: number): Reaction[] {
  if (!m.reactionLog?.length) return m.reactions;
  const out = m.reactions.map((r) => ({ ...r }));
  for (const [e, t] of m.reactionLog) {
    if (t > now) continue;
    const r = out.find((x) => x.emoji === e);
    if (r) r.count++; else out.push({ emoji: e, count: 1 });
  }
  return out.sort((a, b) => b.count - a.count);
}
export const textAt = (m: Message, now: number) => (m.editText && m.editedAt && m.editedAt <= now ? m.editText : m.text);
export const isEdited = (m: Message, now: number) => !!m.editedAt && m.editedAt <= now;
export function pinnedIn(s: WorldState, channelId: string, now: number): Message[] {
  return [...s.messages, ...s.pending].filter((m) => m.channelId === channelId && m.pinnedAt && m.pinnedAt <= now && !m.deleted).sort((a, b) => b.pinnedAt! - a.pinnedAt!);
}
export function dmThreads(s: WorldState, now: number) {
  const map = new Map<string, Message>();
  for (const m of [...s.messages, ...s.pending]) if (m.serverId === "dm" && m.t <= now) { const c = map.get(m.channelId); if (!c || c.t < m.t) map.set(m.channelId, m); }
  return [...map.entries()].map(([channelId, last]) => ({ channelId, last, withGod: channelId.split(":").includes("god") })).sort((a, b) => b.last.t - a.last.t);
}
export function trending(s: WorldState, now: number, limit = 10) {
  const best = new Map<string, Topic>();
  for (const t of s.topics) {
    if (t.startedAt > now || t.heat <= 0.3) continue;
    const k = t.tag.toLowerCase();
    const cur = best.get(k);
    if (!cur || t.heat > cur.heat) best.set(k, t);
  }
  const top = [...best.values()].sort((a, b) => b.heat - a.heat).slice(0, limit);
  // post counts are real: stored posts + messages tagged with the topic (or its tag)
  const tags = new Map(top.map((t) => [t.tag.toLowerCase(), 0]));
  const tagOf = new Map(s.topics.map((t) => [t.id, t.tag.toLowerCase()]));
  for (const p of s.posts) { const k = p.topicId && tagOf.get(p.topicId); if (k && tags.has(k) && p.t <= now) tags.set(k, tags.get(k)! + 1); }
  for (const m of s.messages) { const k = m.topicId && tagOf.get(m.topicId); if (k && tags.has(k)) tags.set(k, tags.get(k)! + 1); }
  return top.map((t, i) => ({ topic: t, rank: i + 1, posts: tags.get(t.tag.toLowerCase()) ?? 0 }));
}
export const channelUnread = (s: WorldState, channelId: string, since: number, now: number) =>
  s.messages.filter((m) => m.channelId === channelId && m.t > since && !m.threadOf).length + s.pending.filter((m) => m.channelId === channelId && m.t > since && m.t <= now && !m.threadOf).length;

/** Seed the very first world with some history so it never opens empty. */
export function bootstrap(s: WorldState, now: number, hours = 3, opts: { defer?: boolean } = {}) {
  const rng = rngFor(s.seed, "boot");
  const start = Math.floor((now - hours * HOUR) / BUCKET) * BUCKET;
  s.simTime = start;
  for (let i = 0; i < 4; i++) { const c = celebPick(s, rng); s.topics.push(worldTopic(rng, nid(s, "t"), start, c.displayName, c.id)); }
  for (let i = 0; i < 2; i++) { const c = celebPick(s, rng); s.topics.push(autoGodTopic(rng, nid(s, "t"), start, c.displayName, c.id)); }
  s.topics.push({ id: nid(s, "t"), tag: "CreativeMode", label: "the 'creative mode' post", about: "god", category: "viral", valence: 0.4, magnitude: 5, heat: 14, startedAt: start, subject: "life is easier on creative mode", facts: {} });
  spawnEvent(s, rng, start + HOUR);
  if (!opts.defer) simulate(s, now, { full: true });
  s.lastSeenAt = now;
  return s;
}
