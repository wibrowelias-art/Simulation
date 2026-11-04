import { describe, expect, it } from "vitest";
import { world, T0, HOUR } from "./helpers";
import { godSay, simulate } from "../src/lib/sim/engine";
import { makeMeme, memeAlt } from "../src/lib/sim/memes";
import { rngFor } from "../src/lib/sim/rng";

describe("memes", () => {
  it("are deterministic for the same seed", () => {
    const a = makeMeme(rngFor("x", "m", "1"), { topic: "the river festival", mood: "fan" });
    const b = makeMeme(rngFor("x", "m", "1"), { topic: "the river festival", mood: "fan" });
    expect(a).toEqual(b);
  });
  it("cover several formats and always have alt text", () => {
    const fs = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const m = makeMeme(rngFor("x", "m", String(i)), { topic: "rent going up", mood: i % 3 ? "hater" : "neutral", shot: i % 2 ? { name: "god", handle: "god", text: "hello", likes: 5, seed: 1, gold: true } : undefined });
      fs.add(m.f);
      expect(memeAlt(m).length).toBeGreaterThan(3);
    }
    expect(fs.size).toBeGreaterThanOrEqual(5);
  });
  it("show up in chat over a few hours of background life", () => {
    const s = world();
    simulate(s, T0 + 4 * HOUR);
    const memes = s.messages.filter((m) => m.meme);
    expect(memes.length).toBeGreaterThan(0);
  });
  it("someone usually memes what god said", () => {
    let hits = 0;
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const s = world(seed);
      const srv = s.servers.find((x) => /god hq/i.test(x.name)) ?? s.servers[0];
      const ch = srv.channels.find((c) => c.name === "general") ?? srv.channels[0];
      const r = godSay(s, srv.id, ch.id, "i control the weather now", T0 + 1000) as { message: { id: string } };
      simulate(s, T0 + 60_000);
      if (s.messages.some((m) => m.meme && m.t > T0 && m.episodeId === r.message.id)) hits++;
    }
    expect(hits).toBeGreaterThanOrEqual(3);
  });
});
