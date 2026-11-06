import type { Rng } from "./rng";

export type Slots = Record<string, string | (() => string) | undefined>;

/**
 * Tiny template grammar:
 *  {a|b|c}   → random alternative (may nest slots)
 *  {slot}    → slot value (string or thunk); unknown slots are dropped
 *  {?text}   → included with 50% probability
 *  {?a|b|}   → 50%: one of the alternatives (an empty one means nothing)
 */
export function expand(tpl: string, slots: Slots, rng: Rng): string {
  let s = tpl;
  for (let guard = 0; guard < 24; guard++) {
    const m = /\{([^{}]*)\}/.exec(s);
    if (!m) break;
    const body = m[1];
    let rep: string;
    if (body.startsWith("?")) rep = rng.chance(0.5) ? (body.includes("|") ? rng.pick(body.slice(1).split("|")) : body.slice(1)) : "";
    else if (body.includes("|")) rep = rng.pick(body.split("|"));
    else {
      const v = slots[body];
      rep = typeof v === "function" ? v() : v ?? "";
    }
    s = s.slice(0, m.index) + rep + s.slice(m.index + m[0].length);
  }
  return s
    .replace(/\b(the|a) (the|a|an) /gi, "$2 ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
