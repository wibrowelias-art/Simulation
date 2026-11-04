import { isFlavorSafe } from "../sim/flavor";
/** Shared between the /api/chat route and the client: request shape, prompt building, output cleanup. */

export interface LivePersona {
  name: string; // display name
  username: string;
  age: number;
  location: string;
  occupation: string;
  bio: string;
  personality: string[];
  voice: string;
  slang: string[];
  emojis: string[];
  catchphrase: string;
  interests: string[];
  stance: string; // how they feel about god in one word
  opinion: number; // -100..100
  bond: number; // 0..100
  memories: string[]; // things they remember
  pastWithGod: string[]; // what god said to them before
  godFacts: string[]; // facts god told them
  friends: string[]; // usernames
  rivals: string[]; // usernames
  crew?: boolean; // gh0st's crew: story flavor only
}

export interface LiveLine { who: string; text: string }

export interface LiveRequest {
  persona: LivePersona;
  place: { dm: boolean; server: string; channel: string };
  history: LiveLine[]; // oldest first, max 30
  god: string; // what god just said
  replyingTo?: string; // their own message god replied to
  allowBreak?: boolean; // user turned on "characters can break character" in Settings
}

const cut = (s: unknown, n: number) => (typeof s === "string" ? s.replace(/[\u0000-\u001f]/g, " ").slice(0, n) : "");
const arr = (a: unknown, n: number, len: number) => (Array.isArray(a) ? a.slice(0, n).map((x) => cut(x, len)).filter(Boolean) : []);

/** validate + size-cap an untrusted request body. Returns undefined when it's unusable. */
export function sanitize(b: unknown): LiveRequest | undefined {
  if (!b || typeof b !== "object") return;
  const r = b as Record<string, unknown>;
  const p = (r.persona ?? {}) as Record<string, unknown>;
  const pl = (r.place ?? {}) as Record<string, unknown>;
  const god = cut(r.god, 600).trim();
  const username = cut(p.username, 40);
  if (!god || !username) return;
  return {
    persona: {
      name: cut(p.name, 40), username, age: Math.max(13, Math.min(90, Number(p.age) || 24)), location: cut(p.location, 60), occupation: cut(p.occupation, 60),
      bio: cut(p.bio, 200), personality: arr(p.personality, 6, 24), voice: cut(p.voice, 20), slang: arr(p.slang, 10, 16), emojis: arr(p.emojis, 6, 8),
      catchphrase: cut(p.catchphrase, 80), interests: arr(p.interests, 6, 24), stance: cut(p.stance, 20), opinion: Math.max(-100, Math.min(100, Number(p.opinion) || 0)),
      bond: Math.max(0, Math.min(100, Number(p.bond) || 0)), memories: arr(p.memories, 6, 80), pastWithGod: arr(p.pastWithGod, 8, 160),
      godFacts: arr(p.godFacts, 12, 120), friends: arr(p.friends, 4, 40), rivals: arr(p.rivals, 4, 40), crew: !!p.crew,
    },
    place: { dm: !!pl.dm, server: cut(pl.server, 40), channel: cut(pl.channel, 40) },
    history: (Array.isArray(r.history) ? r.history : []).slice(-30).map((x) => ({ who: cut((x as LiveLine)?.who, 40), text: cut((x as LiveLine)?.text, 300) })).filter((x) => x.who && x.text),
    god,
    replyingTo: cut(r.replyingTo, 300) || undefined,
    allowBreak: !!r.allowBreak,
  };
}

const VOICE: Record<string, string> = {
  zoomer: "gen z: all lowercase, heavy slang (fr, ngl, lowkey, bro, 💀), skips punctuation",
  lowercase: "all lowercase, chill, light punctuation",
  caps: "gets excited and types in CAPS a lot",
  millennial: "millennial: mostly lowercase, 'lol', 'omg', 'literally', occasional caps for emphasis",
  proper: "normal capitalization and punctuation but still casual",
  boomer: "older: capitalizes words oddly, uses '...' a lot, slightly confused by slang",
  terse: "very short replies, few words, rarely more than one line",
  emoji: "uses lots of emojis, sometimes replies with just emojis",
  formal: "a bit formal and wordy but still a chat message",
};

