import type { Character, Message, Obsession, Server, WorldState } from "./types";
import { diurnal } from "./engine";

/** Obsession level is derived from stance + current opinion, so it evolves as opinions move. */
export function obsessionOf(c: Character): Obsession {
  const o = c.opinion;
  if (c.stance === "worshipper" || o >= 72) return "obsessed";
  if (c.stance === "hater" || o <= -60) return "hater";
  if (c.stance === "jealous") return o > 20 ? "supporter" : "rival";
  if (c.stance === "analyst") return o < -30 ? "skeptic" : "business";
  if (c.stance === "skeptic" || c.stance === "conspiracist") return o > 40 ? "supporter" : "skeptic";
  if (c.stance === "indifferent") return o > 45 ? "supporter" : o < -40 ? "skeptic" : "indifferent";
  return o < -25 ? "skeptic" : "supporter"; // fan, memer
}

export const OBSESSION_INFO: Record<Obsession, { label: string; color: string }> = {
  obsessed: { label: "Obsessed fan", color: "#e8b84a" },
  supporter: { label: "Supporter", color: "#facc15" },
  business: { label: "Business admirer", color: "#22d3ee" },
  skeptic: { label: "Skeptic", color: "#a3a3a3" },
  rival: { label: "Jealous rival", color: "#f97316" },
  hater: { label: "Hater", color: "#ef4444" },
  indifferent: { label: "Indifferent", color: "#64748b" },
};

export type Presence = "online" | "idle" | "offline";

/** Presence is backed by real activity: posted recently ⇒ online, awake but quiet ⇒ idle. */
export function presenceOf(c: Character, lastMsgT: number | undefined, now: number): Presence {
  if (lastMsgT !== undefined && now - lastMsgT < 20 * 60e3) return "online";
  const d = diurnal(c, now);
  if (lastMsgT !== undefined && now - lastMsgT < 3 * 3600e3 && d > 0.35) return "idle";
  return d > 0.75 && c.tier !== "lurker" ? "idle" : "offline";
}

export interface Badge { label: string; color: string }
/** Roles/badges shown in the member list and on profiles. */
export function badgesFor(c: Character, srv?: Server): Badge[] {
  const b: Badge[] = [];
  if (srv?.moderators.includes(c.id)) b.push({ label: "Mod", color: "#5eead4" });
  if (c.core) b.push({ label: "Regular", color: "#e8b84a" });
  if ((c.bond ?? 0) >= 25) b.push({ label: "Noticed by god", color: "#fde68a" });
  if (c.influencer) b.push({ label: "Creator", color: "#a78bfa" });
  const ob = obsessionOf(c);
  if (ob === "obsessed") b.push({ label: "Top fan", color: "#e8b84a" });
  if (ob === "hater") b.push({ label: "Hater", color: "#ef4444" });
  if (ob === "rival") b.push({ label: "Rival", color: "#f97316" });
  if (c.netWorthBand >= 4) b.push({ label: "Whale", color: "#38bdf8" });
  return b.slice(0, 3);
}

/** last message time per author across the world (one pass, newest first). */
export function lastSeenMap(s: WorldState, now: number, serverId?: string, scan = 4000): Map<string, number> {
  const out = new Map<string, number>();
  const add = (m: Message) => { if (m.t <= now && (!serverId || m.serverId === serverId) && (out.get(m.authorId) ?? -1) < m.t) out.set(m.authorId, m.t); };
  for (let i = s.pending.length - 1; i >= 0; i--) add(s.pending[i]);
  for (let i = s.messages.length - 1, n = 0; i >= 0 && n < scan; i--, n++) add(s.messages[i]);
  return out;
}
