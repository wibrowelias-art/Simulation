import { describe, expect, it } from "vitest";
import { createWorld } from "../src/lib/sim/world";
import { catchUp, simulate } from "../src/lib/sim/engine";
import { rngFor, hash } from "../src/lib/sim/rng";
import { HOUR, T0, world } from "./helpers";

describe("determinism", () => {
  it("rng is seeded and stable", () => {
    const a = rngFor("x", 1), b = rngFor("x", 1), c = rngFor("x", 2);
    const sa = [a.next(), a.next(), a.next()], sb = [b.next(), b.next(), b.next()];
    expect(sa).toEqual(sb);
    expect(c.next()).not.toBe(sa[0]);
    expect(hash("abc")).toBe(hash("abc"));
  });

  it("same seed -> identical world", () => {
    const a = createWorld("s1", T0), b = createWorld("s1", T0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(createWorld("s2", T0).characters[5].username).not.toBe(undefined);
    expect(JSON.stringify(createWorld("s2", T0).characters)).not.toBe(JSON.stringify(a.characters));
  });

  it("bootstrapped worlds are identical for the same seed", () => {
    expect(JSON.stringify(world("same"))).toBe(JSON.stringify(world("same")));
  });

  it("chunked catch-up equals single-pass catch-up", () => {
    const a = world(), b = world();
    const to = T0 + 3 * HOUR;
    simulate(a, to);
    let guard = 0;
    while (b.simTime + 10_000 <= to && guard++ < 10_000) simulate(b, to, { maxBuckets: 37 });
    expect(b.simTime).toBe(a.simTime);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("opening every 20 min equals opening once after 4h", () => {
    const a = world(), b = world();
    for (let t = T0 + 20 * 60_000; t <= T0 + 4 * HOUR; t += 20 * 60_000) simulate(a, t);
    simulate(b, T0 + 4 * HOUR);
    expect(a.messages.length).toBe(b.messages.length);
    expect(a.messages.at(-1)?.text).toBe(b.messages.at(-1)?.text);
  });
});

describe("catch-up (world runs while away)", () => {
  it("6h away produces thousands of messages, posts and articles", () => {
    const s = world();
    const sum = catchUp(s, T0 + 6 * HOUR);
    expect(sum.messages).toBeGreaterThan(2000);
    expect(sum.posts).toBeGreaterThan(200);
    expect(sum.articles).toBeGreaterThan(3);
    expect(sum.topTopics.length).toBeGreaterThan(2);
    expect(sum.highlights.length).toBeGreaterThan(0);
    expect(sum.compressed).toBe(false);
  });

  it("very long absences are compressed but still evolve the world", () => {
    const s = world();
    const op0 = s.characters.reduce((a, c) => a + c.opinion, 0);
    const t = performance.now();
    const sum = catchUp(s, T0 + 9 * 24 * HOUR);
    expect(performance.now() - t).toBeLessThan(20_000);
    expect(sum.compressed).toBe(true);
    expect(s.simTime).toBeGreaterThan(T0 + 9 * 24 * HOUR - 20_000);
    expect(s.characters.reduce((a, c) => a + c.opinion, 0)).not.toBe(op0);
  });

  it("pruning keeps state bounded", () => {
    const s = world();
    catchUp(s, T0 + 20 * HOUR);
    expect(s.messages.length).toBeLessThanOrEqual(9000 + 3000);
    expect(s.posts.length).toBeLessThanOrEqual(2700);
    expect(s.articles.length).toBeLessThanOrEqual(270);
    expect(s.notifications.length).toBeLessThanOrEqual(170);
    expect(JSON.stringify(s).length).toBeLessThan(12_000_000);
  });

  it("messages are time-ordered and never from the future once delivered", () => {
    const s = world();
    simulate(s, T0 + HOUR);
    for (let i = 1; i < s.messages.length; i++) expect(s.messages[i].t).toBeGreaterThanOrEqual(s.messages[i - 1].t);
    expect(s.messages.at(-1)!.t).toBeLessThan(s.simTime);
  });
});
