import type { Rng } from "./rng";
import type { Character } from "./types";

const KEEP_CASE = /(@[\w.]+|#[\w-]+|\$[A-Z0-9]+)/g;

function lowerKeep(s: string) {
  return s.split(KEEP_CASE).map((p, i) => (i % 2 ? p : p.toLowerCase())).join("");
}

/** Adjacent-swap / drop / double letter typo on one word (research §2). */
export function typo(rng: Rng, s: string): { text: string; word?: string } {
  const words = s.split(" ");
  const idx = words.map((w, i) => [w, i] as const).filter(([w]) => /^[a-z]{4,}$/i.test(w));
  if (!idx.length) return { text: s };
  const [w, i] = rng.pick(idx);
  const k = rng.int(1, w.length - 2);
  const kind = rng.int(0, 2);
  const bad = kind === 0 ? w.slice(0, k) + w[k + 1] + w[k] + w.slice(k + 2) : kind === 1 ? w.slice(0, k) + w.slice(k + 1) : w.slice(0, k) + w[k] + w.slice(k);
  words[i] = bad;
  return { text: words.join(" "), word: w.toLowerCase() };
}

/**
 * Apply a character's voice consistently. Same character ⇒ same tendencies
 * (casing, punctuation, slang, emoji placement), per docs/research.md §2.
 */
export function styleText(rng: Rng, c: Character, raw: string, opts: { allowTypo?: boolean; short?: boolean } = {}): { text: string; typoWord?: string; clean?: string } {
  let s = raw.trim();
  const v = c.voice;
  if (opts.short && (v === "terse" || v === "zoomer") && s.length > 40 && rng.chance(0.5)) {
    const cut = s.split(/[,.;]| and | but /)[0];
    if (cut.length > 6) s = cut;
  }
  // slang insertion
  if (v !== "formal" && v !== "proper" && rng.chance(v === "boomer" ? 0.15 : v === "zoomer" ? 0.45 : 0.28)) {
    const sl = rng.pick(c.slang);
    s = rng.chance(0.6) ? `${s} ${sl}` : `${sl} ${s}`;
  }
  switch (v) {
    case "zoomer":
    case "lowercase":
      s = lowerKeep(s).replace(/[.]+$/g, "").replace(/\. /g, rng.chance(0.5) ? " " : ". ");
      s = s.replace(/'/g, rng.chance(0.6) ? "" : "'");
      if (v === "zoomer" && rng.chance(0.15)) s = s.replace(/\b(so|no|bro|what|why)\b/, (m) => m + m[m.length - 1].repeat(rng.int(2, 4)));
      break;
    case "caps":
      if (rng.chance(0.55)) s = s.split(KEEP_CASE).map((p, i) => (i % 2 ? p : p.toUpperCase())).join("");
      if (rng.chance(0.4)) s = s.replace(/[.!]*$/, "!".repeat(rng.int(1, 3)));
      break;
    case "millennial":
      if (rng.chance(0.3)) s = s.replace(/[.]?$/, rng.chance(0.5) ? " lol" : " haha");
      s = s[0].toUpperCase() + s.slice(1);
      break;
    case "proper":
      s = s[0].toUpperCase() + s.slice(1);
      if (!/[.!?"]$/.test(s) && !/\p{Extended_Pictographic}$/u.test(s)) s += ".";
      break;
    case "boomer":
      s = s[0].toUpperCase() + s.slice(1);
      if (rng.chance(0.45)) s = s.replace(/[.!?]*$/, rng.pick(["...", "!!", ". ", "!!!"]));
      if (rng.chance(0.12)) s = s.replace(/^/, rng.pick(["Well ", "Folks, ", "Hmm. "]));
      break;
    case "terse":
      s = lowerKeep(s).replace(/[.!]+$/g, "");
      break;
    case "emoji":
      s = lowerKeep(s).replace(/[.]+$/g, "");
      break;
    case "formal":
      s = s[0].toUpperCase() + s.slice(1);
      if (!/[.!?"]$/.test(s)) s += ".";
      break;
  }
  // emoji, appended (research: trailing position, 💀/😭 over 😂 for younger voices)
  if (rng.chance(c.emojiRate) && !/\p{Extended_Pictographic}$/u.test(s)) {
    let e = rng.pick(c.emojis);
    if (v === "emoji" && rng.chance(0.5)) e = e + e;
    s = `${s} ${e}`;
  }
  let typoWord: string | undefined;
  const clean = s;
  if (opts.allowTypo !== false && rng.chance(c.typoRate)) {
    const t = typo(rng, s);
    s = t.text;
    typoWord = t.word;
  }
  return { text: s, typoWord, clean: typoWord ? clean : undefined };
}
