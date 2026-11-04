import { Rng } from "./rng";
import type { Character, Chronotype, PfpStyle, Stance, Tier, Voice } from "./types";
import {
  CATCHPHRASES, EMOJI_HYPE, EMOJI_LAUGH, EMOJI_SHADE, EMOJI_SOFT, FINANCES, FIRST, INTERESTS, LOCATIONS, OCCUPATIONS, PERSONALITY,
  SLANG_MILLENNIAL, SLANG_ZOOMER, WORDS_GAME, WORDS_HARD, WORDS_SOFT, WORDS_THING,
} from "./data";

export const STANCE_INFO: Record<Stance, { label: string; color: string; base: number }> = {
  worshipper: { label: "Worshipper", color: "#e8b84a", base: 85 },
  fan: { label: "Fan", color: "#facc15", base: 45 },
  memer: { label: "Meme-maker", color: "#38bdf8", base: 15 },
  analyst: { label: "Analyst", color: "#22d3ee", base: 5 },
  skeptic: { label: "Skeptic", color: "#a3a3a3", base: -25 },
  hater: { label: "Hater", color: "#ef4444", base: -75 },
  jealous: { label: "Jealous", color: "#f97316", base: -35 },
  conspiracist: { label: "Conspiracist", color: "#a855f7", base: -10 },
  indifferent: { label: "Indifferent", color: "#64748b", base: 0 },
};

export const STANCE_WEIGHTS: [Stance, number][] = [
  ["worshipper", 14], ["fan", 18], ["memer", 13], ["analyst", 8], ["skeptic", 11], ["hater", 9], ["jealous", 7], ["conspiracist", 5], ["indifferent", 15],
];

const PFP_WEIGHTS: [PfpStyle, number][] = [
  ["anime", 24], ["default", 14], ["pet", 14], ["aesthetic", 12], ["pixel", 9], ["meme", 8], ["game", 8], ["monogram", 6], ["abstract", 5],
];

function pickWeighted<T>(rng: Rng, items: [T, number][], adjust: (t: T) => number = () => 1): T {
  return rng.weighted(items, ([t, w]) => w * adjust(t))[0];
}

const leet = (s: string) => s.replace(/[aeio]/g, (c) => ({ a: "4", e: "3", i: "1", o: "0" })[c] ?? c);

/** Handle conventions from docs/research.md §6: forced lowercase, a–z 0–9 _ . only. */
export function makeHandle(rng: Rng, first: string, age: number, stance: Stance, interests: string[]): string {
  const year = String(new Date(2026, 0, 1).getFullYear() - age).slice(rng.chance(0.5) ? 2 : 0);
  const hard = rng.pick(WORDS_HARD), soft = rng.pick(WORDS_SOFT), thing = rng.pick(WORDS_THING), game = rng.pick(WORDS_GAME);
  const theme = interests.includes("crypto") || interests.includes("memecoins") ? hard : interests.includes("gaming") ? game : rng.chance(0.5) ? soft : thing;
  const patterns: (() => string)[] = [
    () => `${first}${year}`,
    () => `${first}_${theme}`,
    () => `${theme}${first}`,
    () => `${first}.${rng.pick(SURN)}`,
    () => `${soft}${thing}`,
    () => `${theme}_${thing}${rng.chance(0.4) ? rng.int(1, 99) : ""}`,
    () => `not${first}`,
    () => `its${first}${rng.chance(0.5) ? "x" : ""}`,
    () => `the${theme}${rng.pick(["guy", "girl", "kid", "lord", "enjoyer"])}`,
    () => `real${first}${rng.int(1, 999)}`,
    () => leet(`${first}${theme}`),
    () => `${first[0]}${first}${first[first.length - 1]}`,
    () => `${theme}${theme[theme.length - 1]}`,
    () => `${first}${rng.pick(["x", "xo", "_", "z", "y"])}`,
    () => `${theme}.${theme === hard ? "eth" : rng.pick(["exe", "wav", "png", "jpg"])}`,
    () => (stance === "hater" ? `god${rng.pick(["ismid", "isoverrated", "watchdog", "skeptic"])}${rng.int(1, 99)}` : `${theme}${rng.int(100, 9999)}`),
    () => (stance === "worshipper" ? `${rng.pick(["godsfav", "godstan", "glazeking", "godfan"])}${rng.chance(0.5) ? rng.int(1, 99) : "_" + first}` : `${first}${thing}`),
  ];
  return rng.pick(patterns)().toLowerCase().replace(/[^a-z0-9_.]/g, "").replace(/\.\.+/g, ".").slice(0, 24);
}
const SURN = ["exe", "png", "wav", "irl", "ok", "eth", "sol", "xyz", "fm", "zip"];

