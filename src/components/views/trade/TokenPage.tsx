"use client";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, ChevronLeft, LineChart, Share2, Star } from "lucide-react";
import { haptic } from "../../App";
import { doTrade, doWallet, toast } from "../../store";
import { Sheet } from "../../sheet";
import { errorOf, loadCandles, quoteOf, refreshQuotes, samplesOf, useMarket, watchTokens } from "@/lib/market/client";
import { CHAIN_LABEL, TIMEFRAMES, tokenKey, type Candle, type MarketReply, type Timeframe } from "@/lib/market/providers";
import { fmtAge, fmtAmount, fmtCompactUsd, fmtPct, fmtPrice, fmtUsd } from "@/lib/wallet/format";
import { positionValue } from "@/lib/wallet/value";
import { FEE_RATE, previewBuy, previewSell, QUOTE_MAX_AGE } from "@/lib/wallet/trade";
import { D } from "@/lib/wallet/state";
import { shareCard } from "@/lib/wallet/share";
import { Change, PriceChart, TokenIcon } from "./parts";
import type { WorldState } from "@/lib/sim/types";

export function TokenPage({ s, now, chain, address }: { s: WorldState; now: number; chain: string; address: string }) {
  useMarket();
  const key = `${chain}:${address}`;
  const wl = s.wallet!;
  useEffect(() => { void refreshQuotes([{ chain, address }]); return watchTokens([key]); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const qd = quoteOf(key);
  const q = qd?.q;
  const err = errorOf(key);
  const [tf, setTf] = useState<Timeframe>("1D");
  const [mode, setMode] = useState<"line" | "candles">("line");
  const [candles, setCandles] = useState<MarketReply<Candle[]>>();
  const [scrub, setScrub] = useState<{ t: number; price: number }>();
  const [sheet, setSheet] = useState<"buy" | "sell">();
  useEffect(() => {
    if (!q?.pair) return;
    const ctl = new AbortController();
    loadCandles(chain, q.pair, tf, ctl.signal).then((r) => { if (!ctl.signal.aborted) setCandles(r); }).catch(() => {});
    return () => ctl.abort();
  }, [chain, q?.pair, tf]);
  const pos = wl.positions.find((p) => p.account === wl.active && p.chain === chain && p.address === address);
  const pv = pos ? positionValue(pos) : undefined;
  const watched = wl.watch.some((t) => t.chain === chain && t.address === address);
  const samples = samplesOf(key);
  const live = useMemo<[number, number][]>(() => samples.slice(), [samples.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const series = candles?.data.length ? candles.data : undefined;
  const change = q ? (tf === "1H" ? q.change.h1 : tf === "1D" ? q.change.h24 : series && series.length > 1 ? ((series[series.length - 1].c - series[0].o) / series[0].o) * 100 : q.change.h24) : 0;
  const back = () => { haptic(5); if (history.length > 1) history.back(); else location.hash = "/trade"; };
  const age = qd ? now - qd.t : Infinity;

  if (!q) return (
    <div className="flex h-full flex-col bg-bg">
      <Header onBack={back} />
      <div className="grid flex-1 place-items-center p-6 text-center text-[15px] text-muted">{err ? <span>{err} <button className="font-semibold text-accent" onClick={() => void refreshQuotes([{ chain, address }])}>Try again</button></span> : <span className="skeleton block h-40 w-full max-w-sm rounded-2xl" />}</div>
    </div>
  );
  const share = async () => {
    if (!pv) return;
    haptic(10);
    const r = await shareCard({ app: "trade", title: `${q.symbol} position`, big: fmtPct(pv.pnlPct), good: pv.pnl >= 0, sub: `${fmtUsd(pv.pnl, { sign: true })} on ${fmtUsd(pos!.cost)}`, lines: [{ label: "Holding", value: `${fmtAmount(pos!.amount)} ${q.symbol}` }, { label: "Value", value: fmtUsd(pv.value) }, { label: "Price", value: fmtPrice(q.priceUsd) }, { label: "Chain", value: CHAIN_LABEL[chain] ?? chain }], handle: s.player.handle ?? "player", when: new Date(now).toLocaleString([], { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }) }, `${q.symbol}-pnl.png`);
    if (r === "failed") toast("Couldn't make the image.");
  };
  return (
    <div className="flex h-full flex-col bg-bg">
      <Header onBack={back}>
        <button aria-label={watched ? "Remove from watchlist" : "Add to watchlist"} aria-pressed={watched} onClick={() => { haptic(6); doWallet((w) => { const x = w.wallet!; x.watch = watched ? x.watch.filter((t) => !(t.chain === chain && t.address === address)) : [...x.watch, { chain, address, symbol: q.symbol, name: q.name, pair: q.pair }]; }); }} className={clsx("grid size-11 place-items-center rounded-full", watched ? "text-accent" : "text-muted")}><Star className={clsx("size-5", watched && "fill-current")} /></button>
      </Header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[640px] px-4 pb-4">
          <div className="flex items-center gap-3">
            <TokenIcon symbol={q.symbol} address={q.address} chain={q.chain} size={44} />
            <div className="min-w-0"><h1 className="truncate text-[17px] font-bold text-[var(--header)]">{q.name}</h1><div className="text-[13px] text-muted">{q.symbol} · {CHAIN_LABEL[chain] ?? chain}</div></div>
          </div>
          <div className="num mt-3 text-[36px] font-bold leading-none tracking-tight text-[var(--header)]">{fmtPrice(scrub?.price ?? q.priceUsd)}</div>
          <div className="mt-1 flex items-center gap-2 text-[14px]">
            {scrub ? <span className="text-muted">{new Date(scrub.t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span> : <><Change v={change} /><span className="text-muted">{tf}</span></>}
            <span className={clsx("ml-auto text-[12px]", age > QUOTE_MAX_AGE ? "text-warn" : "text-muted")}>{qd?.source ?? "DEX Screener"} · {fmtAge(age)} ago</span>
          </div>
          <div className="-mx-4 mt-3">
            <PriceChart points={live.length > 1 ? live : [[qd!.t - 1, Number(q.priceUsd)], [qd!.t, Number(q.priceUsd)]]} candles={series} mode={mode} onScrub={(p) => { if (p && !scrub) haptic(3); setScrub(p); }} />
          </div>
          <div className="mt-2 flex items-center gap-1">
            {(Object.keys(TIMEFRAMES) as Timeframe[]).map((k) => <button key={k} aria-pressed={tf === k} onClick={() => { haptic(4); setTf(k); }} className={clsx("min-h-[40px] flex-1 rounded-lg text-[14px] font-semibold", tf === k ? "bg-surface-3 text-[var(--header)]" : "text-muted")}>{k}</button>)}
            <button aria-label={mode === "line" ? "Show candles" : "Show line"} onClick={() => setMode(mode === "line" ? "candles" : "line")} className="grid size-11 place-items-center rounded-lg text-muted">{mode === "line" ? <BarChart3 className="size-5" /> : <LineChart className="size-5" />}</button>
          </div>
          {!series && <p className="mt-1 text-[12px] text-muted">{candles === undefined ? "Loading history…" : "History unavailable right now; showing live prices since you opened this."}</p>}
          {series && <p className="mt-1 text-[12px] text-muted">{candles?.source}{candles?.stale ? " · stale" : ""}</p>}

          {pos && pv && (
            <div className="mt-4 rounded-2xl bg-surface p-4">
              <div className="flex items-center"><span className="text-[13px] font-semibold text-muted">Your position</span><button onClick={share} aria-label="Share position" className="ml-auto grid size-11 place-items-center rounded-full bg-[var(--surface-3)]"><Share2 className="size-5" /></button></div>
              <div className="mt-1 grid grid-cols-2 gap-3">
                <div><div className="num text-[22px] font-bold text-[var(--header)]">{fmtUsd(pv.value)}</div><div className="num text-[13px] text-muted">{fmtAmount(pos.amount)} {q.symbol}</div></div>
                <div className="text-right"><div className={clsx("num text-[22px] font-bold", pv.pnl >= 0 ? "text-up" : "text-down")}>{fmtUsd(pv.pnl, { sign: true })}</div><div className="num text-[13px] text-muted">{fmtPct(pv.pnlPct)} · cost {fmtUsd(pos.cost)}</div></div>
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            {[["Market cap", fmtCompactUsd(q.mcap)], ["FDV", fmtCompactUsd(q.fdv)], ["Liquidity", fmtCompactUsd(q.liquidity)], ["Volume 24h", fmtCompactUsd(q.volume24)], ["Buys / sells 24h", `${q.buys24.toLocaleString()} / ${q.sells24.toLocaleString()}`], ["Age", q.createdAt ? fmtAge(now - q.createdAt) : "—"]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-surface px-3 py-2.5"><div className="text-[12px] text-muted">{k}</div><div className="num text-[15px] font-semibold text-fg">{v}</div></div>
            ))}
          </div>
          <p className="mt-3 break-all text-[12px] text-muted">Contract {q.address} · priced from the {q.dex} pool</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2 border-t border-[var(--border)] bg-bg px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        {pos && <button onClick={() => { haptic(8); setSheet("sell"); }} className="min-h-[52px] flex-1 rounded-2xl bg-surface-3 text-[17px] font-bold text-[var(--header)] active:scale-[.98]">Sell</button>}
        <button onClick={() => { haptic(8); setSheet("buy"); }} className="min-h-[52px] flex-1 rounded-2xl bg-accent text-[17px] font-bold text-accent-ink active:scale-[.98]">Buy</button>
      </div>
      {sheet && <TradeSheet s={s} side={sheet} tokenKey={key} now={now} onClose={() => setSheet(undefined)} />}
    </div>
  );
}

function Header({ onBack, children }: { onBack: () => void; children?: React.ReactNode }) {
  return (
    <header className="flex h-[calc(3.25rem+env(safe-area-inset-top))] shrink-0 items-center gap-1 px-1 pt-[env(safe-area-inset-top)]">
      <button aria-label="Back" onClick={onBack} className="grid size-11 place-items-center rounded-full text-[var(--header)]"><ChevronLeft className="size-7" /></button>
      <span className="flex-1" />
      {children}
    </header>
  );
}

function TradeSheet({ s, side, tokenKey: key, now, onClose }: { s: WorldState; side: "buy" | "sell"; tokenKey: string; now: number; onClose: () => void }) {
  const wl = s.wallet!;
  const qd = quoteOf(key)!;
  const q = qd.q;
  const pos = wl.positions.find((p) => p.account === wl.active && tokenKey(p) === key);
  const cash = Number(wl.cash[wl.active] ?? 0);
  const [input, setInput] = useState("");
  const amount = side === "buy" ? input : input; // buy: USD in; sell: token amount
  const pv = input ? (side === "buy" ? previewBuy(wl, q, amount, qd.t, now) : previewSell(wl, q, amount, qd.t, now)) : undefined;
  const presets = side === "buy" ? [["$50", "50"], ["$100", "100"], ["$500", "500"], ["Max", String(Math.floor(cash * 100) / 100)]] : [["25%", "0.25"], ["50%", "0.5"], ["75%", "0.75"], ["All", "1"]];
  const confirm = () => {
    if (!pv?.ok) return;
    const r = doTrade(side, key, amount);
    if (!r) return;
    if ("error" in r) { toast(r.error); return; }
    haptic(16);
    toast(side === "buy" ? `Bought ${fmtAmount(r.amount)} ${q.symbol} for ${fmtUsd(r.usd)}` : `Sold ${fmtAmount(r.amount)} ${q.symbol} for ${fmtUsd(r.usd)}${r.pnl ? ` (${fmtUsd(r.pnl, { sign: true })})` : ""}`, 3500);
    onClose();
  };
  return (
    <Sheet onClose={onClose} label={`${side === "buy" ? "Buy" : "Sell"} ${q.symbol}`} title={`${side === "buy" ? "Buy" : "Sell"} ${q.symbol}`}
      footer={<button onClick={confirm} disabled={!pv?.ok} className={clsx("min-h-[52px] w-full rounded-2xl text-[17px] font-bold active:scale-[.98]", pv?.ok ? (side === "buy" ? "bg-accent text-accent-ink" : "bg-down text-white") : "bg-surface-3 text-muted")}>{pv?.ok ? `${side === "buy" ? "Buy" : "Sell"} at ${fmtPrice(pv.price)}` : pv?.reason ?? (side === "buy" ? "Enter an amount" : "Choose how much to sell")}</button>}>
      <div className="text-center">
        <label className="block">
          <span className="sr-only">{side === "buy" ? "Amount in dollars" : `Amount of ${q.symbol}`}</span>
          <span className="num flex items-baseline justify-center gap-1 text-[44px] font-bold text-[var(--header)]">
            {side === "buy" && <span className="text-muted">$</span>}
            <input inputMode="decimal" autoFocus value={input} onChange={(e) => setInput(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))} placeholder="0" className="w-[6.5ch] bg-transparent text-center outline-none placeholder:text-[var(--surface-3)]" />
          </span>
        </label>
        <div className="text-[13px] text-muted">{side === "buy" ? `${fmtUsd(cash)} cash available` : `${fmtAmount(pos?.amount ?? 0)} ${q.symbol} held`}</div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {presets.map(([label, v]) => <button key={label} onClick={() => { haptic(5); setInput(side === "buy" ? v : pos ? D(pos.amount).mul(v).toDecimalPlaces(8, 1).toString() : ""); }} className="min-h-[44px] rounded-xl bg-[var(--surface-3)] text-[15px] font-semibold text-fg">{label}</button>)}
      </div>
      <dl className="mt-4 space-y-2 rounded-xl bg-[var(--bg)] p-3 text-[14px]">
        <div className="flex justify-between"><dt className="text-muted">{side === "buy" ? "You get about" : "You get about"}</dt><dd className="num font-semibold text-fg">{pv?.ok ? (side === "buy" ? `${fmtAmount(pv.amount)} ${q.symbol}` : fmtUsd(pv.usd)) : "—"}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Price impact</dt><dd className={clsx("num font-semibold", (pv?.impactBps ?? 0) > 300 ? "text-warn" : "text-fg")}>{pv?.ok ? `${(pv.impactBps / 100).toFixed(2)}%` : "—"}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Fee ({Number(FEE_RATE) * 100}%)</dt><dd className="num font-semibold text-fg">{pv?.ok ? fmtUsd(pv.fee) : "—"}</dd></div>
        {side === "sell" && pv?.ok && pv.pnl && <div className="flex justify-between"><dt className="text-muted">Profit / loss</dt><dd className={clsx("num font-semibold", Number(pv.pnl) >= 0 ? "text-up" : "text-down")}>{fmtUsd(pv.pnl, { sign: true })}</dd></div>}
      </dl>
      <p className="mt-2 text-center text-[12px] text-muted">Fills at the live {qd.source ?? "DEX Screener"} price ({fmtAge(now - qd.t)} old).</p>
    </Sheet>
  );
}
