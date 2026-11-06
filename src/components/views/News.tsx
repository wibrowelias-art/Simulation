"use client";
import clsx from "clsx";
import { useState } from "react";
import { ArrowLeft, Clock, Eye, Heart } from "lucide-react";
import type { Route } from "../App";
import { useApp } from "../store";
import { Avatar, NameLine, go, who } from "../ui";
import { clockTime, fmtCount, relTime } from "@/lib/sim/format";
import type { Article, WorldState } from "@/lib/sim/types";

const KIND: Record<string, string> = { breaking: "BREAKING", report: "Report", opinion: "Opinion", rumor: "Rumor mill", financial: "Markets", interview: "Interview", investigation: "Investigation" };

export function News({ route }: { route: Route }) {
  const { world: w, now } = useApp();
  const s = w!;
  const [outlet, setOutlet] = useState<string | null>(null);
  if (route.parts[0]) return <ArticleView s={s} id={route.parts[0]} now={now} />;
  const arts = s.articles.filter((a) => a.t <= now && (!outlet || a.outletId === outlet)).slice().reverse();
  const hero = arts.find((a) => a.kind === "breaking" && now - a.t < 6 * 3600e3) ?? arts[0];
  const rest = arts.filter((a) => a !== hero);
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl p-3 md:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h1 className="mr-2 text-[22px] font-black tracking-tight">Newsstand</h1>
          <button onClick={() => setOutlet(null)} className={clsx("rounded-full border px-3 py-1 text-[12px]", !outlet ? "border-fg text-fg" : "border-line text-muted")}>All</button>
          {s.outlets.map((o) => (
            <button key={o.id} onClick={() => setOutlet(o.id)} className={clsx("rounded-full border px-3 py-1 text-[12px] font-semibold", outlet === o.id ? "text-white" : "border-line text-muted")} style={outlet === o.id ? { background: o.color, borderColor: o.color } : undefined}>{o.name}</button>
          ))}
        </div>
        {hero && <Hero s={s} a={hero} now={now} />}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rest.slice(0, 60).map((a) => <Card key={a.id} s={s} a={a} now={now} />)}
        </div>
      </div>
    </div>
  );
}

const outletOf = (s: WorldState, a: Article) => s.outlets.find((o) => o.id === a.outletId)!;
const cover = (a: Article, color: string) => `linear-gradient(135deg, ${color}, #050505 70%), radial-gradient(circle at 80% 20%, #ffffff22, transparent 40%)`;

function Hero({ s, a, now }: { s: WorldState; a: Article; now: number }) {
  const o = outletOf(s, a);
  return (
    <button onClick={() => go(`/news/${a.id}`)} className="panel group relative block w-full overflow-hidden text-left">
      <div className="h-56 md:h-72" style={{ background: cover(a, o.color) }} />
      <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black via-black/60 to-transparent p-5 md:p-8">
        <div className="mb-2 flex items-center gap-2 text-[12px]">
          {a.kind === "breaking" && <span className="breaking-pulse rounded bg-down px-2 py-0.5 font-bold text-white">BREAKING</span>}
          <span className="font-bold" style={{ color: o.color }}>{o.name}</span><span className="text-white/60">· {relTime(a.t, now)}</span>
        </div>
        <h2 className="max-w-3xl text-[24px] font-black leading-tight text-white group-hover:underline md:text-[34px]">{a.headline}</h2>
        <p className="mt-2 max-w-2xl text-[14px] text-white/75">{a.dek}</p>
      </div>
    </button>
  );
}

function Card({ s, a, now }: { s: WorldState; a: Article; now: number }) {
  const o = outletOf(s, a);
  return (
    <button onClick={() => go(`/news/${a.id}`)} className="panel group flex flex-col overflow-hidden text-left transition hover:-translate-y-0.5">
      <div className="h-28" style={{ background: cover(a, o.color) }} />
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-1 flex items-center gap-2 text-[11px]"><span className="font-bold" style={{ color: o.color }}>{o.short}</span><span className="text-muted">{KIND[a.kind]}</span><span className="ml-auto text-muted">{relTime(a.t, now)}</span></div>
        <h3 className="font-bold leading-snug group-hover:underline">{a.headline}</h3>
        <p className="mt-1 line-clamp-2 text-[13px] text-muted">{a.dek}</p>
        <div className="mt-auto flex gap-3 pt-3 text-[11px] text-muted"><span className="flex items-center gap-1"><Eye className="size-3" />{fmtCount(a.reads)}</span><span>{a.comments.length} comments</span></div>
      </div>
    </button>
  );
}

