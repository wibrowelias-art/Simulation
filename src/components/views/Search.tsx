"use client";
import { useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import type { Route } from "../App";
import { useApp } from "../store";
import { Avatar, NameLine, StanceChip, go, who } from "../ui";
import { PostCard } from "./Feed";
import { textAt } from "@/lib/sim/engine";
import { relTime } from "@/lib/sim/format";

export function SearchView({ route }: { route: Route }) {
  const { world: w, now } = useApp();
  const s = w!;
  const [q, setQ] = useState(route.query.get("q") ?? "");
  const t = q.trim().toLowerCase();
  const chars = t ? s.characters.filter((c) => c.username.includes(t) || c.displayName.toLowerCase().includes(t) || c.occupation.toLowerCase().includes(t) || c.location.toLowerCase().includes(t)).slice(0, 24) : [];
  const servers = t ? s.servers.filter((x) => x.name.toLowerCase().includes(t) || x.description.toLowerCase().includes(t)) : [];
  const topics = t ? s.topics.filter((x) => x.startedAt <= now && (x.tag.toLowerCase().includes(t) || x.label.toLowerCase().includes(t))).slice(-10).reverse() : [];
  const arts = t ? s.articles.filter((a) => a.t <= now && a.headline.toLowerCase().includes(t)).slice(-10).reverse() : [];
  const posts = t ? s.posts.filter((p) => p.t <= now && p.text.toLowerCase().includes(t)).slice(-20).reverse() : [];
  const msgs: typeof s.messages = [];
  if (t.length >= 2) for (let i = s.messages.length - 1; i >= 0 && msgs.length < 20; i--) { const m = s.messages[i]; if (m.t <= now && !m.deleted && m.serverId !== "dm" && m.kind !== "system" && textAt(m, now).toLowerCase().includes(t)) msgs.push(m); }
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-5 p-3 md:p-6">
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface-2 px-4 py-2.5">
          <SearchIcon className="size-5 text-muted" />
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); history.replaceState(null, "", `#/search?q=${encodeURIComponent(e.target.value)}`); }} placeholder="Search people, servers, trends, news, posts…" className="flex-1 bg-transparent outline-none" />
        </div>
        {!t && <p className="text-center text-[13px] text-muted">Try &quot;island&quot;, &quot;crypto&quot;, a city, or a job title.</p>}
        {chars.length > 0 && <Block title="People">{<div className="grid gap-2 sm:grid-cols-2">{chars.map((c) => { const x = who(s, c.id); return (
          <button key={c.id} onClick={() => go(`/u/${c.id}`)} className="panel flex items-center gap-3 p-3 text-left"><Avatar src={x.avatar} size={40} /><div className="min-w-0 flex-1"><NameLine w={x} /><div className="truncate text-[12px] text-muted">@{c.username} · {c.occupation} · {c.location}</div></div><StanceChip c={c} /></button>
        ); })}</div>}</Block>}
        {servers.length > 0 && <Block title="Servers">{servers.map((x) => <button key={x.id} onClick={() => go(`/lounge/${x.id}`)} className="panel mb-2 flex w-full items-center gap-3 p-3 text-left"><span className="grid size-10 place-items-center rounded-xl text-[20px]" style={{ background: x.color }}>{x.icon}</span><div><div className="font-semibold">{x.name}</div><div className="text-[12px] text-muted">{x.description}</div></div></button>)}</Block>}
        {topics.length > 0 && <Block title="Trends">{topics.map((x) => <button key={x.id} onClick={() => go(`/feed/tag/${x.tag}`)} className="mb-1 block text-left"><span className="font-semibold text-brand">#{x.tag}</span> <span className="text-[13px] text-muted">{x.label}</span></button>)}</Block>}
        {msgs.length > 0 && <Block title="Lounge messages"><div className="panel divide-y divide-line overflow-hidden">{msgs.map((m) => { const x = who(s, m.authorId); const srv = s.servers.find((v) => v.id === m.serverId); const ch = srv?.channels.find((c) => c.id === m.channelId); return (
          <button key={m.id} data-testid="search-msg" onClick={() => go(`/lounge/${m.serverId}/${m.channelId}?m=${m.id}`)} className="flex w-full items-start gap-3 p-3 text-left hover:bg-surface-2"><Avatar src={x.avatar} size={32} /><div className="min-w-0 flex-1"><div className="flex items-baseline gap-2 text-[12px] text-muted"><span className="font-semibold text-text">{x.name}</span><span className="truncate">{srv?.name} #{ch?.name}</span><span className="shrink-0">{relTime(m.t, now)}</span></div><div className="text-[14px] [overflow-wrap:anywhere]">{textAt(m, now)}</div></div></button>
        ); })}</div></Block>}
        {arts.length > 0 && <Block title="News">{arts.map((a) => <button key={a.id} onClick={() => go(`/news/${a.id}`)} className="mb-2 block text-left"><div className="text-[11px] text-muted">{s.outlets.find((o) => o.id === a.outletId)?.name}</div><div className="font-semibold">{a.headline}</div></button>)}</Block>}
        {posts.length > 0 && <Block title="Posts"><div className="panel overflow-hidden">{posts.map((p) => <PostCard key={p.id} s={s} p={p} now={now} compact onOpen={() => go(`/feed/post/${p.id}`)} />)}</div></Block>}
        {t && !chars.length && !servers.length && !topics.length && !arts.length && !posts.length && !msgs.length && <p className="text-center text-muted">No results.</p>}
      </div>
    </div>
  );
}
const Block = ({ title, children }: { title: string; children: React.ReactNode }) => <section><h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">{title}</h2>{children}</section>;
