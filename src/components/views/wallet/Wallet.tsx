"use client";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Check, ChevronDown, Copy, History, Plus, Wallet as WalletIcon } from "lucide-react";
import type { Route } from "../../App";
import { haptic } from "../../App";
import { doWallet, toast, useApp } from "../../store";
import { Avatar, go, who } from "../../ui";
import { Sheet } from "../../sheet";
import { quoteOf, useMarket, watchTokens } from "@/lib/market/client";
import { tokenKey } from "@/lib/market/providers";
import { fmtAmount, fmtPct, fmtUsd, fmtPrice } from "@/lib/wallet/format";
import { walletValue, sampleValue } from "@/lib/wallet/value";
import { D } from "@/lib/wallet/state";
import { sendTransfer, contactsFor, walletAddress } from "@/lib/wallet/transfers";
import { Change, PriceChart, TokenIcon } from "../trade/parts";
import type { TradeFill, Transfer, WorldState } from "@/lib/sim/types";

type Tab = "home" | "activity";
const RANGES = { "1D": 86400e3, "1W": 7 * 86400e3, "1M": 30 * 86400e3, All: Infinity } as const;
type Range = keyof typeof RANGES;

/** Lanternfish: the wallet. Balances are virtual; prices are the same live quotes Kiteline uses. */
export function Wallet({ route }: { route: Route }) {
  const { world: w, now } = useApp();
  useMarket();
  const s = w!;
  const tab: Tab = route.parts[0] === "activity" ? "activity" : "home";
  const keys = useMemo(() => s.wallet!.positions.map((p) => tokenKey(p)), [s.wallet!.positions]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => watchTokens(keys), [keys.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { doWallet((x, t) => sampleValue(x, t)); }, [now - (now % 300_000)]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="min-h-0 flex-1 overflow-y-auto">{tab === "home" ? <WalletHome s={s} now={now} /> : <Activity s={s} now={now} />}</div>
      <nav aria-label="Lanternfish tabs" className="flex shrink-0 border-t border-[var(--border)] bg-bg">
        {([["home", "Wallet", WalletIcon, "/wallet"], ["activity", "Activity", History, "/wallet/activity"]] as const).map(([id, label, I, href]) => (
          <button key={id} aria-current={tab === id ? "page" : undefined} onClick={() => { haptic(6); go(href); }} className={clsx("relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", tab === id ? "text-[var(--header)]" : "text-muted")}>
            <I className="size-6" />{label}
            {tab === id && <span className="absolute top-1 size-1 rounded-full bg-accent" />}
          </button>
        ))}
      </nav>
    </div>
  );
}

function WalletHome({ s, now }: { s: WorldState; now: number }) {
  const wl = s.wallet!;
  const [range, setRange] = useState<Range>("1W");
  const [sheet, setSheet] = useState<"send" | "receive" | "accounts">();
  const [scrub, setScrub] = useState<{ t: number; price: number }>();
  const v = walletValue(s, now, wl.active);
  const acct = wl.accounts.find((a) => a.id === wl.active)!;
  const totalCents = Math.round(v.total * 100), minute = Math.floor(now / 60_000);
  const pts = useMemo<[number, number][]>(() => {
    const all: [number, number][] = [...wl.history.map((h) => [h[0], h[1]] as [number, number]), [now, v.total]];
    const from = now - RANGES[range];
    const inRange = all.filter((p) => p[0] >= from);
    return inRange.length > 1 ? inRange : all.slice(-2);
  }, [wl.history.length, range, totalCents, minute]); // eslint-disable-line react-hooks/exhaustive-deps
  const first = pts[0]?.[1] ?? v.total;
  const delta = v.total - first;
  const multi = wl.accounts.length > 1;
  return (
    <div className="mx-auto max-w-[640px] px-4 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <header className="flex items-center py-1">
        <button onClick={() => setSheet("accounts")} className="flex min-h-[44px] items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3">
          <span className="grid size-8 place-items-center rounded-full text-[14px] font-bold text-accent-ink" style={{ background: `hsl(${acct.hue} 85% 60%)` }}>{acct.name[0]}</span>
          <span className="text-[15px] font-semibold text-[var(--header)]">{acct.name}</span>
          <ChevronDown className="size-4 text-muted" />
        </button>
      </header>
      <div className="mt-4 text-center">
        <div className="num text-[44px] font-bold leading-none tracking-tight text-[var(--header)]">{fmtUsd(scrub?.price ?? v.total)}</div>
        <div className={clsx("num mt-2 text-[15px] font-semibold", scrub ? "text-muted" : delta >= 0 ? "text-up" : "text-down")}>
          {scrub ? new Date(scrub.t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : `${fmtUsd(delta, { sign: true })} (${fmtPct(first ? (delta / first) * 100 : 0)}) ${range === "All" ? "all time" : `past ${range === "1D" ? "day" : range === "1W" ? "week" : "month"}`}`}
        </div>
      </div>
      <div className="-mx-4 mt-3"><PriceChart points={pts} mode="line" height={160} onScrub={setScrub} /></div>
      <div className="mt-1 flex gap-1">{(Object.keys(RANGES) as Range[]).map((r) => <button key={r} aria-pressed={range === r} onClick={() => { haptic(4); setRange(r); }} className={clsx("min-h-[40px] flex-1 rounded-lg text-[14px] font-semibold", range === r ? "bg-surface-3 text-[var(--header)]" : "text-muted")}>{r}</button>)}</div>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {([["Send", ArrowUpRight, () => setSheet("send")], ["Receive", ArrowDownLeft, () => setSheet("receive")], ["Swap", ArrowLeftRight, () => go("/trade/portfolio")], ["Buy", Plus, () => go("/trade/search")]] as const).map(([label, I, fn]) => (
          <button key={label} onClick={() => { haptic(6); fn(); }} className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface text-[13px] font-semibold text-fg active:scale-95">
            <span className="grid size-9 place-items-center rounded-full bg-accent text-accent-ink"><I className="size-5" /></span>{label}
          </button>
        ))}
      </div>

      <h2 className="mb-1 mt-6 text-[13px] font-bold uppercase text-muted">Tokens</h2>
      <div className="flex min-h-[64px] items-center gap-3 px-1">
        <span className="grid size-10 place-items-center rounded-full bg-[#2775ca] text-[15px] font-bold text-white" aria-hidden>$</span>
        <span className="min-w-0 flex-1"><span className="block text-[16px] font-semibold text-[var(--header)]">Cash</span><span className="block text-[13px] text-muted">Virtual dollars</span></span>
        <span className="num text-[15px] font-semibold text-[var(--header)]">{fmtUsd(v.cash)}</span>
      </div>
      {v.items.map(({ p, value, price }) => (
        <button key={tokenKey(p)} onClick={() => go(`/trade/t/${p.chain}/${p.address}`)} className="flex min-h-[64px] w-full items-center gap-3 rounded-xl px-1 text-left active:bg-surface">
          <TokenIcon symbol={p.symbol} address={p.address} chain={p.chain} />
          <span className="min-w-0 flex-1"><span className="block truncate text-[16px] font-semibold text-[var(--header)]">{p.name}</span><span className="num block truncate text-[13px] text-muted">{fmtAmount(p.amount)} {p.symbol}</span></span>
          <span className="text-right"><span className="num block text-[15px] font-semibold text-[var(--header)]">{fmtUsd(value)}</span>{price !== undefined ? <TokenChange chain={p.chain} address={p.address} /> : <span className="text-[12px] text-warn">price unavailable</span>}</span>
        </button>
      ))}
      {!v.items.length && <p className="px-1 py-3 text-[15px] text-muted">Your tokens show up here after you buy something in <button className="font-semibold text-accent" onClick={() => go("/trade")}>Kiteline</button>.</p>}
      {multi && <p className="mt-4 px-1 text-[13px] text-muted">Showing the {acct.name} account. Total across accounts: <span className="num font-semibold text-fg">{fmtUsd(walletValue(s, now).total)}</span></p>}

      {sheet === "send" && <SendSheet s={s} onClose={() => setSheet(undefined)} />}
      {sheet === "receive" && <ReceiveSheet s={s} onClose={() => setSheet(undefined)} />}
      {sheet === "accounts" && <AccountsSheet s={s} now={now} onClose={() => setSheet(undefined)} />}
    </div>
  );
}

/** the token's own 24h change (not your position's) */
function TokenChange({ chain, address }: { chain: string; address: string }) {
  const q = quoteOf(tokenKey({ chain, address }));
  return q ? <Change v={q.q.change.h24} className="text-[13px]" /> : null;
}

/* ------------------------------------------------------------------ send / receive / accounts */

function SendSheet({ s, onClose }: { s: WorldState; onClose: () => void }) {
  const wl = s.wallet!;
  const contacts = useMemo(() => contactsFor(s), [s]);
  const [to, setTo] = useState<string>();
  const [asset, setAsset] = useState<string>("cash"); // "cash" or a token key
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const pos = asset === "cash" ? undefined : wl.positions.find((p) => p.account === wl.active && tokenKey(p) === asset);
  const max = asset === "cash" ? D(wl.cash[wl.active] ?? 0) : D(pos?.amount ?? 0);
  const amt = D(amount || 0);
  const err = !to ? "Choose who to send to" : !amount ? "Enter an amount" : !amt.isFinite() || amt.lte(0) ? "Enter an amount" : amt.gt(max) ? "Not enough in this account" : undefined;
  const send = () => {
    if (err || !to) return;
    let r: ReturnType<typeof sendTransfer> | undefined;
    doWallet((x, now) => { r = sendTransfer(x, { to, asset, amount, memo: memo.trim() || undefined }, now); });
    if (!r || "error" in r) { toast(r && "error" in r ? r.error : "Couldn't send."); return; }
    haptic(16);
    toast(`Sent ${asset === "cash" ? fmtUsd(amount) : `${fmtAmount(amount)} ${pos?.symbol}`} to ${to.startsWith("acct:") ? wl.accounts.find((a) => `acct:${a.id}` === to)?.name : `@${who(s, to).handle}`}`);
    onClose();
  };
  return (
    <Sheet onClose={onClose} label="Send" title="Send" footer={<button onClick={send} disabled={!!err} className={clsx("min-h-[52px] w-full rounded-2xl text-[17px] font-bold", err ? "bg-surface-3 text-muted" : "bg-accent text-accent-ink")}>{err ?? "Send"}</button>}>
      <h3 className="mb-1 text-[13px] font-bold uppercase text-muted">To</h3>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2" data-scroll-x>
        {wl.accounts.filter((a) => a.id !== wl.active).map((a) => (
          <button key={a.id} aria-pressed={to === `acct:${a.id}`} onClick={() => setTo(`acct:${a.id}`)} className="flex w-16 shrink-0 flex-col items-center gap-1">
            <span className={clsx("grid size-12 place-items-center rounded-full text-[17px] font-bold text-accent-ink", to === `acct:${a.id}` && "ring-2 ring-accent ring-offset-2 ring-offset-[var(--surface)]")} style={{ background: `hsl(${a.hue} 85% 60%)` }}>{a.name[0]}</span>
            <span className="w-full truncate text-center text-[12px] text-fg">{a.name}</span>
          </button>
        ))}
        {contacts.map((c) => (
          <button key={c.id} aria-pressed={to === c.id} aria-label={`Send to ${c.displayName}`} onClick={() => setTo(c.id)} className="flex w-16 shrink-0 flex-col items-center gap-1">
            <span className={clsx("rounded-full", to === c.id && "ring-2 ring-accent ring-offset-2 ring-offset-[var(--surface)]")}><Avatar src={who(s, c.id).avatar} size={48} /></span>
            <span className="w-full truncate text-center text-[12px] text-fg">{c.displayName.split(" ")[0]}</span>
          </button>
        ))}
      </div>
      <h3 className="mb-1 mt-2 text-[13px] font-bold uppercase text-muted">Asset</h3>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" data-scroll-x>
        {[{ k: "cash", label: "Cash" }, ...wl.positions.filter((p) => p.account === wl.active).map((p) => ({ k: tokenKey(p), label: p.symbol }))].map((a) => (
          <button key={a.k} aria-pressed={asset === a.k} onClick={() => { setAsset(a.k); setAmount(""); }} className={clsx("min-h-[44px] shrink-0 rounded-full px-4 text-[15px] font-semibold", asset === a.k ? "bg-accent text-accent-ink" : "bg-[var(--surface-3)] text-fg")}>{a.label}</button>
        ))}
      </div>
      <label className="mt-3 block">
        <span className="text-[13px] font-bold uppercase text-muted">Amount</span>
        <span className="mt-1 flex items-center gap-2 rounded-xl bg-[var(--bg)] px-3">
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))} placeholder="0" className="num min-h-[52px] min-w-0 flex-1 bg-transparent text-[22px] font-bold text-fg outline-none" />
          <button onClick={() => setAmount(asset === "cash" ? max.toFixed(2) : max.toString())} className="min-h-[36px] rounded-full bg-[var(--surface-3)] px-3 text-[13px] font-semibold text-fg">Max</button>
        </span>
        <span className="mt-1 block text-[12px] text-muted">{asset === "cash" ? `${fmtUsd(max.toNumber())} available` : `${fmtAmount(max.toString())} ${pos?.symbol} available`}</span>
      </label>
      <label className="mt-3 block"><span className="text-[13px] font-bold uppercase text-muted">Note (optional)</span><input value={memo} onChange={(e) => setMemo(e.target.value.slice(0, 80))} placeholder="for the pizza" className="mt-1 min-h-[48px] w-full rounded-xl bg-[var(--bg)] px-3 text-[16px] text-fg outline-none placeholder:text-muted" /></label>
    </Sheet>
  );
}

