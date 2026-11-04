import { installUndernet } from "./undernet";
import { rngFor } from "./rng";
import type { Character, Server, WorldState } from "./types";
import { makeCharacter } from "./characters";
import { CELEB_FIELDS } from "./data";
import { OUTLETS, SERVER_DEFS } from "./servers";

export const WORLD_VERSION = 7;
export const CORE_CAST = 36;
export const CHARACTER_COUNT = 380;

export function createWorld(seed: string, now: number): WorldState {
  const rng = rngFor(seed, "world");
  const used = new Set<string>();
  const characters: Character[] = [];
  const celebs = CELEB_FIELDS.map((f, i) => ({ field: f, idx: i }));
  for (let i = 0; i < CHARACTER_COUNT; i++) {
    const celeb = i < celebs.length ? celebs[i].field : undefined;
    characters.push(makeCharacter(rng, i, used, { influencer: i < 40, celebField: celeb, celebIndex: i }));
  }
  const servers: Server[] = SERVER_DEFS.map((d) => {
    const want = d.cast;
    const scored = characters.map((c) => {
      const interest = c.interests.filter((x) => d.tags.includes(x) || (x === "celebrity" && d.tags.includes("drama"))).length;
      const align = 1 + Math.max(-0.8, d.bias * (c.opinion / 100) * 1.6);
      const w = (0.35 + interest) * align * (c.tier === "power" ? 1.5 : 1) * rng.range(0.2, 1.8);
      return { c, w };
    });
    scored.sort((a, b) => b.w - a.w);
    const members = scored.slice(0, want).map((x) => x.c);
    for (const m of members) m.servers.push(d.id);
    const modPool = members.filter((m) => m.tier !== "lurker" && !m.influencer && m.age >= 19);
    const mods = rng.shuffle([...modPool]).slice(0, rng.int(2, 3));
    for (const m of mods) m.isMod = true;
    return {
      id: d.id, name: d.name, icon: d.icon, color: d.color, description: d.description, bias: d.bias, vibe: d.vibe, tags: d.tags,
      channels: d.channels.map(([name, topic, tags]) => ({ id: `${d.id}-${name}`, name, topic, tags, announce: name === "god-announcements" || name === "announcements" })),
      members: members.map((m) => m.id), moderators: mods.map((m) => m.id), memberCount: d.size, insideJokes: d.jokes,
    };
  });
  // every character lives somewhere
  for (const c of characters) {
    if (!c.servers.length) {
      const s = rng.pick(servers);
      s.members.push(c.id);
      c.servers.push(s.id);
    }
    for (const sid of c.servers) if (rng.chance(0.22)) c.nicknames[sid] = rng.pick([c.displayName.split(" ")[0].toLowerCase(), `${c.username.slice(0, 6)}`, `${c.displayName.split(" ")[0]} 🌙`, `${c.username} (${rng.pick(["afk", "lvl " + rng.int(5, 80), "mod-in-training", "lurking", "NFA"])})`]);
  }
  // relationships form inside shared servers
  for (const c of characters) {
    const pool = servers.filter((s) => c.servers.includes(s.id)).flatMap((s) => s.members).filter((id) => id !== c.id);
    for (let k = 0; k < rng.int(1, 5) && pool.length; k++) {
      const o = characters[Number(rng.pick(pool).slice(1))];
      const same = Math.sign(o.opinion) === Math.sign(c.opinion);
      if (same && !c.friends.includes(o.id)) { c.friends.push(o.id); if (!o.friends.includes(c.id)) o.friends.push(c.id); }
      else if (!same && !c.rivals.includes(o.id) && rng.chance(0.6)) { c.rivals.push(o.id); if (!o.rivals.includes(c.id)) o.rivals.push(c.id); }
    }
  }
  pickCoreCast(rng, characters, servers);
  const start = Math.floor(now / 10_000) * 10_000;
  const w: WorldState = {
    version: WORLD_VERSION, seed, createdAt: now, simTime: start, lastSeenAt: now, characters, servers, outlets: OUTLETS,
    celebrities: celebs.map((c) => ({ id: `c${c.idx}`, field: c.field })),
    messages: [], posts: [], articles: [], topics: [], events: [], notifications: [],
    player: {
      username: "god", displayName: "God", cash: 2_400_000_000, followers: 48_200_000, reputation: 62, influence: 88, avatarSeed: 7,
      holdings: [
        { id: "h-holdings", kind: "business", name: "GOD Holdings", value: 9_800_000_000, acquiredAt: now - 9e10, detail: "Parent company · 14 subsidiaries", employees: 6200, yieldPerDay: 4_100_000 },
        { id: "h-penthouse", kind: "property", name: "Halcyon Tower Penthouse", value: 180_000_000, acquiredAt: now - 6e10, detail: "Port Aurelia · 3 floors" },
        { id: "h-jet", kind: "jet", name: "Skyhaven 700", value: 72_000_000, acquiredAt: now - 4e10, detail: "Tail: G-OD1" },
        { id: "h-car", kind: "vehicle", name: "Vantor Spectre", value: 3_400_000, acquiredAt: now - 2e10, detail: "Matte black" },
        { id: "h-port", kind: "investment", name: "Index & Venture Portfolio", value: 3_100_000_000, acquiredAt: now - 9e10, detail: "Diversified", yieldPerDay: 600_000 },
      ],
      history: [], netWorthHistory: [],
    },
    settings: { activity: 1, glazeRatio: 0.5, drama: 0.5, theme: "midnight", reducedMotion: false },
    counter: 0, stats: { messages: 0, posts: 0, articles: 0, pruned: 0 }, recentTexts: [], pending: [], bus: [], godLog: [],
  };
  installUndernet(w, now);
  return w;
}

