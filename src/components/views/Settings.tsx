"use client";
import clsx from "clsx";
import { useState } from "react";
import { changePasscode, lock, resetUniverse, toast, updateSettings, useApp } from "../store";
import { Section } from "../ui";
import type { Settings } from "@/lib/sim/types";
import { liveStatus } from "@/lib/live/client";

const THEMES: { id: Settings["theme"]; label: string; sw: string[] }[] = [
  { id: "midnight", label: "Midnight", sw: ["#0b0d12", "#e8b84a", "#5865f2"] },
  { id: "obsidian", label: "Obsidian", sw: ["#050505", "#d4d4d4", "#a3a3a3"] },
  { id: "royal", label: "Royal", sw: ["#120b1e", "#e8b84a", "#a855f7"] },
  { id: "terminal", label: "Terminal", sw: ["#050a06", "#3ddc84", "#f5a623"] },
];

export function SettingsView() {
  const { world: w, profile } = useApp();
  const s = w!;
  const st = s.settings;
  const live = liveStatus();
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [seed, setSeed] = useState("");
  const slider = (k: "activity" | "glazeRatio" | "drama", label: string, min: number, max: number, step: number, lo: string, hi: string) => (
    <label className="block">
      <div className="flex justify-between text-[13px]"><span className="font-semibold">{label}</span><span className="num text-gold">{k === "activity" ? `${st[k].toFixed(2)}×` : `${Math.round(st[k] * 100)}%`}</span></div>
      <input type="range" min={min} max={max} step={step} value={st[k]} onChange={(e) => updateSettings({ [k]: Number(e.target.value) })} className="mt-2 w-full accent-[var(--gold)]" />
      <div className="flex justify-between text-[11px] text-muted"><span>{lo}</span><span>{hi}</span></div>
    </label>
  );
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-4 p-3 md:p-6">
        <h1 className="text-[24px] font-black">Settings</h1>
        <Section title="World">
          <div className="space-y-5">
            {slider("activity", "World activity", 0.25, 3, 0.05, "sleepy", "chaos")}
            {slider("glazeRatio", "Glaze ratio", 0, 1, 0.01, "everyone hates you", "everyone worships you")}
            {slider("drama", "Drama level", 0, 1, 0.01, "wholesome", "messy")}
          </div>
        </Section>
        <Section title="Conversations">
          <label className="flex items-start gap-2 text-[14px]"><input className="mt-1" type="checkbox" checked={st.liveReplies !== false} onChange={(e) => updateSettings({ liveReplies: e.target.checked })} />
            <span>Live replies<span className="block text-[12px] text-muted">When you talk to someone, they write a new reply with a language model on our server, using the recent chat. Off: built-in lines only. Background chatter always uses built-in lines.{live.state === "unavailable" ? " Live replies are not available right now, so built-in lines are used." : ""}</span></span></label>
          <label className="mt-3 flex items-start gap-2 text-[14px]"><input className="mt-1" type="checkbox" checked={!!st.breakCharacter} onChange={(e) => updateSettings({ breakCharacter: e.target.checked })} />
            <span>Let people break character<span className="block text-[12px] text-muted">If you sincerely ask someone whether they are an AI, they may say yes.</span></span></label>
        </Section>
        <Section title="Appearance">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {THEMES.map((t) => <button key={t.id} onClick={() => updateSettings({ theme: t.id })} className={clsx("rounded-xl border p-3 text-left", st.theme === t.id ? "border-gold" : "border-line")}><div className="mb-2 flex gap-1">{t.sw.map((c) => <span key={c} className="size-4 rounded-full border border-white/10" style={{ background: c }} />)}</div><div className="text-[13px] font-semibold">{t.label}</div></button>)}
          </div>
          <label className="mt-4 flex items-center gap-2 text-[14px]"><input type="checkbox" checked={st.reducedMotion} onChange={(e) => updateSettings({ reducedMotion: e.target.checked })} /> Reduce motion</label>
        </Section>
        <Section title={`Profile · ${profile?.name ?? ""}`}>
          <p className="mb-2 text-[13px] text-muted">Profiles live only in this browser (IndexedDB). A passcode is stored as a salted SHA-256 hash. It keeps casual snoopers out; it is not real security.</p>
          <div className="flex gap-2"><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={profile?.passHash ? "New passcode" : "Set a passcode"} className="input flex-1" />
            <button onClick={async () => { await changePasscode(pass || null); setPass(""); toast(pass ? "Passcode set" : "Passcode removed"); }} className="btn">{pass ? "Save" : "Remove"}</button></div>
          <button onClick={lock} className="btn mt-3">Lock & switch profile</button>
        </Section>
        <Section title="Danger zone">
          <p className="mb-2 text-[13px] text-muted">Reset the universe: new characters, servers and history. Your empire starts over.</p>
          <input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder={`Seed (current: ${s.seed})`} className="input mb-2 w-full" />
          {confirm ? (
            <div className="flex gap-2"><button onClick={() => resetUniverse(seed.trim() || `u-${Date.now().toString(36)}`)} className="btn border-down bg-down/20 text-down">Yes, reset everything</button><button onClick={() => setConfirm(false)} className="btn">Cancel</button></div>
          ) : <button onClick={() => setConfirm(true)} className="btn text-down">Reset universe</button>}
        </Section>
        <p className="pb-6 text-center text-[11px] text-muted">About: a fictional world. Every person, company, platform, outlet and event is invented.</p>
      </div>
    </div>
  );
}
