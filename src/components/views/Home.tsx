"use client";
import { useEffect, useState } from "react";
import { ChevronRight, Settings as Cog } from "lucide-react";
import { useApp } from "../store";
import { haptic } from "../App";
import { AppMark } from "../brand";
import { Avatar, go, who } from "../ui";
import { APP, APP_ORDER } from "@/lib/brand";
import { walletValue } from "@/lib/wallet/value";
import { fmtUsd, fmtPct } from "@/lib/wallet/format";
import { MarketWidget } from "./trade/Widgets";

/** The home screen: your balance, the market, and the four apps. */
export function Home() {
  const { world: w, now } = useApp();
  const s = w!;
  const v = walletValue(s, now);
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setClock(new Date()), 15_000); return () => clearInterval(t); }, []);
  const me = who(s, "god");
  const open = (route: string) => { haptic(6); go(route); };
  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-full max-w-[520px] flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
        <header className="flex items-center gap-3 py-2">
          <button onClick={() => open("/settings")} aria-label="Your profile and settings" className="flex min-h-[44px] items-center gap-2.5">
            <Avatar src={me.avatar} size={36} />
            <span className="text-left leading-tight">
              <span className="block text-[15px] font-semibold text-[var(--header)]">{me.name}</span>
              <span className="block text-[13px] text-muted">@{me.handle}</span>
            </span>
          </button>
          <span className="num ml-auto text-[15px] font-semibold text-muted" aria-label="Time">{clock.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
          <button onClick={() => open("/settings")} aria-label="Settings" className="grid size-11 place-items-center rounded-full bg-surface text-muted"><Cog className="size-5" /></button>
        </header>

        <button onClick={() => open(APP.wallet.route)} className="mt-3 w-full rounded-2xl bg-surface p-4 text-left active:scale-[.99]">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-muted"><AppMark app="wallet" size={20} />{APP.wallet.name}<ChevronRight className="ml-auto size-4" /></span>
          <span className="num mt-2 block text-[36px] font-bold leading-none tracking-tight text-[var(--header)]">{fmtUsd(v.total)}</span>
          <span className={`num mt-1.5 block text-[14px] font-semibold ${v.change >= 0 ? "text-up" : "text-down"}`}>{v.change >= 0 ? "▲" : "▼"} {fmtUsd(Math.abs(v.change))} ({fmtPct(v.changePct)}) <span className="font-medium text-muted">since you started</span></span>
        </button>

        <MarketWidget onOpen={(href) => open(href)} />

        <nav aria-label="Apps" className="mt-6 grid grid-cols-4 gap-x-2 gap-y-4">
          {APP_ORDER.map((id) => (
            <button key={id} onClick={() => open(APP[id].route)} className="flex flex-col items-center gap-1.5 active:scale-95">
              <AppMark app={id} size={64} />
              <span className="text-[13px] font-medium text-fg">{APP[id].name}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