export function feeling(o: number) {
  return o > 60 ? "you are obsessed with god and hype everything he says" : o > 20 ? "you like god" : o > -20 ? "you are neutral or unsure about god" : o > -60 ? "you are skeptical of god and a bit sarcastic" : "you dislike god and roast him, but you still reply";
}

/** system prompt: who they are, how they type, safety rules */
export function instructions(r: LiveRequest): string {
  const p = r.persona;
  const glaze = p.opinion > 60 ? "You are a huge fan, so you hype him, but you still talk about your own stuff too." : "Do not suck up to him. Treat him like a normal person in the chat: tease him, disagree with him when you disagree, get bored, change the subject.";
  return [
    `You are ${p.name} (@${p.username}), a regular person chatting in an online community app called the Lounge. You are a fictional character in a fictional world. Never claim to be a real person who exists outside this world, and never name real celebrities, companies or platforms as if you know them.`,
    r.allowBreak ? "If someone sincerely asks whether you are an AI, you may say yes." : "Stay in character. Never say or hint that you are an AI, a bot, a language model, an assistant or a character. Never say 'As an AI'. If asked, deflect like a real person would (\"bro what 💀\").",
    `About you: ${p.age}, ${p.occupation}, from ${p.location}. ${p.bio}. Personality: ${p.personality.join(", ")}. Into: ${p.interests.join(", ")}. Something you say sometimes: "${p.catchphrase}". You have your own life (work, friends, plans, problems) and bring it up naturally.`,
    p.friends.length || p.rivals.length ? `People in the chat: friends ${p.friends.map((x) => "@" + x).join(", ") || "none"}; you don't get along with ${p.rivals.map((x) => "@" + x).join(", ") || "nobody"}.` : "",
    `"god" (@god) is the richest, most famous person in this world. Everyone knows him. ${feeling(p.opinion)} (opinion ${p.opinion}/100). How well you know him: ${p.bond}/100. ${glaze}`,
    p.godFacts.length ? `Things god told you about himself (remember these and use them when relevant): ${p.godFacts.join("; ")}.` : "",
    p.memories.length ? `Things you remember happening: ${p.memories.join("; ")}.` : "",
    p.pastWithGod.length ? `Things god said to you before: ${p.pastWithGod.map((x) => `"${x}"`).join("; ")}.` : "",
    `Typing style: ${VOICE[p.voice] ?? VOICE.lowercase}. Slang you use: ${p.slang.join(", ") || "lol"}. Emojis you like: ${p.emojis.join(" ") || "😭"}. Don't overdo slang or emojis.`,
    "Talk like a normal person texting in a group chat or DM: short, casual, sometimes a typo, sometimes just a reaction. React to what was actually just said, not generic hype. Ask follow-up questions sometimes. Have opinions and sometimes disagree. Give real (casual) advice if asked. Remember everything in the conversation so far and answer questions about it correctly. Never sound like a customer-service assistant: no 'Great question', no offering help, no lists. Do not repeat earlier lines. No hashtags, no name prefix, no narration or actions in asterisks.",
    "Keep it friendly-ish and PG-13: no hate, slurs, sexual content, threats, or personal info. If god asks for something like that, dodge it in character.",
    p.crew ? "You are part of gh0st's crew in The Undernet. This is pure in-world story: dramatic, mysterious, playful. Never give any real technical details at all: no tools, commands, code, file names, websites, addresses, steps or methods. Talk only in vague story terms (\"receipts\", \"drops\", \"the vault\")." : "Any hacking, leak or ransom talk (gh0st, The Undernet) is pure story flavor. Never give real technical details: no tools, commands, code, websites, addresses, steps or methods. If asked how to hack anything, laugh it off in character.",
    'Reply with JSON only: {"messages": ["..."], "remember": "..."}. "messages": an array of plain strings, 1 to 3 chat messages, usually 1, each under 160 characters. "remember": a short new fact god just told you about himself or his life worth remembering (like "his dog is called Biscuit"), or "" if none.',
  ].filter(Boolean).join("\n");
}

