/**
 * Long-term memory, relationships and mood. All deterministic and small: memories are capped and merged so
 * prompts stay short, relationships keep only the strongest ties, mood drifts back to neutral.
 */
import type { Character, LongMemory } from "./types";

export const MEM_CAP = 20;
export const REL_CAP = 12;
const DAY = 86_400_000;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const key = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();

/** how much a memory still matters at time `now` (important ones fade slowly, trivia fast) */
const score = (m: LongMemory, now: number) => m.w * (1 + Math.log2(m.n ?? 1)) * Math.exp(-(now - m.t) / ((4 + m.w * 40) * DAY));

/** store a memory (merging repeats); keeps at most MEM_CAP, dropping what matters least */
export function rememberLong(c: Character, m: Omit<LongMemory, "n">): LongMemory {
  const list = (c.mem ??= []);
  const k = key(m.text);
  const same = list.find((x) => x.about === m.about && key(x.text) === k);
  if (same) { same.n = (same.n ?? 1) + 1; same.t = Math.max(same.t, m.t); same.w = Math.max(same.w, m.w); return same; }
  const item: LongMemory = { ...m, text: m.text.slice(0, 120), w: clamp(m.w, 0, 1) };
  list.push(item);
  if (list.length > MEM_CAP) compact(c, m.t);
  return item;
}

/** summarise: several small memories about the same person collapse into one line, then the weakest go */
export function compact(c: Character, now: number) {
  const list = c.mem ?? [];
  const groups = new Map<string, LongMemory[]>();
  for (const m of list) if (m.w < 0.5) (groups.get(m.about) ?? groups.set(m.about, []).get(m.about)!).push(m);
  for (const [about, g] of groups) {
    if (g.length < 3 || about === "self" || about === "god") continue;
    const keep = g.sort((a, b) => b.t - a.t)[0];
    const merged: LongMemory = { about, t: keep.t, w: Math.min(0.6, Math.max(...g.map((x) => x.w)) + 0.1), n: g.reduce((a, x) => a + (x.n ?? 1), 0), text: `lots of back and forth (latest: ${keep.text})`.slice(0, 120) };
    c.mem = list.filter((x) => !g.includes(x)).concat(merged);
  }
  const out = c.mem ?? [];
  if (out.length > MEM_CAP) c.mem = out.sort((a, b) => score(b, now) - score(a, now)).slice(0, MEM_CAP).sort((a, b) => a.t - b.t);
}

/** the few memories worth putting in a prompt */
export function topMemories(c: Character, now: number, n = 6, about?: string): LongMemory[] {
  return (c.mem ?? []).filter((m) => !about || m.about === about).sort((a, b) => score(b, now) - score(a, now)).slice(0, n);
}

export const relOf = (c: Character, id: string) => c.rel?.[id] ?? 0;
/** nudge a relationship (-100..100); keeps only the strongest REL_CAP ties (god always kept) */
export function adjustRel(c: Character, id: string, d: number) {
  const r = (c.rel ??= {});
  r[id] = clamp(Math.round(((r[id] ?? 0) + d) * 10) / 10, -100, 100);
  const ids = Object.keys(r);
  if (ids.length > REL_CAP) {
    const drop = ids.filter((x) => x !== "god").sort((a, b) => Math.abs(r[a]) - Math.abs(r[b]))[0];
    delete r[drop];
  }
}

export const moodOf = (c: Character) => c.mood ?? 0;
export const nudgeMood = (c: Character, d: number) => { c.mood = clamp(Math.round(((c.mood ?? 0) + d) * 100) / 100, -1, 1); };
export function moodWord(c: Character): string | undefined {
  const m = c.mood ?? 0;
  return m < -0.55 ? "having an awful day" : m < -0.2 ? "a bit down / irritable" : m > 0.55 ? "in a great mood" : m > 0.2 ? "in a good mood" : undefined;
}

/** a day passes: grudges and moods ease off a little (big ones still last days) */
export function easeDay(c: Character, days: number) {
  if (c.rel) for (const [id, v] of Object.entries(c.rel)) {
    const step = 5 * days;
    c.rel[id] = Math.abs(v) <= step ? 0 : v - Math.sign(v) * step;
    if (c.rel[id] === 0 && id !== "god") delete c.rel[id];
  }
  if (c.mood) c.mood = Math.abs(c.mood) < 0.15 * days ? 0 : Math.round((c.mood - Math.sign(c.mood) * 0.15 * days) * 100) / 100;
}

/** "his dog is called Biscuit" -> "your dog is called Biscuit" (for bringing a fact up to god's face) */
export function toYou(fact: string): string {
  return fact
    .replace(/\bhimself\b/gi, "yourself").replace(/\bhe's\b/gi, "you're").replace(/\bhe is\b/gi, "you are").replace(/\bhe was\b/gi, "you were")
    .replace(/\bhe has\b/gi, "you have").replace(/\bhis\b/gi, "your").replace(/\bhim\b/gi, "you").replace(/\bhe\b/gi, "you")
    .replace(/\byou (likes|loves|hates|wants|has|does|goes|plays|lives|works|owns|thinks)\b/gi, (_m, v: string) => `you ${v === "has" ? "have" : v === "does" ? "do" : v === "goes" ? "go" : v.replace(/s$/, "")}`);
}
