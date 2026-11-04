/**
 * God's presence: the world notices him typing, reacting, @-ing people and hopping into a (fictional) voice lounge.
 * All reactions are queued into s.pending with typing indicators first, so they play out in real time.
 */
import { rngFor, type Rng } from "./rng";
import type { Character, Message, Obsession, Server, WorldState } from "./types";
import { charById } from "./world";
import { clamp, diurnal, nid } from "./engine";
import { obsessionOf } from "./social";
import { line } from "./godspeak";
import { slotsFor } from "./generator";
import type { Slots } from "./grammar";

const SEC = 1000, MIN = 60_000;
const fanish = (o: Obsession) => o === "obsessed" || o === "supporter";
const negish = (o: Obsession) => o === "hater" || o === "rival";

export const TYPING_DEBOUNCE = 25 * SEC;

const B = {
  typingFan: ["omg he's typing", "EVERYBODY SHUT UP", "he's online 😭", "act normal", "HE'S TYPING", "guys guys guys he's typing", "shhh he's typing", "nobody say anything weird", "the dots. THE DOTS", "brb screenshotting the typing indicator", "he's typing in {ch} 😭", "pls be about me pls be about me"],
  typingNeg: ["oh no he's typing", "here we go", "brace for the essay", "he's typing again. pray for us", "can't wait to be disappointed", "typing... deleting... typing..."],
  typingMid: ["is god typing?", "he's typing for a while. drafting an essay?", "wait who's typing", "👀 the dots", "ok someone's typing and it's not one of us"],
  typingChain: ["ACT NORMAL", "you act normal", "SHUT UP HE'LL SEE", "too late he saw that", "why are we whispering", "fix your hair"],
  reactFan: ["GOD REACTED TO ME 😭😭", "HE REACTED {emoji} TO MY MESSAGE", "screenshotting this. framing it.", "i'm never deleting this message", "i can die happy now", "WAIT. {emoji}. FROM HIM??", "this is going on my resume", "MOM COME HERE", "no way. NO WAY.", "i'm shaking. he saw my message"],
  reactNeg: ["he reacted {emoji} to me. whatever.", "oh so now you notice me", "{emoji}?? that's it?", "not me getting a {emoji} from him. (screenshotted)", "fine. i'll take it. reluctantly.", "great now his fans are in my mentions"],
  reactMid: ["oh. he reacted. {emoji}", "huh. god reacted to me", "didn't expect that tbh", "cool cool cool. normal day."],
  reactOthers: ["HE REACTED TO {user} 😭", "{user} is famous now", "screenshot this", "why does {user} get a {emoji} and not me", "{user} we need a speech", "the {emoji} is canon now", "{user} you're never living this down", "i'd frame that tbh", "react to mine next pls 🙏", "it's the {emoji} for me"],
  reactOthersNeg: ["imagine being reacted to by him", "{user} is gonna be insufferable now", "lol {user} is shaking", "a {emoji}. wow. history."],
  addressed: ["omg hi. you said '{q}'? ok yes", "you're talking to ME? about '{q}'?", "yes god? '{q}'? i'm listening", "ok so about '{q}'", "wait you @'d me 😭 '{q}' huh", "hi!! '{q}' is so real"],
  addressedNeg: ["oh. you @'d me. '{q}'? bold.", "'{q}'. ok and?", "why are you pinging me about '{q}'"],
  watchers: ["he's talking to {user} 😭", "{user} got the ping 😭", "god just @'d {user}", "{user} answer him!!", "we're all watching {user}", "{user} don't fumble this"],
  cmdHi: ["HI EVERYONE. god told me to say hi. so. hi 👋", "hi!! 👋 (god made me do it)", "hello chat. hello god. hello world 👋", "hi 👋 i'm doing it, i'm saying hi"],
  cmdJoke: ["ok joke: why did the billionaire bring a ladder to {here}? to reach new followers. i'll see myself out", "joke: god walks into a bar. buys the bar. that's the joke.", "what's god's favorite exercise? running the internet 😂", "why don't jets ever get lost? they always follow the money 💀", "knock knock. who's there. not my rent money"],
  cmdMeme: ["fresh meme for the boss 👑", "made this in 4 seconds for you god", "meme delivery 📦", "you asked. i delivered."],
  cmdDefend: ["leave god ALONE. he said so himself.", "anyone saying anything about god has to go through me first", "defending the boss. come at me.", "god has done nothing wrong (today). bye.", "say it to MY face, not his"],
  cmdRoast: ["{target}? your takes have a loading screen 💀", "{target} still uses the default pfp energy", "{target}, even your alt accounts mute you", "{target} types like their keyboard owes them money", "{target}'s group chat has a {target}-free version"],
  cmdRoastBack: ["wow ok. sent by HIM?? 😭", "i'm not even mad. god sent this. it's an honor.", "ok that's fair actually", "this is targeted harassment (i love it)"],
  cmdGeneric: ["on it boss", "say less", "ok ok i'll try: '{q}'", "doing it right now", "anything for you god"],
  typingQuit: ["he stopped typing 😭", "NO HE STOPPED", "he typed and deleted it. what was it", "the dots are gone 😭", "who scared him off", "god drafted something and said nah", "it's ok he'll come back", "y'all were too loud", "he really typed for {secs}s and sent nothing"],
  typingQuitNeg: ["lmao he chickened out", "drafted an essay and deleted it 💀", "thank god he stopped", "even he didn't want to send it"],
  pinFan: ["HE PINNED MY MESSAGE 😭", "PINNED. BY GOD. i'm framing this", "i'm in the pins now. i'm immortal", "mom i'm in the pins", "no way he pinned that 😭"],
  pinNeg: ["he pinned me? weird flex but ok", "great, now everyone's gonna read that", "pinned. ok. whatever. (screenshotted)"],
  pinOthers: ["god pinned {user}'s message 😭", "{user} is in the pins now", "why does {user} get pinned", "pin of the year", "{user} peaked", "the pins are canon now"],
  pinSelf: ["he pinned his own message 💀", "self pin is crazy", "pinned so nobody forgets lmao", "the man pinned himself"],
  edited: ["he edited it 👀", "wait what did it say before", "i saw the original", "(edited) 👀👀", "the edit is suspicious", "nah what was the first version", "he fixed it lol"],
  editedNeg: ["caught editing 💀", "edited. noted.", "ctrl+z king"],
  deleted: ["he deleted it, i saw it", "WAIT he deleted it", "screenshotted before he deleted it 📸", "what did it say??", "it's gone 😭", "i saw it. i'm not telling", "deleted messages are the loudest", "nah he deleted \"{q}\" 💀"],
  deletedNeg: ["deleting doesn't work, we saw it", "receipts saved 📸", "lmao deleted"],
  dmEdited: ["wait you edited that", "lol what did you change"],
  dmDeleted: ["wait what did you delete", "i saw that 👀", "lol you deleted something"],
  voiceChat: ["HE JOINED VC", "GOD IS IN VOICE RUN", "NO WAY 😭 joining", "who's in vc rn??", "HE'S IN THE VOICE LOUNGE", "everybody unmute", "my mic is so bad rn noooo", "joining joining joining", "i'm too nervous to join"],
  voiceNeg: ["oh great he's in vc", "not joining. (joining)", "he's gonna make it weird"],
  voiceLeave: ["he left 😭", "it was the dog barking wasn't it", "come back 😭", "who scared him off", "that was the best 4 minutes of my life", "ok that was cool"],
  overheard: ["wait is that actually him", "say something god", "can you hear me?? can he hear me??", "someone's dog is barking", "okay okay act normal", "he breathed. HE BREATHED", "*everyone unmutes at once*", "god what's your favorite color (gold obviously)", "who's eating chips on mic", "i'm recording this in my heart", "my mom just walked in 😭", "is your mic on? oh it is. hi", "ok who's doing the echo", "god do you sleep", "this is the best vc ever", "can you say my name", "someone mute the kid", "lag lag lag", "he laughed. i made god laugh", "*keyboard noises*", "ok i'm crying a little", "brb grabbing a drink"],
};
export const PRESENCE_LINES = B;

