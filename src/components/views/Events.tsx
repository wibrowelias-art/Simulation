"use client";
import { useState } from "react";
import { doEvent, toast, useApp } from "../store";
import { Avatar, Section, go, who } from "../ui";
import { relTime } from "@/lib/sim/format";

export function Events() {
  const { world: w, now } = useApp();
  const s = w!;
  const [last, setLast] = useState<string>();
  const evs = s.events.filter((e) => e.t <= now);
  const open = evs.filter((e) => !e.resolved && e.expiresAt > now).reverse();
  const past = evs.filter((e) => e.resolved || e.expiresAt <= now).reverse().slice(0, 30);
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 p-3 md:p-6">
        <h1 className="text-[24px] font-black">Situations</h1>
        {last && <div className="panel border-gold/40 p-3 text-[14px]">{last}</div>}
        {!open.length && <div className="panel p-6 text-center text-muted">No open situations. The internet will find something soon.</div>}
        {open.map((e) => { const f = e.fromId ? who(s, e.fromId) : undefined; return (
          <div key={e.id} className="panel pop p-4">
            <div className="flex items-start gap-3">
              {f && <button onClick={() => go(`/u/${f.id}`)}><Avatar src={f.avatar} size={40} /></button>}
              <div className="flex-1"><div className="font-bold">{e.title}</div><div className="mt-0.5 text-[14px] text-fg/85">{e.body}</div><div className="mt-1 text-[11px] text-muted">{relTime(e.t, now)} · expires in {e.expiresAt - now > 36e5 ? `${Math.round((e.expiresAt - now) / 36e5)}h` : `${Math.max(1, Math.round((e.expiresAt - now) / 6e4))}m`}</div></div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {e.choices.map((c) => (
                <button key={c.id} onClick={() => { const r = doEvent(e.id, c.id); if (r && !("error" in r)) { setLast(`${e.title} → ${c.label}: ${r.outcome}`); toast(r.outcome); } }} className="rounded-xl border border-line bg-surface-2 p-3 text-left hover:border-gold">
                  <div className="text-[14px] font-semibold">{c.label}</div><div className="text-[12px] text-muted">{c.hint}</div>
                </button>
              ))}
            </div>
          </div>
        ); })}
        {past.length > 0 && (
          <Section title="History">
            <div className="divide-y divide-line">{past.map((e) => (
              <div key={e.id} className="py-2 text-[13px]"><div className="font-semibold">{e.title}</div>
                <div className="text-muted">{e.resolved ? `${e.choices.find((c) => c.id === e.resolved!.choiceId)?.label} → ${e.resolved.outcome}` : "Ignored (expired)"}</div></div>
            ))}</div>
          </Section>
        )}
      </div>
    </div>
  );
}
