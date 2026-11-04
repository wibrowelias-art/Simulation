import { rngFor, type Rng } from "./rng";
import type { BusEvent, Channel, Character, Message, Obsession, Post, Server, Topic, WorldState } from "./types";
import { charById, netWorth } from "./world";
import { clamp, diurnal, engagementFor, makeArticle, makePost, memeFor, nid, notify, rememberText, runEpisode, seenText } from "./engine";
import { MEME_LINES } from "./memes";
import { expand, type Slots } from "./grammar";
import { styleText, typo } from "./style";
import { obsessionOf } from "./social";
import { getGenerator, slotsFor } from "./generator";
import { fmtMoney } from "./format";
import { crewDmReply, crewRole } from "./undernet";
import { COMMAND_BANK, PRESENCE_LINES, findMentioned, godStopTyping, parseCommand } from "./presence";
import { tagify, COINS } from "./topics";
import { AMBIENT, BY_OBSESSION, CHAIN, DM_OPEN, DM_REPLY, ECHO_OPEN, ECHO_REPLY, FREAK, FREAK_OTHERS, HYPE, LEAD, TO_GOD, type GodIntent } from "./godlines";

const SEC = 1000, MIN = 60_000;

// ---------------------------------------------------------------- intent parsing
const STOP = new Set("the a an and or but if then so to of in on at for with from by is are was were be been am i you we they he she it my your our their me us them this that these those just really very what who why how when where do does did can could should would will im i'm its it's dont don't guys yall y'all hey hi yo sup lol lmao ok okay today now here there about all any some get got".split(" "));

export interface ParsedGod { intent: GodIntent; keywords: string[]; question: boolean; mentions: string[]; coin?: string; quote: string }

