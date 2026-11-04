"use client";
import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { memeAlt, type MemeSpec } from "@/lib/sim/memes";
import { avatarUri, GOD_AVATAR } from "@/lib/sim/avatar";
import type { PfpStyle } from "@/lib/sim/types";

/** greedy word wrap for SVG text */
function wrap(text: string, max: number, lines = 4): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/)) {
    if (!w) continue;
    if ((cur + " " + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1].replace(/.{0,2}$/, "…"); }
  return out;
}

const IMPACT = "'Arial Black', 'Helvetica Neue', Arial, sans-serif";

function Caption({ text, y, size = 30, max = 20, anchor = "top", fill = "#fff" }: { text: string; y: number; size?: number; max?: number; anchor?: "top" | "bottom"; fill?: string }) {
  const ls = wrap(text.toUpperCase(), max, 3);
  const y0 = anchor === "top" ? y : y - (ls.length - 1) * size * 1.08;
  return (
    <text x={200} y={y0} textAnchor="middle" fontFamily={IMPACT} fontWeight={900} fontSize={size} fill={fill} stroke="#000" strokeWidth={size / 7} paintOrder="stroke" strokeLinejoin="round">
      {ls.map((l, i) => <tspan key={i} x={200} dy={i ? size * 1.08 : 0}>{l}</tspan>)}
    </text>
  );
}

function Plain({ text, x = 20, y, size = 19, max = 34, fill = "#111", weight = 700, lines = 3 }: { text: string; x?: number; y: number; size?: number; max?: number; fill?: string; weight?: number; lines?: number }) {
  return (
    <text x={x} y={y} fontFamily="ui-sans-serif, system-ui, sans-serif" fontWeight={weight} fontSize={size} fill={fill}>
      {wrap(text, max, lines).map((l, i) => <tspan key={i} x={x} dy={i ? size * 1.25 : 0}>{l}</tspan>)}
    </text>
  );
}

/** an illustrated backdrop: gradient sky, sun or spotlight, sparkles; all seeded */
function Scene({ hue, seed, id }: { hue: number; seed: number; id: string }) {
  const r = (k: number) => ((Math.sin(seed * 9301 + k * 49297) + 1) / 2) % 1;
  return (
    <>
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 70% 62%)`} />
          <stop offset="1" stopColor={`hsl(${(hue + 50) % 360} 60% 22%)`} />
        </linearGradient>
        <radialGradient id={`${id}s`}><stop offset="0" stopColor="#fff8" /><stop offset="1" stopColor="#fff0" /></radialGradient>
      </defs>
      <rect width="400" height="400" fill={`url(#${id}g)`} />
      <circle cx={80 + r(1) * 240} cy={120 + r(2) * 60} r={110} fill={`url(#${id}s)`} />
      {Array.from({ length: 9 }, (_, i) => <circle key={i} cx={r(i + 3) * 400} cy={r(i + 13) * 400} r={1.5 + r(i + 23) * 3} fill="#fff" opacity={0.5} />)}
      <path d={`M0 ${330 + r(4) * 20} Q 100 ${300 + r(5) * 30} 200 ${325} T 400 ${320 + r(6) * 20} V400 H0Z`} fill="#0006" />
    </>
  );
}

const Emoji = ({ e, x, y, size }: { e?: string; x: number; y: number; size: number }) => (
  <text x={x} y={y} fontSize={size} textAnchor="middle" dominantBaseline="central">{e}</text>
);

