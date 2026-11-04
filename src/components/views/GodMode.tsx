"use client";
import clsx from "clsx";
import { useState } from "react";
import { doAction, toast, useApp } from "../store";
import { Money } from "../ui";
import { ACTIONS, magnitudeFor, type ActionKind } from "@/lib/sim/topics";
import { fmtMoney } from "@/lib/sim/format";

export function GodMode() {
  const { world: w } = useApp();
  const s = w!;
  const [kind, setKind] = useState<ActionKind>("island");
  const def = ACTIONS.find((a) => a.kind === kind)!;
  const [name, setName] = useState("");
  const [pos, setPos] = useState(0.5);
  const [err, setErr] = useState<string>();
  const [lo, hi] = def.cost;
  const cost = hi === 0 ? 0 : Math.round(Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * pos) / 1e5) * 1e5;
  const mag = magnitudeFor(kind, cost);
  const run = () => {
    setErr(undefined);
    const r = doAction({ kind, name: name || def.names[0], cost });
    if (!r) return;
    if ("error" in r) { setErr(r.error); return; }
    if (!r.breaking) toast(`${def.icon} ${def.title} — rippling through ${r.servers.length} servers${r.articles.length ? `, ${r.articles.length} article` : ""}`);
    setName("");
  };
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl p-3 md:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div><h1 className="gold-text text-[30px] font-black tracking-tight">GOD MODE</h1><p className="text-[13px] text-muted">Make a move. The internet reacts in proportion. Cash: <Money v={s.player.cash} className="text-fg" /></p></div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {ACTIONS.map((a) => (
            <button key={a.kind} onClick={() => { setKind(a.kind); setName(""); setErr(undefined); }} className={clsx("panel flex flex-col items-center gap-1 p-3 text-center transition", kind === a.kind ? "glow border-gold" : "hover:border-fg/30")}>
              <span className="text-[26px]">{a.icon}</span><span className="text-[12px] font-semibold leading-tight">{a.title}</span>
            </button>
          ))}
        </div>
        <div className="panel mt-4 space-y-4 p-5">
          <div className="text-[18px] font-bold">{def.icon} {def.title}</div>
          <label className="block"><span className="text-[12px] uppercase tracking-wider text-muted">{def.prompt}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={def.names[0]} className="input mt-1 w-full" />
          </label>
          <div className="flex flex-wrap gap-1.5">{def.names.map((n) => <button key={n} onClick={() => setName(n)} className="rounded-full border border-line px-2.5 py-1 text-[12px] text-muted hover:text-fg">{n}</button>)}</div>
          {hi > 0 && (
            <label className="block"><div className="flex justify-between text-[12px] uppercase tracking-wider text-muted"><span>Spend</span><span className="num text-[16px] font-bold normal-case text-gold">{fmtMoney(cost)}</span></div>
              <input type="range" min={0} max={1} step={0.01} value={pos} onChange={(e) => setPos(Number(e.target.value))} className="mt-2 w-full accent-[var(--gold)]" />
              <div className="flex justify-between text-[11px] text-muted"><span>{fmtMoney(lo)}</span><span>{fmtMoney(hi)}</span></div>
            </label>
          )}
          <div>
            <div className="flex justify-between text-[12px] uppercase tracking-wider text-muted"><span>Expected internet impact</span><span className={clsx("num font-bold", mag >= 7 ? "text-down" : "text-fg")}>{mag.toFixed(1)} / 10 {mag >= 7 && "· BREAKING POINT"}</span></div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full transition-all" style={{ width: `${mag * 10}%`, background: mag >= 7 ? "linear-gradient(90deg,var(--gold),var(--down))" : "var(--gold)" }} /></div>
            <p className="mt-1.5 text-[12px] text-muted">{mag >= 7 ? "Trends worldwide, floods every server, triggers news coverage, influencer takes and memes." : mag >= 4.5 ? "Gets a news write-up and a trending tag." : "A few servers will notice."}</p>
          </div>
          {err && <div className="rounded-lg border border-down/40 bg-down/10 p-2.5 text-[13px] text-down">{err}</div>}
          <button onClick={run} className="btn btn-gold w-full py-3 text-[15px]">Do it</button>
        </div>
      </div>
    </div>
  );
}
