"use client";
import clsx from "clsx";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { changePasscode, editWorld, lock, resetUniverse, toast, updateSettings, useApp } from "../store";
import { Avatar, go, who } from "../ui";
import { liveStatus } from "@/lib/live/client";
import { START_OPTIONS, toHandle } from "@/lib/wallet/state";
import { fmtUsd } from "@/lib/wallet/format";
import { APP, SUITE } from "@/lib/brand";

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className="grid min-h-[44px] min-w-[52px] shrink-0 place-items-center">
      <span className={clsx("relative h-[31px] w-[51px] rounded-full transition-colors", on ? "bg-accent" : "bg-[var(--surface-3)]")}>
        <span className={clsx("absolute top-[2px] size-[27px] rounded-full bg-white shadow transition-transform", on ? "translate-x-[22px]" : "translate-x-[2px]")} />
      </span>
    </button>
  );
}
const Group = ({ title, children, note }: { title?: string; children: React.ReactNode; note?: React.ReactNode }) => (
  <section className="mt-6">
    {title && <h2 className="mb-1.5 px-4 text-[13px] font-semibold uppercase text-muted">{title}</h2>}
    <div className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl bg-surface">{children}</div>
    {note && <p className="mt-1.5 px-4 text-[13px] text-muted">{note}</p>}
  </section>
);
const Row = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={clsx("flex min-h-[52px] items-center gap-3 px-4", className)}>{children}</div>;

export function SettingsView() {
  const { world: w, profile } = useApp();
  const s = w!;
  const st = s.settings;
  const live = liveStatus();
  const me = who(s, "god");
  const [name, setName] = useState(s.player.displayName);
  const [handle, setHandle] = useState(s.player.handle ?? "");
  const [pass, setPass] = useState("");
  const [reset, setReset] = useState<string>();
  const saveId = () => {
    const h = toHandle(handle || name);
    editWorld((x) => { x.player.displayName = name.trim().slice(0, 32) || x.player.displayName; x.player.handle = h; });
    setHandle(h);
    toast("Profile saved");
  };
  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-[640px] px-4 pb-10 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <header className="flex items-center gap-1 py-1">
          <button aria-label="Back" onClick={() => (history.length > 1 ? history.back() : go("/"))} className="grid size-11 place-items-center rounded-full text-[var(--header)]"><ChevronLeft className="size-7" /></button>
          <h1 className="text-[28px] font-extrabold text-[var(--header)]">Settings</h1>
        </header>

        <Group title="Profile">
          <Row className="py-3"><Avatar src={me.avatar} size={52} /><span className="min-w-0"><span className="block truncate text-[17px] font-semibold text-[var(--header)]">{me.name}</span><span className="block text-[14px] text-muted">@{me.handle}</span></span></Row>
          <Row><label className="flex flex-1 items-center gap-3"><span className="w-24 text-[16px] text-fg">Name</span><input value={name} onChange={(e) => setName(e.target.value)} className="min-h-[44px] min-w-0 flex-1 bg-transparent text-right text-[16px] text-fg outline-none" /></label></Row>
          <Row><label className="flex flex-1 items-center gap-3"><span className="w-24 text-[16px] text-fg">Handle</span><span className="ml-auto text-muted">@</span><input value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^\w.]/g, ""))} className="min-h-[44px] w-40 bg-transparent text-[16px] text-fg outline-none" /></label></Row>
          <Row><button onClick={saveId} className="min-h-[44px] w-full text-left text-[16px] font-semibold text-accent">Save profile</button></Row>
        </Group>

        <Group title="People" note={live.state === "unavailable" ? "Live replies aren't available on this server right now, so people use their built-in lines." : "People write new replies with a language model on the server, using the recent chat and what they remember about you."}>
          <Row><span className="flex-1 text-[16px] text-fg">Live replies</span><Switch on={st.liveReplies !== false} onChange={(v) => updateSettings({ liveReplies: v })} label="Live replies" /></Row>
          <Row><span className="flex-1 text-[16px] text-fg">Let people break character<span className="block text-[13px] text-muted">If you sincerely ask whether they&apos;re an AI, they may say yes.</span></span><Switch on={!!st.breakCharacter} onChange={(v) => updateSettings({ breakCharacter: v })} label="Let people break character" /></Row>
        </Group>

        <Group title="Display">
          <Row><span className="flex-1 text-[16px] text-fg">Reduce motion</span><Switch on={st.reducedMotion} onChange={(v) => updateSettings({ reducedMotion: v })} label="Reduce motion" /></Row>
        </Group>

        <Group title="Privacy" note="Everything is stored only in this browser. A passcode keeps casual snoopers out; it isn't real security.">
          <Row><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={profile?.passHash ? "New passcode" : "Set a passcode"} aria-label="Passcode" className="min-h-[44px] min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-muted" />
            <button onClick={async () => { await changePasscode(pass || null); setPass(""); toast(pass ? "Passcode set" : "Passcode removed"); }} className="min-h-[44px] px-1 text-[16px] font-semibold text-accent">{pass ? "Save" : profile?.passHash ? "Remove" : ""}</button></Row>
          <Row><button onClick={lock} className="min-h-[44px] w-full text-left text-[16px] text-fg">Lock and switch profile</button></Row>
        </Group>

        <Group title="Start over" note="A new world: new people, new history, and your wallet resets to the amount you pick.">
          {reset === undefined
            ? <Row><button onClick={() => setReset("10000")} className="min-h-[44px] w-full text-left text-[16px] text-down">Reset everything…</button></Row>
            : <>
              <Row className="flex-wrap gap-2 py-3">{START_OPTIONS.map((o) => <button key={o} aria-pressed={reset === o} onClick={() => setReset(o)} className={clsx("min-h-[44px] rounded-full px-4 text-[15px] font-semibold", reset === o ? "bg-accent text-accent-ink" : "bg-[var(--surface-3)] text-fg")}>{fmtUsd(o).replace(".00", "")}</button>)}</Row>
              <Row><button onClick={() => resetUniverse(`u-${Date.now().toString(36)}`, reset)} className="min-h-[44px] flex-1 text-left text-[16px] font-semibold text-down">Reset with {fmtUsd(reset).replace(".00", "")}</button><button onClick={() => setReset(undefined)} className="min-h-[44px] px-1 text-[16px] text-muted">Cancel</button></Row>
            </>}
        </Group>

        <Group title="About">
          <Row className="py-3"><p className="text-[14px] leading-relaxed text-muted">{SUITE} is a fictional world. Every person, company, outlet and event in {APP.lounge.name} and {APP.feed.name} is invented. Prices in {APP.trade.name} are real market data from DEX Screener and GeckoTerminal; all money, balances and trades are virtual, and nothing connects to a real wallet or exchange.</p></Row>
        </Group>
      </div>
    </div>
  );
}
