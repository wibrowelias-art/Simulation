"use client";
import clsx from "clsx";
import { MemeImage } from "../MemeImage";
import { ArrowBigUp, Eye, Heart, MessageSquare, Play, Radio, X } from "lucide-react";
import { PostCard } from "./Chirp";
import type { Route } from "../App";
import { useApp } from "../store";
import { Avatar, NameLine, RichText, go, who } from "../ui";
import { fmtCount, relTime } from "@/lib/sim/format";
import type { PlatformId, Post, WorldState } from "@/lib/sim/types";

const PLATS: { id: PlatformId; name: string; blurb: string; color: string }[] = [
  { id: "snapgram", name: "Snapgram", blurb: "photos & stories", color: "#e0567b" },
  { id: "clipz", name: "Clipz", blurb: "short vertical video", color: "#35d0c3" },
  { id: "threadit", name: "Threadit", blurb: "forums & upvotes", color: "#ff7a3d" },
  { id: "tubeverse", name: "TubeVerse", blurb: "long-form video", color: "#f2555f" },
  { id: "wire", name: "Wire", blurb: "broadcast channels", color: "#4aa8ff" },
];

export function Platforms({ route }: { route: Route }) {
  const { world: w, now } = useApp();
  const s = w!;
  const pid = (PLATS.find((p) => p.id === route.parts[0]) ?? PLATS[0]).id;
  const posts = s.posts.filter((p) => p.platform === pid && p.t <= now && !p.replyTo).slice(-120).reverse();
  const openId = route.query.get("p") ?? undefined;
  return (
    <div className="flex h-full flex-col">
      <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto border-b border-line px-3 py-2">
        {PLATS.map((p) => (
          <button key={p.id} onClick={() => go(`/platforms/${p.id}`)} className={clsx("flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-semibold", pid === p.id ? "border-transparent text-white" : "border-line text-muted")} style={pid === p.id ? { background: p.color } : undefined}>
            {p.name}<span className="hidden text-[11px] font-normal opacity-80 sm:inline">{p.blurb}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3 md:p-5">
        {pid === "snapgram" && <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{posts.slice(0, 48).map((p) => <Open key={p.id} pid={pid} id={p.id}><Snap s={s} p={p} now={now} /></Open>)}</div>}
        {pid === "clipz" && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{posts.slice(0, 40).map((p) => <Open key={p.id} pid={pid} id={p.id}><Clip s={s} p={p} /></Open>)}</div>}
        {pid === "threadit" && <div className="mx-auto max-w-3xl space-y-2">{posts.slice(0, 60).map((p) => <Open key={p.id} pid={pid} id={p.id}><Thread s={s} p={p} now={now} /></Open>)}</div>}
        {pid === "tubeverse" && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{posts.slice(0, 36).map((p) => <Open key={p.id} pid={pid} id={p.id}><Tube s={s} p={p} now={now} /></Open>)}</div>}
        {pid === "wire" && <WireView s={s} posts={posts} now={now} />}
        {!posts.length && <div className="p-8 text-center text-muted">Quiet right now. Check back soon, the world keeps running.</div>}
      </div>
      {openId && <PostSheet s={s} id={openId} pid={pid} now={now} />}
    </div>
  );
}

function Open({ pid, id, children }: { pid: PlatformId; id: string; children: React.ReactNode }) {
  return <div role="button" tabIndex={0} onClick={() => go(`/platforms/${pid}?p=${id}`)} onKeyDown={(e) => { if (e.key === "Enter") go(`/platforms/${pid}?p=${id}`); }} className="block w-full cursor-pointer text-left transition-transform active:scale-[0.99]">{children}</div>;
}

function PostSheet({ s, id, pid, now }: { s: WorldState; id: string; pid: PlatformId; now: number }) {
  const p = s.posts.find((x) => x.id === id);
  const close = () => go(`/platforms/${pid}`);
  const replies = p ? s.posts.filter((x) => x.replyTo === id && x.t <= now).slice(-40) : [];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-[2px] md:items-center" onClick={close}>
      <div onClick={(e) => e.stopPropagation()} className="sheet-up max-h-[88vh] w-full max-w-[600px] overflow-y-auto rounded-t-3xl border border-line bg-surface md:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/95 px-3 py-2 backdrop-blur">
          <span className="text-[14px] font-bold">{PLATS.find((x) => x.id === pid)?.name}</span>
          <button aria-label="Close" onClick={close} className="grid size-10 place-items-center rounded-full hover:bg-surface-2"><X className="size-5" /></button>
        </div>
        {p ? <PostCard s={s} p={p} now={now} /> : <div className="p-6 text-muted">This post is gone.</div>}
        {replies.map((r) => <PostCard key={r.id} s={s} p={r} now={now} compact />)}
        {p && !replies.length && <div className="p-5 text-center text-[13px] text-muted">{p.replies ? "Older comments aren’t shown here. Reply from the card above to join in." : "No comments yet. Be the first."}</div>}
      </div>
    </div>
  );
}

const grad = (h: number) => `radial-gradient(circle at 30% 25%, hsl(${h} 75% 60%), hsl(${(h + 70) % 360} 65% 20%))`;

function Snap({ s, p, now }: { s: WorldState; p: Post; now: number }) {
  const a = who(s, p.authorId);
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-2 p-2"><Avatar src={a.avatar} size={26} /><NameLine w={a} className="text-[12px]" /><span className="ml-auto text-[10px] text-muted">{relTime(p.t, now)}</span></div>
      {p.media?.meme ? <MemeImage still m={p.media.meme} id={p.id} className="block aspect-square w-full overflow-hidden [&_svg]:block [&_svg]:h-full [&_svg]:w-full" /> : (
      <div className="relative aspect-square" style={{ background: grad(p.media?.hue ?? 200) }}>
        <span className="absolute bottom-2 left-2 rounded bg-black/50 px-1.5 text-[10px] text-white/80">#{p.media?.label}</span>
      </div>)}
      <div className="p-2.5 text-[12.5px]"><div className="mb-1 flex gap-3 text-muted"><span className="flex items-center gap-1"><Heart className="size-3.5" />{fmtCount(p.likes)}</span><span className="flex items-center gap-1"><MessageSquare className="size-3.5" />{fmtCount(p.replies)}</span></div><span className="font-semibold">{a.handle}</span> <span className="line-clamp-2"><RichText text={p.text} /></span></div>
    </div>
  );
}

function Clip({ s, p }: { s: WorldState; p: Post }) {
  const a = who(s, p.authorId);
  return (
    <div className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-line" style={{ background: grad(p.media?.hue ?? 160) }}>
      <Play className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-white/70" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2.5 pt-10 text-[12px] text-white">
        <div className="mb-1 flex items-center gap-1.5"><Avatar src={a.avatar} size={20} /><span className="truncate font-semibold">@{a.handle}</span></div>
        <div className="line-clamp-3">{p.text}</div>
        <div className="mt-1 flex items-center gap-1 text-white/70"><Eye className="size-3" />{fmtCount(p.views)}</div>
      </div>
    </div>
  );
}

function Thread({ s, p, now }: { s: WorldState; p: Post; now: number }) {
  const a = who(s, p.authorId);
  const score = Math.round(p.likes / 7 - p.replies / 3);
  return (
    <div className="panel flex gap-3 p-3">
      <div className="flex w-10 shrink-0 flex-col items-center text-[12px] font-bold"><ArrowBigUp className="size-5 text-[#ff7a3d]" /><span className="num">{fmtCount(score)}</span></div>
      <div className="min-w-0">
        <div className="text-[11px] text-muted"><span className="font-semibold text-fg">{p.community ?? "t/AskAnything"}</span> · posted by u/{a.handle} · {relTime(p.t, now)}</div>
        <div className="mt-0.5 font-semibold">{p.title ?? p.text.slice(0, 90)}</div>
        {p.title && <div className="mt-1 line-clamp-3 text-[13.5px] text-fg/85">{p.text}</div>}
        <div className="mt-1.5 text-[12px] text-muted">{fmtCount(p.replies)} comments</div>
      </div>
    </div>
  );
}

function Tube({ s, p, now }: { s: WorldState; p: Post; now: number }) {
  const a = who(s, p.authorId);
  const mins = 4 + (p.views % 37);
  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-xl border border-line" style={{ background: grad(p.media?.hue ?? 0) }}>
        <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1 text-[11px] text-white num">{mins}:{String(p.likes % 60).padStart(2, "0")}</span>
        <span className="absolute left-3 top-3 max-w-[80%] text-[18px] font-black uppercase leading-tight text-white [text-shadow:0_2px_0_#000]">{(p.title ?? p.text).split(" ").slice(0, 4).join(" ")}</span>
      </div>
      <div className="mt-2 flex gap-2.5">
        <Avatar src={a.avatar} size={34} />
        <div className="min-w-0"><div className="line-clamp-2 text-[14px] font-semibold">{p.title ?? p.text}</div><div className="text-[12px] text-muted">{a.name} · {fmtCount(p.views)} views · {relTime(p.t, now)}</div></div>
      </div>
    </div>
  );
}

function WireView({ s, posts, now }: { s: WorldState; posts: Post[]; now: number }) {
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      {posts.slice(0, 50).map((p) => { const a = who(s, p.authorId); return (
        <div key={p.id} className="flex gap-3">
          <Avatar src={a.avatar} size={38} />
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-surface-3 px-3.5 py-2.5">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#4aa8ff]"><Radio className="size-3.5" />{a.name}&apos;s channel</div>
            <div className="mt-0.5 whitespace-pre-wrap text-[14px]"><RichText text={p.text} /></div>
            <div className="mt-1 flex justify-end gap-2 text-[10px] text-muted"><span className="flex items-center gap-0.5"><Eye className="size-3" />{fmtCount(p.views)}</span>{relTime(p.t, now)}</div>
          </div>
        </div>
      ); })}
    </div>
  );
}
