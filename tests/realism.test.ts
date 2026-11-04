import { describe, expect, it } from "vitest";
import { catchUp, diurnalAt, localHour } from "../src/lib/sim/engine";
import { charById } from "../src/lib/sim/world";
import { HOUR, T0, world } from "./helpers";

const s = world("realism");
catchUp(s, T0 + 8 * HOUR);
const chat = s.messages.filter((m) => m.authorId.startsWith("c"));
const words = (t: string) => t.split(/\s+/).filter(Boolean).length;

describe("characters", () => {
  it("has hundreds of unique characters with valid handles", () => {
    expect(s.characters.length).toBeGreaterThanOrEqual(300);
    const handles = new Set(s.characters.map((c) => c.username));
    expect(handles.size).toBe(s.characters.length);
    for (const c of s.characters) {
      expect(c.username).toMatch(/^[a-z0-9_.]{2,32}$/);
      expect(c.username).not.toContain("..");
      expect(c.age).toBeGreaterThanOrEqual(13);
    }
  });

  it("uses a spread of handle conventions (underscores, numbers, dots, prefixes)", () => {
    const u = s.characters.map((c) => c.username);
    const share = (re: RegExp) => u.filter((x) => re.test(x)).length / u.length;
    expect(share(/_/)).toBeGreaterThan(0.08);
    expect(share(/\d/)).toBeGreaterThan(0.15);
    expect(share(/\./)).toBeGreaterThan(0.04);
    expect(share(/^(real|its|the|not)/)).toBeGreaterThan(0.04);
  });

  it("pfp styles are weighted, not uniform, and all appear", () => {
    const counts: Record<string, number> = {};
    for (const c of s.characters) counts[c.pfp] = (counts[c.pfp] ?? 0) + 1;
    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(8);
    const vals = Object.values(counts);
    expect(Math.max(...vals) / Math.min(...vals)).toBeGreaterThan(2);
  });

  it("activity is heavy-tailed: a few power users write most messages", () => {
    const per = new Map<string, number>();
    for (const m of chat) per.set(m.authorId, (per.get(m.authorId) ?? 0) + 1);
    const sorted = [...per.values()].sort((a, b) => b - a);
    const top10 = sorted.slice(0, Math.ceil(s.characters.length * 0.1)).reduce((a, b) => a + b, 0);
    expect(top10 / chat.length).toBeGreaterThan(0.3);
    const lurkers = s.characters.filter((c) => c.tier === "lurker");
    expect(lurkers.length / s.characters.length).toBeGreaterThan(0.55);
  });

  it("each character keeps a consistent voice", () => {
    let checked = 0;
    for (const c of s.characters.filter((c) => c.voice === "zoomer" || c.voice === "lowercase")) {
      const mine = chat.filter((m) => m.authorId === c.id && m.intent !== "mod" && !m.text.startsWith("*"));
      if (mine.length < 5) continue;
      const startsUpper = mine.filter((m) => /^[A-Z][a-z]/.test(m.text)).length;
      expect(startsUpper / mine.length).toBeLessThan(0.2);
      checked++;
    }
    for (const c of s.characters.filter((c) => c.voice === "proper" || c.voice === "formal")) {
      const mine = chat.filter((m) => m.authorId === c.id && /^[a-z]/i.test(m.text));
      if (mine.length < 5) continue;
      const lower = mine.filter((m) => /^[a-z]/.test(m.text)).length;
      expect(lower / mine.length).toBeLessThan(0.25);
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });
});

describe("message variety and non-repetition", () => {
  it("has thousands of messages and most long ones are unique", () => {
    expect(chat.length).toBeGreaterThan(3000);
    const long = chat.filter((m) => m.text.length > 25).map((m) => m.text.toLowerCase());
    expect(new Set(long).size / long.length).toBeGreaterThan(0.85);
  });

  it("no message text dominates", () => {
    const freq = new Map<string, number>();
    for (const m of chat) freq.set(m.text.toLowerCase(), (freq.get(m.text.toLowerCase()) ?? 0) + 1);
    const top = Math.max(...freq.values());
    expect(top / chat.length).toBeLessThan(0.02);
  });

  it("no exact duplicate within a channel's recent window", () => {
    const byCh = new Map<string, string[]>();
    for (const m of chat) { const a = byCh.get(m.channelId) ?? []; a.push(m.text); byCh.set(m.channelId, a); }
    let dupes = 0, total = 0;
    for (const list of byCh.values()) for (let i = 0; i < list.length; i++) {
      if (list[i].length < 15) continue;
      total++;
      if (list.slice(Math.max(0, i - 40), i).includes(list[i])) dupes++;
    }
    expect(dupes / total).toBeLessThan(0.01);
  });

  it("length distribution looks like chat: mostly short, some long", () => {
    const w = chat.map((m) => words(m.text)).sort((a, b) => a - b);
    const median = w[Math.floor(w.length / 2)];
    expect(median).toBeGreaterThanOrEqual(2);
    expect(median).toBeLessThanOrEqual(10);
    expect(w.filter((x) => x <= 3).length / w.length).toBeGreaterThan(0.2);
    expect(w.filter((x) => x >= 15).length / w.length).toBeGreaterThan(0.02);
  });

  it("not everything is about @god", () => {
    const god = chat.filter((m) => /\bgod\b|\bhim\b|\bhe\b/i.test(m.text) || s.topics.find((t) => t.id === m.topicId)?.about === "god").length;
    expect(god / chat.length).toBeLessThan(0.75);
    expect(god / chat.length).toBeGreaterThan(0.15);
  });

  it("slang, emoji and typos appear at believable rates", () => {
    const share = (re: RegExp) => chat.filter((m) => re.test(m.text)).length / chat.length;
    expect(share(/\b(fr|ngl|ong|lmao|lol|tbh|icl|deadass|no cap)\b/i)).toBeGreaterThan(0.05);
    expect(share(/💀|😭/)).toBeGreaterThan(0.01);
    expect(share(/^\*\w+$/)).toBeGreaterThan(0.002);
    expect(share(/^\*\w+$/)).toBeLessThan(0.05);
  });

  it("different characters on the same topic phrase it differently", () => {
    const godTopic = s.topics.find((t) => t.about === "god")!;
    const texts = chat.filter((m) => m.topicId === godTopic.id).map((m) => m.text.toLowerCase());
    expect(new Set(texts).size / texts.length).toBeGreaterThan(0.6);
  });
});

describe("conversation threading", () => {
  it("has replies, pings, self follow-ups, mod and bot messages", () => {
    expect(chat.filter((m) => m.replyTo).length / chat.length).toBeGreaterThan(0.08);
    expect(chat.filter((m) => /@[a-z0-9_.]+/.test(m.text)).length).toBeGreaterThan(50);
    let bursts = 0;
    for (let i = 1; i < s.messages.length; i++) {
      const a = s.messages[i - 1], b = s.messages[i];
      if (a.channelId === b.channelId && a.authorId === b.authorId && b.t - a.t < 30_000) bursts++;
    }
    expect(bursts).toBeGreaterThan(100);
    expect(s.messages.some((m) => m.authorId.startsWith("bot-"))).toBe(true);
    const modIds = new Set(s.servers.flatMap((x) => x.moderators));
    expect(chat.some((m) => modIds.has(m.authorId) && m.intent === "mod")).toBe(true);
  });

  it("replies point at earlier messages in the same channel", () => {
    const byId = new Map(s.messages.map((m) => [m.id, m]));
    let ok = 0, n = 0;
    for (const m of s.messages) if (m.replyTo && byId.has(m.replyTo)) { n++; const p = byId.get(m.replyTo)!; if (p.channelId === m.channelId && p.t <= m.t) ok++; }
    expect(n).toBeGreaterThan(50);
    expect(ok).toBe(n);
  });

  it("topics drift inside conversations", () => {
    expect(chat.some((m) => m.intent === "drift")).toBe(true);
  });
});

describe("activity rhythms", () => {
  it("diurnal curve has a night trough and evening peak", () => {
    expect(diurnalAt("evening", 4)).toBeLessThan(diurnalAt("evening", 21) / 3);
    expect(diurnalAt("owl", 2)).toBeGreaterThan(diurnalAt("morning", 2));
  });

  it("characters post more in their own evening than their own small hours", () => {
    let eve = 0, night = 0;
    for (const m of chat) {
      const h = localHour(charById(s, m.authorId), m.t);
      if (h >= 18 && h < 23) eve++;
      else if (h >= 3 && h < 7) night++;
    }
    // 5h vs 4h windows
    expect(eve / 5).toBeGreaterThan((night / 4) * 1.8);
  });
});