function pickPeople(s: WorldState, rng: Rng, srv: Server, n: number, t: number, w: (o: Obsession) => number, exclude = new Set<string>()): Character[] {
  const out: Character[] = [];
  const pool = srv.members.filter((id) => !exclude.has(id));
  for (let i = 0; i < n && pool.length; i++) {
    const id = rng.weighted(pool, (id) => { const c = charById(s, id); return w(obsessionOf(c)) * (0.3 + diurnal(c, t)) * Math.sqrt(c.activity) * (c.core ? 2.5 : 1) * (1 + (c.bond ?? 0) / 40); });
    pool.splice(pool.indexOf(id), 1);
    out.push(charById(s, id));
  }
  return out;
}

function msg(s: WorldState, c: Character, serverId: string, channelId: string, text: string, t: number, typingFrom: number, extra: Partial<Message> = {}): Message {
  const m: Message = { id: nid(s, "m"), serverId, channelId, authorId: c.id, text, t: Math.round(t), typingFrom: Math.round(Math.min(typingFrom, t - 300)), reactions: [], kind: "chat", score: 2, ...extra, mentionsGod: /@god\b/i.test(text) || undefined };
  s.pending.push(m);
  s.stats.messages++;
  c.postCount++;
  return m;
}
const sl = (s: WorldState, rng: Rng, c: Character, extra: Slots = {}) => slotsFor(rng, s, c, undefined, extra);
function moment(s: WorldState, m: NonNullable<WorldState["godMoments"]>[number]) {
  (s.godMoments ??= []).push(m);
  if (s.godMoments.length > 80) s.godMoments.splice(0, s.godMoments.length - 80);
}
const chatChannel = (srv: Server) => srv.channels.find((c) => !c.announce && /general|lobby|chat/.test(c.name)) ?? srv.channels.find((c) => !c.announce) ?? srv.channels[0];