function ReceiveSheet({ s, onClose }: { s: WorldState; onClose: () => void }) {
  const addr = walletAddress(s);
  const [copied, setCopied] = useState(false);
  const cells = useMemo(() => { const out: boolean[] = []; let h = 0; for (const ch of addr) h = (h * 31 + ch.charCodeAt(0)) >>> 0; for (let i = 0; i < 21 * 21; i++) { h = (h * 1103515245 + 12345) >>> 0; out.push((h >> 16) % 2 === 0); } return out; }, [addr]);
  return (
    <Sheet onClose={onClose} label="Receive" title="Receive">
      <div className="mx-auto mt-2 grid w-[220px] grid-cols-[repeat(21,1fr)] gap-0 rounded-2xl bg-white p-3" aria-hidden>
        {cells.map((on, i) => { const r = Math.floor(i / 21), c = i % 21; const finder = (r < 7 && c < 7) || (r < 7 && c > 13) || (r > 13 && c < 7); const fon = finder && (r % 6 === 0 || c % 6 === 0 || (r % 14 > 1 && r % 14 < 5 && c % 14 > 1 && c % 14 < 5) || (r > 13 && (r === 14 || r === 20 || (r > 15 && r < 19 && c > 1 && c < 5))) || c === 20 || c === 14); return <span key={i} className="aspect-square" style={{ background: (finder ? fon : on) ? "#0b0c0e" : "transparent" }} />; })}
      </div>
      <p className="mt-3 text-center text-[13px] text-muted">Your Lanternfish address</p>
      <p className="num mt-1 break-all text-center text-[15px] font-semibold text-fg">{addr}</p>
      <button onClick={() => { void navigator.clipboard?.writeText(addr).catch(() => {}); setCopied(true); haptic(8); }} className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--surface-3)] text-[16px] font-semibold text-fg">{copied ? <Check className="size-5 text-up" /> : <Copy className="size-5" />}{copied ? "Copied" : "Copy address"}</button>
      <p className="mt-3 text-center text-[12px] text-muted">Friends in the Lounge can send you tokens here.</p>
    </Sheet>
  );
}

