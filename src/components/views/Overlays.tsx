"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import { dismissBreaking, dismissSummary, useApp, type Summary } from "../store";
import { Money, go } from "../ui";
import type { RippleResult } from "@/lib/sim/engine";
import { fmtCount } from "@/lib/sim/format";

const dur = (ms: number) => { const h = ms / 36e5; return h >= 48 ? `${Math.round(h / 24)} days` : h >= 1 ? `${Math.round(h)} hours` : `${Math.round(ms / 6e4)} minutes`; };

export function AwaySummary({ s }: { s: Summary }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-3 backdrop-blur-sm" onClick={dismissSummary}>
      <div className="panel pop max-h-[90vh] w-full max-w-lg overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between"><div><div className="text-[11px] uppercase tracking-[0.2em] text-gold">While you were away</div><h2 className="text-[22px] font-black leading-tight">{fmtCount(s.messages)} messages while you were away</h2><p className="mt-0.5 text-[12px] text-muted">You were gone {dur(s.to - s.from)}. Everything below was replayed for that time when you came back.</p></div><button aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-surface-2" onClick={dismissSummary}><X className="size-5" /></button></div>
        {s.compressed && <p className="mt-1 text-[12px] text-muted">Long absence: older hours were fast-forwarded; the last day was replayed in full.</p>}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["@god mentions", fmtCount(s.mentions ?? 0)], ["Posts", fmtCount(s.posts)], ["Articles", String(s.articles)], ["Situations", String(s.events)]].map(([k, v]) => <div key={k} className="rounded-xl bg-surface-2 p-2.5"><div className="text-[10px] uppercase text-muted">{k}</div><div className="num text-[18px] font-bold">{v}</div></div>)}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
          <div className="rounded-xl bg-surface-2 p-2.5"><div className="text-[10px] uppercase text-muted">Net worth</div><Money v={s.netWorthDelta} sign /></div>
          <div className="rounded-xl bg-surface-2 p-2.5"><div className="text-[10px] uppercase text-muted">Followers</div><span className="num text-up">+{fmtCount(Math.max(0, s.followerDelta))}</span></div>
          <div className="rounded-xl bg-surface-2 p-2.5"><div className="text-[10px] uppercase text-muted">Sentiment</div><span className={`num ${s.opinionShift >= 0 ? "text-up" : "text-down"}`}>{s.opinionShift >= 0 ? "+" : ""}{s.opinionShift.toFixed(1)}</span></div>
        </div>
        {s.highlights.length > 0 && <div className="mt-4"><div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Highlights</div><ul className="space-y-1.5 text-[14px]">{s.highlights.map((h, i) => <li key={i} className="flex gap-2"><span className="text-gold">◆</span>{h}</li>)}</ul></div>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Trended</div>{s.topTopics.map((t) => <button key={t.tag} onClick={() => { dismissSummary(); go(`/chirp/tag/${t.tag}`); }} className="block text-[13px] text-brand">#{t.tag}</button>)}</div>
          <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Loudest servers</div>{s.topServers.map((t) => <div key={t.name} className="flex justify-between text-[13px]"><span>{t.name}</span><span className="num text-muted">{fmtCount(t.count)}</span></div>)}</div>
        </div>
        <div className="mt-5 flex items-center justify-between"><span /><button onClick={dismissSummary} className="btn btn-gold">Catch up</button></div>
      </div>
    </div>
  );
}

export function BreakingOverlay({ r }: { r: RippleResult }) {
  useEffect(() => { const t = setTimeout(dismissBreaking, 14000); return () => clearTimeout(t); }, [r]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-3 backdrop-blur" onClick={dismissBreaking}>
      <div className="shake w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="breaking-pulse rounded-t-2xl bg-down px-4 py-2 text-center text-[13px] font-black tracking-[0.3em] text-white">BREAKING POINT</div>
        <div className="panel rounded-t-none border-down/60 p-5">
          <div className="text-[11px] uppercase tracking-wider text-muted">Impact {r.magnitude.toFixed(1)} / 10</div>
          <h2 className="mt-1 text-[24px] font-black leading-tight">{r.headline ?? r.topic.label}</h2>
          <div className="mt-2 inline-block rounded-full bg-gold/15 px-3 py-1 text-[14px] font-bold text-gold">#{r.topic.tag} · #1 trending</div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-surface-2 p-2"><div className="num text-[20px] font-bold">{r.servers.length}</div><div className="text-[10px] uppercase text-muted">servers erupting</div></div>
            <div className="rounded-xl bg-surface-2 p-2"><div className="num text-[20px] font-bold">{r.posts}</div><div className="text-[10px] uppercase text-muted">viral posts</div></div>
            <div className="rounded-xl bg-surface-2 p-2"><div className="num text-[20px] font-bold">{r.articles.length}</div><div className="text-[10px] uppercase text-muted">news stories</div></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">{r.servers.slice(0, 8).map((n) => <span key={n} className="rounded-full border border-line px-2 py-0.5 text-[11px]">{n}</span>)}</div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button onClick={() => { dismissBreaking(); go(`/chirp/tag/${r.topic.tag}`); }} className="btn btn-gold">See the reaction</button>
            {r.articles[0] && <button onClick={() => { dismissBreaking(); go(`/news/${r.articles[0].id}`); }} className="btn">Read coverage</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Toast() {
  const { toast, now } = useApp();
  if (!toast || Math.max(now, toast.t) - toast.t > (toast.ms ?? 3500)) return null;
  return <div className="pop fixed bottom-20 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-full border border-line bg-surface-3 px-4 py-2 text-[13px] shadow-2xl md:bottom-6">{toast.text}</div>;
}