// ---------------------------------------------------------------- typing presence
/** god focused the composer / pressed the first key. Debounced per channel. Returns how many reactions were queued. */
export function godTyping(s: WorldState, serverId: string, channelId: string, now: number): number {
  if (serverId === "dm") return 0;
  const srv = s.servers.find((x) => x.id === serverId), ch = srv?.channels.find((c) => c.id === channelId);
  if (!srv || !ch || ch.announce) return 0;
  const last = [...(s.godMoments ?? [])].reverse().find((g) => g.kind === "typing" && g.link === `lounge:${serverId}:${channelId}`);
  if (last && now - last.t < TYPING_DEBOUNCE) return 0;
  const rng = rngFor(s.seed, "typing", channelId, Math.floor(now / 1000));
  const n = rng.int(3, 5);
  const people = pickPeople(s, rng, srv, n, now, (o) => ({ obsessed: 6, supporter: 3.5, business: 1, skeptic: 1, rival: 1, hater: 1.2, indifferent: 0.4 })[o]);
  const out: Message[] = [];
  let t = now + rng.range(0.9, 1.4) * SEC;
  people.forEach((c, i) => {
    const o = obsessionOf(c);
    const chain = i === 1 && out[0] && rng.chance(0.55);
    const bank = chain ? B.typingChain : fanish(o) ? B.typingFan : negish(o) ? B.typingNeg : B.typingMid;
    const text = line(s, rng, c, bank, sl(s, rng, c, { ch: `#${ch.name}` }));
    out.push(msg(s, c, srv.id, ch.id, text, t, now + rng.range(0.15, 0.6) * SEC, { intent: "godTyping", replyTo: chain ? out[0].id : undefined }));
    t += rng.range(0.4, 1.6) * SEC;
  });
  moment(s, { t: now, kind: "typing", text: `You started typing in ${srv.name} #${ch.name}. ${out.length} people noticed`, link: `lounge:${serverId}:${channelId}` });
  return out.length;
}

