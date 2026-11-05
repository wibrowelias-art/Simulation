import { describe, expect, it } from "vitest";
import { T0, world } from "./helpers";
import { godSay, simulate } from "../src/lib/sim/engine";
import { buzzChannels } from "../src/lib/sim/godspeak";
import type { Message, WorldState } from "../src/lib/sim/types";

const MIN = 60_000;
const CH = "godhq-general";
const all = (s: WorldState) => [...s.messages, ...s.pending];
const buzz = (s: WorldState, from: number, to: number) => all(s).filter((m: Message) => m.channelId === CH && m.intent === "buzz" && m.t >= from && m.t < to);

function talk(seed: string, lines: string[]) {
  const s = world(seed);
  const t = T0 + 2 * MIN;
  simulate(s, t);
  lines.forEach((text, i) => { simulate(s, t + i * 40_000); godSay(s, "godhq", CH, text, t + i * 40_000); });
  return { s, t };
}

describe("the chat stays on you after you talk", () => {
  it("keeps coming back to what you said for minutes, not just one burst", () => {
    const { s, t } = talk("buzz-1", ["sup guys"]);
    simulate(s, t + 15 * MIN);
    // after the first reaction has played out, new waves keep landing
    const minutes = new Set(buzz(s, t + 3 * MIN, t + 12 * MIN).map((m) => Math.floor((m.t - t) / MIN)));
    expect(minutes.size).toBeGreaterThanOrEqual(3);
    // they talk about the actual message, and some of it is aimed at you
    const lines = buzz(s, t, t + 15 * MIN);
    expect(lines.some((m) => /sup guys/i.test(m.text))).toBe(true);
    expect(lines.some((m) => m.mentionsGod || m.replyTo)).toBe(true);
    // waves play live: each line has someone typing first
    expect(lines.every((m) => m.typingFrom != null && m.typingFrom < m.t)).toBe(true);
  }, 60_000);

  it("more lines from you means a louder room", () => {
    const one = talk("buzz-2", ["sup guys"]);
    const three = talk("buzz-2", ["sup guys", "what are we buying today", "this server is the best lol"]);
    simulate(one.s, one.t + 12 * MIN);
    simulate(three.s, three.t + 12 * MIN);
    const a = buzz(one.s, one.t, one.t + 12 * MIN).length;
    const b = buzz(three.s, three.t, three.t + 12 * MIN).length;
    expect(b).toBeGreaterThan(a * 1.25);
  }, 60_000);

  it("cools off eventually", () => {
    const { s, t } = talk("buzz-3", ["sup guys"]);
    expect(buzzChannels(s, t + MIN).map((z) => z.channelId)).toContain(CH);
    expect(buzzChannels(s, t + 30 * MIN)).toHaveLength(0);
    simulate(s, t + 40 * MIN);
    expect(buzz(s, t + 32 * MIN, t + 40 * MIN)).toHaveLength(0);
  }, 60_000);

  it("is deterministic", () => {
    const x = talk("buzz-4", ["gm chat"]), y = talk("buzz-4", ["gm chat"]);
    simulate(x.s, x.t + 8 * MIN); simulate(y.s, y.t + 8 * MIN);
    expect(buzz(x.s, 0, Infinity).map((m) => m.text)).toEqual(buzz(y.s, 0, Infinity).map((m) => m.text));
  }, 60_000);
});
