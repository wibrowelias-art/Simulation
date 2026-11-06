import { describe, expect, it } from "vitest";
import { world, T0 } from "./helpers";
import { godEdit, godPin, godPost, godPostAction, godReact, godSay, pinnedIn, reactionsAt, simulate, textKey, unreadIndex, dmThreads, typingIn } from "../src/lib/sim/engine";
import { dmChannel } from "../src/lib/sim/godspeak";
import { migrateWorld } from "../src/lib/sim/world";

const hq = (s: ReturnType<typeof world>) => { const srv = s.servers.find((x) => x.id === "godhq") ?? s.servers[0]; return { srv, ch: srv.channels.find((c) => c.name === "general") ?? srv.channels[0] }; };

describe("@god's own message actions", () => {
  it("edits, pins, reacts and deletes", () => {
    const s = world();
    const { srv, ch } = hq(s);
    const { message } = godSay(s, srv.id, ch.id, "first draft", T0 + 1000);
    expect(godEdit(s, message.id, "final words", T0 + 5000)).toBe(true);
    const m = [...s.messages, ...s.pending].find((x) => x.id === message.id)!;
    expect(m.text).toBe("final words");
    expect(m.editedAt).toBe(T0 + 5000);
    godPin(s, m.id, T0 + 6000);
    expect(pinnedIn(s, ch.id, T0 + 7000).map((x) => x.id)).toContain(m.id);
    godPin(s, m.id, T0 + 8000);
    expect(pinnedIn(s, ch.id, T0 + 9000).map((x) => x.id)).not.toContain(m.id);
    godReact(s, m.id, "🫡");
    expect(reactionsAt(m, T0 + 1000).find((r) => r.emoji === "🫡")?.me).toBe(true);
    godReact(s, m.id, "🫡");
    expect(m.reactions.find((r) => r.emoji === "🫡" && r.me)).toBeUndefined();
    expect(godEdit(s, m.id, null, T0 + 10000)).toBe(true);
    expect(m.deleted).toBe(true);
    expect(s.godLog.some((g) => g.id === m.id)).toBe(false);
  });
  it("cannot edit someone else's message", () => {
    const s = world();
    const other = s.messages.find((m) => m.authorId !== "god")!;
    expect(godEdit(s, other.id, "hacked", T0)).toBe(false);
    expect(other.text).not.toBe("hacked");
  });
});

describe("posts", () => {
  it("like and repost toggle by exactly one", () => {
    const s = world();
    const p = s.posts.find((x) => x.authorId !== "god")!;
    const l = p.likes, r = p.reposts;
    godPostAction(s, p.id, "like"); expect(p.likes).toBe(l + 1);
    godPostAction(s, p.id, "like"); expect(p.likes).toBe(l);
    godPostAction(s, p.id, "repost"); expect(p.reposts).toBe(r + 1);
  });
  it("reply counts are backed by stored replies", () => {
    const s = world();
    godPost(s, "chirp", "big announcement tomorrow", T0 + 1000);
    const mine = s.posts.filter((p) => p.authorId === "god").at(-1)!;
    const stored = s.posts.filter((p) => p.replyTo === mine.id).length;
    expect(stored).toBeGreaterThanOrEqual(3);
    expect(mine.replies).toBe(stored);
  });
});

describe("unread, DMs and dedupe", () => {
  it("counts unread + mentions per channel and clears on read", () => {
    const s = world();
    const { srv, ch } = hq(s);
    godSay(s, srv.id, ch.id, "sup guys", T0 + 1000);
    simulate(s, T0 + 60_000);
    const u = unreadIndex(s, T0 + 60_000, {}, T0 + 1000).get(ch.id)!;
    expect(u.n).toBeGreaterThan(0);
    expect(u.mentions).toBeGreaterThan(0);
    expect(unreadIndex(s, T0 + 60_000, { [ch.id]: T0 + 60_000 }, T0).get(ch.id)).toBeUndefined();
  });
  it("a DM to a character gets typed + answered and shows up as a thread", () => {
    const s = world();
    const c = s.characters.find((x) => x.core)!;
    const id = dmChannel("god", c.id);
    godSay(s, "dm", id, "hey, you up?", T0 + 1000);
    const reply = s.pending.find((m) => m.channelId === id && m.authorId === c.id);
    expect(reply).toBeDefined();
    expect(typingIn(s, id, (reply!.typingFrom ?? reply!.t - 1000) + 1)).toContain(c.id);
    simulate(s, reply!.t + 1000);
    expect(dmThreads(s, reply!.t + 1000).find((d) => d.channelId === id)?.withGod).toBe(true);
  });
  it("dedupe key ignores case, punctuation, emoji and handles", () => {
    expect(textKey("LMAO @god 💀 sup!!")).toBe(textKey("lmao sup"));
  });
});

describe("save migration", () => {
  it("upgrades an older save instead of wiping it", () => {
    const s = world();
    const old = JSON.parse(JSON.stringify(s));
    old.version = 3; delete old.bus; delete old.godLog;
    const m = migrateWorld(old)!;
    expect(m).toBeDefined();
    expect(Array.isArray(m.bus)).toBe(true);
    expect(m.characters.length).toBe(s.characters.length);
    expect(migrateWorld({ ...old, version: 1 })).toBeUndefined();
  });
});
