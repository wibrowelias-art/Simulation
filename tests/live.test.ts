import { beforeEach, describe, expect, it } from "vitest";
import { world, T0 } from "./helpers";
import { godSay, simulate, channelMessages } from "../src/lib/sim/engine";
import { liveReply, pickLead, resetLive, historyFor } from "../src/lib/live/client";
import { cleanLines, instructions, promptText, sanitize } from "../src/lib/live/prompt";
import { dmChannel } from "../src/lib/sim/godspeak";
import type { Message, WorldState } from "../src/lib/sim/types";

function hq(s: WorldState) {
  const srv = s.servers.find((x) => /god hq/i.test(x.name)) ?? s.servers[0];
  return { srv, ch: srv.channels.find((c) => c.name === "general") ?? srv.channels[0] };
}
const say = (s: WorldState, srv: string, ch: string, text: string, now: number, replyTo?: string) => {
  const before = new Set(s.pending);
  const r = godSay(s, srv, ch, text, now, replyTo);
  return { r, fresh: s.pending.filter((m) => !before.has(m) && m.authorId !== "god") };
};
let last: { history: { who: string; text: string }[]; god: string } | undefined;
const fake = (lines: string[] | null, status = 200, code?: string) => (async (_u: unknown, init?: RequestInit) => {
  last = JSON.parse(String(init?.body));
  return new Response(JSON.stringify(lines ? { lines, model: "test/model" } : { code }), { status });
}) as unknown as typeof fetch;

beforeEach(() => resetLive());

describe("live replies", () => {
  it("DM: the peer's scripted reply is replaced by the model's lines, in order", async () => {
    const s = world();
    const c = s.characters.find((x) => x.core)!;
    const ch = dmChannel("god", c.id);
    let clock = T0 + 60_000;
    const { r, fresh } = say(s, "dm", ch, "yo what are you up to", clock);
    expect(pickLead(s, r.message, fresh)?.authorId).toBe(c.id);
    const out = await liveReply(s, r.message, fresh, { now: () => (clock += 800), changed: () => {}, post: fake(["nm just got off work", "wbu"]) });
    expect(out).toBe("live");
    simulate(s, clock + 10 * 60_000);
    const msgs = channelMessages(s, ch, clock + 10 * 60_000).filter((m) => m.authorId === c.id).map((m) => m.text);
    expect(msgs).toEqual(["nm just got off work", "wbu"]);
  });

  it("sends the recent conversation so replies can remember it", async () => {
    const s = world();
    const c = s.characters.find((x) => x.core)!;
    const ch = dmChannel("god", c.id);
    let clock = T0 + 60_000;
    const post = fake(["bet"]);
    for (const text of ["my favorite color is teal", "remember that", "what's my favorite color?"]) {
      const { r, fresh } = say(s, "dm", ch, text, clock);
      await liveReply(s, r.message, fresh, { now: () => (clock += 1500), changed: () => {}, post });
      clock += 60 * 60_000; // let it land (even if they were asleep)
      simulate(s, clock);
    }
    const body = last!;
    expect(body.god).toBe("what's my favorite color?");
    expect(body.history.map((h) => h.text)).toContain("my favorite color is teal");
    expect(body.history.some((h) => h.who === c.username)).toBe(true);
  });

  it("falls back to the scripted line when the model is unavailable, and stops asking", async () => {
    const s = world();
    const { srv, ch } = hq(s);
    let clock = T0 + 60_000;
    const { r, fresh } = say(s, srv.id, ch.id, "sup guys", clock);
    const lead = pickLead(s, r.message, fresh)!;
    const text = lead.text;
    const out = await liveReply(s, r.message, fresh, { now: () => (clock += 300), changed: () => {}, post: fake(null, 402, "customer_verification_required") });
    expect(out).toBe("fallback");
    expect(lead.text).toBe(text);
    expect(lead.t).toBeLessThan(clock + 3000);
    const again = say(s, srv.id, ch.id, "hello?", (clock += 5000));
    expect(await liveReply(s, again.r.message, again.fresh, { now: () => clock, changed: () => {}, post: fake(["x"]) })).toBe("skipped");
  });

  it("replies to the lead wait behind it", async () => {
    const s = world();
    const { srv, ch } = hq(s);
    simulate(s, T0 + 60_000);
    const target = channelMessages(s, ch.id, T0 + 60_000).filter((m) => m.authorId.startsWith("c")).pop() as Message;
    let clock = T0 + 61_000;
    const { r, fresh } = say(s, srv.id, ch.id, "wait you again?", clock, target.id);
    const lead = pickLead(s, r.message, fresh)!;
    expect(lead.authorId).toBe(target.authorId);
    await liveReply(s, r.message, fresh, { now: () => (clock += 4000), changed: () => {}, post: fake(["lmaooo yes me again"]) });
    for (const d of fresh.filter((m) => m.replyTo === lead.id)) expect(d.t).toBeGreaterThan(lead.t);
  });

  it("history excludes the new god line and is capped at 30", () => {
    const s = world();
    const { ch } = hq(s);
    simulate(s, T0 + 3600e3);
    expect(historyFor(s, ch.id, T0 + 3600e3, "none").length).toBeLessThanOrEqual(30);
  });
});

