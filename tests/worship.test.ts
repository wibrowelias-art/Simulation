import { describe, expect, it } from "vitest";
import { T0, world } from "./helpers";
import { godSay, simulate } from "../src/lib/sim/engine";
import { worshipOf } from "../src/lib/sim/godspeak";
import { WORSHIP } from "../src/lib/sim/godlines";
import { obsessionOf } from "../src/lib/sim/social";
import { charById, migrateWorld, WORLD_VERSION } from "../src/lib/sim/world";
import { instructions, sanitize, sanitizeScene, sceneInstructions } from "../src/lib/live/prompt";
import type { WorldState } from "../src/lib/sim/types";

const MIN = 60_000;
const CH = "godhq-general";
// a line came from the worship bank if it contains a distinctive chunk of one of its templates
const marks = [...WORSHIP.praise, ...WORSHIP.defend, ...WORSHIP.converted].map((x) => x.replace(/\{\w+\}|@god|@\{user\}/g, "|").split("|").map((p) => p.trim().toLowerCase()).filter((p) => p.length >= 8)).flat();
const worshipLine = (t: string) => marks.some((m) => t.toLowerCase().includes(m));

function crowd(glaze: number, seed: string) {
  const s = world(seed);
  s.settings.glazeRatio = glaze;
  const t = T0 + 2 * MIN;
  simulate(s, t);
  godSay(s, "godhq", CH, "sup guys", t);
  simulate(s, t + 4 * MIN);
  const lines = [...s.messages, ...s.pending].filter((m) => m.channelId === CH && m.t >= t && m.authorId.startsWith("c") && m.kind === "chat");
  return { s, lines };
}
const negShare = (s: WorldState, lines: { authorId: string }[]) => lines.filter((m) => ["hater", "rival"].includes(obsessionOf(charById(s, m.authorId)))).length / lines.length;

describe("worship mode", () => {
  it("is the default, and old saves move to it", () => {
    const w = world("w-default");
    expect(worshipOf(w)).toBeCloseTo(1);
    const old = structuredClone(w);
    old.version = 9; old.settings.glazeRatio = 0.5;
    const m = migrateWorld(old)!;
    expect(m.version).toBe(WORLD_VERSION);
    expect(worshipOf(m)).toBeCloseTo(1);
  });

  it("the crowd praises you like a god, and haters barely get a word in", () => {
    let wPraise = 0, mPraise = 0, wNeg = 0, mNeg = 0, wN = 0, mN = 0;
    for (const seed of ["w1", "w2", "w3"]) {
      const w = crowd(0.95, seed), m = crowd(0.5, seed);
      wPraise += w.lines.filter((x) => worshipLine(x.text)).length; wN += w.lines.length; wNeg += negShare(w.s, w.lines);
      mPraise += m.lines.filter((x) => worshipLine(x.text)).length; mN += m.lines.length; mNeg += negShare(m.s, m.lines);
    }
    expect(wPraise / wN).toBeGreaterThan(0.15);
    expect(mPraise / mN).toBeLessThan(0.03); // the real mix never uses the worship lines
    expect(wNeg).toBeLessThan(mNeg);
  }, 60_000);

  it("the server bots hype you too: Herald, Tally and Starboard", () => {
    const bots = new Set<string>();
    let waveBots = 0;
    for (const seed of ["b1", "b2", "b3"]) {
      const { s } = crowd(0.95, seed);
      const t = T0 + 2 * MIN;
      simulate(s, t + 12 * MIN);
      const mine = [...s.messages, ...s.pending].filter((m) => m.channelId === CH && m.kind === "bot" && m.t >= t && /@god/.test(m.text));
      for (const m of mine) bots.add(m.authorId);
      waveBots += mine.filter((m) => m.t > t + 3 * MIN).length;
    }
    expect([...bots].sort()).toEqual(["bot-herald", "bot-starboard", "bot-tally"]);
    expect(waveBots).toBeGreaterThan(0); // and they keep chiming in while the room is on you
  }, 60_000);

  it("tells the AI the player is worshipped, only in worship mode", () => {
    const base = { kind: "scene", mode: "crowd", cast: [{ username: "sam", name: "Sam", opinion: 70 }], place: { server: "Trenches", channel: "general", topic: "" }, history: [], god: "sup", lines: 4, player: "alex" };
    expect(sceneInstructions(sanitizeScene({ ...base, worship: 1 })!)).toMatch(/worshipped like a living god/);
    expect(sceneInstructions(sanitizeScene({ ...base, worship: 0 })!)).not.toMatch(/worshipped/);
    const s = world("w-ai");
    const c = s.characters.find((x) => x.core)!;
    c.opinion = 50;
    const persona = { name: c.displayName, username: c.username, age: 20, occupation: "x", location: "y", bio: "z", personality: [], interests: [], catchphrase: "", friends: [], rivals: [], opinion: 50, bond: 10, godFacts: [], memories: [], voice: "casual", emojis: [] };
    const req = (worship: number) => sanitize({ kind: "reply", persona, place: { dm: false, server: "Trenches", channel: "general" }, history: [], god: "sup", player: "alex", worship } as unknown)!;
    expect(instructions(req(1))).toMatch(/treated like a living god/);
    expect(instructions(req(0))).not.toMatch(/living god/);
  });
});