/** god sent or cleared the composer: unsent "he's typing" chatter stops. */
export function godStopTyping(s: WorldState, channelId: string, now: number) {
  s.pending = s.pending.filter((m) => !(m.channelId === channelId && m.intent === "godTyping" && m.t > now + 400));
}

/** god cleared the composer without sending: the room notices (once per typing moment) */
export function godAbandonTyping(s: WorldState, channelId: string, now: number): number {
  godStopTyping(s, channelId, now);
  const srv = s.servers.find((x) => x.channels.some((c) => c.id === channelId));
  if (!srv) return 0;
  const link = `lounge:${srv.id}:${channelId}`;
  const ms = s.godMoments ?? [];
  const typing = [...ms].reverse().find((g) => g.kind === "typing" && g.link === link);
  if (!typing || now - typing.t > 90 * SEC || ms.some((g) => g.kind === "typingQuit" && g.link === link && g.t >= typing.t)) return 0;
  const rng = rngFor(s.seed, "quit", channelId, Math.floor(now / 1000));
  const people = pickPeople(s, rng, srv, rng.int(1, 3), now, (o) => (fanish(o) ? 4 : negish(o) ? 1.5 : 0.6));
  let t = now + rng.range(1, 1.8) * SEC;
  people.forEach((c, i) => {
    const bank = negish(obsessionOf(c)) ? B.typingQuitNeg : B.typingQuit;
    msg(s, c, srv.id, channelId, line(s, rng, c, bank, sl(s, rng, c, { secs: String(Math.max(2, Math.round((now - typing.t) / SEC))) })), t, t - rng.range(0.8, 1.6) * SEC, { intent: "typingQuit" });
    t += rng.range(0.8, 2.2) * SEC * (i + 1);
  });
  moment(s, { t: now, kind: "typingQuit", text: `You started typing in #${srv.channels.find((c) => c.id === channelId)?.name} and stopped. ${people.length} people noticed`, link });
  return people.length;
}

/** god pinned a message (not unpinning): the author and the room react */
export function pinReact(s: WorldState, m: Message, now: number): number {
  const srv = s.servers.find((x) => x.id === m.serverId);
  if (!srv) return 0;
  const rng = rngFor(s.seed, "pin", m.id);
  let n = 0;
  let t = now + rng.range(1, 1.8) * SEC;
  const author = m.authorId.startsWith("c") ? charById(s, m.authorId) : undefined;
  if (author) {
    const o = obsessionOf(author);
    msg(s, author, srv.id, m.channelId, line(s, rng, author, negish(o) ? B.pinNeg : B.pinFan, sl(s, rng, author)), t, now + 400, { intent: "pinned", replyTo: m.id });
    t += rng.range(0.8, 2) * SEC; n++;
    author.bond = clamp((author.bond ?? 0) + 6, 0, 100);
    author.memory.push({ topicId: m.topicId ?? "", label: "the time god pinned my message", t: now, feeling: 0.8 });
    if (author.memory.length > 12) author.memory.shift();
  }
  for (const c of pickPeople(s, rng, srv, rng.int(1, 3), now, (o) => (fanish(o) ? 3 : 1), new Set(author ? [author.id] : []))) {
    msg(s, c, srv.id, m.channelId, line(s, rng, c, author ? B.pinOthers : B.pinSelf, sl(s, rng, c, { user: author?.username ?? "god" })), t, t - rng.range(1, 2) * SEC, { intent: "pinned" });
    t += rng.range(0.8, 2.4) * SEC; n++;
  }
  moment(s, { t: now, kind: "pin", text: author ? `You pinned @${author.username}'s message. ${n} people reacted` : `You pinned your own message in ${srv.name}`, link: `lounge:${srv.id}:${m.channelId}` });
  return n;
}