describe("prompt", () => {
  it("sanitizes and caps input", () => {
    expect(sanitize({})).toBeUndefined();
    const r = sanitize({ persona: { username: "a".repeat(200), opinion: 900 }, god: "x".repeat(2000), history: Array.from({ length: 50 }, () => ({ who: "a", text: "b" })) })!;
    expect(r.persona.username.length).toBe(40);
    expect(r.persona.opinion).toBe(100);
    expect(r.god.length).toBe(600);
    expect(r.history.length).toBe(30);
  });
  it("keeps the rules in the system prompt", () => {
    const r = sanitize({ persona: { username: "kai", name: "Kai" }, god: "are you a bot?" })!;
    const sys = instructions(r);
    expect(sys).toMatch(/fictional/);
    expect(sys).toMatch(/Never say or hint that you are an AI/);
    expect(instructions({ ...r, allowBreak: true })).toMatch(/may say yes/);
    expect(promptText(r)).toMatch(/are you a bot\?/);
  });
  it("cleans model output", () => {
    expect(cleanLines('kai: "yo"\n\n- *laughs* lmao\nthree\nfour', "kai")).toEqual(["yo", "lmao", "three"]);
  });
});

describe("memory of what god says", () => {
  it("keeps a remembered fact and sends it next time", async () => {
    const { liveReply, resetLive, persona } = await import("../src/lib/live/client");
    const { parseReply } = await import("../src/lib/live/prompt");
    expect(parseReply('{"messages":["omg biscuit 😭"],"remember":"his dog is called Biscuit"}', "x")).toEqual({ lines: ["omg biscuit 😭"], remember: "his dog is called Biscuit" });
    expect(parseReply("just plain text", "x").lines).toEqual(["just plain text"]);
    resetLive();
    const s = world("mem");
    const c = s.characters.find((x) => x.core)!;
    simulate(s, T0 + 60e3);
    const before = new Set(s.pending);
    const r = godSay(s, "dm", dmChannel("god", c.id), "my dog is called Biscuit", T0 + 60e3);
    const fresh = s.pending.filter((m) => !before.has(m) && m.authorId !== "god");
    const out = await liveReply(s, r.message, fresh, { now: () => T0 + 60e3, changed: () => {}, post: async () => Response.json({ lines: ["biscuit is elite"], remember: "his dog is called Biscuit" }) });
    expect(out).toBe("live");
    expect(c.godFacts).toContain("his dog is called Biscuit");
    expect(persona(c, s).godFacts).toContain("his dog is called Biscuit");
  });
});
