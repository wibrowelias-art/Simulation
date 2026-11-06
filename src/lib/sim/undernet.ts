/**
 * The gh0st storyline. A fictional "hacker" antagonist and their crew in a server called The Undernet.
 * Everything is narrative flavor: fabricated in-world docs about @god, "defaced" in-world trophy walls,
 * cryptic threats and rumor trading. No real techniques, tools, commands, code or personal data appear;
 * every generated line goes through the flavor guard (flavor.ts) and falls back to a safe line.
 */
import { rngFor, type Rng } from "./rng";
import type { Article, Character, CrewRole, InteractiveEvent, Message, Post, Server, Topic, WorldState } from "./types";
import { makeCharacter } from "./characters";
import { safeFlavor } from "./flavor";
import { fmtMoney } from "./format";
import type { MemeSpec } from "./memes";

const SEC = 1000, MIN = 60_000, HOUR = 60 * MIN;
export const UNDERNET_ID = "undernet";

// ---------------------------------------------------------------- the cast
interface CrewDef { role: CrewRole; username: string; displayName: string; voice: Character["voice"]; stance: Character["stance"]; opinion: number; bio: string; catchphrase: string; personality: string[]; occupation: string; location: string; age: number; seed: number; activity: number }
export const CREW: CrewDef[] = [
  { role: "gh0st", username: "gh0st_", displayName: "gh0st", voice: "lowercase", stance: "jealous", opinion: -35, bio: "you don't find me. i find you. ░▒▓", catchphrase: "we see you.", personality: ["cryptic", "patient", "theatrical"], occupation: "unknown", location: "nowhere in particular", age: 29, seed: 404, activity: 0.05 },
  { role: "kid", username: "skr1pt_kiddo", displayName: "kiddo ⚡", voice: "caps", stance: "memer", opinion: -5, bio: "14 tabs open. learning. allegedly.", catchphrase: "IM IN (the group chat)", personality: ["loud", "eager", "chaotic"], occupation: "student", location: "a gaming chair", age: 17, seed: 1337, activity: 0.6 },
  { role: "wren", username: "whitehat_wren", displayName: "Wren 🕊️", voice: "proper", stance: "analyst", opinion: 22, bio: "the one who warns you. receipts or it didn't happen.", catchphrase: "stay skeptical.", personality: ["calm", "principled", "dry"], occupation: "security writer (in-world)", location: "Port Aurelia", age: 31, seed: 2024, activity: 0.4 },
  { role: "broker", username: "brkr", displayName: "the broker", voice: "terse", stance: "analyst", opinion: 0, bio: "rumors bought and sold. no refunds.", catchphrase: "everything has a price.", personality: ["cold", "transactional", "amused"], occupation: "rumor broker", location: "unlisted", age: 40, seed: 777, activity: 0.35 },
  { role: "hype", username: "loudpacket", displayName: "LOUDPACKET 📢", voice: "caps", stance: "memer", opinion: -12, bio: "i don't do anything. i just yell about it.", catchphrase: "CHAOS IS CONTENT", personality: ["loud", "funny", "unhinged"], occupation: "professional hype man", location: "the comments", age: 23, seed: 9001, activity: 0.7 },
];

const CHANNELS: [name: string, topic: string, tags: string[]][] = [
  ["lobby", "you weren't invited. nobody was.", ["rumor", "drama", "god"]],
  ["leaks", "drops only. nothing here is verified.", ["leak", "god", "rumor"]],
  ["rumors", "trade gossip. pay in crowns.", ["rumor", "god", "drama"]],
  ["ransom-board", "gh0st's demands. in-world only.", ["god", "drama"]],
  ["trophy-wall", "brag about your in-story wins", ["memes", "god"]],
];

