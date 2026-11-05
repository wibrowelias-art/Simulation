import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { HOUR, T0, world } from "./helpers";
import { catchUp, godSay, simulate } from "../src/lib/sim/engine";
import { MEM_CAP, adjustRel, relOf, rememberLong, toYou, topMemories } from "../src/lib/sim/memory";
import { obsessionOf } from "../src/lib/sim/social";
import { dmChannel } from "../src/lib/sim/godspeak";
import { indexedDbKV } from "../src/lib/persistence/kv";
import { createProfile, loadWorld, saveWorld } from "../src/lib/persistence/profiles";
import { castCard, liveReply, persona, resetLive } from "../src/lib/live/client";
import { instructions, sanitize } from "../src/lib/live/prompt";
import type { Character, WorldState } from "../src/lib/sim/types";

const DAY = 24 * HOUR;
const core = (s: WorldState, pred: (c: Character) => boolean = () => true) => s.characters.find((c) => c.core && pred(c))!;

describe("long-term memory", () => {
  it("is capped, merges repeats, and keeps what matters", () => {
    const s = world();
    const c = core(s);
    rememberLong(c, { about: "god", text: "his dog is called Biscuit", t: T0, w: 0.9 });
    for (let i = 0; i < 40; i++) rememberLong(c, { about: `c${i % 7}`, text: `small talk number ${i}`, t: T0 + i * HOUR, w: 0.2 });
    rememberLong(c, { about: "god", text: "His dog is called Biscuit!", t: T0 + 50 * HOUR, w: 0.9 });
    expect(c.mem!.length).toBeLessThanOrEqual(MEM_CAP);
    const dog = c.mem!.filter((m) => /biscuit/i.test(m.text));
    expect(dog).toHaveLength(1);
    expect(dog[0].n).toBe(2);
    expect(topMemories(c, T0 + 60 * HOUR, 3).some((m) => /biscuit/i.test(m.text))).toBe(true);
  });

  it("turns a fact about god into something you can say to his face", () => {
    expect(toYou("his dog is called Biscuit")).toBe("your dog is called Biscuit");
    expect(toYou("he hates mondays")).toBe("you hate mondays");
    expect(toYou("he's learning guitar")).toBe("you're learning guitar");
  });

  it("keeps a fact god told them through a save and a day away", async () => {
    resetLive();
    const s = world("mem-day");
    const c = core(s);
    const now = T0 + 60e3;
    simulate(s, now);
    const before = new Set(s.pending);
    const r = godSay(s, "dm", dmChannel("god", c.id), "my dog is called Biscuit", now);
    const fresh = s.pending.filter((m) => !before.has(m) && m.authorId !== "god");
    await liveReply(s, r.message, fresh, { now: () => now, changed: () => {}, post: async () => Response.json({ lines: ["biscuit!!"], remember: "his dog is called Biscuit" }) });
    const kv = indexedDbKV("god-sim-memday");
    const p = await createProfile(kv, "God");
    await saveWorld(kv, p.id, s);
    const back = (await loadWorld(kv, p.id))!;
    catchUp(back, now + DAY); // ?away=1d
    const c2 = back.characters[Number(c.id.slice(1))];
    expect(c2.godFacts).toContain("his dog is called Biscuit");
    expect(persona(c2, back).memories.join(" | ")).toMatch(/Biscuit/);
    expect(castCard(c2, back).memories.join(" | ")).toMatch(/Biscuit/);
  }, 60_000);
});

