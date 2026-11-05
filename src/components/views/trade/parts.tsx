"use client";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Candle } from "@/lib/market/providers";
import { CHAIN_LABEL } from "@/lib/market/providers";
import { fmtAge, fmtPct, fmtPrice } from "@/lib/wallet/format";

const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

/** generated token icon (no third-party logos): two letters on a gradient seeded by the contract */
export function TokenIcon({ symbol, address, chain, size = 40 }: { symbol: string; address: string; chain?: string; size?: number }) {
  const h = hash(address);
  const a = h % 360, b = (a + 40 + ((h >> 9) % 80)) % 360;
  const letters = symbol.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
  return (
    <span className="relative inline-grid shrink-0 place-items-center rounded-full font-bold text-white" style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(135deg, hsl(${a} 70% 52%), hsl(${b} 65% 32%))` }} aria-hidden>
      {letters}
      {chain && <span className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full border-2 border-[var(--surface)] bg-[var(--surface-3)] font-bold text-[var(--text)]" style={{ width: size * 0.42, height: size * 0.42, fontSize: size * 0.18 }}>{(CHAIN_LABEL[chain] ?? chain)[0]}</span>}
    </span>
  );
}

export function Change({ v, className }: { v: number; className?: string }) {
  return <span className={clsx("num font-semibold", v > 0 ? "text-up" : v < 0 ? "text-down" : "text-muted", className)}>{v > 0 ? "▲ " : v < 0 ? "▼ " : ""}{fmtPct(Math.abs(v)).replace(/^[+−]/, "")}</span>;
}

/** "DEX Screener · updated 12s" — data age is always visible; stale turns amber */
export function Provenance({ source, at, stale, note, now }: { source?: string; at?: number; stale?: boolean; note?: string; now: number }) {
  if (!source || !at) return null;
  const old = stale || now - at > 120_000;
  return <p className={clsx("px-1 text-[12px]", old ? "text-warn" : "text-muted")}>{source} · updated {fmtAge(now - at)} ago{old ? " (stale)" : ""}{note ? ` · ${note}` : ""}</p>;
}

export function RowSkeleton({ n = 6 }: { n?: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex h-16 items-center gap-3 px-1">
          <span className="skeleton size-10 rounded-full" />
          <span className="flex-1 space-y-2"><span className="skeleton block h-3.5 w-24 rounded" /><span className="skeleton block h-3 w-16 rounded" /></span>
          <span className="space-y-2 text-right"><span className="skeleton ml-auto block h-3.5 w-16 rounded" /><span className="skeleton ml-auto block h-3 w-10 rounded" /></span>
        </div>
      ))}
    </div>
  );
}

/**
 * Price chart: a line by default, real candles when asked. Drag a finger across it to read a price.
 * `points` are [t, price]; `candles` come from GeckoTerminal.
 */
export function PriceChart({ points, candles, mode, onScrub, height = 220 }: { points: [number, number][]; candles?: Candle[]; mode: "line" | "candles"; onScrub?: (p?: { t: number; price: number }) => void; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(360);
  const [hover, setHover] = useState<number>();
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 360));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const useCandles = mode === "candles" && (candles?.length ?? 0) > 1;
  const series = useMemo<[number, number][]>(() => (candles && candles.length > 1 && mode === "line" ? candles.map((c) => [c.t, c.c] as [number, number]) : points), [candles, points, mode]);
  const lo = useMemo(() => (useCandles ? Math.min(...candles!.map((c) => c.l)) : Math.min(...series.map((p) => p[1]))), [useCandles, candles, series]);
  const hi = useMemo(() => (useCandles ? Math.max(...candles!.map((c) => c.h)) : Math.max(...series.map((p) => p[1]))), [useCandles, candles, series]);
  const pad = 8, H = height;
  const y = (v: number) => (hi === lo ? H / 2 : pad + (1 - (v - lo) / (hi - lo)) * (H - pad * 2));
  const n = useCandles ? candles!.length : series.length;
  const x = (i: number) => (n <= 1 ? w / 2 : (i / (n - 1)) * (w - 2) + 1);
  const first = useCandles ? candles![0].o : series[0]?.[1] ?? 0;
  const last = useCandles ? candles![n - 1].c : series[n - 1]?.[1] ?? 0;
  const up = last >= first;
  const col = up ? "var(--up)" : "var(--down)";
  const scrub = (clientX: number) => {
    const el = box.current;
    if (!el || n < 2) return;
    const r = el.getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.round(((clientX - r.left) / r.width) * (n - 1))));
    setHover(i);
    onScrub?.(useCandles ? { t: candles![i].t, price: candles![i].c } : { t: series[i][0], price: series[i][1] });
  };
  const end = () => { setHover(undefined); onScrub?.(undefined); };
  if (n < 2) return <div ref={box} style={{ height: H }} className="grid place-items-center text-[13px] text-muted">Collecting live prices…</div>;
  const line = series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(" ");
  const cw = Math.max(1.5, (w / n) * 0.62);
  return (
    <div ref={box} className="relative touch-pan-y select-none" style={{ height: H }}
      onPointerDown={(e) => scrub(e.clientX)} onPointerMove={(e) => { if (e.buttons || e.pointerType === "mouse") scrub(e.clientX); }} onPointerUp={end} onPointerLeave={end} onPointerCancel={end}>
      <svg width={w} height={H} className="block" role="img" aria-label={`Price chart, ${up ? "up" : "down"} ${fmtPct(first ? ((last - first) / first) * 100 : 0)}`}>
        <defs><linearGradient id="pc-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={col} stopOpacity=".22" /><stop offset="1" stopColor={col} stopOpacity="0" /></linearGradient></defs>
        {useCandles
          ? candles!.map((c, i) => {
            const g = c.c >= c.o, cx = x(i);
            return (
              <g key={c.t} stroke={g ? "var(--up)" : "var(--down)"} fill={g ? "var(--up)" : "var(--down)"}>
                <line x1={cx} x2={cx} y1={y(c.h)} y2={y(c.l)} strokeWidth="1" />
                <rect x={cx - cw / 2} width={cw} y={Math.min(y(c.o), y(c.c))} height={Math.max(1, Math.abs(y(c.o) - y(c.c)))} rx="0.5" />
              </g>
            );
          })
          : <>
            <path d={`${line} L${x(n - 1)} ${H} L${x(0)} ${H} Z`} fill="url(#pc-fill)" />
            <path d={line} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </>}
        {hover !== undefined && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="var(--muted)" strokeDasharray="3 3" />}
        {hover !== undefined && !useCandles && <circle cx={x(hover)} cy={y(series[hover][1])} r="4.5" fill={col} stroke="var(--bg)" strokeWidth="2" />}
      </svg>
    </div>
  );
}

export const priceAt = (v: number) => fmtPrice(v);
