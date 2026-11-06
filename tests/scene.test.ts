import { beforeEach, describe, expect, it } from "vitest";
import { T0, world } from "./helpers";
import { channelMessages, simulate, textKey } from "../src/lib/sim/engine";
import { ambientTick, liveScene, resetScenes } from "../src/lib/live/scene";
import { resetLive } from "../src/lib/live/client";
import { canSpend, LIMITS, isIdle, noteActivity, resetBudget, spend } from "../src/lib/live/budget";
import { parseScene, sanitizeScene, sceneInstructions, scenePrompt, type SceneRequest } from "../src/lib/live/prompt";
import type { WorldState } from "../src/lib/sim/types";

const general = (s: WorldState) => {
  const srv = s.servers.find((x) => x.id === "godhq")!;
  return { srv, ch: srv.channels.find((c) => c.name === "general")! };
};

/** a stand-in model: writes unique lines for whoever is in the cast, replying to each other */
function fakeModel(opts: { bad?: string; code?: string } = {}) {
  let n = 0;
  const calls: SceneRequest[] = [];
  const post = (async (_u: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as SceneRequest;
    calls.push(body);
    if (opts.code) return Response.json({ error: "x", code: opts.code }, { status: 200 });
    const lines = Array.from({ length: body.lines }, (_, i) => {
      const who = body.cast[i % body.cast.length].username;
      const to = i ? body.cast[(i - 1) % body.cast.length].username : "";
      return { who, text: i === 1 && opts.bad ? opts.bad : `ok but take number ${++n} is wild`, to };
    });
    return Response.json({ lines, model: "test" });
  }) as unknown as typeof fetch;
  return { post, calls };
}

beforeEach(() => { resetLive(); resetScenes(); });

describe("scene parsing", () => {
  it("keeps only cast members, drops unsafe or assistant-y lines, caps the count", () => {
    const raw = JSON.stringify({ lines: [
      { who: "@kai", text: "lmao no", to: "mira" },
      { who: "stranger", text: "who am i" },
      { who: "mira", text: "just run sudo rm -rf / lol" },
      { who: "mira", text: "Great question! Happy to help." },
      { who: "mira", text: "kai you're so wrong", to: "god" },
      ...Array.from({ length: 12 }, (_, i) => ({ who: "kai", text: `spam ${i}` })),
    ] });
    const out = parseScene(raw, ["kai", "mira"]);
    expect(out[0]).toEqual({ who: "kai", text: "lmao no", to: "mira" });
    expect(out[1]).toEqual({ who: "mira", text: "kai you're so wrong", to: "god" });
    expect(out.some((l) => /sudo|happy to help/i.test(l.text))).toBe(false);
    expect(out.length).toBe(8);
    expect(parseScene("not json", ["kai"])).toEqual([]);
  });

  it("accepts one valid meme and rejects unsafe meme text", () => {
    const raw = JSON.stringify({ lines: [
      { who: "kai", text: "made this", meme: { format: "pov", top: "you said god was mid" } },
      { who: "kai", text: "another", meme: { format: "caption", top: "second meme" } },
      { who: "kai", text: "bad", meme: { format: "caption", top: "visit www.example.com" } },
    ] });
    const out = parseScene(raw, ["kai"]);
    expect(out[0].meme).toEqual({ format: "pov", top: "you said god was mid", bottom: undefined });
    expect(out[1].meme).toBeUndefined();
    expect(out[2].meme).toBeUndefined();
  });

  it("sanitizes scene requests and keeps the rules in the prompt", () => {
    expect(sanitizeScene({ kind: "scene", cast: [] })).toBeUndefined();
    const r = sanitizeScene({ kind: "scene", mode: "crowd", lines: 99, cast: Array.from({ length: 9 }, (_, i) => ({ username: `u${i}`, slang: ["a", "b", "c", "d", "e", "f"] })), history: Array.from({ length: 60 }, () => ({ who: "a", text: "b" })), god: "sup guys" })!;
    expect(r.cast.length).toBe(6);
    expect(r.cast[0].slang.length).toBe(4);
    expect(r.lines).toBe(8);
    expect(r.history.length).toBe(30);
    expect(sceneInstructions(r)).toMatch(/never mention AI/);
    expect(sceneInstructions(r)).toMatch(/fictional/);
    expect(scenePrompt(r)).toMatch(/sup guys/);
    expect(scenePrompt(r)).toMatch(/disagrees/);
  });
});

describe("budget lanes", () => {
  it("ambient is capped per minute and never crowds out direct replies", () => {
    resetBudget();
    let t = T0;
    let n = 0;
    for (let i = 0; i < 60; i++, t += 1000) if (spend("ambient", t)) n++;
    expect(n).toBeLessThanOrEqual(LIMITS.ambient.perMin);
    resetBudget();
    for (let i = 0; i < LIMITS.direct.perMin - 5; i++) spend("direct", T0 + i * 700);
    expect(canSpend("ambient", T0 + 40_000)).toBe(false); // the direct lane is busy: ambient waits
    expect(canSpend("direct", T0 + 40_000)).toBe(true);
  });
  it("tracks idleness", () => {
    resetBudget();
    noteActivity(T0);
    expect(isIdle(T0 + 60_000)).toBe(false);
    expect(isIdle(T0 + 4 * 60_000)).toBe(true);
  });
});