function ArticleView({ s, id, now }: { s: WorldState; id: string; now: number }) {
  const a = s.articles.find((x) => x.id === id);
  if (!a) return <div className="p-8 text-muted">Article not found.</div>;
  const o = outletOf(s, a);
  const role = o.authors.find((x) => x.name === a.author)?.role;
  const comments = a.comments.filter((c) => c.t <= now);
  return (
    <div className="h-full overflow-y-auto">
      <div className="border-b border-line" style={{ background: `linear-gradient(90deg, ${o.color}33, transparent)` }}>
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button onClick={() => go("/news")}><ArrowLeft className="size-5" /></button>
          <span className="text-[18px] font-black tracking-tight" style={{ color: o.color }}>{o.name}</span>
          <span className="hidden text-[12px] text-muted sm:inline">{o.tagline}</span>
        </div>
      </div>
      <article className="mx-auto max-w-3xl px-4 py-6 md:py-10">
        <div className="mb-3 flex items-center gap-2 text-[12px]">
          {a.kind === "breaking" ? <span className="breaking-pulse rounded bg-down px-2 py-0.5 font-bold text-white">BREAKING</span> : <span className="font-semibold uppercase tracking-wider" style={{ color: o.color }}>{KIND[a.kind]}</span>}
        </div>
        <h1 className="text-[30px] font-black leading-[1.1] tracking-tight md:text-[42px]">{a.headline}</h1>
        <p className="mt-3 text-[18px] text-muted">{a.dek}</p>
        <div className="mt-5 flex items-center gap-3 border-y border-line py-3 text-[13px]">
          <div className="grid size-9 place-items-center rounded-full text-[13px] font-bold text-white" style={{ background: o.color }}>{a.author.split(" ").map((x) => x[0]).join("")}</div>
          <div><div className="font-semibold">{a.author}</div><div className="text-[12px] text-muted">{role ?? "Staff"} · {o.name}</div></div>
          <div className="ml-auto text-right text-[12px] text-muted"><div className="flex items-center justify-end gap-1"><Clock className="size-3" />{clockTime(a.t)} · {relTime(a.t, now)}</div><div className="flex items-center justify-end gap-1"><Eye className="size-3" />{fmtCount(a.reads)} reads</div></div>
        </div>
        <div className="my-6 h-56 rounded-xl md:h-80" style={{ background: cover(a, o.color) }} />
        <div className="space-y-4 text-[17px] leading-relaxed text-fg/90">{a.body.map((p, i) => <p key={i}>{p}</p>)}</div>
        <div className="mt-6 flex flex-wrap gap-2">{a.reactions.map((r) => <span key={r.emoji} className="rounded-full border border-line bg-surface-2 px-3 py-1 text-[14px]">{r.emoji} <span className="num text-[12px] text-muted">{fmtCount(r.count)}</span></span>)}</div>
        <h3 className="mb-3 mt-8 text-[15px] font-bold">{comments.length} comments</h3>
        <div className="space-y-4">
          {comments.map((c, i) => { const x = who(s, c.authorId); return (
            <div key={i} className="flex gap-3">
              <button onClick={() => go(`/u/${x.id}`)}><Avatar src={x.avatar} size={34} /></button>
              <div className="min-w-0"><div className="flex items-center gap-2 text-[13px]"><NameLine w={x} /><span className="text-muted">@{x.handle} · {relTime(c.t, now)}</span></div><div className="text-[14.5px]">{c.text}</div><div className="mt-1 flex items-center gap-1 text-[11px] text-muted"><Heart className="size-3" />{c.likes}</div></div>
            </div>
          ); })}
        </div>
      </article>
    </div>
  );
}