function Svg({ m, id }: { m: MemeSpec; id: string }) {
  switch (m.f) {
    case "caption":
      return (<svg viewBox="0 0 400 400"><Scene hue={m.hue} seed={m.seed} id={id} /><Emoji e={m.art} x={200} y={210} size={150} />{m.top && <Caption text={m.top} y={48} />}{m.bottom && <Caption text={m.bottom} y={378} anchor="bottom" />}</svg>);
    case "reaction":
      return (<svg viewBox="0 0 400 400"><rect width="400" height="110" fill="#fff" /><Plain text={m.top ?? ""} y={38} size={21} max={32} /><g transform="translate(0 110)"><rect width="400" height="290" fill={`hsl(${m.hue} 45% 30%)`} /><circle cx="200" cy="150" r="115" fill={`hsl(${m.hue} 60% 45%)`} opacity=".55" /><Emoji e={m.art} x={200} y={150} size={170} /></g></svg>);
    case "pov":
      return (<svg viewBox="0 0 400 400"><Scene hue={m.hue} seed={m.seed} id={id} /><rect y="0" width="400" height="96" fill="#000a" /><Plain text={m.top ?? ""} y={36} size={20} max={34} fill="#fff" /><Emoji e={m.art} x={200} y={240} size={160} />{m.bottom && <Caption text={m.bottom} y={380} size={24} max={26} anchor="bottom" />}</svg>);
    case "compare":
      return (
        <svg viewBox="0 0 400 400">
          <rect width="400" height="400" fill="#fff" />
          {m.top && <Plain text={m.top} y={30} size={18} max={36} />}
          {[0, 1].map((i) => (
            <g key={i} transform={`translate(${i ? 204 : 6} ${m.top ? 50 : 10})`}>
              <rect width="190" height="250" rx="10" fill={`hsl(${(m.hue + i * 150) % 360} ${i ? 65 : 25}% ${i ? 50 : 70}%)`} />
              <Emoji e={i ? m.art2 : m.art} x={95} y={125} size={110} />
              <Plain text={(i ? m.b : m.a) ?? ""} x={6} y={290} size={16} max={20} lines={4} />
            </g>
          ))}
        </svg>
      );
    case "chart": {
      const pts = m.trend === "spike" ? [10, 12, 9, 14, 11, 13, 95] : m.trend === "crash" ? [90, 86, 92, 88, 30, 12, 8] : m.trend === "down" ? [80, 70, 64, 50, 44, 30, 22] : [12, 20, 26, 40, 52, 70, 92];
      const path = pts.map((v, i) => `${i ? "L" : "M"}${50 + i * 52} ${330 - v * 2.5}`).join(" ");
      const col = m.trend === "crash" || m.trend === "down" ? "#ef4444" : "#22c55e";
      return (
        <svg viewBox="0 0 400 400">
          <rect width="400" height="400" fill="#0f1115" />
          <Plain text={m.top ?? ""} y={38} size={22} max={30} fill="#fff" weight={800} />
          {[0, 1, 2, 3].map((i) => <line key={i} x1="50" x2="370" y1={330 - i * 70} y2={330 - i * 70} stroke="#ffffff1a" />)}
          <path d={`${path} L362 330 L50 330Z`} fill={col} opacity=".15" />
          <path d={path} fill="none" stroke={col} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
          <Emoji e={m.art} x={362} y={330 - pts[6] * 2.5 - 26} size={34} />
          <text x="50" y="360" fill="#9aa" fontSize="15" fontFamily="ui-sans-serif, system-ui">{m.a}</text>
          <text x="370" y="360" fill="#9aa" fontSize="15" textAnchor="end" fontFamily="ui-sans-serif, system-ui">{m.b}</text>
        </svg>
      );
    }
    case "starter":
      return (
        <svg viewBox="0 0 400 400">
          <rect width="400" height="400" fill="#fafafa" />
          <Plain text={m.top ?? ""} y={36} size={21} max={32} weight={900} />
          {(m.arts ?? []).slice(0, 4).map((e, i) => (
            <g key={i} transform={`translate(${20 + (i % 2) * 190} ${80 + Math.floor(i / 2) * 155})`}>
              <rect width="170" height="140" rx="8" fill={`hsl(${(m.hue + i * 70) % 360} 50% 88%)`} />
              <Emoji e={e} x={85} y={70} size={80} />
            </g>
          ))}
        </svg>
      );
    case "leakdoc": {
      const d = m.doc!;
      const MONO = "ui-monospace, 'SFMono-Regular', Menlo, monospace";
      return (
        <svg viewBox="0 0 400 400">
          <rect width="400" height="400" fill="#07090d" />
          {Array.from({ length: 14 }, (_, i) => <rect key={i} x={0} y={i * 29} width="400" height="1" fill="#39ff8812" />)}
          <g transform="rotate(-2.5 200 200)">
            <rect x="34" y="34" width="332" height="318" rx="4" fill="#f4f1e8" />
            <rect x="34" y="34" width="332" height="40" rx="4" fill="#e6e1d3" />
            <text x="48" y="60" fontSize="14" fontWeight="700" fill="#1a1a1a" fontFamily={MONO}>{d.title.length > 36 ? d.title.slice(0, 35) + "…" : d.title}</text>
            {d.lines.slice(0, 8).map((l, i) => {
              const parts = l.split(/(█+)/);
              let x = 48;
              return (
                <g key={i}>
                  {parts.map((p, k) => {
                    const w = p.length * 7.6;
                    const el = /^█+$/.test(p) ? <rect key={k} x={x} y={88 + i * 30} width={w} height="15" fill="#111" /> : <text key={k} x={x} y={100 + i * 30} fontSize="13" fill="#222" fontFamily={MONO} xmlSpace="preserve">{p}</text>;
                    x += w;
                    return el;
                  })}
                </g>
              );
            })}
          </g>
          <g transform="rotate(-14 285 300)">
            <rect x="205" y="278" width="170" height="44" rx="6" fill="none" stroke="#dc2626" strokeWidth="4" opacity=".85" />
            <text x="290" y="309" textAnchor="middle" fontSize="22" fontWeight="900" fill="#dc2626" opacity=".85" fontFamily={IMPACT}>{d.stamp}</text>
          </g>
          <text x="200" y="388" textAnchor="middle" fontSize="12" fill="#39ff88" fontFamily={MONO}>{`>_ ${d.by} :: unverified`}</text>
        </svg>
      );
    }
    case "chirpshot": {
      const s = m.shot!;
      const av = s.gold ? GOD_AVATAR : avatarUri((s.pfp ?? "default") as PfpStyle, s.seed, s.name);
      const body = wrap(s.text, 34, 5);
      return (
        <svg viewBox="0 0 400 400">
          <rect width="400" height="400" fill={`hsl(${m.hue} 30% 20%)`} />
          {m.top && <Caption text={m.top} y={44} size={24} max={24} />}
          <g transform="translate(20 90)">
            <rect width="360" height={110 + body.length * 24} rx="16" fill="#fff" />
            <image href={av} x="16" y="16" width="44" height="44" clipPath="circle(22px at 22px 22px)" />
            <text x="70" y="34" fontSize="16" fontWeight="800" fill="#0b0d12" fontFamily="ui-sans-serif, system-ui">{s.name}{s.gold ? " ✦" : ""}</text>
            <text x="70" y="54" fontSize="14" fill="#666" fontFamily="ui-sans-serif, system-ui">@{s.handle} · chirp</text>
            {body.map((l, i) => <text key={i} x="16" y={90 + i * 24} fontSize="18" fill="#0b0d12" fontFamily="ui-sans-serif, system-ui">{l}</text>)}
            <text x="16" y={90 + body.length * 24 + 10} fontSize="13" fill="#888" fontFamily="ui-sans-serif, system-ui">♥ {s.likes.toLocaleString("en-US")}   ↻ {Math.round(s.likes / 7).toLocaleString("en-US")}</text>
          </g>
        </svg>
      );
    }
  }
}

/** A meme attachment: tap to view it bigger. */
export const MemeImage = memo(function MemeImage({ m, id, className, still }: { m: MemeSpec; id: string; className?: string; still?: boolean }) {
  const [open, setOpen] = useState(false);
  const sid = `mm${id.replace(/[^a-z0-9]/gi, "")}`;
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  // inside a card that opens on tap: just the picture, the card handles the tap
  if (still) return <div data-meme={m.f} role="img" aria-label={memeAlt(m)} className={className}><Svg m={m} id={sid} /></div>;
  return (
    <>
      <button type="button" data-meme={m.f} aria-label={memeAlt(m)} onClick={(e) => { e.stopPropagation(); setOpen(true); }} className={className ?? "mt-1.5 block w-full max-w-[300px] overflow-hidden rounded-lg border border-line bg-black/20 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"}>
        <Svg m={m} id={sid} />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div role="dialog" aria-label="Image" onClick={() => setOpen(false)} className="fixed inset-0 z-[80] grid place-items-center bg-black/85 p-4">
          <div className="w-full max-w-[min(92vw,560px)] overflow-hidden rounded-xl [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"><Svg m={m} id={`${sid}big`} /></div>
        </div>, document.body)}
    </>
  );
});