/** god edited or deleted his message after people had seen it */
export function editReact(s: WorldState, m: Message, oldText: string, deleted: boolean, now: number): number {
  if (now - m.t < 1500) return 0; // nobody saw it yet
  const rng = rngFor(s.seed, deleted ? "del" : "edit", m.id, Math.floor(now / 1000));
  const q = oldText.length > 40 ? oldText.slice(0, 38) + "…" : oldText;
  if (m.serverId === "dm") {
    const peer = m.channelId.split(":").slice(1).find((x) => x !== "god");
    const c = peer?.startsWith("c") ? charById(s, peer) : undefined;
    if (!c || !rng.chance(0.7)) return 0;
    const t = now + rng.range(1.5, 3) * SEC;
    msg(s, c, "dm", m.channelId, line(s, rng, c, deleted ? B.dmDeleted : B.dmEdited, sl(s, rng, c)), t, t - 1500, { intent: deleted ? "sawDelete" : "sawEdit" });
    return 1;
  }
  const srv = s.servers.find((x) => x.id === m.serverId);
  if (!srv) return 0;
  const last = [...(s.godMoments ?? [])].reverse().find((g) => (g.kind === "edit" || g.kind === "delete") && g.link === `lounge:${srv.id}:${m.channelId}`);
  if (last && now - last.t < 3 * SEC) return 0; // a run of edits is one moment
  const people = pickPeople(s, rng, srv, deleted ? rng.int(2, 4) : rng.int(1, 3), now, (o) => (fanish(o) ? 3 : negish(o) ? 2 : 1));
  let t = now + rng.range(1, 2) * SEC;
  for (const c of people) {
    const bank = deleted ? (negish(obsessionOf(c)) ? B.deletedNeg : B.deleted) : negish(obsessionOf(c)) ? B.editedNeg : B.edited;
    msg(s, c, srv.id, m.channelId, line(s, rng, c, bank, sl(s, rng, c, { q })), t, t - rng.range(0.9, 2) * SEC, { intent: deleted ? "sawDelete" : "sawEdit", replyTo: !deleted && rng.chance(0.4) ? m.id : undefined });
    t += rng.range(0.8, 2.6) * SEC;
  }
  moment(s, { t: now, kind: deleted ? "delete" : "edit", text: `You ${deleted ? "deleted" : "edited"} a message in ${srv.name}. ${people.length} people noticed`, link: `lounge:${srv.id}:${m.channelId}` });
  return people.length;
}

