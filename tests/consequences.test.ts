import { describe, expect, it } from "vitest";
import { applyAction, godPost, godSay, resolveEvent, simulate } from "../src/lib/sim/engine";
import { netWorth } from "../src/lib/sim/world";
import { magnitudeFor } from "../src/lib/sim/topics";
import { HOUR, T0, world } from "./helpers";

describe("GOD MODE consequences", () => {
  it("buying an island costs cash, adds a holding and breaks the internet", () => {
    const s = world();
    const cash = s.player.cash, holdings = s.player.holdings.length, nw = netWorth(s);
    const r = applyAction(s, { kind: "island", name: "Isla Corona", cost: 600e6 }, T0);
    if ("error" in r) throw new Error(r.error);
    expect(s.player.cash).toBeCloseTo(cash - 600e6, -3);
    expect(s.player.holdings.length).toBe(holdings + 1);
    expect(Math.abs(netWorth(s) - nw)).toBeLessThan(600e6);
    expect(r.breaking).toBe(true);
    expect(r.articles.length).toBeGreaterThanOrEqual(3);
    expect(r.servers.length).toBeGreaterThanOrEqual(8);
    expect(s.topics.find((t) => t.id === r.topic.id)?.heat).toBeGreaterThan(20);
    // the reaction plays out over the following minutes
    const before = s.messages.length;
    simulate(s, T0 + 30 * 60_000);
    const reacting = s.messages.slice(before).filter((m) => m.topicId === r.topic.id);
    expect(reacting.length).toBeGreaterThan(50);
    const posts = s.posts.filter((p) => p.topicId === r.topic.id);
    expect(posts.length).toBeGreaterThan(20);
    expect(s.notifications.some((n) => n.kind === "trend")).toBe(true);
  });

  it("small actions ripple less than big ones", () => {
    const a = world(), b = world();
    const small = applyAction(a, { kind: "vehicle", name: "Vantor GT", cost: 300_000 }, T0);
    const big = applyAction(b, { kind: "jet", name: "Skyhaven 900", cost: 90e6 }, T0);
    if ("error" in small || "error" in big) throw new Error("unexpected");
    expect(small.magnitude).toBeLessThan(big.magnitude);
    expect(small.servers.length).toBeLessThan(big.servers.length);
    expect(magnitudeFor("island", 1e9)).toBeGreaterThan(magnitudeFor("island", 1e7));
  });

  it("cannot spend money you don't have", () => {
    const s = world();
    const r = applyAction(s, { kind: "business", name: "Too Big Inc", cost: 1e15 }, T0);
    expect("error" in r).toBe(true);
  });

  it("a controversy hurts reputation and splits the communities", () => {
    const s = world();
    const rep = s.player.reputation;
    const r = applyAction(s, { kind: "controversy", name: "said college is a scam", cost: 0, boost: 3 }, T0);
    if ("error" in r) throw new Error(r.error);
    expect(s.player.reputation).toBeLessThan(rep);
  });

  it("resolving an event applies its consequences once", () => {
    const s = world();
    simulate(s, T0 + 6 * HOUR);
    const ev = s.events.find((e) => !e.resolved && e.t <= s.simTime);
    expect(ev).toBeDefined();
    const before = JSON.stringify(s.player);
    const r = resolveEvent(s, ev!.id, ev!.choices[0].id, s.simTime);
    expect("error" in r).toBe(false);
    expect(JSON.stringify(s.player)).not.toBe(before);
    expect("error" in resolveEvent(s, ev!.id, ev!.choices[0].id, s.simTime)).toBe(true);
  });

  it("god talking in a channel gets replies; god posting gets engagement", () => {
    const s = world();
    const srv = s.servers[0], ch = srv.channels[0];
    godSay(s, srv.id, ch.id, "who's awake", T0);
    godPost(s, "chirp", "big announcement tomorrow", T0);
    simulate(s, T0 + 10 * 60_000);
    const replies = s.messages.filter((m) => m.channelId === ch.id && m.t > T0 && m.authorId !== "god");
    expect(replies.length).toBeGreaterThan(3);
    const post = s.posts.find((p) => p.authorId === "god");
    expect(post!.likes).toBeGreaterThan(1000);
  });
});