/** add gh0st, the crew and The Undernet to a world (new or migrated). Idempotent; returns true when it added anything. */
export function installUndernet(s: WorldState, now: number): boolean {
  const hasSrv = s.servers.some((x) => x.id === UNDERNET_ID);
  const crewOk = !!s.undernet && Object.values(s.undernet.crew).every((id) => s.characters[Number(id.slice(1))]?.pfp === "hacker");
  if (hasSrv && crewOk) return false;
  // half-installed save: drop the partial pieces and install cleanly
  if (hasSrv) s.servers = s.servers.filter((x) => x.id !== UNDERNET_ID);
  if (s.undernet && !crewOk) delete s.undernet;
  for (const c of s.characters) if (c.servers.includes(UNDERNET_ID)) c.servers = c.servers.filter((x) => x !== UNDERNET_ID);
  const rng = rngFor(s.seed, "undernet");
  const used = new Set(s.characters.map((c) => c.username));
  const crew = {} as Record<CrewRole, string>;
  const keep = s.undernet?.crew;
  for (const d of CREW) {
    if (keep?.[d.role]) { crew[d.role] = keep[d.role]; s.characters[Number(keep[d.role].slice(1))].servers.push(UNDERNET_ID); continue; }
    const c = makeCharacter(rngFor(s.seed, "crew", d.role), s.characters.length, used);
    Object.assign(c, {
      username: d.username, displayName: d.displayName, voice: d.voice, stance: d.stance, opinion: d.opinion, bio: d.bio, catchphrase: d.catchphrase, personality: d.personality,
      occupation: d.occupation, location: d.location, age: d.age, avatarSeed: d.seed, pfp: "hacker", tier: d.role === "gh0st" || d.role === "broker" || d.role === "wren" ? "lurker" : "power", activity: d.activity, influencer: false, verified: false,
      followers: d.role === "gh0st" ? 412_000 : rng.int(900, 40_000), interests: ["rumor", "drama", "god"], servers: [UNDERNET_ID], typoRate: 0, emojiRate: d.voice === "caps" ? 0.5 : 0.1,
      emojis: d.role === "gh0st" ? ["👁️", "🕸️", "░"] : d.role === "wren" ? ["🕊️", "🧐", "📎"] : ["🔥", "💀", "📢"], slang: d.voice === "caps" ? ["W", "LETS GO", "NO WAY"] : ["noted", "hm"], core: false, bond: d.role === "wren" ? 20 : 0, godContacts: [],
    });
    s.characters.push(c);
    crew[d.role] = c.id;
  }
  // regulars who lurk there: conspiracists, haters, memers and a few curious fans
  const pool = s.characters.filter((c) => !Object.values(crew).includes(c.id) && !c.influencer);
  const lurkers = rng.shuffle(pool.filter((c) => ["conspiracist", "hater", "memer", "skeptic", "jealous"].includes(c.stance))).slice(0, 26)
    .concat(rng.shuffle(pool.filter((c) => c.stance === "worshipper" || c.stance === "fan")).slice(0, 8));
  for (const c of lurkers) c.servers.push(UNDERNET_ID);
  const srv: Server = {
    id: UNDERNET_ID, name: "The Undernet", icon: "🕸️", color: "#39ff88", description: "you weren't invited. nobody was.", bias: -0.35, vibe: "hacker", tags: ["rumor", "drama", "leak"],
    channels: CHANNELS.map(([name, topic, tags]) => ({ id: `${UNDERNET_ID}-${name}`, name, topic, tags })),
    members: [...Object.values(crew), ...lurkers.map((c) => c.id)], moderators: [crew.gh0st, crew.broker], memberCount: 6_660,
    insideJokes: ["the 'i'm in' screenshot that was a calculator", "gh0st's 404 poem", "the broker's 'no refunds' sign", "kiddo's eleven alt accounts"],
  };
  s.servers.push(srv);
  // friendships inside the crew; the white hat is everyone's rival
  const ids = Object.values(crew);
  for (const id of ids) {
    const c = s.characters[Number(id.slice(1))];
    c.friends = ids.filter((x) => x !== id && x !== crew.wren);
    c.rivals = id === crew.wren ? [crew.gh0st, crew.broker] : [crew.wren];
  }
  s.characters[Number(crew.wren.slice(1))].friends = [];
  s.undernet = keep ? { ...s.undernet!, crew } : { crew, grudge: 18, leaks: 0, nextLeakAt: Math.round(now + rng.range(18, 40) * MIN) };
  return true;
}

export const crewOf = (s: WorldState, role: CrewRole) => s.undernet ? s.characters[Number(s.undernet.crew[role].slice(1))] : undefined;
export const crewRole = (s: WorldState, id: string): CrewRole | undefined => (s.undernet ? (Object.entries(s.undernet.crew).find(([, v]) => v === id)?.[0] as CrewRole | undefined) : undefined);

// ---------------------------------------------------------------- the approved flavor vocabulary
export const DOCS: { kind: string; titles: string[]; lines: string[]; short: string }[] = [
  { kind: "receipt", short: "receipt", titles: ["receipt #{n} :: island provisions", "receipt #{n} :: yacht snacks dept", "receipt #{n} :: {holding} gift shop"],
    lines: ["1x gold rubber duck ........ $██,███", "3x family size cheese puffs ... $███", "1x 'humble' hoodie (gold) .... $█,███", "12x scented candles 'money' ... $███", "1x trampoline for the jet .... $██,███", "tip ............ ███%", "signed: g█d"] },
  { kind: "memo", short: "memo", titles: ["{holding} // internal memo (draft {n})", "memo: project GOLDFISH", "memo: re the {asset} naming"],
    lines: ["re: the {asset} situation", "budget: $█████████", "approved by: ██████", "note: do NOT let god name the {asset} again", "status: vibes", "action item: buy a second moon (ask legal)", "cc: ██████, ██████"] },
  { kind: "drafts", short: "unsent drafts", titles: ["screenshot :: unsent post drafts", "notes app :: 'posts (do not post)'"],
    lines: ["draft 1: 'i am just like you guys'", "draft 2: 'i am not like you guys'", "draft 3: '👑'", "draft 4: 'creative mode is a mindset'", "[sent: draft 3]", "draft 5: 'who wants a jet ride (jk)'"] },
  { kind: "calendar", short: "calendar", titles: ["calendar export :: week {n}", "calendar :: 'very busy (secret)'"],
    lines: ["mon: nap (2h)", "tue: 'business'", "wed: ██████ with ███████", "thu: practice humble face", "fri: island", "sat: read the fan servers (anonymously)", "sun: ███████████"] },
  { kind: "notes", short: "notes", titles: ["notes :: 'ideas (genius)'", "notes :: 'things fans must never know'"],
    lines: ["- learn to cook eggs", "- new jet name ideas: ███████", "- reply to fans more (lol)", "- the {asset} needs a hot tub", "- is the island too small? (it is not)", "- ask the chef what 'al dente' means", "- name the dog ████"] },
];
const ASSETS = ["jet", "yacht", "island", "penthouse", "hot tub", "submarine", "garage", "vault"];
const STAMPS = ["LEAKED?", "UNVERIFIED", "CONFIDENTIAL", "DROP #{n}"];
const TAGS = ["GodLeak", "TheGodFiles", "gh0stFiles", "LeakGate", "GodDocs"];