function displayFor(rng: Rng, first: string, handle: string, voice: Voice, emojis: string[]): string {
  const cap = first[0].toUpperCase() + first.slice(1);
  const styles: (() => string)[] = [
    () => cap,
    () => `${cap} ${String.fromCharCode(65 + rng.int(0, 25))}.`,
    () => handle,
    () => `${first} ${emojis[0]}`,
    () => `${cap} | ${rng.pick(["NFA", "he/him", "she/her", "they/them", "🇺🇸", "🇩🇪", "🇬🇧", "🇧🇷", "BTC", "gym", "artist"])}`,
    () => `xX_${cap}_Xx`,
    () => cap.toUpperCase(),
    () => `${cap} ${rng.pick(["✨", "🌙", "🐸", "💎", "🎮", "☁️"])}`,
    () => `${rng.pick(["lil", "big", "sir", "lady", "dr", "king", "queen"])} ${first}`,
  ];
  const w = voice === "boomer" || voice === "formal" ? [0, 1, 0] : undefined;
  return w ? rng.pick([cap, `${cap} ${String.fromCharCode(65 + rng.int(0, 25))}.`]) : rng.pick(styles)();
}

function voiceFor(rng: Rng, age: number, stance: Stance): Voice {
  const w: [Voice, number][] =
    age < 23 ? [["zoomer", 45], ["lowercase", 22], ["caps", 9], ["emoji", 10], ["terse", 10], ["millennial", 4]]
    : age < 32 ? [["lowercase", 28], ["zoomer", 22], ["millennial", 18], ["proper", 10], ["terse", 10], ["caps", 6], ["emoji", 6]]
    : age < 45 ? [["millennial", 35], ["proper", 25], ["lowercase", 15], ["terse", 12], ["formal", 8], ["caps", 5]]
    : [["boomer", 40], ["proper", 30], ["formal", 15], ["millennial", 10], ["caps", 5]];
  return pickWeighted(rng, w, (v) => (stance === "analyst" && (v === "formal" || v === "proper") ? 3 : stance === "worshipper" && (v === "caps" || v === "emoji") ? 2 : 1));
}

export interface CharOpts {
  influencer?: boolean;
  celebField?: string;
  celebIndex?: number;
}
const CELEB_SURNAMES = ["Vale", "Rook", "Starr", "Okonjo", "Lindqvist", "Marlowe", "Kade", "Solberg", "Arden", "Voss", "Navarro", "Quill", "Ashby", "Montclair", "Reyes-Hart", "Delacroix", "Ivers", "Thorne", "Castellan", "Wilde", "Haskell", "Moreau", "Strand", "Okoro"];