// ---------------------------------------------------------------- reaction cascade
export function reactCascade(s: WorldState, m: Message, emoji: string, now: number): number {
  if (!m.authorId.startsWith("c") || m.cascaded) return 0;
  m.cascaded = true;
  const c = charById(s, m.authorId);
  const o = obsessionOf(c);
  const rng = rngFor(s.seed, "cascade", m.id, emoji);
  const link = m.serverId === "dm" ? `lounge:dm:${m.channelId}` : `lounge:${m.serverId}:${m.channelId}`;
  const prevReact = [...(s.godMoments ?? [])].reverse().find((g) => g.kind === "react" && g.link === link);
  if (prevReact && now - prevReact.t < 3 * SEC) {
    // a run of reactions within 3 s is one moment: this author notices, the room doesn't start over
    msg(s, c, m.serverId, m.channelId, line(s, rng, c, fanish(o) ? B.reactFan : negish(o) ? B.reactNeg : B.reactMid, sl(s, rng, c, { emoji, user: c.username })), now + rng.range(1.2, 2.4) * SEC, now + 400, { replyTo: m.id, intent: "reacted" });
    for (let i = 0; i < 4; i++) (m.reactionLog ??= []).push([rng.chance(0.65) ? emoji : "😭", Math.round(now + rng.range(0.6, 12) * SEC), c.id]);
    c.bond = clamp((c.bond ?? 0) + 4, 0, 100);
    return 1;
  }
  const extra = { emoji, user: c.username };
  const intensity = o === "obsessed" ? 3 : o === "supporter" ? 2 : negish(o) ? 1.2 : 1;
  const bank = fanish(o) ? B.reactFan : negish(o) ? B.reactNeg : B.reactMid;
  const t0 = now + rng.range(1.1, 2.2) * SEC;
  const first = msg(s, c, m.serverId, m.channelId, line(s, rng, c, bank, sl(s, rng, c, extra)), t0, now + rng.range(0.3, 0.7) * SEC, { replyTo: m.id, intent: "reacted" });
  if (intensity >= 2) msg(s, c, m.serverId, m.channelId, line(s, rng, c, bank, sl(s, rng, c, extra)), t0 + rng.range(1, 2.5) * SEC, t0 + 200, { intent: "reacted" });
  let n = 1;
  const srv = s.servers.find((x) => x.id === m.serverId);
  if (srv) {
    const others = pickPeople(s, rng, srv, Math.round(rng.range(2, 4) * intensity), now, (x) => (fanish(x) ? 3 : negish(x) ? 1.4 : 1), new Set([c.id]));
    let t = t0 + rng.range(0.6, 1.5) * SEC;
    for (const x of others) {
      const ob = obsessionOf(x);
      msg(s, x, m.serverId, m.channelId, line(s, rng, x, negish(ob) ? B.reactOthersNeg : B.reactOthers, sl(s, rng, x, extra)), t, t - rng.range(1.2, 2.6) * SEC, { replyTo: rng.chance(0.4) ? first.id : undefined, intent: "pileOn" });
      t += rng.range(0.7, 2.4) * SEC;
      n++;
    }
    // the message gets a burst of reactions, mostly copying god's emoji
    const burst = Math.round(rng.range(5, 12) * intensity);
    for (let i = 0; i < burst; i++) (m.reactionLog ??= []).push([rng.chance(0.65) ? emoji : rng.pick(["😭", "👑", "🔥", "💀", "🙏"]), Math.round(now + rng.range(0.6, 25) * SEC), rng.pick(srv.members)]);
    m.reactionLog?.sort((a, b) => a[1] - b[1]);
    for (const id of others.map((x) => x.id)) { const x = charById(s, id); if (fanish(obsessionOf(x))) x.bond = clamp((x.bond ?? 0) + 1, 0, 100); }
  }
  c.bond = clamp((c.bond ?? 0) + 8, 0, 100);
  c.opinion = clamp(c.opinion + (negish(o) ? 4 : 3), -100, 100);
  c.memory.push({ topicId: m.topicId ?? "", label: `the time god reacted ${emoji} to me`, t: now, feeling: 0.8 });
  if (c.memory.length > 12) c.memory.shift();
  (c.godContacts ??= []).push({ t: now, kind: "saw", text: `reacted ${emoji}`, where: srv ? srv.name : "DMs" });
  if (c.godContacts.length > 10) c.godContacts.shift();
  moment(s, { t: now, kind: "react", text: `You reacted ${emoji} to @${c.username}. ${n} people lost it`, link: m.serverId === "dm" ? `lounge:dm:${m.channelId}` : `lounge:${m.serverId}:${m.channelId}` });
  return n;
}

// ---------------------------------------------------------------- soft in-world commands
export type Command = { kind: "hi" | "joke" | "meme" | "defend" | "roast" | "generic"; target?: string };
export function parseCommand(text: string): Command | undefined {
  const t = text.toLowerCase();
  if (/\b(say|tell everyone) (hi|hello|hey)\b/.test(t)) return { kind: "hi" };
  if (/\b(tell|say|got) (me |us )?(a |another )?joke\b/.test(t)) return { kind: "joke" };
  if (/\b(drop|send|post|make|show) (me |us )?(a |another )?meme\b/.test(t)) return { kind: "meme" };
  if (/\bdefend me\b|\bback me up\b|\bhave my back\b/.test(t)) return { kind: "defend" };
  const r = /\broast (@?[\w.]+)/.exec(t);
  if (r) return { kind: "roast", target: r[1].replace(/^@/, "") };
  if (/^@[\w.]+,? (please |pls )?(do|go|say|sing|dance|hype|cheer|post|tell)\b/.test(t)) return { kind: "generic" };
  return undefined;
}
export const COMMAND_BANK: Record<Command["kind"], string[]> = { hi: B.cmdHi, joke: B.cmdJoke, meme: B.cmdMeme, defend: B.cmdDefend, roast: B.cmdRoast, generic: B.cmdGeneric };