const L = {
  teaser: [">_ something is loading. ░░░░▒▒▓ {pct}%", "tick. tock. @god", ":: new file in the vault. soon.", "// you'll want to sit down for this one", "i found a folder. it has your name on it, @god.", "[ countdown: {mins} min ]", "the god files, part {n}. warming up. ░"],
  leak: [">_ the god files, part {n}. enjoy. ::", "// {doc}. you're welcome, internet.", "found this in a drawer i was never supposed to open. ░", "[ drop #{n} ] read it before it vanishes", "he said he had nothing to hide. :: {doc}", "receipts are forever, @god. ░▒▓"],
  ransom: ["price for silence: {ransom}. clock's running. >_", "pay {ransom} or part {next} drops. no counteroffers. ::", "the board is open. {ransom}. you know where to find me.", "{ransom}. or the next file gets a press release. ░"],
  credit: ["that {label}? cute. i saw it coming three days ago. ::", "nice {label}. would be a shame if the paperwork leaked. >_", "trophy wall says hi. {label} was my idea, by the way.", "every move leaves a receipt, @god. i collect receipts.", "// noted. adding {label} to the file.", "keep going. the file gets thicker. ░"],
  kid: ["IM IN 😤 (the group chat)", "YO IS THIS REAL?? reposting anyway", "gh0st is literally him", "i helped (i refreshed the page)", "W DROP", "wait whats a memo", "THIS IS THE BEST DAY OF MY LIFE"],
  wren: ["heads up: this looks fabricated. the fonts don't even match.", "please don't share this. it's a fake doc built to farm attention.", "for the record, nothing here is verified. stay skeptical.", "if @god sees this: don't panic. it's theater.", "i've seen better forgeries on a cereal box."],
  broker: ["rumors on @god trading at {price} crowns. buying.", "real or not, it's worth something. selling copies.", "market's hot. part {next} pre-orders open.", "i don't make the drama. i price it.", "the {doc} is going for {price} crowns."],
  hype: ["THE GOD FILES ARE OUT 🔥🔥", "GH0ST NEVER MISSES", "CHAOS IS CONTENT", "WE ARE SO BACK (HE IS SO COOKED)", "RUN IT BACK", "SOMEBODY CHECK ON THE FAN CLUB 😭"],
  warn: ["heads up. gh0st is about to drop something about you. it's mostly made up, but people will run with it.", "small warning: the undernet is hyping a 'god files' drop. it's theater. plan your reply.", "they're teasing a leak in #leaks. if it's fake, say so early."],
  afterPay: ["pleasure doing business. (we kept a copy.) ::", "paid. funny. the file is still warm. ░", "noted. silence purchased. for now."],
  afterDeny: ["denial noted. part {next} has better lighting.", "'fake' he says. ok. >_", "deny all you want. the internet already screenshotted it."],
  afterCounterWin: ["...ok. that was annoying. respect. a little.", "who painted my wall gold. :: not funny. (a little funny)", "fine. round to you. the game isn't over."],
  afterCounterLose: ["you call that a counter? framed it. #trophy-wall", "cute attempt. i'm adding it to the museum. ░", "lol. try again in a few business days."],
  afterHire: ["you brought a white hat to a ghost story. cute.", "wren. of course. ::", "a bodyguard for your receipts. adorable."],
  wrenHired: ["on it. i'll watch the shadows, you watch your posts.", "deal. first tip: post something boring for a day.", "hired. i'll call out every fake doc before it spreads."],
  dm: {
    taunt: ["ok.", "you asked for it. ░", "check #leaks in a minute. >_", "be careful what you dare a ghost to do."],
    who: ["nobody. that's the point.", "a rumor with a keyboard.", "the reason your fans refresh #leaks. ::", "i'm the receipt you forgot about."],
    nice: ["flattery is a weakness. noted.", "cute. still leaking.", "you're nicer in the drafts. ░"],
    mean: ["loud. i like loud.", "say that again. i'm taking notes. ::", "anger looks good on a headline."],
    deal: ["the board has a price. read #ransom-board.", "everything has a price. ask the broker.", "make an offer. i'll pretend to think about it."],
    stop: ["stop? we just started.", "maybe. if you're entertaining.", "the ghost doesn't stop. it gets bored. so stay interesting."],
    generic: ["::", "we see you.", "interesting. ░▒▓", "keep typing. it all goes in the file.", "you shouldn't be in my dms, @god.", "i was wondering when you'd write."],
  },
  wrenDm: ["for what it's worth, most of these drops are fabricated. stay calm.", "if you want, i can call out the next fake before it spreads. just say the word.", "best move: don't feed him. or hire me 🕊️", "i'm on your side. mostly because fake docs are lazy."],
  brokerDm: ["everything has a price.", "your rumors are trading well today.", "buying or selling?", "no refunds."],
  kidDm: ["IM NOT AFFILIATED (i'm a little affiliated)", "WAIT GOD DMED ME 😭😭", "PLS DONT BE MAD I JUST REPOST STUFF", "can i have a jet ride if i snitch (jk) (unless)"],
  hypeDm: ["GOD IN MY DMS. CHAOS IS CONTENT.", "YOU'RE THE MAIN CHARACTER AND GH0ST IS THE PLOT TWIST", "I'M SCREENSHOTTING THIS (I'M NOT) (I AM)"],
};
export const LINES = L;

