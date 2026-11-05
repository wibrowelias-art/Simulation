"use client";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { Compass, PieChart, Search as SearchIcon, Share2, X } from "lucide-react";
import type { Route } from "../../App";
import { haptic } from "../../App";
import { toast, useApp } from "../../store";
import { go } from "../../ui";
import { boardOf, errorOf, loadBoard, searchTokens, useMarket, watchTokens, type Board } from "@/lib/market/client";
import { CHAIN_LABEL, tokenKey, type TokenQuote } from "@/lib/market/providers";
import { fmtCompactUsd, fmtPct, fmtPrice, fmtUsd, fmtAmount } from "@/lib/wallet/format";
import { walletValue } from "@/lib/wallet/value";
import { realised } from "@/lib/wallet/trade";
import { shareCard } from "@/lib/wallet/share";
import { Change, Provenance, RowSkeleton, TokenIcon } from "./parts";
import { TokenPage } from "./TokenPage";
import type { WorldState } from "@/lib/sim/types";

type Tab = "discover" | "search" | "portfolio";

/** Kiteline: paper trading on real prices. */
export function Trade({ route }: { route: Route }) {
  const { world: w, now } = useApp();
  useMarket();
  const s = w!;
  if (route.parts[0] === "t" && route.parts[1] && route.parts[2]) return <TokenPage s={s} now={now} chain={route.parts[1]} address={route.parts[2]} />;
  const tab: Tab = route.parts[0] === "search" ? "search" : route.parts[0] === "portfolio" ? "portfolio" : "discover";
  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "discover" ? <Discover now={now} /> : tab === "search" ? <SearchTab /> : <Portfolio s={s} now={now} />}
      </div>
      <nav aria-label="Kiteline tabs" className="flex shrink-0 border-t border-[var(--border)] bg-bg">
        {([["discover", "Discover", Compass, "/trade"], ["search", "Search", SearchIcon, "/trade/search"], ["portfolio", "Portfolio", PieChart, "/trade/portfolio"]] as const).map(([id, label, I, href]) => (
          <button key={id} aria-current={tab === id ? "page" : undefined} onClick={() => { haptic(6); go(href); }} className={clsx("relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", tab === id ? "text-[var(--header)]" : "text-muted")}>
            <I className="size-6" />{label}
            {tab === id && <span className="absolute top-1 size-1 rounded-full bg-accent" />}
          </button>
        ))}
      </nav>
    </div>
  );
}

export function TokenRow({ q, onOpen, right }: { q: TokenQuote; onOpen: () => void; right?: React.ReactNode }) {
  return (
    <button onClick={onOpen} className="flex min-h-[64px] w-full items-center gap-3 rounded-xl px-1 text-left active:bg-surface md:hover:bg-surface">
      <TokenIcon symbol={q.symbol} address={q.address} chain={q.chain} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold text-[var(--header)]">{q.symbol}</span>
        <span className="block truncate text-[13px] text-muted">{q.name} · {fmtCompactUsd(q.mcap)} mcap</span>
      </span>
      {right ?? (
        <span className="text-right">
          <span className="num block text-[15px] font-semibold text-[var(--header)]">{fmtPrice(q.priceUsd)}</span>
          <Change v={q.change.h24} className="text-[13px]" />
        </span>
      )}
    </button>
  );
}

const open = (q: { chain: string; address: string }) => { haptic(5); go(`/trade/t/${q.chain}/${q.address}`); };