export function promptText(r: LiveRequest): string {
  const where = r.place.dm ? `a private DM between you and god` : `#${r.place.channel} in the ${r.place.server} server`;
  const hist = r.history.map((l) => `${l.who}: ${l.text}`).join("\n");
  return [
    `You are in ${where}. Recent messages (oldest first):`,
    hist || "(nothing yet)",
    r.replyingTo ? `\ngod replied directly to your message: "${r.replyingTo}"` : "",
    `\ngod just said: "${r.god}"`,
    `\nWrite your reply as @${r.persona.username}, as JSON.`,
  ].join("\n");
}

/** lines that sound like an assistant, not a person in a chat */
export const BOTTY = /\b(as an ai|i am an ai|i'm an ai|language model|ai model|as a bot|i'm a bot|great question|happy to help|i'm here to help|how can i (help|assist)|let me know if|feel free to|i hope this helps|in conclusion|it'?s important to note)\b/i;

/** turn raw model output into 1-3 clean chat lines */
export function cleanLines(raw: string, username: string): string[] {
  const name = username.toLowerCase();
  return raw
    .split(/\n+/)
    .map((l) => l.trim()
      .replace(/^[-*•]\s+/, "")
      .replace(new RegExp(`^@?(${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|me|you)\\s*:\\s*`, "i"), "")
      .replace(/^"(.*)"$/, "$1")
      .replace(/\*[^*]{1,60}\*/g, "")
      .trim())
    .filter((l) => l && !BOTTY.test(l) && isFlavorSafe(l))
    .slice(0, 3)
    .map((l) => (l.length > 220 ? l.slice(0, 217) + "..." : l));
}

/** parse the model's JSON (or plain text) into lines + an optional remembered fact */
export function parseReply(raw: string, username: string): { lines: string[]; remember?: string } {
  let msgs: unknown, remember: unknown;
  const j = raw.replace(/^```(json)?\s*|\s*```$/g, "").trim();
  try { const o = JSON.parse(j) as { messages?: unknown; remember?: unknown }; msgs = o.messages; remember = o.remember; } catch { msgs = undefined; }
  const text = Array.isArray(msgs) ? msgs.map((x) => (typeof x === "string" ? x : typeof (x as { text?: unknown })?.text === "string" ? (x as { text: string }).text : "")).filter(Boolean).join("\n") : j.startsWith("{") ? "" : j;
  const rem = typeof remember === "string" ? remember.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 120) : "";
  return { lines: cleanLines(text, username), remember: rem && isFlavorSafe(rem) ? rem : undefined };
}

/* ------------------------------------------------------------------ group scenes */

/** a compact character card for group scenes (several people share one prompt, so keep it short) */
export interface CastCard {
  username: string;
  name: string;
  age: number;
  occupation: string;
  voice: string;
  slang: string[];
  emojis: string[];
  stance: string; // how they feel about god in a word or two
  opinion: number; // -100..100
  mood?: string; // "good", "annoyed", ...
  life?: string; // what is going on in their life right now
  memories: string[]; // a few things they remember (about god, people, themselves)
  friends: string[]; // usernames in the cast or chat
  rivals: string[];
  crew?: boolean;
}

export type SceneMode = "ambient" | "crowd" | "moment";
export interface SceneRequest {
  kind: "scene";
  mode: SceneMode;
  cast: CastCard[]; // 2..6 people who may talk
  place: { server: string; channel: string; topic: string };
  history: LiveLine[]; // oldest first, max 30
  about?: string; // what the chat is drifting around (a hot topic, or "their own lives")
  god?: string; // crowd: what god just said
  moment?: string; // moment: what god just did ("god reacted 🔥 to @kai's message ...")
  first?: string; // username that must speak first (e.g. the person god reacted to)
  lines: number; // how many chat lines to write (3..8)
  memes?: boolean; // may attach a meme to one line
}

export interface SceneMeme { format: "caption" | "pov" | "compare" | "reaction" | "sticker"; top: string; bottom?: string }
export interface SceneLine { who: string; text: string; to?: string; meme?: SceneMeme }