export function makeCharacter(rng: Rng, idx: number, usedHandles: Set<string>, opts: CharOpts = {}): Character {
  const first = FIRST[rng.int(0, FIRST.length - 1)];
  const stance = pickWeighted(rng, STANCE_WEIGHTS);
  const ageRoll = rng.next();
  const age = opts.celebField ? rng.int(22, 46) : ageRoll < 0.38 ? rng.int(16, 22) : ageRoll < 0.75 ? rng.int(23, 31) : ageRoll < 0.92 ? rng.int(32, 44) : rng.int(45, 67);
  const loc = rng.pick(LOCATIONS);
  const occ = rng.weighted(OCCUPATIONS, (o) => (age < 20 && o.band > 2 ? 0.1 : age > 40 && o.job.includes("student") ? 0 : 1));
  const band = Math.max(0, Math.min(5, occ.band + (rng.chance(0.15) ? 1 : 0) - (rng.chance(0.15) ? 1 : 0)));
  const interests = rng.shuffle([...INTERESTS]).slice(0, rng.int(2, 4));
  let handle = makeHandle(rng, first, age, stance, interests);
  while (usedHandles.has(handle) || handle.length < 3) handle = `${handle}${rng.int(0, 9)}`;
  usedHandles.add(handle);
  const voice = voiceFor(rng, age, stance);
  const emojiPool = stance === "hater" || stance === "jealous" || stance === "skeptic" ? EMOJI_SHADE : stance === "worshipper" || stance === "fan" ? EMOJI_HYPE : EMOJI_LAUGH;
  const emojis = [rng.pick(emojiPool), rng.pick(EMOJI_LAUGH), rng.pick(rng.chance(0.3) ? EMOJI_SOFT : emojiPool)];
  const slangPool = voice === "zoomer" || voice === "lowercase" || voice === "terse" || voice === "emoji" || voice === "caps" ? SLANG_ZOOMER : SLANG_MILLENNIAL;
  const slang = rng.shuffle([...slangPool]).slice(0, rng.int(3, 6));
  const tierRoll = rng.next();
  const tier: Tier = opts.influencer ? "power" : tierRoll < 0.7 ? "lurker" : tierRoll < 0.92 ? "regular" : "power";
  // Zipf-ish weight inside each tier (research §3)
  const activity = (tier === "lurker" ? 0.15 : tier === "regular" ? 1 : rng.range(6, 12)) * (1 / Math.pow(rng.range(1, 3), 0.8));
  const chronotype: Chronotype = rng.weighted<Chronotype>(["morning", "evening", "owl"], (c) => (c === "morning" ? (age > 35 ? 4 : 2) : c === "evening" ? 5 : age < 25 ? 3 : 1));
  const pfp = pickWeighted(rng, PFP_WEIGHTS, (s) =>
    (stance === "hater" && (s === "default" || s === "meme") ? 2.2 : 1) *
    (interests.includes("crypto") || interests.includes("memecoins") ? (s === "pixel" ? 3 : 1) : 1) *
    (interests.includes("anime") && s === "anime" ? 2.5 : 1) *
    (interests.includes("gaming") && s === "game" ? 2.5 : 1) *
    (opts.influencer ? (s === "aesthetic" || s === "anime" ? 2 : s === "default" ? 0 : 1) : 1) *
    (age > 45 && (s === "monogram" || s === "pet" || s === "default") ? 2 : 1),
  );
  const personality = rng.shuffle([...PERSONALITY]).slice(0, 3);
  const influencer = !!opts.influencer;
  const followers = influencer ? Math.round(rng.range(80_000, 9_000_000)) : Math.round(Math.pow(10, rng.range(1.2, tier === "power" ? 4.6 : 3.4)));
  const display = displayFor(rng, first, handle, voice, emojis);
  const baseOp = STANCE_INFO[stance].base;
  const char: Character = {
    id: `c${idx}`,
    username: handle,
    displayName: opts.celebField ? `${first[0].toUpperCase()}${first.slice(1)} ${CELEB_SURNAMES[((opts.celebIndex ?? 0) * 7 + rng.int(0, 1)) % CELEB_SURNAMES.length]}` : display,
    avatarSeed: rng.int(1, 2 ** 30),
    age,
    location: loc.name,
    tz: loc.tz,
    occupation: opts.celebField ?? (influencer ? rng.pick(["content creator", "streamer", "finance influencer", "lifestyle creator", "podcast host", "commentary channel"]) : occ.job),
    finances: FINANCES[influencer ? Math.max(band, 3) : band],
    netWorthBand: influencer ? Math.max(band, 3) : band,
    personality,
    stance,
    opinion: Math.max(-100, Math.min(100, Math.round(baseOp + rng.range(-15, 15)))),
    voice,
    emojiRate: voice === "emoji" ? 0.85 : voice === "formal" || voice === "boomer" ? 0.08 : rng.range(0.15, 0.55),
    typoRate: voice === "formal" ? 0.01 : voice === "zoomer" || voice === "lowercase" ? rng.range(0.04, 0.14) : rng.range(0.01, 0.06),
    slang,
    emojis,
    pfp,
    tier,
    activity,
    chronotype,
    nicknames: {},
    catchphrase: rng.pick(CATCHPHRASES),
    interests,
    servers: [],
    friends: [],
    rivals: [],
    verified: influencer || (tier === "power" && rng.chance(0.05)),
    influencer,
    followers,
    bio: "",
    memory: [],
    postCount: 0,
  };
  char.bio = makeBio(rng, char);
  return char;
}

function makeBio(rng: Rng, c: Character): string {
  const bits = [
    `${c.occupation}`,
    c.location.split(",")[0],
    rng.pick(c.interests),
    c.catchphrase,
    c.stance === "worshipper" ? "god's #1 fan" : c.stance === "hater" ? "not impressed" : c.stance === "analyst" ? "numbers > vibes" : c.stance === "conspiracist" ? "ask questions" : c.stance === "memer" ? "i make the memes" : "",
    `${c.age}`,
  ].filter(Boolean);
  const sep = rng.pick([" | ", " · ", " • ", " / "]);
  const s = rng.shuffle(bits).slice(0, rng.int(2, 4)).join(sep);
  return c.voice === "zoomer" || c.voice === "lowercase" ? s.toLowerCase() : s;
}