/** every string the storyline can emit, before slot filling (used by the vocabulary test) */
export function allFlavorTemplates(): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => { if (typeof v === "string") out.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") Object.values(v).forEach(walk); };
  walk(L);
  for (const d of DOCS) { walk(d.titles); walk(d.lines); walk(d.short); }
  walk(ASSETS); walk(STAMPS); walk(TAGS);
  return out;
}

const SAFE = "::";
function fill(rng: Rng, tpl: string, sl: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => sl[k] ?? "");
}
/** pick + fill + guard. Slot values that come from the player (holding names) are guarded too. */
export function say(rng: Rng, bank: string[], sl: Record<string, string> = {}): string {
  return safeFlavor(fill(rng, rng.pick(bank), sl), SAFE);
}

export interface LeakDoc { kind: string; title: string; short: string; lines: string[]; stamp: string }
export function makeLeakDoc(s: WorldState, rng: Rng, n: number): LeakDoc {
  const d = rng.pick(DOCS);
  const holdingRaw = s.player.holdings.length ? rng.pick(s.player.holdings).name : "GOD Holdings";
  const sl = { n: String(rng.int(2, 99)), holding: safeFlavor(holdingRaw, "GOD Holdings"), asset: rng.pick(ASSETS) };
  const title = safeFlavor(fill(rng, rng.pick(d.titles), sl), "the god files");
  const lines = rng.shuffle([...d.lines]).slice(0, rng.int(4, 6)).map((l) => safeFlavor(fill(rng, l, sl), "████████"));
  return { kind: d.kind, title, short: d.short, lines, stamp: fill(rng, rng.pick(STAMPS), { n: String(n) }) };
}

// ---------------------------------------------------------------- message helpers

const id = (s: WorldState, p: string) => `${p}${(s.counter++).toString(36)}`;

function chan(name: string) { return `${UNDERNET_ID}-${name}`; }
/** proper/formal voices capitalize their first letter, like the rest of the cast */
const voiced = (who: Character, text: string) => (who.voice === "proper" || who.voice === "formal" ? text.replace(/^[a-z]/, (x) => x.toUpperCase()) : text);
function post(s: WorldState, who: Character, channel: string, text: string, t: number, extra: Partial<Message> = {}): Message {
  text = voiced(who, text);
  const m: Message = { id: id(s, "m"), serverId: UNDERNET_ID, channelId: chan(channel), authorId: who.id, text, t: Math.round(t), reactions: [], kind: "chat", score: 3, typingFrom: Math.round(t - Math.min(6000, Math.max(1200, text.length * 55))), intent: "undernet", ...extra, mentionsGod: /@god\b/i.test(text) || undefined };
  s.pending.push(m);
  s.stats.messages++;
  who.postCount++;
  return m;
}
function dm(s: WorldState, who: Character, text: string, t: number): Message {
  text = voiced(who, text);
  const chId = `dm:${["god", who.id].sort().join(":")}`;
  const m: Message = { id: id(s, "m"), serverId: "dm", channelId: chId, authorId: who.id, text, t: Math.round(t), reactions: [], kind: "chat", score: 2, typingFrom: Math.round(t - Math.min(5000, Math.max(1000, text.length * 50))), mentionsGod: true };
  s.pending.push(m);
  return m;
}
const react = (m: Message, rng: Rng, s: WorldState, emojis: string[], n: number) => {
  const srv = s.servers.find((x) => x.id === UNDERNET_ID);
  if (!srv) return;
  for (let i = 0; i < n; i++) (m.reactionLog ??= []).push([rng.pick(emojis), Math.round(m.t + rng.range(2, 90) * SEC), rng.pick(srv.members)]);
  m.reactionLog!.sort((a, b) => a[1] - b[1]);
};