function Discover({ now }: { now: number }) {
  const [board, setBoard] = useState<Board | "gainers">("trending");
  const src: Board = board === "gainers" ? "trending" : board;
  useEffect(() => {
    const ctl = new AbortController();
    const b = boardOf(src);
    if (!b || now - b.fetchedAt > 60_000) void loadBoard(src, ctl.signal);
    const t = setInterval(() => void loadBoard(src), 60_000);
    return () => { ctl.abort(); clearInterval(t); };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = boardOf(src);
  let rows = b?.data ?? [];
  if (board === "gainers") rows = [...rows, ...(boardOf("new")?.data ?? [])].filter((x, i, a) => a.findIndex((y) => tokenKey(y) === tokenKey(x)) === i).sort((x, y) => y.change.h24 - x.change.h24);
  const err = errorOf(`board:${src}`);
  return (
    <div className="mx-auto max-w-[640px] px-4 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <h1 className="py-2 text-[28px] font-extrabold text-[var(--header)]">Discover</h1>
      <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4" data-scroll-x>
        {([["trending", "Trending"], ["gainers", "Gainers"], ["new", "New"]] as const).map(([id, label]) => (
          <button key={id} aria-pressed={board === id} onClick={() => { haptic(5); setBoard(id); if (id === "gainers") void loadBoard("new"); }} className={clsx("min-h-[44px] shrink-0 rounded-full px-4 text-[15px] font-semibold", board === id ? "bg-accent text-accent-ink" : "bg-surface text-fg")}>{label}</button>
        ))}
      </div>
      <Provenance source={b?.source} at={b?.fetchedAt} stale={b?.stale} note={b?.note} now={now} />
      {!b && !err && <RowSkeleton />}
      {err && !b && <p className="px-1 py-8 text-center text-[15px] text-muted">{err} <button className="font-semibold text-accent" onClick={() => void loadBoard(src)}>Try again</button></p>}
      <div className="mt-1">{rows.slice(0, 40).map((q) => <TokenRow key={tokenKey(q)} q={q} onOpen={() => open(q)} />)}</div>
    </div>
  );
}

function SearchTab() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<TokenQuote[]>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const ctl = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) return;
    const timer = setTimeout(() => {
      ctl.current?.abort(); // a newer query supersedes the old one
      const c = (ctl.current = new AbortController());
      setBusy(true);
      searchTokens(t, c.signal).then((r) => { setRes(r); setErr(undefined); }).catch((e) => { if (e.name !== "AbortError") setErr("Search is unavailable right now."); }).finally(() => { if (!c.signal.aborted) setBusy(false); });
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);
  const active = q.trim().length >= 2;
  const shown = active ? res : undefined;
  return (
    <div className="mx-auto max-w-[640px] px-4 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <label className="mt-1 flex items-center gap-2 rounded-xl bg-surface px-3">
        <SearchIcon className="size-5 shrink-0 text-muted" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, ticker or contract" aria-label="Search tokens" className="min-h-[48px] min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-muted" />
        {q && <button aria-label="Clear" onClick={() => setQ("")} className="grid size-11 place-items-center text-muted"><X className="size-5" /></button>}
      </label>
      {active && busy && !shown && <RowSkeleton n={4} />}
      {active && err && <p className="py-8 text-center text-[15px] text-muted">{err}</p>}
      {shown && !shown.length && <p className="py-8 text-center text-[15px] text-muted">No tokens with real liquidity match “{q}”.</p>}
      {!q && <p className="px-1 pt-6 text-[15px] text-muted">Search any token by name, ticker or contract address. Identity is always chain + contract, so look-alike tickers show separately.</p>}
      <div className="mt-2">{(shown ?? []).map((t) => <TokenRow key={tokenKey(t)} q={t} onOpen={() => open(t)} right={<span className="text-right"><span className="num block text-[15px] font-semibold text-[var(--header)]">{fmtPrice(t.priceUsd)}</span><span className="text-[12px] text-muted">{CHAIN_LABEL[t.chain] ?? t.chain}</span></span>} />)}</div>
    </div>
  );
}

function Portfolio({ s, now }: { s: WorldState; now: number }) {
  const wl = s.wallet!;
  const keys = useMemo(() => wl.positions.map((p) => tokenKey(p)), [wl.positions]);
  useEffect(() => watchTokens(keys), [keys.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = walletValue(s, now, wl.active);
  const weekAgo = now - 7 * 86400e3;
  const week = wl.fills.filter((f) => f.t >= weekAgo && f.account === wl.active);
  const sells = week.filter((f) => f.side === "sell");
  const wins = sells.filter((f) => Number(f.pnl) > 0).length;
  const best = [...sells].sort((a, b) => Number(b.pnl) - Number(a.pnl))[0];
  const real = Number(realised(wl, weekAgo));
  const shareWeek = async () => {
    haptic(10);
    const r = await shareCard({ app: "trade", title: "My week on Kiteline", big: fmtUsd(real, { sign: true }), good: real >= 0, sub: `${sells.length} closed · ${sells.length ? Math.round((wins / sells.length) * 100) : 0}% wins`, lines: [{ label: "Trades", value: String(week.length) }, { label: "Best trade", value: best ? `${best.symbol} ${fmtUsd(best.pnl ?? 0, { sign: true })}` : "—" }, { label: "Open positions", value: String(v.items.length) }], handle: s.player.handle ?? "player", when: new Date(now).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }) }, "kiteline-week.png");
    if (r === "failed") toast("Couldn't make the image.");
  };
  return (
    <div className="mx-auto max-w-[640px] px-4 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <h1 className="py-2 text-[28px] font-extrabold text-[var(--header)]">Portfolio</h1>
      <div className="rounded-2xl bg-surface p-4">
        <div className="text-[13px] font-semibold text-muted">{wl.accounts.find((a) => a.id === wl.active)?.name} account</div>
        <div className="num mt-1 text-[36px] font-bold leading-none text-[var(--header)]">{fmtUsd(v.total)}</div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
          <div><div className="text-muted">Cash</div><div className="num font-semibold text-fg">{fmtUsd(v.cash)}</div></div>
          <div><div className="text-muted">Unrealised</div><div className={clsx("num font-semibold", v.unrealised >= 0 ? "text-up" : "text-down")}>{fmtUsd(v.unrealised, { sign: true })}</div></div>
          <div><div className="text-muted">Realised (7d)</div><div className={clsx("num font-semibold", real >= 0 ? "text-up" : "text-down")}>{fmtUsd(real, { sign: true })}</div></div>
        </div>
      </div>
      <h2 className="mb-1 mt-5 text-[13px] font-bold uppercase text-muted">Positions</h2>
      {!v.items.length && <p className="rounded-2xl bg-surface p-4 text-[15px] text-muted">No open positions. Find something in <button className="font-semibold text-accent" onClick={() => go("/trade")}>Discover</button>.</p>}
      {v.items.map(({ p, value, pnl, pnlPct, price }) => (
        <button key={tokenKey(p)} onClick={() => open(p)} className="flex min-h-[64px] w-full items-center gap-3 rounded-xl px-1 text-left active:bg-surface md:hover:bg-surface">
          <TokenIcon symbol={p.symbol} address={p.address} chain={p.chain} />
          <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-semibold text-[var(--header)]">{p.symbol}</span><span className="num block truncate text-[13px] text-muted">{fmtAmount(p.amount)} · {price !== undefined ? fmtPrice(price) : "price unavailable"}</span></span>
          <span className="text-right"><span className="num block text-[15px] font-semibold text-[var(--header)]">{fmtUsd(value)}</span><span className={clsx("num text-[13px] font-semibold", pnl >= 0 ? "text-up" : "text-down")}>{fmtUsd(pnl, { sign: true })} ({fmtPct(pnlPct)})</span></span>
        </button>
      ))}
      <div className="mt-5 rounded-2xl bg-surface p-4">
        <div className="flex items-center"><h2 className="text-[17px] font-bold text-[var(--header)]">This week</h2><button onClick={shareWeek} aria-label="Share your week" className="ml-auto grid size-11 place-items-center rounded-full bg-[var(--surface-3)] text-fg"><Share2 className="size-5" /></button></div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[13px]">
          <div><div className="text-muted">Trades</div><div className="num text-[17px] font-semibold text-fg">{week.length}</div></div>
          <div><div className="text-muted">Win rate</div><div className="num text-[17px] font-semibold text-fg">{sells.length ? `${Math.round((wins / sells.length) * 100)}%` : "—"}</div></div>
          <div><div className="text-muted">Best</div><div className="num truncate text-[17px] font-semibold text-fg">{best ? best.symbol : "—"}</div></div>
        </div>
      </div>
      <h2 className="mb-1 mt-5 text-[13px] font-bold uppercase text-muted">Activity</h2>
      {[...wl.fills].reverse().slice(0, 40).map((f) => (
        <button key={f.id} onClick={() => open(f)} className="flex min-h-[56px] w-full items-center gap-3 rounded-xl px-1 text-left active:bg-surface">
          <span className={clsx("grid size-9 place-items-center rounded-full text-[13px] font-bold", f.side === "buy" ? "bg-up/15 text-up" : "bg-down/15 text-down")}>{f.side === "buy" ? "B" : "S"}</span>
          <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-fg">{f.side === "buy" ? "Bought" : "Sold"} {f.symbol}</span><span className="block text-[12px] text-muted">{new Date(f.t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · {fmtAmount(f.amount)} @ {fmtPrice(f.price)}</span></span>
          <span className="text-right"><span className="num block text-[15px] font-semibold text-fg">{fmtUsd(f.usd)}</span>{f.pnl && <span className={clsx("num text-[12px] font-semibold", Number(f.pnl) >= 0 ? "text-up" : "text-down")}>{fmtUsd(f.pnl, { sign: true })}</span>}</span>
        </button>
      ))}
      {!wl.fills.length && <p className="px-1 text-[15px] text-muted">Your trades will show up here.</p>}
    </div>
  );
}