/** ~36 recurring regulars with a deliberate mix of attitudes, so the player learns their names. */
/** bring an older save up to the current version without losing anything */
export function migrateWorld(w: WorldState): WorldState | undefined {
  if (w.version === WORLD_VERSION) { ensureUndernet(w); return w; }
  if (w.version < 3 || w.version > WORLD_VERSION) return undefined;
  if (w.version === 3) {
    w.bus ??= [];
    w.godLog ??= [];
    if (!w.characters.some((c) => c.core)) pickCoreCast(rngFor(w.seed, "core-migrate"), w.characters, w.servers);
    for (const m of w.messages) if (m.authorId === "god") w.godLog.push({ id: m.id, t: m.t, text: m.text, serverId: m.serverId, channelId: m.channelId, intent: "generic" });
    w.godLog = w.godLog.slice(-60);
  }
  // v3, v4 and early v5 saves may predate The Undernet
  ensureUndernet(w);
  // v7: messages may carry an optional `ai` flag (live lines); nothing to convert
  w.version = WORLD_VERSION;
  return w;
}

/** safety net on every load: installs The Undernet into any save that lacks it (idempotent) and flags the "new" tip */
export function ensureUndernet(w: WorldState) {
  if (installUndernet(w, w.simTime || Date.now())) w.undernet!.announce = true;
  return w;
}

function pickCoreCast(rng: ReturnType<typeof rngFor>, characters: Character[], servers: Server[]) {
  const want: [Character["stance"], number][] = [["worshipper", 7], ["fan", 7], ["analyst", 4], ["skeptic", 4], ["jealous", 4], ["hater", 4], ["memer", 3], ["conspiracist", 1], ["indifferent", 2]];
  const hq = servers.find((x) => x.id === "godhq")!;
  const pool = characters.filter((c) => !c.influencer && c.age >= 16);
  const core: Character[] = [];
  for (const [stance, n] of want) {
    const cands = rng.shuffle(pool.filter((c) => c.stance === stance && !core.includes(c))).sort((a, b) => Number(a.tier === "lurker") - Number(b.tier === "lurker"));
    core.push(...cands.slice(0, n));
  }
  for (const c of core.slice(0, CORE_CAST)) {
    c.core = true;
    if (c.tier === "lurker") c.tier = "regular";
    c.activity = Math.max(c.activity, 1.6) * 2.2;
    c.bond = Math.round(rng.range(0, 12));
    c.godContacts = [];
    if (!c.servers.includes(hq.id)) { c.servers.push(hq.id); hq.members.push(c.id); }
  }
  // regulars know each other
  const ids = core.map((c) => c.id);
  for (const c of core) {
    const others = rng.shuffle(ids.filter((x) => x !== c.id)).slice(0, 3);
    for (const o of others) {
      const oc = characters[Number(o.slice(1))];
      const same = Math.sign(oc.opinion) === Math.sign(c.opinion);
      const list = same ? "friends" : "rivals";
      if (!c[list].includes(o)) c[list].push(o);
      if (!oc[list].includes(c.id)) oc[list].push(c.id);
    }
  }
}

export const charById = (s: WorldState, id: string) => s.characters[Number(id.slice(1))];
export const serverById = (s: WorldState, id: string) => s.servers.find((x) => x.id === id)!;
export const netWorth = (s: WorldState) => s.player.cash + s.player.holdings.reduce((a, h) => a + h.value, 0);
