"use client";
import { useState } from "react";
import { Crown, Lock, Trash2 } from "lucide-react";
import { newProfile, removeProfile, unlock, useApp } from "../store";
import type { Profile } from "@/lib/persistence/profiles";

export function AuthScreen() {
  const { profiles } = useApp();
  const [sel, setSel] = useState<Profile>();
  const [pass, setPass] = useState("");
  const [name, setName] = useState("God");
  const [np, setNp] = useState("");
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(!profiles.length);
  return (
    <main className="grid h-full place-items-center overflow-y-auto p-4" style={{ background: "radial-gradient(ellipse at top, #e8b84a22, transparent 60%)" }}>
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Crown className="mx-auto size-12 text-gold" />
          <h1 className="gold-text mt-2 text-[40px] font-black tracking-tight">GOD</h1>
          <p className="text-muted">The Internet</p>
        </div>
        <div className="panel space-y-3 p-5">
          {!creating && profiles.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <button onClick={async () => { setErr(""); if (!p.passHash) { await unlock(p, ""); } else setSel(p); }} className="flex flex-1 items-center gap-3 rounded-xl border border-line bg-surface-2 p-3 text-left hover:border-gold">
                <span className="grid size-10 place-items-center rounded-full bg-gold/20 text-gold">{p.name[0]}</span>
                <div className="flex-1"><div className="font-semibold">{p.name}</div><div className="text-[11px] text-muted">universe {p.seed}</div></div>
                {p.passHash && <Lock className="size-4 text-muted" />}
              </button>
              <button title="Delete profile" onClick={() => confirm(`Delete ${p.name} and its universe?`) && removeProfile(p.id)} className="p-2 text-muted hover:text-down"><Trash2 className="size-4" /></button>
            </div>
          ))}
          {sel && !creating && (
            <form onSubmit={async (e) => { e.preventDefault(); if (!(await unlock(sel, pass))) setErr("Wrong passcode"); }} className="flex gap-2">
              <input autoFocus type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={`Passcode for ${sel.name}`} className="input flex-1" />
              <button className="btn btn-gold">Unlock</button>
            </form>
          )}
          {creating ? (
            <form onSubmit={(e) => { e.preventDefault(); newProfile(name.trim() || "God", np); }} className="space-y-3">
              <label className="block"><span className="text-[11px] uppercase tracking-wider text-muted">Display name</span><input value={name} onChange={(e) => setName(e.target.value)} className="input mt-1 w-full" /></label>
              <label className="block"><span className="text-[11px] uppercase tracking-wider text-muted">Passcode (optional)</span><input type="password" value={np} onChange={(e) => setNp(e.target.value)} className="input mt-1 w-full" /></label>
              <button className="btn btn-gold w-full py-3">Become @god</button>
              {profiles.length > 0 && <button type="button" onClick={() => setCreating(false)} className="w-full text-[13px] text-muted">Back</button>}
            </form>
          ) : <button onClick={() => setCreating(true)} className="w-full py-1 text-[13px] text-brand">+ New universe</button>}
          {err && <p className="text-[13px] text-down">{err}</p>}
        </div>
        <p className="mt-4 text-center text-[11px] text-muted">Stored locally in this browser.</p>
      </div>
    </main>
  );
}

export function CatchUpScreen({ progress }: { progress: number }) {
  return (
    <main className="grid h-full place-items-center p-6">
      <div className="w-full max-w-sm text-center">
        <Crown className="mx-auto size-10 animate-pulse text-gold" />
        <div className="mt-3 font-semibold">The internet kept going without you…</div>
        <div className="mt-1 text-[13px] text-muted">Replaying what happened while you were away</div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-gold transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        <div className="num mt-2 text-[12px] text-muted">{Math.round(progress * 100)}%</div>
      </div>
    </main>
  );
}
