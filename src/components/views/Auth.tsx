"use client";
import clsx from "clsx";
import { useState } from "react";
import { Lock, Trash2 } from "lucide-react";
import { AppMark } from "../brand";
import { APP, APP_ORDER } from "@/lib/brand";
import { DEFAULT_START, START_OPTIONS, toHandle } from "@/lib/wallet/state";
import { fmtUsd } from "@/lib/wallet/format";
import { newProfile, removeProfile, unlock, useApp } from "../store";
import type { Profile } from "@/lib/persistence/profiles";

export function AuthScreen() {
  const { profiles } = useApp();
  const [sel, setSel] = useState<Profile>();
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [touchedHandle, setTouchedHandle] = useState(false);
  const [start, setStart] = useState<string>(DEFAULT_START);
  const [np, setNp] = useState("");
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(!profiles.length);
  const h = touchedHandle ? handle : toHandle(name || "");
  return (
    <main className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="flex gap-3">{APP_ORDER.map((id) => <AppMark key={id} app={id} size={48} />)}</div>
        <h1 className="mt-6 text-[32px] font-extrabold leading-tight text-[var(--header)]">{creating ? "Set up your phone" : "Welcome back"}</h1>
        <p className="mt-1 text-[16px] text-muted">{creating ? `${APP.wallet.name}, ${APP.trade.name}, ${APP.lounge.name} and ${APP.feed.name}, in one place.` : "Pick your profile."}</p>
        {!creating && (
          <div className="mt-6 space-y-2">
            {profiles.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <button onClick={async () => { setErr(""); if (!p.passHash) { await unlock(p, ""); } else setSel(p); }} className="flex min-h-[64px] flex-1 items-center gap-3 rounded-2xl bg-surface px-3 text-left active:scale-[.99]">
                  <span className="grid size-11 place-items-center rounded-full bg-accent text-[18px] font-bold text-accent-ink">{p.name[0]}</span>
                  <span className="flex-1"><span className="block text-[17px] font-semibold text-[var(--header)]">{p.name}</span><span className="block text-[13px] text-muted">@{p.handle ?? toHandle(p.name)}</span></span>
                  {p.passHash && <Lock className="size-4 text-muted" />}
                </button>
                <button aria-label={`Delete ${p.name}`} onClick={() => confirm(`Delete ${p.name} and everything in it?`) && removeProfile(p.id)} className="grid size-11 place-items-center text-muted"><Trash2 className="size-5" /></button>
              </div>
            ))}
            {sel && (
              <form onSubmit={async (e) => { e.preventDefault(); if (!(await unlock(sel, pass))) setErr("Wrong passcode"); }} className="flex gap-2 pt-2">
                <input autoFocus type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={`Passcode for ${sel.name}`} className="min-h-[52px] min-w-0 flex-1 rounded-2xl bg-surface px-4 text-[16px] text-fg outline-none" />
                <button className="min-h-[52px] rounded-2xl bg-accent px-5 text-[16px] font-bold text-accent-ink">Unlock</button>
              </form>
            )}
            <button onClick={() => setCreating(true)} className="min-h-[48px] w-full text-[16px] font-semibold text-accent">New profile</button>
          </div>
        )}
        {creating && (
          <form onSubmit={(e) => { e.preventDefault(); if (!name.trim()) { setErr("Add your name"); return; } newProfile(name.trim(), np, { handle: h, start }); }} className="mt-6 flex flex-1 flex-col gap-4">
            <label className="block"><span className="text-[13px] font-semibold uppercase text-muted">Your name</span><input autoFocus value={name} onChange={(e) => setName(e.target.value.slice(0, 32))} placeholder="Alex Rivera" className="mt-1 min-h-[52px] w-full rounded-2xl bg-surface px-4 text-[17px] text-fg outline-none placeholder:text-muted" /></label>
            <label className="block"><span className="text-[13px] font-semibold uppercase text-muted">Handle</span>
              <span className="mt-1 flex items-center rounded-2xl bg-surface px-4"><span className="text-[17px] text-muted">@</span><input value={h} onChange={(e) => { setTouchedHandle(true); setHandle(e.target.value.toLowerCase().replace(/[^\w.]/g, "").slice(0, 24)); }} placeholder="alexrivera" className="min-h-[52px] min-w-0 flex-1 bg-transparent pl-0.5 text-[17px] text-fg outline-none placeholder:text-muted" /></span>
            </label>
            <fieldset>
              <legend className="text-[13px] font-semibold uppercase text-muted">Starting cash (virtual)</legend>
              <div className="mt-1 grid grid-cols-3 gap-2">{START_OPTIONS.map((o) => <button type="button" key={o} aria-pressed={start === o} onClick={() => setStart(o)} className={clsx("min-h-[52px] rounded-2xl text-[17px] font-bold", start === o ? "bg-accent text-accent-ink" : "bg-surface text-fg")}>{fmtUsd(o).replace(".00", "")}</button>)}</div>
            </fieldset>
            <label className="block"><span className="text-[13px] font-semibold uppercase text-muted">Passcode (optional)</span><input type="password" value={np} onChange={(e) => setNp(e.target.value)} className="mt-1 min-h-[52px] w-full rounded-2xl bg-surface px-4 text-[17px] text-fg outline-none" /></label>
            {err && <p className="text-[14px] text-down">{err}</p>}
            <button className="mt-auto min-h-[56px] w-full rounded-2xl bg-accent text-[17px] font-bold text-accent-ink active:scale-[.99]">Get started</button>
            {profiles.length > 0 && <button type="button" onClick={() => setCreating(false)} className="min-h-[44px] w-full text-[15px] text-muted">Back</button>}
          </form>
        )}
        {err && !creating && <p className="mt-2 text-[14px] text-down">{err}</p>}
      </div>
    </main>
  );
}

export function CatchUpScreen({ progress }: { progress: number }) {
  return (
    <main className="grid h-full place-items-center bg-bg p-6">
      <div className="w-full max-w-xs text-center">
        <div className="flex justify-center gap-2">{APP_ORDER.map((id) => <AppMark key={id} app={id} size={36} />)}</div>
        <div className="mt-5 text-[17px] font-semibold text-[var(--header)]">Catching up</div>
        <div className="mt-1 text-[14px] text-muted">Everyone kept talking while you were away.</div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
      </div>
    </main>
  );
}