// ---------------------------------------------------------------- engine hooks (called with engine helpers injected to avoid import cycles)
export interface EngineHooks {
  ripple: (s: WorldState, topic: Topic, now: number, rng: Rng) => unknown;
  notify: (s: WorldState, t: number, kind: "mention" | "trend" | "news" | "event" | "money" | "system", text: string, link?: string) => void;
  nid: (s: WorldState, p: string) => string;
}

/** every 5 sim-minutes: is a leak due? schedule the teaser, the white-hat warning and the drop on the bus. */
export function undernetTick(s: WorldState, t0: number) {
  const u = s.undernet;
  if (!u || t0 < u.nextLeakAt - 15 * MIN) return;
  if (s.bus.some((e) => e.kind === "undernet" && e.data.beat === "leak")) return;
  const rng = rngFor(s.seed, "leak-plan", u.leaks);
  const at = Math.max(t0 + 2 * MIN, u.nextLeakAt);
  scheduleLeak(s, rng, at, true);
}

export function scheduleLeak(s: WorldState, rng: Rng, at: number, withTeaser: boolean) {
  const u = s.undernet!;
  if (withTeaser) {
    s.bus.push({ id: id(s, "v"), kind: "undernet", t: Math.round(at - rng.range(8, 13) * MIN), data: { beat: "teaser" } });
    if (!u.hiredUntil || u.hiredUntil < at) s.bus.push({ id: id(s, "v"), kind: "undernet", t: Math.round(at - rng.range(3, 6) * MIN), data: { beat: "warn" } });
  }
  s.bus.push({ id: id(s, "v"), kind: "undernet", t: Math.round(at), data: { beat: "leak" } });
  const base = rng.range(4, 9) * HOUR / (1 + u.grudge / 80);
  u.nextLeakAt = Math.round(at + base * (u.hiredUntil && u.hiredUntil > at ? 2 : 1));
}

