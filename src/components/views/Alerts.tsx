"use client";
import { useEffect } from "react";
import { AtSign, Bell, CalendarClock, DollarSign, Newspaper, TrendingUp } from "lucide-react";
import { editWorld, useApp } from "../store";
import { go } from "../ui";
import { relTime } from "@/lib/sim/format";

const ICON = { mention: AtSign, trend: TrendingUp, news: Newspaper, event: CalendarClock, money: DollarSign, system: Bell };
export const linkTo = (l?: string) => {
  if (!l) return;
  const [k, a, ...rest] = l.split(":");
  const b = rest.join(":");
  if (k === "chirp") go(`/chirp/tag/${a}`); else if (k === "article") go(`/news/${a}`); else if (k === "event") go("/events"); else if (k === "lounge") go(`/lounge/${a}/${b}`);
};

export function Alerts() {
  const { world: w, now } = useApp();
  const s = w!;
  const list = s.notifications.filter((n) => n.t <= now).slice(-150).reverse();
  useEffect(() => () => { editWorld((x) => { const t = Date.now(); x.notifications.forEach((n) => { if (n.t <= t) n.read = true; }); }); }, []);
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl p-3 md:p-6">
        <h1 className="mb-4 text-[24px] font-black">Notifications</h1>
        <div className="panel divide-y divide-line overflow-hidden">
          {list.map((n) => { const I = ICON[n.kind]; return (
            <button key={n.id} onClick={() => linkTo(n.link)} className={`flex w-full items-start gap-3 p-3 text-left hover:bg-surface-2 ${n.read ? "" : "bg-gold/[0.06]"}`}>
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-surface-3"><I className="size-4 text-gold" /></span>
              <div className="min-w-0 flex-1"><div className="text-[14px]">{n.text}</div><div className="text-[11px] text-muted">{relTime(n.t, now)}</div></div>
              {!n.read && <span className="mt-2 size-2 rounded-full bg-gold" />}
            </button>
          ); })}
          {!list.length && <div className="p-6 text-center text-muted">Nothing yet.</div>}
        </div>
      </div>
    </div>
  );
}
