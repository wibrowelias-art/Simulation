/** Original meme formats (no third-party templates, no real people). A meme is data; MemeImage renders it as SVG. */
import type { Rng } from "./rng";

export type MemeFormat = "caption" | "compare" | "pov" | "chart" | "chirpshot" | "reaction" | "starter" | "leakdoc";

export interface MemeSpec {
  f: MemeFormat;
  hue: number;
  seed: number;
  top?: string;
  bottom?: string;
  a?: string; // left / first label
  b?: string; // right / second label
  art?: string; // emoji "actor"
  art2?: string;
  arts?: string[]; // starter pack items
  trend?: "up" | "down" | "spike" | "crash";
  doc?: { title: string; lines: string[]; stamp: string; by: string }; // fabricated in-world "leaked" doc (storyline flavor)
  shot?: { name: string; handle: string; text: string; likes: number; seed: number; pfp?: string; gold?: boolean };
}

export interface MemeCtx {
  q?: string; // what god said (short)
  topic?: string; // topic label e.g. "the island purchase"
  tag?: string;
  mood: "fan" | "hater" | "neutral";
  shot?: MemeSpec["shot"];
}

const short = (s: string | undefined, n: number) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
};

const FACES = { fan: ["🤩", "😭", "🥹", "😍", "🙌", "🫡"], hater: ["😒", "🙄", "🤨", "😐", "🥱", "🤡"], neutral: ["😳", "👀", "🤔", "😶", "🫠", "💀"] };
const GOD = ["👑", "🐐", "💎", "🛸", "🦁", "🏆"];

type Fill = (r: Rng, c: Required<Pick<MemeCtx, "q" | "topic">> & MemeCtx) => Omit<MemeSpec, "hue" | "seed">;

const BANK: Record<MemeCtx["mood"], Fill[]> = {
  fan: [
    (r, c) => ({ f: "caption", top: "nobody:", bottom: `god at 3am: "${c.q}"`, art: r.pick(GOD) }),
    (r, c) => ({ f: "reaction", top: `me when god says "${c.q}"`, art: r.pick(FACES.fan) }),
    (r, c) => ({ f: "compare", a: "normal people saying it", b: `god saying "${c.q}"`, art: "🙂", art2: r.pick(GOD) }),
    (r, c) => ({ f: "pov", top: `POV: god just typed "${c.q}" and you were online`, art: r.pick(["🫨", "😱", "🥹"]) }),
    (r) => ({ f: "chart", top: "server activity", a: "before god", b: "after god", trend: "spike", art: r.pick(GOD) }),
    (r, c) => ({ f: "chart", top: "god's aura", a: "last week", b: short(c.topic, 22), trend: "up", art: "📈" }),
    (r, c) => ({ f: "starter", top: `${short(c.topic, 26)} starter pack`, arts: r.shuffle(["👑", "💸", "🛥️", "🕶️", "📈", "🏝️", "⌚", "🍾"]).slice(0, 4) }),
    (r, c) => ({ f: "caption", top: "me refreshing the chat", bottom: `waiting for god to say something after "${short(c.q, 24)}"`, art: "🔄" }),
  ],
  hater: [
    (r, c) => ({ f: "caption", top: "god fans when he says", bottom: `"${c.q}" 💀`, art: r.pick(["🤡", "🧎", "🫠"]) }),
    (r, c) => ({ f: "compare", a: "what god fans see", b: "what actually happened", art: "🏰", art2: "🏚️", top: short(c.topic, 30) }),
    (r) => ({ f: "chart", top: "god hype vs reality", a: "hype", b: "reality", trend: "crash", art: "📉" }),
    (r, c) => ({ f: "reaction", top: `me reading "${c.q}" for the 40th time today`, art: r.pick(FACES.hater) }),
    (r, c) => ({ f: "pov", top: `POV: you said god was mid and now the whole server is typing`, art: "🫣", bottom: short(c.topic, 30) }),
  ],
  neutral: [
    (r, c) => ({ f: "reaction", top: `me finding out about ${short(c.topic, 36)}`, art: r.pick(FACES.neutral) }),
    (r, c) => ({ f: "pov", top: `POV: you open the app and it's all ${short(c.topic, 30)}`, art: r.pick(["🫠", "😶", "📱"]) }),
    (r, c) => ({ f: "compare", a: "me before checking the chat", b: "me after", art: "😌", art2: "😵‍💫", top: short(c.topic, 30) }),
    (r, c) => ({ f: "caption", top: `everyone talking about ${short(c.topic, 30)}`, bottom: "me who just woke up", art: "🥱" }),
    (r) => ({ f: "chart", top: "my screen time", a: "monday", b: "today", trend: "up", art: "📱" }),
  ],
};

/** Pick and fill an original meme for the current context. */
export function makeMeme(rng: Rng, ctx: MemeCtx): MemeSpec {
  const c = { ...ctx, q: short(ctx.q || "sup guys", 42), topic: short(ctx.topic || "whatever this is", 40) };
  const base = { hue: rng.int(0, 360), seed: rng.int(1, 1e6) };
  if (ctx.shot && rng.chance(0.5)) {
    return { ...base, f: "chirpshot", shot: { ...ctx.shot, text: short(ctx.shot.text, 140) }, top: ctx.mood === "hater" ? rng.pick(["screenshotting this before he deletes it", "receipts 📸", "this aged well"]) : rng.pick(["framing this", "saving this forever", "historic moment"]) };
  }
  const fill = rng.pick(BANK[ctx.mood]);
  return { ...base, ...fill(rng, c) };
}

/** what people type when posting a meme */
export const MEME_LINES = ["made this", "💀💀💀", "accurate", "lmaooo", "i'm done", "had to", "this is so real", "ok last one i swear", "😭😭", "be honest this is us", "posting this before someone else does", "no context needed"];

/** plain-text description for screen readers */
export function memeAlt(m: MemeSpec): string {
  const parts = [m.top, m.a && m.b ? `${m.a} vs ${m.b}` : m.a, m.bottom, m.shot ? `post by ${m.shot.name}: ${m.shot.text}` : "", m.doc ? `fake leaked document "${m.doc.title}", stamped ${m.doc.stamp}` : ""].filter(Boolean);
  return `${m.f === "leakdoc" ? "Image" : "Meme"}: ${parts.join(". ")}`;
}