/** bus delivery for the storyline */
export function undernetBus(s: WorldState, ev: { id: string; t: number; data: Record<string, string | number> }, h: EngineHooks) {
  const u = s.undernet;
  if (!u) return;
  const rng = rngFor(s.seed, "ubus", ev.id);
  const g = crewOf(s, "gh0st")!, kid = crewOf(s, "kid")!, wren = crewOf(s, "wren")!, broker = crewOf(s, "broker")!, hype = crewOf(s, "hype")!;
  const t = ev.t;
  const beat = String(ev.data.beat);
  const sl = { n: String(u.leaks + 1), next: String(u.leaks + 2), pct: String(rng.int(61, 97)), mins: String(rng.int(5, 12)), price: String(rng.int(3, 40)), label: String(ev.data.label ?? "move"), doc: String(ev.data.doc ?? "the file") };
  if (beat === "teaser") {
    const m = post(s, g, "leaks", say(rng, L.teaser, sl), t);
    react(m, rng, s, ["👁️", "👀", "🕸️", "💀"], rng.int(8, 20));
    post(s, kid, "leaks", say(rng, L.kid, sl), t + rng.range(6, 20) * SEC);
    post(s, hype, "lobby", say(rng, L.hype, sl), t + rng.range(15, 50) * SEC);
    h.notify(s, t, "mention", `@gh0st_ in The Undernet #leaks: "${m.text.slice(0, 60)}"`, `lounge:${UNDERNET_ID}:${chan("leaks")}`);
    return;
  }
  if (beat === "warn") {
    const m = dm(s, wren, say(rng, L.warn, sl), t);
    h.notify(s, t, "mention", `New message from @${wren.username}: "${m.text.slice(0, 60)}"`, `lounge:dm:${m.channelId}`);
    return;
  }
  if (beat === "credit") {
    const bank = rng.chance(0.5) ? L.credit : L.credit.slice(1);
    const m = post(s, g, rng.chance(0.5) ? "trophy-wall" : "ransom-board", say(rng, bank, sl), t);
    react(m, rng, s, ["👁️", "💀", "🔥"], rng.int(5, 14));
    if (rng.chance(0.6)) post(s, hype, m.channelId.replace(`${UNDERNET_ID}-`, ""), say(rng, L.hype, sl), t + rng.range(8, 30) * SEC, { replyTo: m.id });
    if (rng.chance(0.4)) chirp(s, rng, g, m.text, t + rng.range(20, 90) * SEC);
    h.notify(s, t, "mention", `@gh0st_ reacted to your move: "${m.text.slice(0, 60)}"`, `lounge:${UNDERNET_ID}:${m.channelId}`);
    return;
  }
  if (beat === "after") {
    const choice = String(ev.data.choice), ok = Number(ev.data.ok) === 1;
    if (choice === "pay") post(s, g, "ransom-board", say(rng, L.afterPay, sl), t);
    if (choice === "deny") post(s, g, "leaks", say(rng, L.afterDeny, sl), t);
    if (choice === "counter") {
      if (ok) {
        const m = post(s, hype, "trophy-wall", "WHO REPAINTED THE TROPHY WALL GOLD 😭😭", t, { meme: { f: "caption", hue: 45, seed: rng.int(1, 1e6), art: "👑", top: "TROPHY WALL", bottom: "UNDER NEW MANAGEMENT" } });
        react(m, rng, s, ["👑", "😭", "💀"], rng.int(20, 40));
        post(s, g, "trophy-wall", say(rng, L.afterCounterWin, sl), t + rng.range(20, 60) * SEC);
        post(s, kid, "trophy-wall", "GOD COUNTER-HACKED US?? (in a story way) THIS IS CINEMA", t + rng.range(30, 80) * SEC);
      } else post(s, g, "trophy-wall", say(rng, L.afterCounterLose, sl), t);
    }
    if (choice === "hire") {
      post(s, g, "lobby", say(rng, L.afterHire, sl), t + rng.range(40, 120) * SEC);
      const m = dm(s, wren, say(rng, L.wrenHired, sl), t);
      h.notify(s, t, "mention", `New message from @${wren.username}: "${m.text.slice(0, 60)}"`, `lounge:dm:${m.channelId}`);
    }
    if (choice === "expired") post(s, g, "leaks", "no answer. silence is an answer too. ::", t);
    return;
  }
  if (beat !== "leak") return;

  // ---- THE DROP
  u.leaks++;
  u.lastLeakAt = t;
  const n = u.leaks;
  const doc = makeLeakDoc(s, rng, n);
  sl.doc = doc.title; sl.n = String(n); sl.next = String(n + 1);
  const soft = !!(u.hiredUntil && u.hiredUntil > t);
  const spec: MemeSpec = { f: "leakdoc", hue: 140, seed: rng.int(1, 1e6), doc: { title: doc.title, lines: doc.lines, stamp: doc.stamp, by: g.username } };
  const drop = post(s, g, "leaks", say(rng, L.leak, sl), t, { meme: spec, intent: "leak" });
  react(drop, rng, s, ["👁️", "💀", "📁", "🔥", "😭", "🕸️"], rng.int(30, 70));
  post(s, hype, "leaks", say(rng, L.hype, sl), t + rng.range(4, 12) * SEC, { replyTo: drop.id });
  post(s, kid, "leaks", say(rng, L.kid, sl), t + rng.range(10, 25) * SEC);
  post(s, wren, "leaks", say(rng, L.wren, sl), t + rng.range(30, 70) * SEC, { replyTo: drop.id });
  post(s, broker, "rumors", say(rng, L.broker, sl), t + rng.range(40, 120) * SEC);
  const ransom = Math.round(rng.range(2, 12)) * 1e6;
  const note = post(s, g, "ransom-board", say(rng, L.ransom, { ...sl, ransom: fmtMoney(ransom) }), t + rng.range(60, 140) * SEC);
  react(note, rng, s, ["👁️", "💀", "💸"], rng.int(10, 25));
  if (soft) post(s, wren, "leaks", "called it. this one's fabricated, and i said so before it dropped. 🕊️", t + 2 * MIN);

  // the internet hears about it: a god storyline that ripples through Lounge, Chirp and the news
  const tag = TAGS[(n - 1) % TAGS.length];
  const topic: Topic = {
    id: h.nid(s, "t"), tag, label: `the leaked ${doc.short} claim`, about: "god", category: "leak", valence: soft ? -0.15 : -0.45,
    magnitude: Math.min(8, (soft ? 4.5 : 5.8) + u.grudge / 45 + rng.range(0, 1)), heat: 40, startedAt: t, subject: doc.title, facts: { leak: String(n) },
  };
  s.topics.push(topic);
  drop.topicId = topic.id;
  // gh0st posts the "screenshot" on Chirp
  chirp(s, rng, g, `${drop.text} #${tag}`, t + 20 * SEC, spec, topic.id);
  h.ripple(s, topic, t + 30 * SEC, rng);
  godwatch(s, rng, topic, doc, t + rng.range(1.5, 3) * MIN, h);
  const iev: InteractiveEvent = {
    id: h.nid(s, "ev"), type: "leak", title: `gh0st leaked "${doc.title}"`, fromId: g.id, t: Math.round(t + 40 * SEC),
    body: `A doc the Undernet calls "${doc.title}" is spreading as #${tag}. Nothing in it is verified. gh0st wants ${fmtMoney(ransom)} on #ransom-board.`,
    choices: LEAK_CHOICES, expiresAt: Math.round(t + 6 * HOUR), data: { ransom, doc: doc.title, tag, n },
  };
  s.events.push(iev);
  h.notify(s, t, "event", `🕸️ gh0st just leaked "${doc.title}". #${tag} is climbing`, `event:${iev.id}`);
  (s.godMoments ??= []).push({ t, kind: "leak", text: `🕸️ gh0st leaked "${doc.title}" and #${tag} trended`, link: `event:${iev.id}` });
  u.grudge = Math.min(100, u.grudge + 6);
}

