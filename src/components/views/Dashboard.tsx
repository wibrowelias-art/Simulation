"use client";
import { useApp } from "../store";
import { Money, Section, Spark, go } from "../ui";
import { netWorth } from "@/lib/sim/world";
import { trending } from "@/lib/sim/engine";
import { STANCE_INFO } from "@/lib/sim/characters";
import { fmtCount, fmtMoney, relAgo } from "@/lib/sim/format";
import type { Holding, Stance } from "@/lib/sim/types";

const KINDS: { k: Holding["kind"]; label: string; icon: string }[] = [
  { k: "business", label: "Businesses", icon: "🏢" }, { k: "investment", label: "Investments", icon: "📈" }, { k: "coin", label: "Coins", icon: "🪙" },
  { k: "property", label: "Properties", icon: "🏰" }, { k: "island", label: "Islands", icon: "🏝️" }, { k: "jet", label: "Jets", icon: "✈️" },
  { k: "vehicle", label: "Vehicles", icon: "🏎️" }, { k: "organization", label: "Organizations", icon: "🏛️" }, { k: "account", label: "Accounts", icon: "🏦" },
];

export function Dashboard() {
  const { world: w, now } = useApp();
  const s = w!;
  const p = s.player;
  const nw = netWorth(s);
  const hist = p.netWorthHistory.slice(-160).map((x) => x.v).concat(nw);
  const day = p.netWorthHistory.find((x) => x.t >= now - 864e5)?.v ?? hist[0];
  const chg = nw - day;
  const invest = p.holdings.filter((h) => h.kind === "investment" || h.kind === "coin").reduce((a, h) => a + h.value, 0);
  const tr = trending(s, now, 20);
  const godRank = tr.find((t) => t.topic.about === "god");
  const counts = new Map<Stance, number>();
  for (const c of s.characters) counts.set(c.stance, (counts.get(c.stance) ?? 0) + 1);
  const pos = s.characters.filter((c) => c.opinion > 25).length, neg = s.characters.filter((c) => c.opinion < -25).length;
  const glaze = Math.round((pos / s.characters.length) * 100);
  const community = s.servers.reduce((a, x) => a + (x.tags.includes("god") || x.bias > 0.2 ? x.memberCount : 0), 0);
  const yieldDay = p.holdings.reduce((a, h) => a + (h.yieldPerDay ?? 0), 0);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-4 p-3 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[12px] uppercase tracking-[0.2em] text-muted">The Empire of @god</div>
            <div className="gold-text num text-[40px] font-black leading-tight md:text-[56px]">{fmtMoney(nw)}</div>
            <div className="flex items-center gap-2 text-[14px]"><Money v={chg} sign /><span className="text-muted">({day ? ((chg / day) * 100).toFixed(2) : "0"}%) · 24h</span></div>
          </div>
          <div className="flex items-center gap-2"><button onClick={() => go("/god")} className="btn btn-gold">⚡ GOD MODE</button></div>
        </div>
        <div className="panel p-4"><Spark data={hist} w={1200} h={140} /><div className="mt-1 flex justify-between text-[11px] text-muted"><span>{p.netWorthHistory.length ? relAgo(p.netWorthHistory[Math.max(0, p.netWorthHistory.length - 160)].t, now) : ""}</span><span>now</span></div></div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          {[
            ["Cash", fmtMoney(p.cash)], ["Investments", fmtMoney(invest)], ["Income / day", fmtMoney(yieldDay)], ["Followers", fmtCount(p.followers)],
            ["Community", fmtCount(community)], ["Reputation", `${p.reputation.toFixed(0)}/100`], ["Influence", `${p.influence.toFixed(0)}/100`],
            ["Trending", godRank ? `#${godRank.rank} ${godRank.topic.tag}` : "not trending"],
          ].map(([k, v]) => (
            <div key={k} className="panel p-3"><div className="text-[11px] uppercase tracking-wider text-muted">{k}</div><div className="num mt-1 truncate text-[18px] font-bold">{v}</div></div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Section title="Holdings" className="lg:col-span-2" right={<span className="text-[12px] text-muted">{p.holdings.length} assets</span>}>
            <div className="grid gap-3 sm:grid-cols-2">
              {KINDS.map(({ k, label, icon }) => { const hs = p.holdings.filter((h) => h.kind === k); if (!hs.length) return null; return (
                <div key={k} className="rounded-xl border border-line bg-surface-2/50 p-3">
                  <div className="mb-2 flex items-center justify-between"><span className="font-semibold">{icon} {label}</span><Money v={hs.reduce((a, h) => a + h.value, 0)} className="text-[13px] text-gold" /></div>
                  {hs.slice(-6).map((h) => <div key={h.id} className="flex justify-between gap-2 py-0.5 text-[13px]"><span className="truncate text-fg/85">{h.name}{h.employees ? <span className="text-muted"> · {fmtCount(h.employees)} staff</span> : null}</span><Money v={h.value} className="shrink-0 text-muted" /></div>)}
                </div>
              ); })}
            </div>
          </Section>
          <div className="space-y-4">
            <Section title="Glaze meter">
              <div className="flex items-end gap-2"><span className="num text-[36px] font-black text-gold">{glaze}%</span><span className="pb-2 text-[12px] text-muted">of the internet likes you · {Math.round((neg / s.characters.length) * 100)}% can&apos;t stand you</span></div>
              <div className="mt-2 flex h-3 overflow-hidden rounded-full">
                {[...counts.entries()].sort((a, b) => STANCE_INFO[b[0]].base - STANCE_INFO[a[0]].base).map(([k, n]) => <div key={k} title={`${STANCE_INFO[k].label}: ${n}`} style={{ width: `${(n / s.characters.length) * 100}%`, background: STANCE_INFO[k].color }} />)}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">{[...counts.entries()].map(([k, n]) => <span key={k}><span className="mr-1 inline-block size-2 rounded-full" style={{ background: STANCE_INFO[k].color }} />{STANCE_INFO[k].label} {n}</span>)}</div>
            </Section>
            <Section title="Recent moves">
              <div className="space-y-2">{p.history.slice(-8).reverse().map((h, i) => <div key={i} className="text-[13px]"><div>{h.text}</div><div className="text-[11px] text-muted">{relAgo(h.t, now)}</div></div>)}{!p.history.length && <button onClick={() => go("/god")} className="text-[13px] text-muted">No moves yet. Open GOD MODE and give them something to talk about.</button>}</div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
