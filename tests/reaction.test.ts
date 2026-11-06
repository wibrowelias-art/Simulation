import { describe, expect, it } from "vitest";
import { world, T0 } from "./helpers";
import { godSay, simulate, channelMessages, typingIn, reactionsAt, unreadIndex, textAt } from "../src/lib/sim/engine";
import { parseGodText } from "../src/lib/sim/godspeak";
import type { WorldState } from "../src/lib/sim/types";

function hq(s: WorldState) {
  const srv = s.servers.find((x) => /god hq/i.test(x.name)) ?? s.servers[0];
  const ch = srv.channels.find((c) => c.name === "general") ?? srv.channels[0];
  return { srv, ch };
}

describe("parseGodText", () => {
  it("classifies intents", () => {
    expect(parseGodText("sup guys").intent).toBe("greeting");
    expect(parseGodText("what are you all doing?").question).toBe(true);
    expect(parseGodText("just bought an island").intent).toBe("purchase");
    expect(parseGodText("gn everyone").intent).toBe("farewell");
    expect(parseGodText("you're all clowns").intent).toBe("insult");
  });
});

describe("@god speaks in a public channel", () => {
  const s = world();
  const { srv, ch } = hq(s);
  const now = T0 + 60_000;
  const res = godSay(s, srv.id, ch.id, "sup guys", now);

  it("people start typing within 1-3s", () => {
    const at = typingIn(s, ch.id, now + 2500);
    expect(at.length).toBeGreaterThanOrEqual(2);
  });
  it("first replies land within ~3s and reply to god", () => {
    simulate(s, now + 3200);
    const msgs = channelMessages(s, ch.id, now + 3200).filter((m) => m.t > now);
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs.some((m) => m.replyTo === res.message.id || /@god|god/i.test(m.text))).toBe(true);
  });
  it("the first hype message is a direct reply to god (drives the mention badge)", () => {
    const first = [...s.messages, ...s.pending].filter((m) => m.channelId === ch.id && m.t > now && m.authorId.startsWith("c")).sort((a, b) => a.t - b.t)[0];
    expect(first.replyTo).toBe(res.message.id);
    expect(first.t - now).toBeLessThan(4000);
  });
  it("a character answers another character within the first ~5s", () => {
    const early = [...s.messages, ...s.pending].filter((m) => m.channelId === ch.id && m.t > now && m.t <= now + 5000);
    const ids = new Map(early.map((m) => [m.id, m]));
    expect(early.some((m) => m.authorId.startsWith("c") && m.replyTo && ids.get(m.replyTo)?.authorId.startsWith("c"))).toBe(true);
  });
  it("conversation continues with character-to-character replies", () => {
    simulate(s, now + 90_000);
    const msgs = channelMessages(s, ch.id, now + 90_000, 400).filter((m) => m.t > now && m.authorId !== "god");
    expect(msgs.length).toBeGreaterThanOrEqual(8);
    const ids = new Set(msgs.map((m) => m.id));
    expect(msgs.some((m) => m.replyTo && ids.has(m.replyTo))).toBe(true);
    const texts = msgs.map((m) => m.text);
    expect(new Set(texts).size).toBe(texts.length);
  });
  it("reactions pile on and notifications arrive", () => {
    const god = [...s.messages, ...s.pending].find((m) => m.id === res.message.id)!;
    const total = reactionsAt(god, now + 60_000).reduce((a, r) => a + r.count, 0);
    expect(total).toBeGreaterThanOrEqual(5);
    expect(s.notifications.filter((n) => n.t > now && n.t <= now + 90_000).length).toBeGreaterThan(0);
    const u = unreadIndex(s, now + 90_000, { [ch.id]: now }, now);
    expect(u.get(ch.id)?.n ?? 0).toBeGreaterThan(0);
  });
  it("other servers discuss it later", () => {
    simulate(s, now + 15 * 60_000);
    const others = s.messages.filter((m) => m.serverId !== srv.id && m.serverId !== "dm" && m.t > now && /god/i.test(textAt(m, now + 15 * 60_000)) && new RegExp(srv.name.split(" ")[0] + "|" + ch.name + "|just (now|said)|was in|showed up|appeared|popped", "i").test(m.text));
    expect(others.length).toBeGreaterThan(0);
  });
  it("replying to a character makes them freak out", () => {
    const target = channelMessages(s, ch.id, now + 15 * 60_000).filter((m) => m.authorId.startsWith("c")).pop()!;
    const t2 = now + 16 * 60_000;
    godSay(s, srv.id, ch.id, "lol true", t2, target.id);
    simulate(s, t2 + 20_000);
    const fresh = channelMessages(s, ch.id, t2 + 20_000, 200).filter((m) => m.t > t2);
    expect(fresh.some((m) => m.authorId === target.authorId)).toBe(true);
  });
  it("is deterministic", () => {
    const a = world(); const b = world();
    const x = godSay(a, hq(a).srv.id, hq(a).ch.id, "sup guys", now);
    const y = godSay(b, hq(b).srv.id, hq(b).ch.id, "sup guys", now);
    expect(x.replies).toBe(y.replies);
    expect(a.pending.map((m) => m.text)).toEqual(b.pending.map((m) => m.text));
  });
});