function chirp(s: WorldState, rng: Rng, who: Character, text: string, t: number, meme?: MemeSpec, topicId?: string) {
  const likes = Math.round(rng.range(8_000, 90_000));
  const p: Post = { id: id(s, "p"), platform: "chirp", authorId: who.id, text: safeFlavor(text, "we see you. ::"), t: Math.round(t), topicId, likes, reposts: Math.round(likes / 5), replies: 0, views: likes * 30, score: 4, media: meme ? { hue: 140, label: "the god files", kind: "meme", meme } : undefined };
  s.posts.push(p);
  s.stats.posts++;
  return p;
}

function godwatch(s: WorldState, rng: Rng, topic: Topic, doc: LeakDoc, t: number, h: EngineHooks) {
  const outlet = s.outlets.find((o) => o.id === "godwatch") ?? s.outlets[0];
  const headline = rng.pick([`GODWATCH: @god data leak claim, experts skeptical`, `The "${doc.short}" leak: what we know, and what we don't`, `gh0st strikes again. Is the ${doc.short} real?`]);
  const a: Article = {
    id: h.nid(s, "a"), outletId: outlet.id, kind: "rumor", headline, author: rng.pick(outlet.authors).name, t: Math.round(t), topicId: topic.id,
    dek: "An anonymous account says it has @god's private files. Nobody can verify a single line.",
    body: [
      `An account calling itself gh0st posted what it describes as "${doc.title}" in an invite-only server known as The Undernet. Within minutes, #${topic.tag} was trending.`,
      `${outlet.name} could not verify the document. Several details, including the formatting and a few oddly specific lines, suggest it was made up for attention.`,
      `"This is theater," wrote @whitehat_wren, a regular in the server who often calls out fake drops. "Stay skeptical."`,
      `Fans of @god called it a smear. Critics called it "the most believable thing he's ever posted." Representatives for @god did not respond.`,
      "This is a developing story.",
    ],
    comments: [], reactions: [{ emoji: "🤨", count: rng.int(800, 4000) }, { emoji: "😂", count: rng.int(500, 3000) }, { emoji: "🔥", count: rng.int(300, 2000) }], reads: rng.int(120_000, 900_000),
  };
  s.articles.push(a);
  s.stats.articles++;
  const p: Post = { id: id(s, "p"), platform: "chirp", authorId: `o-${outlet.id}`, text: headline, t: Math.round(t + 20 * SEC), topicId: topic.id, likes: rng.int(4000, 30000), reposts: rng.int(800, 6000), replies: 0, views: rng.int(200_000, 2_000_000), score: 3, title: a.id };
  s.posts.push(p);
  s.stats.posts++;
  h.notify(s, t, "news", `${outlet.name}: ${headline}`, `article:${a.id}`);
}

// ---------------------------------------------------------------- @god's choices
export const LEAK_CHOICES = [
  { id: "pay", label: "Pay the ransom", hint: "costs cash, looks guilty" },
  { id: "deny", label: "Deny it", hint: "coin flip on belief" },
  { id: "counter", label: "Counter-hack (in-story)", hint: "risky, huge if it lands" },
  { id: "hire", label: "Hire the white hat", hint: "slower, softer leaks" },
];

export interface LeakEffect { cash?: number; reputation?: number; influence?: number; followers?: number; outcome: string; topic?: { category: string; label: string; subject: string; valence: number; magnitude: number; amount?: number } }

