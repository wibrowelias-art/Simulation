"use client";
import clsx from "clsx";
import { BadgeCheck, Shield, Bot } from "lucide-react";
import { avatarUri, playerAvatar } from "@/lib/sim/avatar";
import { STANCE_INFO } from "@/lib/sim/characters";
import type { Character, WorldState } from "@/lib/sim/types";
import { fmtMoney } from "@/lib/sim/format";

const uriCache = new Map<string, string>();
export function avatarFor(c: Pick<Character, "pfp" | "avatarSeed" | "displayName">) {
  const k = `${c.pfp}:${c.avatarSeed}`;
  let u = uriCache.get(k);
  if (!u) { u = avatarUri(c.pfp, c.avatarSeed, c.displayName); uriCache.set(k, u); }
  return u;
}

export interface Who {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  verified?: boolean;
  kind: "god" | "char" | "outlet" | "bot";
  char?: Character;
  color?: string;
}

const BOT_AV = (label: string, color: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${color}"/><text x="32" y="41" font-family="sans-serif" font-size="26" font-weight="700" text-anchor="middle" fill="#fff">${label}</text></svg>`)}`;

export function who(s: WorldState, id: string): Who {
  if (id === "god") return { id, name: s.player.displayName || "You", handle: s.player.handle ?? "god", avatar: playerAvatar(s.player.displayName || "You"), verified: false, kind: "god" };
  if (id.startsWith("o-")) {
    const o = s.outlets.find((x) => x.id === id.slice(2));
    return { id, name: o?.name ?? "News", handle: (o?.short ?? "news").toLowerCase(), avatar: BOT_AV(o?.short.slice(0, 2) ?? "N", o?.color ?? "#444"), verified: true, kind: "outlet", color: o?.color };
  }
  if (id.startsWith("bot-")) {
    const n = id === "bot-tally" ? "Tally" : id === "bot-starboard" ? "Starboard" : "Bot";
    return { id, name: n, handle: n.toLowerCase(), avatar: BOT_AV(n === "Tally" ? "#" : "★", n === "Tally" ? "#5865f2" : "#c9961a"), kind: "bot" };
  }
  const c = s.characters[Number(id.slice(1))];
  if (!c) return { id, name: "deleted user", handle: "deleted", avatar: BOT_AV("?", "#333"), kind: "char" };
  return { id, name: c.displayName, handle: c.username, avatar: avatarFor(c), verified: c.verified, kind: "char", char: c };
}

export function Avatar({ src, size = 36, ring, className }: { src: string; size?: number; ring?: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className={clsx("shrink-0 rounded-full bg-surface-2 object-cover", className)} style={{ width: size, height: size, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined }} />
  );
}

export function Verified({ gold }: { gold?: boolean }) {
  return <BadgeCheck className={clsx("inline size-[15px] shrink-0", gold ? "text-gold" : "text-brand")} aria-label="verified" />;
}

export function NameLine({ w, nick, className }: { w: Who; nick?: string; className?: string }) {
  return (
    <span className={clsx("inline-flex min-w-0 items-center gap-1", className)}>
      <span className={clsx("truncate font-semibold", w.kind === "god" && "text-gold")}>{nick ?? w.name}</span>
      {w.verified && <Verified gold={w.kind === "god"} />}
      {w.kind === "bot" && <span className="rounded bg-brand px-1 text-[10px] font-bold leading-4 text-white"><Bot className="inline size-3" /> APP</span>}
      {w.char?.isMod && <Shield className="size-3.5 text-up" aria-label="moderator" />}
    </span>
  );
}

export function StanceChip({ c }: { c: Character }) {
  const i = STANCE_INFO[c.stance];
  return <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: i.color + "22", color: i.color }}>{i.label}</span>;
}

export function Money({ v, sign, className }: { v: number; sign?: boolean; className?: string }) {
  return <span className={clsx("num", sign && (v >= 0 ? "text-up" : "text-down"), className)}>{fmtMoney(v, { sign })}</span>;
}

export function Spark({ data, w = 120, h = 32, color = "var(--gold)" }: { data: number[]; w?: number; h?: number; color?: string }) {
  if (data.length < 2) return <svg width={w} height={h} />;
  const mn = Math.min(...data), mx = Math.max(...data), r = mx - mn || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - mn) / r) * (h - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function Section({ title, right, children, className }: { title: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("panel p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

/** Text with @mentions, #tags and $TICKERS highlighted. */
/** the player's handle: the engine mentions the player as "@god" internally; everything visible shows the handle */
let playerHandle = "god";
export const setPlayerHandle = (h: string) => { playerHandle = h || "god"; };
export const showHandle = (text: string) => {
  if (!text || playerHandle === "god") return text;
  return text
    .replace(/@god\b/gi, `@${playerHandle}`)
    // the engine's lines call the player "god"; on screen they use the player's handle
    .replace(/(^|[^@\w])(GOD|God|god)\b/g, (_m, pre: string, w: string) => pre + (w === "GOD" ? playerHandle.toUpperCase() : playerHandle));
};

export function RichText({ text: raw, onTag, onUser }: { text: string; onTag?: (t: string) => void; onUser?: (h: string) => void }) {
  const text = showHandle(raw);
  const parts = text.split(/(@[\w.]+|#[\w]+|\$[A-Z0-9]{2,})/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 0 ? p : p.startsWith("@") ? (
          <button key={i} onClick={(e) => { e.stopPropagation(); onUser?.(p.slice(1)); }} className={clsx("rounded px-0.5 font-medium", p.toLowerCase() === `@${playerHandle}`.toLowerCase() ? "bg-accent/15 text-accent" : "bg-brand/15 text-brand")}>{p}</button>
        ) : (
          <button key={i} onClick={(e) => { e.stopPropagation(); onTag?.(p.replace(/^[#$]/, "")); }} className="text-brand hover:underline">{p}</button>
        ),
      )}
    </>
  );
}

export const go = (hash: string) => { if (typeof location !== "undefined") location.hash = hash; };