describe("relationships", () => {
  it("a character god insults stays colder for days", () => {
    const s = world("insult");
    const c = core(s, (x) => x.stance === "fan" || x.stance === "worshipper");
    const now = T0 + 5 * 60e3;
    simulate(s, now);
    const theirs = s.messages.find((m) => m.authorId === c.id) ?? (() => { const m = { ...s.messages.at(-1)!, id: "mx", authorId: c.id, serverId: "godhq", channelId: "godhq-general" }; s.messages.push(m); return m; })();
    const warmBefore = c.opinion + relOf(c, "god") * 0.8;
    godSay(s, theirs.serverId, theirs.channelId, "you're so mid honestly", now, theirs.id);
    expect(relOf(c, "god")).toBeLessThanOrEqual(-30);
    expect(c.mem!.some((m) => m.about === "god" && /insulted/.test(m.text))).toBe(true);
    catchUp(s, now + 2 * DAY);
    expect(relOf(c, "god")).toBeLessThan(-10); // still sore two days later
    expect(c.opinion + relOf(c, "god") * 0.8).toBeLessThan(warmBefore - 15);
    const sys = instructions(sanitize({ ...persona(c, s), god: "hey", persona: persona(c, s) } as unknown)!);
    expect(sys).toMatch(/still annoyed with @?god/);
    if (c.stance === "worshipper") expect(obsessionOf(c)).toBe("skeptic");
  }, 60_000);

  it("relationships keep only the strongest ties", () => {
    const s = world();
    const c = core(s);
    for (let i = 0; i < 30; i++) adjustRel(c, `c${i}`, i % 2 ? i : -i);
    adjustRel(c, "god", 3);
    expect(Object.keys(c.rel!).length).toBeLessThanOrEqual(12);
    expect(c.rel!.god).toBe(3);
  });

  it("remembers being left on read", () => {
    const s = world("read");
    const c = core(s);
    const ch = dmChannel("god", c.id);
    s.messages.push({ id: "dm-x", serverId: "dm", channelId: ch, authorId: c.id, text: "hey are you there", t: T0 + 60e3, reactions: [], kind: "chat", score: 1 });
    catchUp(s, T0 + 9 * HOUR);
    expect(c.mem!.some((m) => /left me on read/.test(m.text))).toBe(true);
    expect(relOf(c, "god")).toBeLessThan(0);
    const n = c.mem!.length;
    catchUp(s, T0 + 12 * HOUR);
    expect(c.mem!.filter((m) => /left me on read/.test(m.text))).toHaveLength(1); // counted once
    expect(c.mem!.length).toBeGreaterThanOrEqual(n);
  }, 60_000);
});

describe("lives of their own", () => {
  it("over a day, at least 5 characters talk about what's going on in their life", () => {
    const s = world("lives");
    catchUp(s, T0 + DAY);
    const talkers = new Set(s.messages.filter((m) => m.intent === "life").map((m) => m.authorId));
    expect(talkers.size).toBeGreaterThanOrEqual(5);
    const living = s.characters.filter((c) => c.life);
    expect(living.length).toBeGreaterThan(10);
    // what they say matches what they're living through
    const sample = s.messages.filter((m) => m.intent === "life").slice(-20);
    expect(sample.every((m) => m.text.length > 3)).toBe(true);
  }, 60_000);

  it("arcs move forward and become memories", () => {
    const s = world("arcs");
    catchUp(s, T0 + 6 * DAY);
    const done = s.characters.filter((c) => c.lifeDone?.length);
    expect(done.length).toBeGreaterThan(3);
    expect(done.some((c) => c.mem?.some((m) => m.about === "self"))).toBe(true);
  }, 60_000);
});

describe("v7 -> v8 migration", () => {
  it("old saves keep facts god told them, now in long-term memory", async () => {
    const { migrateWorld, WORLD_VERSION } = await import("../src/lib/sim/world");
    const w = world();
    w.version = 7;
    const c = core(w);
    c.godFacts = ["he hates pineapple pizza"];
    for (const x of w.characters) { delete x.mem; delete x.rel; delete x.life; delete x.mood; }
    const m = migrateWorld(w)!;
    expect(m.version).toBe(WORLD_VERSION);
    expect(m.characters[Number(c.id.slice(1))].mem?.[0].text).toBe("he hates pineapple pizza");
    catchUp(m, T0 + 3 * HOUR);
    expect(m.characters.some((x) => x.life)).toBe(true);
  });
});