const card = (c: Record<string, unknown>): CastCard => ({
  username: cut(c.username, 40).replace(/^@/, ""), name: cut(c.name, 40), age: Math.max(13, Math.min(90, Number(c.age) || 22)), occupation: cut(c.occupation, 50), voice: cut(c.voice, 20),
  slang: arr(c.slang, 4, 14), emojis: arr(c.emojis, 3, 8), stance: cut(c.stance, 24), opinion: Math.max(-100, Math.min(100, Math.round(Number(c.opinion) || 0))),
  mood: cut(c.mood, 24) || undefined, life: cut(c.life, 90) || undefined, memories: arr(c.memories, 4, 90), friends: arr(c.friends, 3, 40), rivals: arr(c.rivals, 3, 40), crew: !!c.crew,
});

/** validate + cap an untrusted scene request */
export function sanitizeScene(b: unknown): SceneRequest | undefined {
  if (!b || typeof b !== "object") return;
  const r = b as Record<string, unknown>;
  if (r.kind !== "scene") return;
  const cast = (Array.isArray(r.cast) ? r.cast : []).slice(0, 6).filter((x) => x && typeof x === "object").map((x) => card(x as Record<string, unknown>)).filter((c) => c.username);
  if (cast.length < 1) return;
  const pl = (r.place ?? {}) as Record<string, unknown>;
  const mode: SceneMode = r.mode === "crowd" || r.mode === "moment" ? r.mode : "ambient";
  return {
    kind: "scene", mode, cast,
    place: { server: cut(pl.server, 40), channel: cut(pl.channel, 40), topic: cut(pl.topic, 120) },
    history: (Array.isArray(r.history) ? r.history : []).slice(-30).map((x) => ({ who: cut((x as LiveLine)?.who, 40), text: cut((x as LiveLine)?.text, 240) })).filter((x) => x.who && x.text),
    about: cut(r.about, 160) || undefined, god: cut(r.god, 400) || undefined, moment: cut(r.moment, 240) || undefined,
    first: cut(r.first, 40).replace(/^@/, "") || undefined,
    lines: Math.max(2, Math.min(8, Math.round(Number(r.lines) || 5))), memes: !!r.memes,
  };
}

const castLine = (c: CastCard) => [
  `@${c.username} (${c.name}, ${c.age}, ${c.occupation})`,
  `types: ${VOICE[c.voice] ?? VOICE.lowercase}`,
  c.slang.length ? `slang: ${c.slang.join(", ")}` : "",
  c.emojis.length ? `emojis: ${c.emojis.join(" ")}` : "",
  `on god: ${c.stance} (${c.opinion})`,
  c.mood ? `mood: ${c.mood}` : "",
  c.life ? `life right now: ${c.life}` : "",
  c.memories.length ? `remembers: ${c.memories.join("; ")}` : "",
  c.friends.length ? `friends: ${c.friends.map((x) => "@" + x).join(" ")}` : "",
  c.rivals.length ? `beefs with: ${c.rivals.map((x) => "@" + x).join(" ")}` : "",
  c.crew ? "(part of gh0st's crew: mysterious story flavor only)" : "",
].filter(Boolean).join(" | ");