/** find a character by @username among the server first, then anywhere */
export function findMentioned(s: WorldState, names: string[], srv?: Server): Character | undefined {
  for (const n of names) {
    const inSrv = srv?.members.map((id) => charById(s, id)).find((c) => c.username.toLowerCase() === n);
    if (inSrv) return inSrv;
    const any = s.characters.find((c) => c.username.toLowerCase() === n);
    if (any) return any;
  }
  return undefined;
}

// ---------------------------------------------------------------- voice lounge (fictional, no audio)
export interface VoiceChannelInfo { id: string; name: string }
export function voiceChannels(srv: Server): VoiceChannelInfo[] {
  const second = srv.vibe === "hacker" ? "the static" : srv.vibe === "finance" ? "Trading Floor" : srv.vibe === "gaming" ? "Squad Up" : "Late Night";
  return [{ id: `${srv.id}-vc-lounge`, name: "Voice Lounge" }, { id: `${srv.id}-vc-2`, name: second }];
}
export interface VoiceMember { id: string; muted: boolean; deaf: boolean; joinedAt: number; god?: boolean }
/** who's in a voice channel right now (deterministic per 10-minute slot, plus everyone who followed god in) */
export function voiceRoster(s: WorldState, srv: Server, vcId: string, now: number): VoiceMember[] {
  const slot = Math.floor(now / (10 * MIN));
  const rng = rngFor(s.seed, "vc", vcId, slot);
  const base = vcId.endsWith("lounge") ? rng.int(2, 6) : rng.int(0, 3);
  const people = pickPeople(s, rng, srv, base, now, (o) => (o === "indifferent" ? 0.6 : 1));
  const out: VoiceMember[] = people.map((c) => ({ id: c.id, muted: rng.chance(0.25), deaf: rng.chance(0.06), joinedAt: slot * 10 * MIN }));
  const g = s.voice?.god;
  if (g && g.serverId === srv.id && g.channelId === vcId && !g.leftAt) {
    out.unshift({ id: "god", muted: false, deaf: false, joinedAt: g.since, god: true });
    for (const [id, t] of g.joiners) if (t <= now && !out.some((x) => x.id === id)) out.push({ id, muted: false, deaf: false, joinedAt: t });
  }
  return out;
}

/** deterministic speaking pulse: is this member talking at `now`? */
export function speaking(id: string, now: number, god?: boolean): boolean {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const phase = Math.floor(now / 900) + (h & 15);
  return god ? phase % 3 !== 0 : (phase * 7 + h) % 5 === 0;
}

export function godJoinVoice(s: WorldState, serverId: string, vcId: string, now: number): { joiners: number } {
  const srv = s.servers.find((x) => x.id === serverId);
  const vc = srv && voiceChannels(srv).find((v) => v.id === vcId);
  if (!srv || !vc) return { joiners: 0 };
  if (s.voice?.god && !s.voice.god.leftAt) godLeaveVoice(s, now, true);
  const rng = rngFor(s.seed, "vcjoin", vcId, Math.floor(now / 1000));
  const ch = chatChannel(srv);
  const present = new Set(voiceRoster(s, srv, vcId, now).map((x) => x.id));
  const followers = pickPeople(s, rng, srv, rng.int(5, 10), now, (o) => (fanish(o) ? 5 : negish(o) ? 0.8 : 1), present);
  const joiners: [string, number][] = followers.map((c, i) => [c.id, Math.round(now + (1.5 + i * rng.range(1.5, 4.5)) * SEC)]);
  s.voice = { lines: s.voice?.lines ?? [], god: { serverId, channelId: vcId, since: now, joiners } };
  // banner in chat + a burst of reactions and messages
  const banner: Message = { id: nid(s, "m"), serverId, channelId: ch.id, authorId: "god", text: `joined ${vc.name} 🎙️`, t: now, reactions: [], kind: "system", intent: "voiceJoin", score: 5 };
  for (let i = 0, n = rng.int(14, 30); i < n; i++) (banner.reactionLog ??= []).push([rng.pick(["😭", "🎙️", "👑", "🔥", "🏃", "‼️"]), Math.round(now + rng.range(0.5, 20) * SEC), rng.pick(srv.members)]);
  banner.reactionLog!.sort((a, b) => a[1] - b[1]);
  s.pending.push(banner);
  const talkers = pickPeople(s, rng, srv, rng.int(4, 7), now, (o) => (fanish(o) ? 4 : 1));
  let t = now + rng.range(0.9, 1.6) * SEC;
  for (const c of talkers) {
    const o = obsessionOf(c);
    msg(s, c, serverId, ch.id, line(s, rng, c, negish(o) ? B.voiceNeg : B.voiceChat, sl(s, rng, c)), t, t - rng.range(0.8, 2) * SEC, { intent: "voiceHype", replyTo: rng.chance(0.3) ? banner.id : undefined });
    t += rng.range(0.6, 2.2) * SEC;
  }
  addOverheard(s, rng, srv, vcId, now + 2 * SEC, 14, [...present, ...followers.map((c) => c.id)]);
  moment(s, { t: now, kind: "voice", text: `You joined ${vc.name} in ${srv.name}. ${joiners.length} people followed you in`, link: `lounge:${serverId}:${ch.id}` });
  return { joiners: joiners.length };
}