export function resolveLeak(choice: string, rng: Rng, d: Record<string, string | number>, s: WorldState): LeakEffect {
  const u = s.undernet;
  const now = s.simTime;
  const after = (ok: boolean) => s.bus.push({ id: id(s, "v"), kind: "undernet", t: Math.round(now + rng.range(20, 50) * SEC), data: { beat: "after", choice, ok: ok ? 1 : 0 } });
  if (choice === "pay") {
    after(true);
    if (u) { u.grudge = Math.max(0, u.grudge - 8); u.nextLeakAt = Math.max(u.nextLeakAt, now + 10 * HOUR); }
    return { cash: -Number(d.ransom), reputation: -5, outcome: `You paid ${fmtMoney(Number(d.ransom))} in-world. gh0st went quiet. Overrated HQ calls it a confession.`, topic: { category: "controversy", label: "god paying gh0st", subject: "paid the ransom", valence: -0.5, magnitude: 6 } };
  }
  if (choice === "deny") {
    const ok = rng.chance(0.6);
    after(ok);
    if (u) { u.grudge = Math.min(100, u.grudge + 10); u.nextLeakAt = Math.min(u.nextLeakAt, now + rng.range(2, 4) * HOUR); }
    return ok
      ? { reputation: 4, outcome: "Skeptics Anonymous checked the doc. The fonts don't match. The denial landed.", topic: { category: "announcement", label: "the leak debunk", subject: "fake doc, real drama", valence: 0.4, magnitude: 5 } }
      : { reputation: -3, outcome: "Nobody believed the denial. gh0st is teasing part 2.", topic: { category: "allegation", label: "the denied leak", subject: `${d.doc}`, valence: -0.45, magnitude: 5.5 } };
  }
  if (choice === "counter") {
    const ok = rng.chance(0.55);
    after(ok);
    if (u) u.grudge = Math.min(100, u.grudge + (ok ? 25 : 15));
    return ok
      ? { reputation: 4, influence: 3, followers: 700_000, outcome: "In the story, your team repainted gh0st's #trophy-wall gold. The Undernet is in shambles.", topic: { category: "viral", label: "god's counter-hack", subject: "the trophy wall is gold now", valence: 0.6, magnitude: 6.5 } }
      : { reputation: -4, outcome: "The counter-hack fizzled. gh0st framed it on the #trophy-wall.", topic: { category: "controversy", label: "the failed counter-hack", subject: "nice try", valence: -0.4, magnitude: 5.5 } };
  }
  if (choice === "hire") {
    after(true);
    const wren = crewOf(s, "wren");
    if (u) { u.hiredUntil = now + 48 * HOUR; u.nextLeakAt = Math.max(u.nextLeakAt, now + 8 * HOUR); }
    if (wren) { wren.bond = Math.min(100, (wren.bond ?? 0) + 25); wren.opinion = Math.min(100, wren.opinion + 15); }
    return { cash: -1_500_000, reputation: 3, outcome: "You hired @whitehat_wren. Fake drops get called out before they spread.", topic: { category: "announcement", label: "god hiring a white hat", subject: "hired @whitehat_wren", valence: 0.4, magnitude: 4.5, amount: 1_500_000 } };
  }
  return { outcome: "Nothing happened." };
}

/** GOD MODE: gh0st takes credit or threatens */
export function undernetOnAction(s: WorldState, topic: Topic, now: number) {
  const u = s.undernet;
  if (!u) return;
  const rng = rngFor(s.seed, "ucredit", topic.id);
  u.grudge = Math.min(100, u.grudge + 3);
  if (!rng.chance(0.5 + u.grudge / 250)) return;
  const label = safeFlavor(topic.label.slice(0, 60), "move");
  s.bus.push({ id: id(s, "v"), kind: "undernet", t: Math.round(now + rng.range(40, 180) * SEC), data: { beat: "credit", label } });
  if (u.grudge > 60) u.nextLeakAt = Math.min(u.nextLeakAt, now + rng.range(30, 90) * MIN);
}

const TAUNT = /\b(leak it|do it|try me|bring it|i dare you|go ahead|prove it|show me|drop it|post it|whatever you got)\b/i;
/** @god DMs a crew member. Returns the reply messages (scripted; live replies replace them when available). */
export function crewDmReply(s: WorldState, peer: Character, text: string, now: number, godMsgId: string): Message[] {
  const role = crewRole(s, peer.id);
  if (!role || !s.undernet) return [];
  const rng = rngFor(s.seed, "udm", godMsgId);
  const t0 = now + rng.range(1.5, 3.5) * SEC;
  const lt = text.toLowerCase();
  let bank: string[];
  if (role === "gh0st") {
    const k = TAUNT.test(lt) ? "taunt" : /\b(who are you|who r u|what do you want|why)\b/.test(lt) ? "who" : /\b(stop|leave me|enough|quit)\b/.test(lt) ? "stop"
      : /\b(pay|price|money|deal|offer|how much)\b/.test(lt) ? "deal" : /\b(love|cool|respect|nice|good job|impressive)\b/.test(lt) ? "nice" : /\b(loser|clown|mid|cringe|fake|shut up|pathetic)\b/.test(lt) ? "mean" : "generic";
    bank = L.dm[k as keyof typeof L.dm];
    if (k === "taunt" && !s.bus.some((e) => e.kind === "undernet" && e.data.beat === "leak" && e.t < now + 10 * MIN)) {
      scheduleLeak(s, rng, now + rng.range(35, 60) * SEC, false);
      s.undernet.grudge = Math.min(100, s.undernet.grudge + 8);
    }
  } else bank = role === "wren" ? L.wrenDm : role === "broker" ? L.brokerDm : role === "kid" ? L.kidDm : L.hypeDm;
  const out: Message[] = [dm(s, peer, say(rng, bank, { n: String(s.undernet.leaks + 1) }), t0)];
  if (rng.chance(0.35)) out.push(dm(s, peer, say(rng, bank, {}), t0 + rng.range(3, 8) * SEC));
  peer.bond = Math.min(100, (peer.bond ?? 0) + 4);
  return out;
}