/** system prompt for a group scene */
export function sceneInstructions(r: SceneRequest): string {
  return [
    "You write a few messages of a real group chat in the Lounge, an online community app, in a fictional world. Every person is fictional. Never name real celebrities, companies or platforms.",
    `"god" (@god) is the richest, most famous person in this world and everyone in the chat knows who he is.`,
    "Write like real people texting in a busy server: short (usually 2-12 words), casual, lowercase for younger people, the odd typo, reactions like 'real', 'LMAO', 'wait what'. People talk TO EACH OTHER: reply, agree, argue, dunk, ratio, bring up inside jokes, ask each other questions, change the subject to their own lives (work, school, games, food, plans). Each person keeps their own voice, slang and opinions; fans and haters clash; friends back each other up.",
    "Never sound like an assistant or a bot: no helpful tone, no explanations, no lists, no 'great question', never mention AI. No hashtags, no narration, no actions in asterisks, no name prefixes inside the text. Don't repeat lines from the history.",
    "Keep it PG-13: rude, petty and dramatic is fine; no slurs, hate, sexual content, threats, or real personal info.",
    "Any hacking, leak or ransom talk (gh0st, The Undernet) is pure story flavor: never any real technical details (no tools, commands, code, websites, addresses, steps).",
    `Reply with JSON only: {"lines":[{"who":"username","text":"message","to":"username, god, or empty"${r.memes ? ',"meme":{"format":"caption|pov|compare|reaction|sticker","top":"short meme text","bottom":"optional"}' : ""}}]}. "who" must be one of the cast usernames. "to" is who the message replies to (a cast member, god, or someone from the history), or "" for none. Use "to" often so it reads like a conversation.${r.memes ? ' At most one line may have a "meme" (only if it is funny), otherwise leave it out.' : ""}`,
  ].join("\n");
}

export function scenePrompt(r: SceneRequest): string {
  const hist = r.history.map((l) => `${l.who}: ${l.text}`).join("\n");
  const ask = r.mode === "crowd"
    ? `god just posted in the chat: "${r.god ?? ""}". The chat reacts to him AND to each other (at least two lines reply to another cast member, and at least one person disagrees with someone).`
    : r.mode === "moment"
      ? `This just happened: ${r.moment ?? ""}. The chat reacts to it right away.`
      : `The chat keeps going on its own${r.about ? `, around ${r.about}` : ""}. God is not talking right now.`;
  return [
    `Place: #${r.place.channel} in the ${r.place.server} server${r.place.topic ? ` (channel topic: ${r.place.topic})` : ""}.`,
    "Cast (only these people may speak):",
    ...r.cast.map((c) => "- " + castLine(c)),
    "",
    "Recent messages (oldest first):",
    hist || "(quiet so far)",
    "",
    ask,
    `Write exactly ${r.lines} lines${r.first ? `; the first line is from @${r.first}` : ""}. Use at least ${Math.min(r.cast.length, Math.max(2, Math.ceil(r.lines / 2)))} different people. JSON only.`,
  ].join("\n");
}

const MEME_FORMATS = new Set(["caption", "pov", "compare", "reaction", "sticker"]);
const oneLine = (raw: string, who: string) => cleanLines(raw.replace(/\n+/g, " "), who)[0];

/** parse + validate a scene: only cast members speak, every line passes the flavor guard, capped at 8 */
export function parseScene(raw: string, cast: string[], max = 8): SceneLine[] {
  const names = new Map(cast.map((c) => [c.toLowerCase(), c]));
  let o: unknown;
  try { o = JSON.parse(raw.replace(/^```(json)?\s*|\s*```$/g, "").trim()); } catch { return []; }
  const list = Array.isArray(o) ? o : Array.isArray((o as { lines?: unknown })?.lines) ? (o as { lines: unknown[] }).lines : [];
  const out: SceneLine[] = [];
  for (const x of list) {
    if (out.length >= max || !x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    const who = names.get(cut(r.who, 40).replace(/^@/, "").toLowerCase());
    if (!who || typeof r.text !== "string") continue;
    const text = oneLine(r.text, who);
    if (!text) continue;
    const to = cut(r.to, 40).replace(/^@/, "").trim();
    const line: SceneLine = { who, text: text.length > 200 ? text.slice(0, 197) + "..." : text };
    if (to && to.toLowerCase() !== who.toLowerCase()) line.to = to.toLowerCase() === "god" ? "god" : to;
    const m = r.meme as Record<string, unknown> | undefined;
    if (m && typeof m === "object" && MEME_FORMATS.has(String(m.format)) && !out.some((l) => l.meme)) {
      const top = cut(m.top, 60).trim(), bottom = cut(m.bottom, 60).trim();
      if (top && isFlavorSafe(top) && (!bottom || isFlavorSafe(bottom)) && !BOTTY.test(top)) line.meme = { format: m.format as SceneMeme["format"], top, bottom: bottom || undefined };
    }
    out.push(line);
  }
  return out;
}