export function parseGodText(text: string): ParsedGod {
  const t = text.toLowerCase().trim();
  const coin = text.match(/\$([A-Za-z]{2,8})\b/)?.[1]?.toUpperCase() ?? COINS.find((c) => t.includes(c.toLowerCase()));
  const question = /\?\s*$/.test(t) || /^(who|what|why|how|when|where|should|do|does|is|are|can|would|anyone|which|wanna)\b/.test(t);
  const mentions = [...text.matchAll(/@([\w.]+)/g)].map((m) => m[1].toLowerCase()).filter((m) => m !== "god");
  const has = (re: RegExp) => re.test(t);
  let intent: GodIntent;
  if (has(/\b(gn|good ?night|bye|cya|later guys|gotta go|brb|logging off|peace out)\b/)) intent = "farewell";
  else if (coin || has(/\b(crypto|coins?|tokens?|btc|eth|pump|moon(ing)?|wallet|chart|hodl|memecoin)\b/)) intent = "crypto";
  else if (has(/\b(bought|buying|buy|purchased|acquired|picked up|just got|ordered|shopping)\b/)) intent = "purchase";
  else if (has(/\b(announc\w*|launch\w*|big news|dropping|coming soon|stay tuned|reveal|tomorrow)\b/) || t.startsWith("!")) intent = "announcement";
  else if (has(/\b(love (you|y'?all|this|u)|proud of|thank(s| you)|appreciate|best (community|server)|you guys rock|ily)\b/)) intent = "compliment";
  else if (has(/\b(mid|cringe|clowns?|losers?|haters?|broke|cope|seethe|shut up)\b/)) intent = "insult";
  else if (has(/\b(tired|sad|rough|lonely|bad day|stress\w*|exhausted|bored)\b/)) intent = "sad";
  else if (question) intent = "question";
  else if (has(/^(yo+|sup|hey+|hi+|hello|gm|good morning|wass?up|whats? up|what's good|evening|howdy|hola)\b/) || has(/\b(sup guys|hey guys|hi guys|hello everyone)\b/)) intent = "greeting";
  else if (has(/\b(billion|million|yacht|jet|island|lambo|penthouse|rich|net worth|private|mansion|ferrari)\b/)) intent = "flex";
  else if (has(/\b(lol|lmao|haha|joke|jk|💀|😂)/)) intent = "joke";
  else if (has(/!{2,}|\b(let'?s go+|lfg|huge|insane|we('re| are) so back)\b/)) intent = "hype";
  else intent = "generic";
  const keywords = t.replace(/[^a-z0-9$#@ ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w) && !w.startsWith("@")).slice(0, 4);
  const quote = text.trim().length > 56 ? text.trim().slice(0, 53).replace(/\s+\S*$/, "") + "…" : text.trim();
  return { intent, keywords, question, mentions, coin, quote };
}

// ---------------------------------------------------------------- helpers
const REACT_EMOJI: Record<Obsession, string[]> = {
  obsessed: ["👑", "😭", "🔥", "🙏", "🐐", "💯", "🫡", "❤️"], supporter: ["👑", "🔥", "😭", "👋", "🙌", "❤️"], business: ["📈", "👀", "🧠", "🤝", "💰"],
  skeptic: ["🤨", "👀", "🧐"], rival: ["🙄", "👀", "😐"], hater: ["🤡", "🥱", "💀", "🙄"], indifferent: ["👋", "👀"],
};
const INTENT_EMOJI: Partial<Record<GodIntent, string[]>> = { greeting: ["👋", "👋", "🫡"], joke: ["😂", "💀"], crypto: ["🚀", "📈"], purchase: ["💸", "🤑"], sad: ["🫂", "❤️"], compliment: ["🥹", "❤️"], announcement: ["👀", "🚨"], farewell: ["👋", "😭"], flex: ["💸", "🤯"] };

const isCaps = (s: string) => /[A-Z]/.test(s) && !/[a-z]/.test(s.replace(/@[\w.]+|\{[a-z]+\}/gi, ""));
const fanish = (o: Obsession) => o === "obsessed" || o === "supporter";
const negish = (o: Obsession) => o === "hater" || o === "rival";

function srvChan(s: WorldState, serverId: string, channelId: string) {
  const srv = s.servers.find((x) => x.id === serverId);
  return { srv, ch: srv?.channels.find((c) => c.id === channelId) };
}

export function pastGodLine(s: WorldState, rng: Rng, excludeId?: string) {
  const prior = s.godLog.filter((g) => g.id !== excludeId && g.serverId !== "dm"); // never quote DMs in public
  if (prior.length) {
    const g = rng.pick(prior.slice(-12));
    const { srv, ch } = srvChan(s, g.serverId, g.channelId);
    return { text: g.text.length > 44 ? g.text.slice(0, 41) + "…" : g.text, where: srv && ch ? `${srv.name} #${ch.name}` : "DMs" };
  }
  const h = s.player.history.filter((x) => x.text.startsWith("📝")).slice(-6);
  if (h.length) return { text: rng.pick(h).text.replace(/^📝 Posted on \w+: "/, "").replace(/"$/, "").slice(0, 44), where: "Chirp" };
  return { text: "life is easier on creative mode", where: "Chirp" };
}

interface Ctx { s: WorldState; rng: Rng; srv: Server; ch: Channel; god: Message; p: ParsedGod; now: number; topic: Topic }

function slots(x: Ctx, c: Character, user?: Character, extra: Slots = {}): Slots {
  const { s, rng, p, srv, ch } = x;
  const past = pastGodLine(s, rng, x.god.id);
  const mem = c.memory.length ? rng.pick(c.memory).label : undefined;
  const hold = s.player.holdings.length ? rng.pick(s.player.holdings).name : "the empire";
  return slotsFor(rng, s, c, undefined, {
    q: p.quote, Q: p.quote.toUpperCase(), kw: p.keywords.length ? rng.pick(p.keywords) : p.quote.split(" ")[0] || "that",
    coin: p.coin ?? (s.player.holdings.find((h) => h.kind === "coin")?.name.replace(/^\$/, "") ?? rng.pick(COINS)), ch: ch.name, server: srv.name, user: user?.username ?? "someone",
    past: past.text, pastwhere: past.where, mem: mem ?? `the ${hold} thing`, holding: hold, nw: fmtMoney(netWorth(s)), here: srv.name, ...extra,
  });
}

/** fill + voice + dedupe (global window + this character's own recent lines). */
export function line(s: WorldState, rng: Rng, c: Character, banks: string[], sl: Slots, opts: { lead?: string[]; keepCaps?: boolean } = {}): string {
  let best = "";
  for (let k = 0; k < 7; k++) {
    let raw = expand(rng.pick(banks), sl, rng);
    if (opts.lead && rng.chance(0.4)) {
      const l = expand(rng.pick(opts.lead), sl, rng);
      raw = isCaps(l) && !isCaps(raw) && rng.chance(0.5) ? `${l} ${raw.toUpperCase()}` : `${l} ${raw}`;
    }
    const caps = isCaps(raw);
    let text = caps ? raw : styleText(rng, c, raw, { short: true, allowTypo: false }).text;
    if (caps && rng.chance(0.35)) text += " " + rng.pick(c.emojis);
    if (caps && rng.chance(0.25)) text = text.replace(/([A-Z])$/, (m) => m + m.repeat(rng.int(1, 4)));
    best = text;
    if (!seenText(s, text)) break;
  }
  const gen = getGenerator();
  if (gen.react) best = gen.react({ rng, state: s, speaker: c, draft: best, godText: String((sl as Record<string, unknown>).q ?? "") }) || best;
  rememberText(s, best);
  return best;
}

function audience(x: Ctx, weightFor: (o: Obsession, c: Character) => number, exclude: Set<string>, t: number): Character | undefined {
  const pool = x.srv.members.filter((id) => !exclude.has(id));
  if (!pool.length) return undefined;
  const id = x.rng.weighted(pool, (id) => {
    const c = charById(x.s, id);
    return weightFor(obsessionOf(c), c) * (0.25 + diurnal(c, t)) * Math.sqrt(c.activity) * (c.core ? 3 : 1) * (1 + (c.bond ?? 0) / 40);
  });
  return charById(x.s, id);
}

class Burst {
  msgs: Message[] = [];
  cur: number;
  constructor(public x: Ctx, start: number) { this.cur = start; }
  push(c: Character, text: string, o: { replyTo?: string; intent: string; gap?: [number, number]; typingStart?: number; threadOf?: string } ) {
    const { s, rng, srv, ch } = this.x;
    if (o.gap) this.cur += rng.range(o.gap[0], o.gap[1]);
    const typeDur = clamp(text.length * rng.range(38, 75), 900, 7000);
    const t = Math.round(this.cur);
    const m: Message = {
      id: nid(s, "m"), episodeId: this.x.god.id, serverId: srv.id, channelId: ch.id, authorId: c.id, text, t, topicId: this.x.topic.id, replyTo: o.replyTo,
      reactions: [], kind: "chat", intent: o.intent, score: 1 + (c.core ? 1 : 0), typingFrom: Math.round(o.typingStart ?? Math.max(this.x.now + 400, t - typeDur)),
      mentionsGod: /@god\b/i.test(text) || o.replyTo === this.x.god.id || undefined, threadOf: o.threadOf,
    };
    // characters occasionally fix a typo by editing instead of sending "*word"
    if (!isCaps(text) && rng.chance(0.07)) {
      const ty = typo(rng, text);
      if (ty.word) { m.editText = text; m.text = ty.text; m.editedAt = t + Math.round(rng.range(3, 14) * SEC); }
    }
    this.msgs.push(m);
    s.stats.messages++;
    c.postCount++;
    return m;
  }
}

/** @god talks in a Lounge channel or DM. Builds the whole reaction up front, timed from `now`. */
export function godSpeak(s: WorldState, serverId: string, channelId: string, text: string, now: number, replyTo?: string): { message: Message; replies: number; reactions: number; servers: string[] } {
  const p = parseGodText(text);
  const god: Message = { id: nid(s, "m"), serverId, channelId, authorId: "god", text, t: now, reactions: [], reactionLog: [], kind: "chat", score: 50, replyTo, intent: `god:${p.intent}` };
  s.pending.push(god);
  s.stats.messages++;
  s.godLog.push({ id: god.id, t: now, text, serverId, channelId, intent: p.intent });
  if (s.godLog.length > 60) s.godLog.splice(0, s.godLog.length - 60);
  godStopTyping(s, channelId, now);
  if (serverId === "dm") return { message: god, replies: dmReply(s, god, p, now), reactions: 0, servers: [] };

  const { srv, ch } = srvChan(s, serverId, channelId);
  if (!srv || !ch) return { message: god, replies: 0, reactions: 0, servers: [] };
  const rng = rngFor(s.seed, "speak", god.id);
  const topic: Topic = { id: nid(s, "t"), tag: tagify(`God In ${srv.name}`), label: `god chatting in ${srv.name}`, about: "god", category: "chat", valence: 0.15, magnitude: 2.5, heat: 6, startedAt: now, subject: p.quote, facts: {} };
  s.topics.push(topic);
  god.topicId = topic.id;
  const x: Ctx = { s, rng, srv, ch, god, p, now, topic };
  const act = clamp(s.settings.activity, 0.4, 3);

  const target = replyTo ? [...s.messages, ...s.pending].find((m) => m.id === replyTo) : undefined;
  // direct address: a reply, or an @mention of someone (in this server first, then anywhere)
  const targetChar = target && target.authorId.startsWith("c") ? charById(s, target.authorId) : findMentioned(s, p.mentions, srv);
  const cmd = targetChar ? parseCommand(text) : undefined;
  const b = new Burst(x, now + rng.range(1.6, 2.6) * SEC);
  const spoke = new Map<string, number>();
  const say = (c: Character, txt: string, o: Parameters<Burst["push"]>[2]) => { spoke.set(c.id, (spoke.get(c.id) ?? 0) + 1); return b.push(c, txt, o); };

  // --- @god replied to a specific character: they freak out first, others react to *that*
  if (targetChar) {
    const ob = obsessionOf(targetChar);
    const P = PRESENCE_LINES;
    const roastee = cmd?.kind === "roast" ? findMentioned(s, [cmd.target ?? ""], srv) : undefined;
    const firstBank = cmd ? COMMAND_BANK[cmd.kind] : !target ? (negish(ob) ? P.addressedNeg : P.addressed) : FREAK[ob];
    const first = say(targetChar, line(s, rng, targetChar, firstBank, slots(x, targetChar, roastee, { target: roastee ? `@${roastee.username}` : cmd?.target ?? "you" }), { keepCaps: true }), { replyTo: god.id, intent: cmd ? `cmd:${cmd.kind}` : "addressed", typingStart: now + rng.range(0.15, 0.3) * SEC, gap: [-1.2 * SEC, -0.8 * SEC] });
    if (cmd?.kind === "meme") first.meme = memeFor(s, rng, targetChar, topic, text);
    if (cmd) {
      (s.godMoments ??= []).push({ t: now, kind: "command", text: `You asked @${targetChar.username} to ${cmd.kind === "hi" ? "say hi" : cmd.kind === "roast" ? `roast ${cmd.target}` : cmd.kind === "defend" ? "defend you" : cmd.kind === "meme" ? "drop a meme" : cmd.kind === "joke" ? "tell a joke" : "do something"}. They did`, link: `lounge:${srv.id}:${ch.id}` });
      if (roastee && roastee.id !== targetChar.id) say(roastee, line(s, rng, roastee, P.cmdRoastBack, slots(x, roastee, targetChar)), { replyTo: first.id, intent: "roasted", gap: [1.5 * SEC, 3 * SEC] });
    } else if (fanish(ob) && rng.chance(0.6)) say(targetChar, line(s, rng, targetChar, FREAK[ob], slots(x, targetChar)), { intent: "freak", gap: [1.2 * SEC, 3 * SEC] });
    // others comment on the exchange
    for (let i = 0, n = rng.int(1, 2); i < n; i++) {
      const w = audience(x, (o2) => (fanish(o2) ? 3 : 1), new Set([targetChar.id]), b.cur);
      if (w) say(w, line(s, rng, w, P.watchers, slots(x, w, targetChar)), { intent: "watch", gap: [0.6 * SEC, 1.8 * SEC] });
    }
    const nOthers = Math.round(rng.range(3, 6) * Math.sqrt(act));
    for (let i = 0; i < nOthers; i++) {
      const o = audience(x, (ob2) => (fanish(ob2) ? 3 : negish(ob2) ? 1.5 : 1), new Set([targetChar.id]), b.cur);
      if (!o) break;
      say(o, line(s, rng, o, FREAK_OTHERS, slots(x, o, targetChar)), { replyTo: rng.chance(0.4) ? first.id : undefined, intent: "noticed", gap: [0.8 * SEC, 3.5 * SEC], typingStart: i < 3 ? now + rng.range(0.8, 2.2) * SEC : undefined });
    }
    targetChar.bond = clamp((targetChar.bond ?? 0) + 15, 0, 100);
    targetChar.opinion = clamp(targetChar.opinion + (negish(ob) ? 8 : 5), -100, 100);
    (targetChar.godContacts ??= []).push({ t: now, kind: "replied", text: p.quote, where: `${srv.name} #${ch.name}` });
    if (targetChar.godContacts.length > 10) targetChar.godContacts.shift();
  }

  // --- wave 1: several people start typing within 1-3s, hype lands in a burst
  const wave1 = targetChar ? rng.int(2, 3) : rng.int(3, 5);
  const firstWave: Message[] = [];
  for (let i = 0; i < wave1; i++) {
    const c = audience(x, (o) => ({ obsessed: 6, supporter: 3, business: 1, skeptic: 0.6, rival: 0.7, hater: 0.8, indifferent: 0.2 })[o], new Set(spoke.keys()), b.cur);
    if (!c) break;
    const ob = obsessionOf(c);
    const r = rng.next();
    const bank = fanish(ob) ? (r < 0.35 ? LEAD[ob] : r < 0.65 ? TO_GOD[p.intent] : HYPE) : r < 0.6 ? BY_OBSESSION[ob] : LEAD[ob];
    if (i === 1 && firstWave[0] && firstWave[0].authorId.startsWith("c")) {
      // the second voice answers the first: character-to-character from the very first seconds
      const B = charById(s, firstWave[0].authorId), obB = obsessionOf(B);
      const chainBank = fanish(ob) && negish(obB) ? CHAIN.fanToHater : negish(ob) && fanish(obB) ? CHAIN.haterToFan : fanish(ob) && fanish(obB) ? CHAIN.fanToFan : CHAIN.noticed;
      firstWave.push(say(c, line(s, rng, c, chainBank, slots(x, c, B)), { replyTo: firstWave[0].id, intent: "chain", gap: [0.4 * SEC, 1.1 * SEC], typingStart: now + rng.range(0.5, 1.6) * SEC }));
      continue;
    }
    const txt = line(s, rng, c, bank, slots(x, c), { lead: bank === LEAD[ob] ? undefined : LEAD[ob] });
    firstWave.push(say(c, txt, { replyTo: i === 0 || rng.chance(0.4) ? god.id : undefined, intent: "hype", gap: i ? [0.5 * SEC, 1.6 * SEC] : undefined, typingStart: now + rng.range(0.5, 2.2) * SEC }));
  }

  // --- main burst: contextual replies, chains between characters, memories, drift
  const total = Math.round(clamp((9 + srv.bias * 8 + rng.poisson(3)) * act, 6, 30));
  let conflicts = 0, modded = false, drifted = 0;
  for (let i = 0; i < total; i++) {
    const r = rng.next();
    const prev = b.msgs.length ? b.msgs[b.msgs.length - 1] : god;
    const gap: [number, number] = i < 6 ? [0.9 * SEC, 3.2 * SEC] : [1.8 * SEC, 7 * SEC];
    if (conflicts >= 2 && !modded && srv.moderators.length) {
      modded = true;
      const mod = charById(s, rng.pick(srv.moderators));
      const m = b.push(mod, line(s, rng, mod, CHAIN.mod, slots(x, mod)), { intent: "mod", gap });
      m.kind = "system";
      continue;
    }
    if (r < 0.24) {
      // direct, contextual reply to what god said
      const c = audience(x, (o) => ({ obsessed: 4, supporter: 3, business: 2, skeptic: 1, rival: 0.6, hater: 0.6, indifferent: 0.3 })[o], new Set(), b.cur);
      if (!c) continue;
      say(c, line(s, rng, c, TO_GOD[p.intent], slots(x, c)), { replyTo: rng.chance(0.5) ? god.id : undefined, intent: "toGod", gap });
    } else if (r < 0.42) {
      const c = audience(x, (o) => ({ obsessed: 2, supporter: 1.5, business: 1.5, skeptic: 1.6, rival: 1.6, hater: 1.8, indifferent: 0.5 })[o], new Set(), b.cur);
      if (!c) continue;
      const ob = obsessionOf(c);
      say(c, line(s, rng, c, BY_OBSESSION[ob], slots(x, c)), { replyTo: ob === "business" && rng.chance(0.4) ? god.id : undefined, intent: `stance:${ob}`, gap });
    } else if (r < 0.7 && b.msgs.length) {
      // character → character
      const pick = rng.chance(0.6) ? prev : rng.pick(b.msgs);
      if (pick.authorId === "god" || !pick.authorId.startsWith("c")) continue;
      const B = charById(s, pick.authorId), ob = obsessionOf(B);
      const A = audience(x, (o) => (fanish(ob) ? (negish(o) || o === "skeptic" ? 3 : fanish(o) ? 2 : 0.5) : negish(ob) ? (fanish(o) ? 4 : 0.5) : 1), new Set([B.id]), b.cur);
      if (!A) continue;
      const oa = obsessionOf(A);
      let bank: string[];
      if (fanish(oa) && negish(ob)) { bank = CHAIN.fanToHater; conflicts++; }
      else if (negish(oa) && fanish(ob)) { bank = CHAIN.haterToFan; conflicts++; }
      else if (oa === "skeptic" && fanish(ob)) bank = CHAIN.skepticToFan;
      else if (fanish(oa) && fanish(ob)) bank = rng.chance(0.7) ? CHAIN.fanToFan : CHAIN.noticed;
      else bank = CHAIN.noticed;
      say(A, line(s, rng, A, bank, slots(x, A, B)), { replyTo: rng.chance(0.75) ? pick.id : undefined, intent: "chain", gap });
      if (rng.chance(0.25)) (pick.reactionLog ??= []).push([rng.pick(negish(oa) ? ["💀", "🤡"] : ["😭", "💯", "🔥"]), Math.round(b.cur + rng.range(1, 6) * SEC), A.id]);
    } else if (r < 0.78) {
      const c = audience(x, (o) => (fanish(o) ? 2 : o === "business" ? 1.5 : 0.6), new Set(), b.cur);
      if (!c) continue;
      say(c, line(s, rng, c, CHAIN.memory, slots(x, c)), { intent: "memory", gap });
    } else if (r < 0.85) {
      const c = audience(x, (o) => (fanish(o) || o === "business" ? 2 : 0.5), new Set(), b.cur);
      if (!c) continue;
      say(c, line(s, rng, c, CHAIN.upTo, slots(x, c)), { replyTo: rng.chance(0.3) ? god.id : undefined, intent: "upTo", gap });
    } else if (r < 0.92) {
      const late = audience(x, () => 1, new Set(spoke.keys()), b.cur);
      if (!late) continue;
      const q = say(late, line(s, rng, late, CHAIN.catchUp, slots(x, late)), { intent: "catchUp", gap });
      const ans = audience(x, (o) => (fanish(o) ? 2 : 1), new Set([late.id]), b.cur);
      if (ans) say(ans, line(s, rng, ans, CHAIN.catchUpAnswer, slots(x, ans, late)), { replyTo: q.id, intent: "answer", gap: [1.5 * SEC, 5 * SEC] });
    } else if (i > total / 2 && drifted < 2) {
      drifted++;
      const c = audience(x, (o) => (o === "indifferent" ? 4 : negish(o) ? 1.5 : 0.6), new Set(), b.cur);
      if (!c) continue;
      say(c, line(s, rng, c, CHAIN.drift, slots(x, c)), { intent: "drift", gap });
    } else {
      // self follow-up burst
      const last = b.msgs[b.msgs.length - 1];
      if (!last || !last.authorId.startsWith("c")) continue;
      const c = charById(s, last.authorId);
      say(c, line(s, rng, c, fanish(obsessionOf(c)) ? HYPE : BY_OBSESSION[obsessionOf(c)], slots(x, c)), { intent: "followup", gap: [0.7 * SEC, 2.2 * SEC] });
    }
  }
  // --- tail: "is he still here?"
  for (let i = 0, n = rng.int(1, 3); i < n; i++) {
    const c = audience(x, (o) => (fanish(o) ? 2 : 1), new Set(), b.cur);
    if (c) say(c, line(s, rng, c, rng.chance(0.65) ? CHAIN.still : CHAIN.drift, slots(x, c)), { intent: "still", gap: [25 * SEC, 110 * SEC] });
  }

  // --- a thread under god's message for the decoders
  if (["announcement", "question", "crypto", "purchase", "flex", "generic"].includes(p.intent) && rng.chance(0.55)) {
    let tt = now + rng.range(12, 40) * SEC;
    const THREAD = ["thread for decoding \"{q}\"", "my theory: it's about {kw}", "he used the word \"{kw}\". that's not random", "you're all overthinking it", "saving this for the history books",
      "ok but the timing right after {world}?", "@god if you're reading the thread, blink twice", "i give it 48h before something drops", "his last message was \"{past}\". connect the dots", "or he was just bored"];
    for (let i = 0, n = rng.int(3, 7); i < n; i++) {
      const c = audience(x, (o) => (o === "business" || o === "skeptic" ? 2.5 : fanish(o) ? 1.6 : 0.7), new Set(), tt);
      if (!c) break;
      const m = b.push(c, line(s, rng, c, THREAD, slots(x, c)), { intent: "thread", threadOf: god.id });
      m.t = Math.round(tt); m.typingFrom = Math.round(tt - 3000); tt += rng.range(8, 50) * SEC;
    }
  }

  // --- reactions pile onto god's message over the next minutes (each one by a real member)
  const nReact = Math.round(clamp((6 + srv.bias * 14 + b.msgs.length * 0.9) * act * rng.range(0.8, 1.3), 5, 70));
  const reactors = rng.shuffle(srv.members.slice()).slice(0, nReact);
  for (const id of reactors) {
    const c = charById(s, id), ob = obsessionOf(c);
    const pool = INTENT_EMOJI[p.intent] && rng.chance(0.35) ? INTENT_EMOJI[p.intent]! : REACT_EMOJI[ob];
    god.reactionLog!.push([rng.pick(pool), Math.round(now + 1200 + Math.min(240, -Math.log(1 - rng.next()) * 22) * SEC), id]);
  }
  god.reactionLog!.sort((a, c) => a[1] - c[1]);
  for (const m of firstWave) if (rng.chance(0.5)) (m.reactionLog ??= []).push([rng.pick(["😭", "💀", "🔥", "💯"]), Math.round(m.t + rng.range(2, 15) * SEC), rng.pick(srv.members)]);

  // --- mods pin it in fan servers
  if (srv.bias >= 0.3 && srv.moderators.length && !targetChar && rng.chance(0.7)) {
    const mod = charById(s, rng.pick(srv.moderators));
    god.pinnedAt = Math.round(now + rng.range(25, 90) * SEC);
    b.msgs.push({ id: nid(s, "m"), serverId: srv.id, channelId: ch.id, authorId: mod.id, text: "pinned a message to this channel.", t: god.pinnedAt, reactions: [], kind: "system", intent: "pin", score: 0.1, replyTo: god.id });
  }
  // --- someone already made a meme out of it
  const mr = rngFor(s.seed, "godmeme", god.id);
  if (mr.chance(0.75)) {
    const mc = audience(x, (o) => (fanish(o) ? 2 : negish(o) ? 1.2 : 0.4) * 1, new Set(), now);
    if (mc) {
      const t = Math.round(now + mr.range(9, 24) * SEC);
      b.msgs.push({ id: nid(s, "m"), episodeId: god.id, serverId: srv.id, channelId: ch.id, authorId: mc.id, text: mr.pick(["already made the meme", ...MEME_LINES]), t, typingFrom: t - 2500, topicId: topic.id,
        reactions: [], reactionLog: [[mr.pick(["😭", "💀", "🔥"]), t + 3000, mr.pick(srv.members)], ["😂", t + 6000, mr.pick(srv.members)]], kind: "chat", intent: "meme", score: 3, meme: memeFor(s, mr, mc, topic, text) });
    }
  }
  s.pending.push(...b.msgs);

  // --- notifications (timed, so the badge ticks up live)
  const toGod = b.msgs.filter((m) => m.mentionsGod && !m.threadOf).sort((a, c) => a.t - c.t);
  for (const m of toGod.slice(0, 3)) notify(s, m.t, "mention", `@${charById(s, m.authorId).username} ${m.replyTo === god.id ? "replied to you" : "mentioned you"} in ${srv.name} #${ch.name}: "${(m.editText ?? m.text).slice(0, 70)}"`, `lounge:${srv.id}:${ch.id}`);
  if (toGod.length > 3) notify(s, toGod[toGod.length - 1].t, "mention", `${toGod.length} people replied to or mentioned you in ${srv.name} #${ch.name}`, `lounge:${srv.id}:${ch.id}`);
  const last60 = god.reactionLog!.filter((r) => r[1] <= now + 60 * SEC).length;
  if (last60 >= 5) notify(s, now + 60 * SEC, "mention", `Your message in #${ch.name} got ${last60} reactions in the first minute`, `lounge:${srv.id}:${ch.id}`);

  // --- relationships evolve
  const delta = ({ compliment: 2.5, greeting: 1.2, joke: 1, hype: 1, insult: -3, flex: 0.4, sad: 1.5 } as Partial<Record<GodIntent, number>>)[p.intent] ?? 0.6;
  for (const [id, n] of spoke) {
    const c = charById(s, id);
    c.bond = clamp((c.bond ?? 0) + 1 + n * 0.5, 0, 100);
    c.opinion = clamp(c.opinion + delta * (negish(obsessionOf(c)) ? 0.4 : 1), -100, 100);
    if (c.core) {
      (c.godContacts ??= []).push({ t: now, kind: "saw", text: p.quote, where: `${srv.name} #${ch.name}` });
      if (c.godContacts.length > 10) c.godContacts.shift();
    }
    c.memory.unshift({ topicId: topic.id, label: `god saying "${p.quote}" in #${ch.name}`, feeling: fanish(obsessionOf(c)) ? 0.8 : -0.2, t: now });
    if (c.memory.length > 6) c.memory.pop();
  }

  // --- shared event bus: the rest of the internet hears about it
  const others = s.servers.filter((o) => o.id !== srv.id);
  const nEcho = Math.round(clamp(2 + srv.bias * 2 + (act - 1), 1, 5));
  const echoSrv = rng.shuffle(others.slice()).sort((a, c) => (c.tags.includes("god") ? 1 : 0) + c.bias - ((a.tags.includes("god") ? 1 : 0) + a.bias)).slice(0, nEcho + 2);
  const chosen = rng.shuffle(echoSrv).slice(0, nEcho);
  chosen.forEach((o, i) => schedule(s, { kind: "echo", t: Math.round(now + (35 + i * rng.range(20, 90)) * SEC), topicId: topic.id, data: { server: o.id, from: srv.id, ch: ch.id, q: p.quote, god: god.id } }));
  if (rng.chance(0.85)) schedule(s, { kind: "screenshot", t: Math.round(now + rng.range(50, 160) * SEC), topicId: topic.id, data: { from: srv.id, ch: ch.id, q: p.quote, replies: toGod.length } });
  const dmFrom = [...spoke.keys()].map((id) => charById(s, id)).filter((c) => c.core || fanish(obsessionOf(c)) || obsessionOf(c) === "business");
  if (dmFrom.length && rng.chance(0.6)) schedule(s, { kind: "godDm", t: Math.round(now + rng.range(1.5, 7) * MIN), data: { who: rng.pick(dmFrom).id, from: srv.id, ch: ch.id } });
  return { message: god, replies: b.msgs.length, reactions: god.reactionLog!.length, servers: chosen.map((o) => o.name) };
}

function schedule(s: WorldState, ev: Omit<BusEvent, "id">) {
  s.bus.push({ id: nid(s, "v"), ...ev });
}

// ---------------------------------------------------------------- DMs
export const dmChannel = (a: string, b: string) => `dm:${[a, b].sort().join(":")}`;
export const dmPeer = (channelId: string, me = "god") => channelId.split(":").slice(1).find((x) => x !== me) ?? me;
const DM_SERVER = (members: string[], channelId: string): { srv: Server; ch: Channel } => {
  const ch: Channel = { id: channelId, name: "dm", topic: "", tags: ["life", "god"] };
  return { srv: { id: "dm", name: "Direct Messages", icon: "✉️", color: "#888", description: "", bias: 0, vibe: "culture", tags: ["life"], memberCount: 2, channels: [ch], members, moderators: [], insideJokes: [] }, ch };
};

function dmMsg(s: WorldState, channelId: string, authorId: string, text: string, t: number, typingFrom?: number): Message {
  return { id: nid(s, "m"), serverId: "dm", channelId, authorId, text, t: Math.round(t), reactions: [], kind: "chat", score: 2, typingFrom: typingFrom ? Math.round(typingFrom) : Math.round(t - clamp(text.length * 60, 1000, 6000)), mentionsGod: authorId !== "god" && channelId.includes("god") || undefined };
}

const CROWD = /\b(he|him|his|he's|hes|everyone|everybody|chat|guys|y'all|yall|we have to|clip it|this man|server)\b/i;
function dmReply(s: WorldState, god: Message, p: ParsedGod, now: number) {
  const peer = dmPeer(god.channelId);
  if (!peer.startsWith("c")) return 0;
  const c = charById(s, peer), ob = obsessionOf(c);
  if (crewRole(s, c.id)) {
    const crew = crewDmReply(s, c, god.text, now, god.id);
    for (const m of crew) notify(s, m.t, "mention", `New message from @${c.username}: "${m.text.slice(0, 60)}"`, `lounge:dm:${god.channelId}`);
    (c.godContacts ??= []).push({ t: now, kind: "dm", text: p.quote, where: "DMs" });
    return crew.length;
  }
  const rng = rngFor(s.seed, "dm", god.id);
  const first = !(c.godContacts ?? []).some((g) => g.kind === "dm");
  const awake = diurnal(c, now) > 0.35;
  const cmd = parseCommand(god.text);
  let t = now + (awake ? rng.range(1.5, 4) * SEC : rng.range(15, 60) * SEC);
  const sl = slotsFor(rng, s, c, undefined, { q: p.quote, Q: p.quote.toUpperCase(), kw: p.keywords[0] ?? "that", holding: s.player.holdings[0]?.name ?? "the empire", coin: p.coin ?? "GOD", ch: "dm", server: "DMs", user: c.username, past: pastGodLine(s, rng, god.id).text, pastwhere: "DMs", mem: c.memory[0]?.label ?? "that day", nw: fmtMoney(netWorth(s)), here: "DMs" });
  const out: Message[] = [];
  const n = rng.int(1, fanish(ob) ? 3 : 2);
  for (let i = 0; i < n; i++) {
    // one-on-one: drop crowd lines ("everyone shut up he asked...") that only make sense in a server
    const one = (l: string) => !CROWD.test(l);
    const pool = (i === 0 && first ? DM_REPLY[ob] : TO_GOD[p.intent]).filter(one).map((l) => l.replace(/@god\b[,!]*\s*/gi, ""));
    const bank = i === 0 && cmd ? COMMAND_BANK[cmd.kind] : pool.length ? pool : DM_REPLY[ob];
    if (i === 0 && cmd?.kind === "roast") sl.target = cmd.target ?? "that guy";
    const text = line(s, rng, c, bank, sl).replace(/@god\b[,!]*\s*/gi, "").replace(/^\s+/, "") || "hm";
    const dmm = dmMsg(s, god.channelId, c.id, text, t, i === 0 ? Math.max(now + 400, t - rng.range(2, 5) * SEC) : undefined);
    if (i === 0 && cmd?.kind === "meme") dmm.meme = memeFor(s, rng, c, undefined, god.text);
    out.push(dmm);
    t += rng.range(2, 9) * SEC;
  }
  s.pending.push(...out);
  for (const m of out) notify(s, m.t, "mention", `New message from @${c.username}: "${m.text.slice(0, 60)}"`, `lounge:dm:${god.channelId}`);
  c.bond = clamp((c.bond ?? 0) + 6, 0, 100);
  c.opinion = clamp(c.opinion + (negish(ob) ? 3 : 2), -100, 100);
  (c.godContacts ??= []).push({ t: now, kind: "dm", text: p.quote, where: "DMs" });
  if (c.godContacts.length > 10) c.godContacts.shift();
  return out.length;
}

/** two characters DM each other (often about god). @god can read everything. */
export function ambientDm(s: WorldState, rng: Rng, t: number) {
  const pool = s.characters.filter((c) => c.core && c.friends.length);
  if (!pool.length) return;
  const a = rng.weighted(pool, (c) => diurnal(c, t));
  const b = charById(s, rng.pick(a.friends));
  const chId = dmChannel(a.id, b.id);
  const { srv, ch } = DM_SERVER([a.id, b.id], chId);
  const tp = s.topics.filter((x) => x.about === "god" && x.heat > 1);
  runEpisode(s, rng, srv, ch, t, tp.length && rng.chance(0.6) ? rng.pick(tp) : undefined, { starter: a, minLen: 2 });
}

// ---------------------------------------------------------------- bus handlers
export function handleBus(s: WorldState, ev: BusEvent) {
  const rng = rngFor(s.seed, "bus", ev.id);
  const topic = s.topics.find((x) => x.id === ev.topicId);
  if (ev.kind === "echo") {
    const srv = s.servers.find((x) => x.id === ev.data.server), from = s.servers.find((x) => x.id === ev.data.from);
    if (!srv || !from) return;
    const fromCh = from.channels.find((c) => c.id === ev.data.ch);
    const chs = srv.channels.filter((c) => !c.announce);
    const ch = chs.find((c) => c.tags.includes("god")) ?? chs.find((c) => c.name === "general") ?? chs[0];
    const fake: Message = { id: String(ev.data.god), serverId: from.id, channelId: String(ev.data.ch), authorId: "god", text: String(ev.data.q), t: ev.t, reactions: [], kind: "chat", score: 0 };
    const p = parseGodText(String(ev.data.q));
    const x: Ctx = { s, rng, srv, ch, god: fake, p, now: ev.t, topic: topic ?? ({ id: "", tag: "", label: "", about: "god", category: "chat", valence: 0, magnitude: 1, heat: 1, startedAt: ev.t, facts: {} } as Topic) };
    const sl = (c: Character, u?: Character) => slots(x, c, u, { server: from.name, ch: fromCh?.name ?? "general", here: srv.name });
    const b = new Burst(x, ev.t);
    const opener = audience(x, (o) => (fanish(o) ? 3 : negish(o) ? 2 : 1), new Set(), ev.t);
    if (!opener) return;
    const o1 = b.push(opener, line(s, rng, opener, ECHO_OPEN, sl(opener)), { intent: "echo" });
    o1.typingFrom = ev.t - 3000;
    for (let i = 0, n = rng.int(2, 6); i < n; i++) {
      const c = audience(x, () => 1, new Set([opener.id]), b.cur);
      if (!c) break;
      b.push(c, line(s, rng, c, ECHO_REPLY, sl(c, opener)), { replyTo: rng.chance(0.4) ? o1.id : undefined, intent: "echoReply", gap: [2 * SEC, 14 * SEC] });
    }
    s.pending.push(...b.msgs);
    return;
  }
  if (ev.kind === "screenshot") {
    const from = s.servers.find((x) => x.id === ev.data.from);
    const ch = from?.channels.find((c) => c.id === ev.data.ch);
    const authors = s.characters.filter((c) => c.influencer && (fanish(obsessionOf(c)) || c.stance === "memer"));
    if (!from || !ch || !authors.length) return;
    const author = rng.pick(authors);
    const text = expand(rng.pick([
      "god just said \"{q}\" in {server} #{ch} 😭", "screenshot from {server} today. he said \"{q}\" and the whole server combusted", "{n} people replied to god in {server} in under a minute. normal behavior",
      "POV: god says \"{q}\" and your whole server forgets how to act", "the {server} chat after god typed \"{q}\" >>>", "not god casually saying \"{q}\" in #{ch}",
    ]), { q: String(ev.data.q), server: from.name, ch: ch.name, n: String(Math.max(3, Number(ev.data.replies) || 3)) }, rng);
    const e = engagementFor(rng, author, topic?.heat ?? 4);
    const post: Post = { id: nid(s, "p"), platform: "chirp", authorId: author.id, text: `${text}${topic ? ` #${topic.tag}` : ""}`, t: ev.t, topicId: topic?.id, ...e, replies: 0, media: { hue: 42, label: `${from.name} #${ch.name}`, kind: "photo" }, score: 3 };
    s.posts.push(post);
    s.stats.posts++;
    // real replies under it (count backed by stored replies)
    for (let i = 0, n = rng.int(2, 5); i < n; i++) {
      const r = makePost(s, rng, ev.t + rng.range(20, 600) * SEC, { topic: topic ?? null, platform: "chirp", replyToId: post.id });
      void r;
    }
    if (topic) { topic.heat += 2; }
    return;
  }
  if (ev.kind === "godDm") {
    const c = charById(s, String(ev.data.who));
    const from = s.servers.find((x) => x.id === ev.data.from);
    const ch = from?.channels.find((x) => x.id === ev.data.ch);
    if (!c || !from || !ch) return;
    const chId = dmChannel("god", c.id);
    const ob = obsessionOf(c);
    const sl = slotsFor(rng, s, c, undefined, { server: from.name, ch: ch.name, holding: s.player.holdings[0]?.name ?? "your empire" });
    const text = line(s, rng, c, DM_OPEN[ob], sl);
    const m = dmMsg(s, chId, c.id, text, ev.t);
    s.pending.push(m);
    if (rng.chance(0.4)) s.pending.push(dmMsg(s, chId, c.id, line(s, rng, c, ["no pressure to reply", "ok that's all 🙏", "sorry if this is weird", "anyway have a good one"], sl), ev.t + rng.range(4, 20) * SEC));
    notify(s, ev.t, "mention", `New message from @${c.username}: "${text.slice(0, 60)}"`, `lounge:dm:${chId}`);
    return;
  }
  if (ev.kind === "followup" && topic) {
    // the day-after discourse for big god actions: more servers, a meme, maybe an opinion piece
    const srvs = rng.shuffle(s.servers.slice()).slice(0, rng.int(2, 4));
    for (const srv of srvs) {
      const chs = srv.channels.filter((c) => !c.announce);
      runEpisode(s, rng, srv, rng.pick(chs), ev.t + rng.range(0, 8) * MIN, topic, { mode: "reaction" });
    }
    const memers = s.characters.filter((c) => c.stance === "memer" && c.influencer);
    if (memers.length) {
      const p = makePost(s, rng, ev.t + rng.range(1, 10) * MIN, { topic, author: rng.pick(memers), platform: "chirp" });
      p.media = { hue: rng.int(0, 360), label: topic.tag, kind: "meme", meme: memeFor(s, rngFor(s.seed, "pm", p.id), charById(s, p.authorId), topic) };
    }
    if (topic.magnitude >= 5 && rng.chance(0.6)) makeArticle(s, rng, topic, ev.t + rng.range(5, 30) * MIN, "opinion");
    topic.heat += topic.magnitude * 0.8;
  }
}

/** used by the template generator for god talk when god isn't around */
export function ambientLine(s: WorldState, rng: Rng, c: Character): string {
  const ob = obsessionOf(c);
  const past = pastGodLine(s, rng);
  const sl = slotsFor(rng, s, c, undefined, { past: past.text, pastwhere: past.where, n: String(rng.int(2, 40)), nw: fmtMoney(netWorth(s)), holding: s.player.holdings.length ? rng.pick(s.player.holdings).name : "the empire" });
  return expand(rng.pick(AMBIENT[ob]), sl, rng);
}

export { AMBIENT };
