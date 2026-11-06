"use client";
/**
 * Live prices for the app. Asks /api/market (shared server cache); without a server (static hosting) it calls
 * the public providers directly. The last good data is kept, with its time, so offline we show dated prices and
 * never invent one.
 */
import { useSyncExternalStore } from "react";
import { dsBoosted, dsNew, dsSearch, dsTokens, gtCandles, gtTrending, tokenKey, type Candle, type MarketReply, type Timeframe, type TokenQuote } from "./providers";

export type Board = "trending" | "new" | "boosted";
export interface Quoted { q: TokenQuote; t: number; source: string }

const quotes = new Map<string, Quoted>();
const boards = new Map<Board, MarketReply<TokenQuote[]>>();
const samples = new Map<string, [number, number][]>(); // live price samples per token (fallback chart)
const candleCache = new Map<string, MarketReply<Candle[]>>();
const errors = new Map<string, string>();
let version = 0;
const subs = new Set<() => void>();
const bump = () => { version++; subs.forEach((f) => f()); };
export function useMarket() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => version, () => 0);
}

/* ------------------------------------------------------------------ persistence of last-good data */
const LS = "lf:market:v1";
let restored = false;
function restore() {
  if (restored || typeof localStorage === "undefined") return;
  restored = true;
  try {
    const j = JSON.parse(localStorage.getItem(LS) ?? "null") as { quotes?: [string, Quoted][]; boards?: [Board, MarketReply<TokenQuote[]>][] } | null;
    for (const [k, v] of j?.quotes ?? []) if (!quotes.has(k)) quotes.set(k, v);
    for (const [k, v] of j?.boards ?? []) if (!boards.has(k)) boards.set(k, { ...v, stale: true });
  } catch { /* corrupt or blocked storage: start empty */ }
}
let saveTimer: ReturnType<typeof setTimeout> | undefined;
function persist() {
  if (saveTimer || typeof localStorage === "undefined") return;
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    try {
      const recent = [...quotes].sort((a, b) => b[1].t - a[1].t).slice(0, 200);
      localStorage.setItem(LS, JSON.stringify({ quotes: recent, boards: [...boards] }));
    } catch { /* full or blocked */ }
  }, 2000);
}

/* ------------------------------------------------------------------ transport: server proxy, else direct */
let direct = false;
async function api<T>(params: Record<string, string>, signal?: AbortSignal, local?: () => Promise<T>, source = "DEX Screener"): Promise<MarketReply<T>> {
  if (!direct) {
    try {
      const r = await fetch(`/api/market?${new URLSearchParams(params)}`, { signal });
      if (r.status === 404 || r.status === 405) direct = true; // static hosting: no server route
      else if (r.ok) return (await r.json()) as MarketReply<T>;
      else throw Object.assign(new Error((await r.json().catch(() => ({ error: `http ${r.status}` }))).error ?? "error"), { status: r.status });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      if (!direct) throw e;
    }
  }
  if (!local) throw new Error("unavailable");
  return { data: await local(), source, fetchedAt: Date.now() };
}

function remember(list: TokenQuote[], t: number, source: string) {
  for (const q of list) {
    const k = tokenKey(q);
    quotes.set(k, { q, t, source });
    const s = samples.get(k) ?? [];
    const p = Number(q.priceUsd);
    if (!s.length || s[s.length - 1][0] < t) { s.push([t, p]); if (s.length > 600) s.splice(0, s.length - 600); samples.set(k, s); }
  }
}

/* ------------------------------------------------------------------ public api */
export const quoteOf = (k: string) => { restore(); return quotes.get(k); };
export const samplesOf = (k: string) => samples.get(k) ?? [];
export const boardOf = (b: Board) => { restore(); return boards.get(b); };
export const errorOf = (k: string) => errors.get(k);
export const QUOTE_MAX_AGE = 60_000; // a fill needs a quote at most this old