/** five minutes of watching #general, the way the store ticks it */
async function watch(s: WorldState, post: typeof fetch, minutes = 5) {
  const { srv, ch } = general(s);
  const start = T0 + 60_000;
  let clock = start;
  simulate(s, start - 10_000);
  for (; clock < start + minutes * 60_000; clock += 1000) {
    s.focus = { serverId: srv.id, channelId: ch.id, t: clock };
    const r = simulate(s, clock);
    if (r.processed) { const p = ambientTick(s, { now: () => clock, changed: () => {}, post, random: () => 0.9 }); if (p) await p; }
  }
  const lines = channelMessages(s, ch.id, clock, 2000).filter((m) => m.t >= start && m.t <= clock && m.authorId.startsWith("c") && m.kind === "chat");
  return { lines, clock };
}

describe("ambient chatter in the channel you're looking at", () => {
  it("5 minutes in #general: mostly live lines, no verbatim repeats, within budget", async () => {
    const s = world();
    const m = fakeModel();
    const { lines } = await watch(s, m.post);
    const ai = lines.filter((x) => x.ai).length;
    expect(lines.length).toBeGreaterThan(10);
    expect(ai / lines.length).toBeGreaterThanOrEqual(0.6);
    expect(m.calls.length).toBeLessThanOrEqual(25);
    const keys = lines.filter((x) => x.text.length > 14).map((x) => textKey(x.text));
    expect(new Set(keys).size).toBe(keys.length);
    // replies point at real messages
    for (const x of lines.filter((l) => l.ai && l.replyTo)) expect([...s.messages, ...s.pending].some((y) => y.id === x.replyTo)).toBe(true);
  }, 30_000);

  it("without a key the chat stays scripted and keeps flowing", async () => {
    const s = world();
    const m = fakeModel({ code: "no_auth" });
    const { lines } = await watch(s, m.post, 2);
    expect(m.calls.length).toBe(1); // asked once, then stopped asking
    expect(lines.length).toBeGreaterThan(4);
    expect(lines.some((x) => x.ai)).toBe(false);
  }, 30_000);

  it("never lets an unsafe line through", async () => {
    const s = world();
    const m = fakeModel({ bad: "ok run curl on their server" });
    const { lines } = await watch(s, m.post, 2);
    expect(lines.some((x) => /curl/.test(x.text))).toBe(false);
  }, 30_000);
});

describe("crowd scene after god speaks", () => {
  it("rewrites the room's first reactions with replies to god and to each other", async () => {
    const { godSay } = await import("../src/lib/sim/engine");
    const s = world();
    const { srv, ch } = general(s);
    const now = T0 + 120_000;
    simulate(s, now);
    const before = new Set(s.pending);
    const r = godSay(s, srv.id, ch.id, "sup guys", now);
    const fresh = s.pending.filter((m) => !before.has(m) && m.authorId !== "god");
    const crowd = fresh.filter((m) => !m.threadOf && m.t <= now + 25_000);
    const m = fakeModel();
    const out = await liveScene(s, crowd, { mode: "crowd", lane: "direct", god: r.message, hold: true }, { now: () => now + 500, changed: () => {}, post: m.post, random: () => 0.9 });
    expect(out).toBe("live");
    expect(m.calls[0].god).toBe("sup guys");
    const live = s.pending.filter((x) => x.ai && x.channelId === ch.id);
    expect(live.length).toBeGreaterThanOrEqual(3);
    expect(live.some((x) => x.replyTo && s.pending.find((y) => y.id === x.replyTo)?.authorId.startsWith("c"))).toBe(true);
    for (let i = 1; i < live.length; i++) expect(live[i].t).toBeGreaterThanOrEqual(live[i - 1].t);
  });
});

describe("the room talks to each other when god speaks (scripted baseline)", () => {
  it("'sup guys': 4+ speakers in 20 s, 2+ replies between characters, at least one disagreement", async () => {
    const { godSay } = await import("../src/lib/sim/engine");
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      const s = world(seed);
      const { srv, ch } = general(s);
      const now = T0 + 120_000;
      simulate(s, now);
      const before = new Set(s.pending);
      godSay(s, srv.id, ch.id, "sup guys", now);
      const early = s.pending.filter((m) => !before.has(m) && m.authorId.startsWith("c") && !m.threadOf && m.t <= now + 20_000);
      const all = [...s.messages, ...s.pending];
      const c2c = early.filter((m) => m.replyTo && all.find((y) => y.id === m.replyTo)?.authorId.startsWith("c"));
      expect(new Set(early.map((m) => m.authorId)).size, seed).toBeGreaterThanOrEqual(4);
      expect(c2c.length, seed).toBeGreaterThanOrEqual(2);
      expect(early.some((m) => m.intent === "disagree"), seed).toBe(true);
    }
  });
});