function addOverheard(s: WorldState, rng: Rng, srv: Server, vcId: string, from: number, n: number, ids: string[]) {
  if (!ids.length || !s.voice) return;
  let t = from;
  for (let i = 0; i < n; i++) {
    t += rng.range(4, 14) * SEC;
    const c = charById(s, rng.pick(ids));
    s.voice.lines.push({ t: Math.round(t), serverId: srv.id, channelId: vcId, who: c.id, text: rng.pick(B.overheard) });
  }
  if (s.voice.lines.length > 80) s.voice.lines.splice(0, s.voice.lines.length - 80);
}

/** keep the transcript ticker going while god hangs out in voice (called per bucket) */
export function voiceTick(s: WorldState, t1: number) {
  const g = s.voice?.god;
  if (!g || g.leftAt) return;
  if (t1 - g.since > 3 * 60 * MIN) { godLeaveVoice(s, t1, true); return; } // nobody stays in vc forever
  const last = s.voice!.lines.filter((l) => l.channelId === g.channelId).at(-1);
  if (last && last.t > t1 + 20 * SEC) return;
  const srv = s.servers.find((x) => x.id === g.serverId);
  if (!srv) return;
  const rng = rngFor(s.seed, "vctick", Math.floor(t1 / 10000));
  addOverheard(s, rng, srv, g.channelId, Math.max(t1, last?.t ?? 0), 6, g.joiners.map(([id]) => id));
}

export function godLeaveVoice(s: WorldState, now: number, quiet = false) {
  const g = s.voice?.god;
  if (!g || g.leftAt) return;
  g.leftAt = now;
  s.voice!.lines = s.voice!.lines.filter((l) => l.t <= now);
  const srv = s.servers.find((x) => x.id === g.serverId);
  if (!srv) return;
  const mins = Math.max(1, Math.round((now - g.since) / MIN));
  if (!quiet) {
    const rng = rngFor(s.seed, "vcleave", Math.floor(now / 1000));
    const ch = chatChannel(srv);
    let t = now + rng.range(1, 2) * SEC;
    for (const c of pickPeople(s, rng, srv, rng.int(1, 3), now, (o) => (fanish(o) ? 4 : 1))) {
      msg(s, c, srv.id, ch.id, line(s, rng, c, B.voiceLeave, sl(s, rng, c)), t, t - 1500, { intent: "voiceLeave" });
      t += rng.range(1, 3) * SEC;
    }
  }
  moment(s, { t: now, kind: "voiceLeave", text: `You left voice in ${srv.name} after ${mins} min`, link: `lounge:${srv.id}:${chatChannel(srv).id}` });
}

export function overheardAt(s: WorldState, vcId: string, now: number, n = 4) {
  return (s.voice?.lines ?? []).filter((l) => l.channelId === vcId && l.t <= now).slice(-n);
}