export async function loadBoard(b: Board, signal?: AbortSignal) {
  restore();
  try {
    const local = b === "trending" ? () => gtTrending(fetch, signal).catch(() => dsBoosted(fetch, signal)) : b === "new" ? () => dsNew(fetch, signal) : () => dsBoosted(fetch, signal);
    const r = await api<TokenQuote[]>({ op: "board", b }, signal, local, b === "trending" ? "GeckoTerminal trending · DEX Screener prices" : "DEX Screener");
    boards.set(b, r);
    remember(r.data, r.fetchedAt, r.source);
    errors.delete(`board:${b}`);
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    errors.set(`board:${b}`, "Couldn't reach the market right now.");
    const old = boards.get(b);
    if (old) boards.set(b, { ...old, stale: true });
  }
  bump();
  persist();
}

export async function searchTokens(q: string, signal?: AbortSignal): Promise<TokenQuote[]> {
  const r = await api<TokenQuote[]>({ op: "search", q }, signal, () => dsSearch(fetch, q, signal));
  remember(r.data, r.fetchedAt, r.source);
  bump();
  return r.data;
}

/** refresh quotes for these tokens (grouped by chain, 30 per call) */
export async function refreshQuotes(refs: { chain: string; address: string }[], signal?: AbortSignal) {
  restore();
  const byChain = new Map<string, string[]>();
  for (const r of refs) { const l = byChain.get(r.chain) ?? []; if (!l.includes(r.address)) l.push(r.address); byChain.set(r.chain, l); }
  await Promise.all([...byChain].map(async ([chain, addrs]) => {
    for (let i = 0; i < addrs.length; i += 30) {
      const batch = addrs.slice(i, i + 30);
      try {
        const r = await api<TokenQuote[]>({ op: "quote", chain, addrs: batch.join(",") }, signal, () => dsTokens(fetch, chain, batch, signal));
        remember(r.data, r.fetchedAt, r.source);
        for (const a of batch) errors.delete(`${chain}:${a}`);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        for (const a of batch) errors.set(`${chain}:${a}`, "Price unavailable right now.");
      }
    }
  }));
  bump();
  persist();
}

export async function loadCandles(chain: string, pool: string, tf: Timeframe, signal?: AbortSignal): Promise<MarketReply<Candle[]> | undefined> {
  const k = `${chain}:${pool}:${tf}`;
  const hit = candleCache.get(k);
  if (hit && Date.now() - hit.fetchedAt < 120_000) return hit;
  try {
    const r = await api<Candle[]>({ op: "candles", chain, pool, tf }, signal, () => gtCandles(fetch, chain, pool, tf, signal), "GeckoTerminal OHLCV");
    candleCache.set(k, r);
    return r;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return hit ? { ...hit, stale: true } : undefined;
  }
}

/* ------------------------------------------------------------------ polling while the app is visible */
const watched = new Map<string, number>(); // key -> refcount
let pollTimer: ReturnType<typeof setInterval> | undefined;
const POLL = 15_000;
function poll() {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  const refs = [...watched.keys()].map((k) => { const i = k.indexOf(":"); return { chain: k.slice(0, i), address: k.slice(i + 1) }; });
  if (refs.length) void refreshQuotes(refs);
}
/** keep these tokens' prices fresh while mounted; returns the release function */
export function watchTokens(keys: string[]) {
  const fresh = keys.filter((k) => { const q = quotes.get(k); return !q || Date.now() - q.t > POLL; });
  for (const k of keys) watched.set(k, (watched.get(k) ?? 0) + 1);
  if (fresh.length) void refreshQuotes(fresh.map((k) => { const i = k.indexOf(":"); return { chain: k.slice(0, i), address: k.slice(i + 1) }; }));
  if (!pollTimer && typeof window !== "undefined") pollTimer = setInterval(poll, POLL);
  return () => {
    for (const k of keys) { const n = (watched.get(k) ?? 1) - 1; if (n <= 0) watched.delete(k); else watched.set(k, n); }
    if (!watched.size && pollTimer) { clearInterval(pollTimer); pollTimer = undefined; }
  };
}

/** test helper */
export function __resetMarket() { quotes.clear(); boards.clear(); samples.clear(); candleCache.clear(); errors.clear(); direct = false; restored = true; }
export function __seedQuote(q: TokenQuote, t = Date.now()) { remember([q], t, "test"); }
