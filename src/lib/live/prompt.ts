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
    .filter((l) => l && !/^(as an ai|i am an ai|i'm an ai)/i.test(l) && isFlavorSafe(l))
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