function AccountsSheet({ s, now, onClose }: { s: WorldState; now: number; onClose: () => void }) {
  const wl = s.wallet!;
  const [name, setName] = useState("");
  const add = () => {
    const n = name.trim().slice(0, 20);
    if (!n) return;
    doWallet((x) => { const w = x.wallet!; const id = `a${w.accounts.length}${Date.now().toString(36).slice(-3)}`; w.accounts.push({ id, name: n, hue: (78 + w.accounts.length * 67) % 360 }); w.cash[id] = "0.00"; w.active = id; });
    haptic(10);
    onClose();
  };
  return (
    <Sheet onClose={onClose} label="Accounts" title="Accounts">
      {wl.accounts.map((a) => (
        <button key={a.id} onClick={() => { doWallet((x) => { x.wallet!.active = a.id; }); haptic(6); onClose(); }} className="flex min-h-[64px] w-full items-center gap-3 rounded-xl px-1 text-left active:bg-surface-2">
          <span className="grid size-10 place-items-center rounded-full text-[16px] font-bold text-accent-ink" style={{ background: `hsl(${a.hue} 85% 60%)` }}>{a.name[0]}</span>
          <span className="flex-1 text-[16px] font-semibold text-fg">{a.name}</span>
          <span className="num text-[15px] text-muted">{fmtUsd(walletValue(s, now, a.id).total)}</span>
          {a.id === wl.active && <Check className="size-5 text-accent" />}
        </button>
      ))}
      <div className="mt-3 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New account name" aria-label="New account name" className="min-h-[48px] min-w-0 flex-1 rounded-xl bg-[var(--bg)] px-3 text-[16px] text-fg outline-none placeholder:text-muted" />
        <button onClick={add} disabled={!name.trim()} className={clsx("min-h-[48px] rounded-xl px-4 text-[15px] font-bold", name.trim() ? "bg-accent text-accent-ink" : "bg-[var(--surface-3)] text-muted")}>Add</button>
      </div>
      <p className="mt-2 text-[12px] text-muted">New accounts start empty. Move cash in with Send.</p>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ activity */

type Item = { kind: "fill"; f: TradeFill; t: number } | { kind: "transfer"; x: Transfer; t: number };

function Activity({ s, now }: { s: WorldState; now: number }) {
  const wl = s.wallet!;
  const [filter, setFilter] = useState<"all" | "trades" | "transfers">("all");
  const [open, setOpen] = useState<Item>();
  const items: Item[] = [
    ...(filter !== "transfers" ? wl.fills.filter((f) => f.account === wl.active).map((f) => ({ kind: "fill" as const, f, t: f.t })) : []),
    ...(filter !== "trades" ? wl.transfers.filter((x) => x.account === wl.active).map((x) => ({ kind: "transfer" as const, x, t: x.t })) : []),
  ].sort((a, b) => b.t - a.t);
  const dayOf = (t: number) => (new Date(t).toDateString() === new Date(now).toDateString() ? "Today" : new Date(t).toLocaleDateString([], { month: "long", day: "numeric" }));
  const heads = items.map((it, i) => (i === 0 || dayOf(items[i - 1].t) !== dayOf(it.t) ? dayOf(it.t) : undefined));
  return (
    <div className="mx-auto max-w-[640px] px-4 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <h1 className="py-2 text-[28px] font-extrabold text-[var(--header)]">Activity</h1>
      <div className="mb-2 flex gap-2">{(["all", "trades", "transfers"] as const).map((k) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)} className={clsx("min-h-[44px] rounded-full px-4 text-[15px] font-semibold capitalize", filter === k ? "bg-accent text-accent-ink" : "bg-surface text-fg")}>{k}</button>)}</div>
      {!items.length && <p className="py-8 text-center text-[15px] text-muted">Nothing here yet.</p>}
      {items.map((it, i) => {
        const head = heads[i];
        return (
          <div key={it.kind === "fill" ? it.f.id : it.x.id}>
            {head && <div className="px-1 pb-1 pt-3 text-[13px] font-bold text-muted">{head}</div>}
            <button onClick={() => setOpen(it)} className="flex min-h-[60px] w-full items-center gap-3 rounded-xl px-1 text-left active:bg-surface">
              {it.kind === "fill" ? <TokenIcon symbol={it.f.symbol} address={it.f.address} chain={it.f.chain} /> : <Avatar src={who(s, it.x.peer.startsWith("acct:") ? "god" : it.x.peer).avatar} size={40} />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold text-fg">{it.kind === "fill" ? `${it.f.side === "buy" ? "Bought" : "Sold"} ${it.f.symbol}` : it.x.dir === "out" ? `Sent to ${peerName(s, it.x.peer)}` : `Received from ${peerName(s, it.x.peer)}`}</span>
                <span className="block truncate text-[13px] text-muted">{new Date(it.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{it.kind === "transfer" && it.x.memo ? ` · ${it.x.memo}` : ""}</span>
              </span>
              <span className={clsx("num text-right text-[15px] font-semibold", it.kind === "transfer" ? (it.x.dir === "in" ? "text-up" : "text-fg") : "text-fg")}>
                {it.kind === "fill" ? (it.f.side === "buy" ? `+${fmtAmount(it.f.amount)} ${it.f.symbol}` : `+${fmtUsd(it.f.usd)}`) : `${it.x.dir === "in" ? "+" : "−"}${it.x.symbol === "USD" ? fmtUsd(it.x.amount) : `${fmtAmount(it.x.amount)} ${it.x.symbol}`}`}
              </span>
            </button>
          </div>
        );
      })}
      {open && (
        <Sheet onClose={() => setOpen(undefined)} label="Transaction details" title={open.kind === "fill" ? `${open.f.side === "buy" ? "Bought" : "Sold"} ${open.f.symbol}` : open.x.dir === "out" ? "Sent" : "Received"}>
          <dl className="space-y-2 rounded-xl bg-[var(--bg)] p-3 text-[15px]">
            {(open.kind === "fill"
              ? [["Date", new Date(open.f.t).toLocaleString()], ["Amount", `${fmtAmount(open.f.amount)} ${open.f.symbol}`], ["Price", fmtPrice(open.f.price)], ["Total", fmtUsd(open.f.usd)], ["Fee", fmtUsd(open.f.fee)], ["Price impact", `${(open.f.impactBps / 100).toFixed(2)}%`], ...(open.f.pnl ? [["Profit / loss", fmtUsd(open.f.pnl, { sign: true })]] : [])]
              : [["Date", new Date(open.x.t).toLocaleString()], [open.x.dir === "out" ? "To" : "From", peerName(s, open.x.peer)], ["Amount", open.x.symbol === "USD" ? fmtUsd(open.x.amount) : `${fmtAmount(open.x.amount)} ${open.x.symbol}`], ["Value", fmtUsd(open.x.usd)], ...(open.x.memo ? [["Note", open.x.memo]] : [])]
            ).map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="num text-right font-semibold text-fg">{v}</dd></div>)}
          </dl>
          {open.kind === "fill" && <button onClick={() => go(`/trade/t/${open.f.chain}/${open.f.address}`)} className="mt-3 min-h-[48px] w-full rounded-2xl bg-[var(--surface-3)] text-[16px] font-semibold text-fg">Open in Kiteline</button>}
        </Sheet>
      )}
    </div>
  );
}

function peerName(s: WorldState, peer: string) {
  if (peer.startsWith("acct:")) return s.wallet!.accounts.find((a) => `acct:${a.id}` === peer)?.name ?? "another account";
  return `@${who(s, peer).handle}`;
}
