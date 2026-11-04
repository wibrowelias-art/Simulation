import { describe, expect, it } from "vitest";
import { baseline, godReact, godSay, simulate, summarize } from "../src/lib/sim/engine";
import { godJoinVoice, godLeaveVoice, godStopTyping, godTyping, overheardAt, parseCommand, voiceChannels, voiceRoster } from "../src/lib/sim/presence";
import { T0, world } from "./helpers";

const SEC = 1000, MIN = 60 * SEC;
const SRV = "godhq", CH = "godhq-general";

function fresh(seed: string) {
  const s = world(seed);
  simulate(s, T0 + 5 * MIN);
  return s;
}
const now = T0 + 5 * MIN;

describe("typing presence", () => {
  it("queues 3-5 reactions about a second out, debounced, and stops when god clears the box", () => {
    const s = fresh("typing");
    const n = godTyping(s, SRV, CH, now);
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(5);
    const q = s.pending.filter((m) => m.intent === "godTyping");
    expect(q).toHaveLength(n);
    expect(Math.min(...q.map((m) => m.t)) - now).toBeLessThan(1600);
    expect(Math.min(...q.map((m) => m.t)) - now).toBeGreaterThan(800);
    expect(q.every((m) => (m.typingFrom ?? 0) < m.t)).toBe(true);
    expect(godTyping(s, SRV, CH, now + 5 * SEC)).toBe(0);
    godStopTyping(s, CH, now + 1000);
    expect(s.pending.filter((m) => m.intent === "godTyping" && m.t > now + 1400)).toHaveLength(0);
    expect(godTyping(s, "dm", "dm-x", now)).toBe(0);
  });
});

describe("reaction cascade", () => {
  it("the author replies, others pile on, and the reactions burst", () => {
    const s = fresh("react");
    const m = [...s.messages].reverse().find((x) => x.channelId === CH && x.authorId.startsWith("c"))!;
    const n = godReact(s, m.id, "🔥", now);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(m.cascaded).toBe(true);
    const reply = s.pending.find((x) => x.replyTo === m.id && x.authorId === m.authorId && x.intent === "reacted")!;
    expect(reply).toBeTruthy();
    expect(reply.t - now).toBeLessThan(3000);
    expect((m.reactionLog ?? []).filter(([e, t]) => e === "🔥" && t > now).length).toBeGreaterThan(2);
    expect(godReact(s, m.id, "🔥", now + SEC)).toBe(0); // toggling off does not cascade again
  });
});

describe("direct address and soft commands", () => {
  it("parses commands", () => {
    expect(parseCommand("say hi")?.kind).toBe("hi");
    expect(parseCommand("tell a joke pls")?.kind).toBe("joke");
    expect(parseCommand("drop a meme")?.kind).toBe("meme");
    expect(parseCommand("defend me")?.kind).toBe("defend");
    expect(parseCommand("roast @someone")?.kind).toBe("roast");
    expect(parseCommand("nice weather")).toBeUndefined();
  });
  it("a mentioned character answers within 3 seconds", () => {
    const s = fresh("mention");
    const srv = s.servers.find((x) => x.id === SRV)!;
    const c = s.characters.find((x) => srv.members.includes(x.id) && x.id.startsWith("c"))!;
    godSay(s, SRV, CH, `@${c.username} what do you think`, now);
    simulate(s, now + 10 * SEC);
    const r = s.messages.concat(s.pending).filter((m) => m.authorId === c.id && m.t > now).sort((a, b) => a.t - b.t)[0];
    expect(r).toBeTruthy();
    expect(r.t - now).toBeLessThanOrEqual(3000);
    expect(r.intent).toBe("addressed");
  });
  it("commands get the right reply and memes come with an image", () => {
    const s = fresh("cmd");
    const srv = s.servers.find((x) => x.id === SRV)!;
    const c = s.characters.find((x) => srv.members.includes(x.id) && x.id.startsWith("c"))!;
    for (const [i, [text, kind]] of ([["tell a joke", "joke"], ["drop a meme", "meme"], ["say hi", "hi"]] as const).entries()) {
      const t = now + i * MIN;
      godSay(s, SRV, CH, `@${c.username} ${text}`, t);
      const r = s.pending.concat(s.messages).find((m) => m.authorId === c.id && m.t > t && m.intent === `cmd:${kind}`)!;
      expect(r, kind).toBeTruthy();
      expect(r.t - t).toBeLessThanOrEqual(3000);
      if (kind === "meme") expect(r.meme).toBeTruthy();
    }
    expect(s.godMoments?.some((g) => g.kind === "command")).toBe(true);
  });
});

describe("voice lounge", () => {
  it("joining posts a banner, pulls people in and fills the transcript; leaving ends it", () => {
    const s = fresh("voice");
    const srv = s.servers.find((x) => x.id === SRV)!;
    const vc = voiceChannels(srv)[0];
    expect(vc).toBeTruthy();
    const { joiners } = godJoinVoice(s, SRV, vc.id, now);
    expect(joiners).toBeGreaterThanOrEqual(5);
    expect(s.pending.some((m) => m.intent === "voiceJoin" && m.authorId === "god")).toBe(true);
    expect(s.pending.filter((m) => m.intent === "voiceHype").length).toBeGreaterThanOrEqual(4);
    simulate(s, now + 2 * MIN);
    expect(voiceRoster(s, srv, vc.id, now + 2 * MIN).some((m) => m.god)).toBe(true);
    expect(overheardAt(s, vc.id, now + 2 * MIN).length).toBeGreaterThan(0);
    godLeaveVoice(s, now + 2 * MIN);
    expect(s.voice?.god?.leftAt).toBe(now + 2 * MIN);
    expect(voiceRoster(s, srv, vc.id, now + 3 * MIN).some((m) => m.god)).toBe(false);
  });
});

describe("away recap", () => {
  it("god's own moments show up in the catch-up highlights", () => {
    const s = fresh("recap");
    const base = baseline(s, now);
    godTyping(s, SRV, CH, now + SEC);
    simulate(s, now + 5 * MIN);
    const sum = summarize(s, base, now + 5 * MIN);
    expect(sum.highlights.some((h) => /You started typing/.test(typeof h === "string" ? h : JSON.stringify(h)))).toBe(true);
  });
});

describe("privacy", () => {
  it("what god says in DMs never shows up in public memes or callbacks", async () => {
    const { memeFor } = await import("../src/lib/sim/engine");
    const { pastGodLine, dmChannel } = await import("../src/lib/sim/godspeak");
    const { rngFor } = await import("../src/lib/sim/rng");
    const s = fresh("privacy");
    const c = s.characters.find((x) => x.id.startsWith("c"))!;
    godSay(s, "dm", dmChannel("god", c.id), "secret plan zebra", now);
    const rng = rngFor("p", 1);
    for (let i = 0; i < 30; i++) expect(pastGodLine(s, rng).text).not.toContain("zebra");
    const topic = { ...s.topics[0], about: "god" as const };
    expect(JSON.stringify(memeFor(s, rng, c, topic))).not.toContain("zebra");
  });
});
