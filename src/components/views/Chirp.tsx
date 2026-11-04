"use client";
import clsx from "clsx";
import { MemeImage } from "../MemeImage";
import { memo, useState } from "react";
import { haptic } from "../App";
import { ArrowLeft, BarChart2, Heart, MessageCircle, Repeat2, Info, Flame, Play, Quote, Image as ImageIcon } from "lucide-react";
import type { Route } from "../App";
import { doPost, doPostAction, useApp } from "../store";
import { Avatar, NameLine, RichText, go, who } from "../ui";
import { trending } from "@/lib/sim/engine";
import { fmtCount, relTime } from "@/lib/sim/format";
import type { Post, WorldState } from "@/lib/sim/types";

export const visiblePosts = (s: WorldState, now: number) => s.posts.filter((p) => p.t <= now);

type CardProps = { s: WorldState; p: Post; now: number; compact?: boolean; onOpen?: () => void };
/** Posts are mutated in place as engagement grows, so the memo key is a signature of what the card shows. */
export function PostCard(props: CardProps) {
  const { p, now } = props;
  const sig = `${p.likes}|${p.reposts}|${p.replies}|${p.views}|${p.godLiked ? 1 : 0}|${p.godReposted ? 1 : 0}|${p.communityNote ? 1 : 0}|${relTime(p.t, now)}|${now - p.t < 5000 ? 1 : 0}`;
  return <PostCardMemo {...props} sig={sig} />;
}
const PostCardMemo = memo(PostCardImpl, (a, b) => a.sig === b.sig && a.p === b.p && a.s === b.s && a.compact === b.compact);
function PostCardImpl({ s, p, now, compact, onOpen }: CardProps & { sig: string }) {
  const a = who(s, p.authorId);
  const quoted = p.quoteOf ? s.posts.find((x) => x.id === p.quoteOf && x.t <= now) : undefined;
  const parent = p.replyTo ? s.posts.find((x) => x.id === p.replyTo) : undefined;
  const article = p.authorId.startsWith("o-") && p.title ? s.articles.find((x) => x.id === p.title) : undefined;
  const fresh = now - p.t < 5000;
  return (
    <article onClick={onOpen} className={clsx("cursor-pointer border-b border-line px-4 py-3 transition hover:bg-surface-2/50", fresh && "msg-in", p.authorId === "god" && "bg-gold/[0.04]")}>
      {parent && <div className="mb-1 ml-12 text-[12px] text-muted">Replying to <span className="text-brand">@{who(s, parent.authorId).handle}</span></div>}
      <div className="flex gap-3">
        <button aria-label={`${a.name}'s profile`} className="shrink-0 self-start" onClick={(e) => { e.stopPropagation(); if (a.kind === "char") go(`/u/${a.id}`); }}><Avatar src={a.avatar} size={40} ring={a.kind === "god" ? "var(--gold)" : undefined} /></button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[14px]">
            <NameLine w={a} />
            <span className="truncate text-muted">@{a.handle} · {relTime(p.t, now)}</span>
          </div>
          {p.breaking && <div className="mt-1 inline-flex items-center gap-1 rounded bg-down px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">BREAKING</div>}
          {p.title && !article && <div className="mt-0.5 text-[15px] font-semibold">{p.title}</div>}
          <div className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-snug"><RichText text={p.text} onTag={(t) => go(`/chirp/tag/${t}`)} onUser={(h) => { const c = s.characters.find((x) => x.username === h); if (c) go(`/u/${c.id}`); }} /></div>
          {article && (
            <button onClick={(e) => { e.stopPropagation(); go(`/news/${article.id}`); }} className="mt-2 block w-full overflow-hidden rounded-xl border border-line text-left">
              <div className="h-24 w-full" style={{ background: `linear-gradient(135deg, ${a.color ?? "#333"}, #000)` }} />
              <div className="p-3"><div className="text-[12px] text-muted">{a.name}</div><div className="text-[14px] font-semibold">{article.headline}</div></div>
            </button>
          )}
          {p.media && !compact && <Media m={p.media} id={p.id} />}
          {quoted && (
            <div className="mt-2 rounded-xl border border-line p-3" onClick={(e) => { e.stopPropagation(); go(`/chirp/post/${quoted.id}`); }}>
              <div className="flex items-center gap-1.5 text-[13px]"><Avatar src={who(s, quoted.authorId).avatar} size={18} /><NameLine w={who(s, quoted.authorId)} /><span className="text-muted">@{who(s, quoted.authorId).handle}</span></div>
              <div className="mt-1 line-clamp-3 text-[14px]">{quoted.text}</div>
            </div>
          )}
          {p.communityNote && (
            <div className="mt-2 rounded-xl border border-line bg-surface-2 p-3 text-[13px]">
              <div className="mb-1 flex items-center gap-1.5 font-semibold"><Info className="size-4 text-brand" /> Readers added context</div>
              <div className="text-muted">{p.communityNote.replace(/^Readers added context:\s*/, "")}</div>
            </div>
          )}
          <div className="-ml-2 mt-1 flex max-w-md justify-between text-[12px] text-muted">
            <Act label={`Reply, ${p.replies} replies`} onClick={() => go(`/chirp/post/${p.id}?compose=reply`)} className="hover:text-brand"><MessageCircle className="size-[17px]" />{fmtCount(p.replies)}</Act>
            <Act label={p.godReposted ? "Undo repost" : "Repost"} pressed={p.godReposted} onClick={() => { haptic(8); doPostAction(p.id, "repost"); }} className={p.godReposted ? "text-up" : "hover:text-up"}><Repeat2 className="size-[17px]" />{fmtCount(p.reposts)}</Act>
            <Act label={p.godLiked ? "Unlike" : "Like"} pressed={p.godLiked} onClick={() => { haptic(8); doPostAction(p.id, "like"); }} className={p.godLiked ? "text-down" : "hover:text-down"}><Heart className={clsx("size-[17px]", p.godLiked && "react-pop fill-current")} />{fmtCount(p.likes)}</Act>
            <Act label="Quote" onClick={() => go(`/chirp/post/${p.id}?compose=quote`)} className="hover:text-brand"><Quote className="size-[16px]" /></Act>
            <span className="flex min-h-10 items-center gap-1 px-2" aria-label={`${p.views} views`}><BarChart2 className="size-4" />{fmtCount(p.views)}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function Act({ label, onClick, pressed, className, children }: { label: string; onClick: () => void; pressed?: boolean; className?: string; children: React.ReactNode }) {
  return <button aria-label={label} aria-pressed={pressed} onClick={(e) => { e.stopPropagation(); onClick(); }} className={clsx("flex min-h-10 min-w-10 items-center gap-1 rounded-full px-2 transition-colors active:scale-95", className)}>{children}</button>;
}

function Media({ m, id }: { m: NonNullable<Post["media"]>; id?: string }) {
  if (m.meme) return <MemeImage m={m.meme} id={id ?? "p"} className="mt-2 block w-full max-w-[420px] overflow-hidden rounded-xl border border-line [&_svg]:block [&_svg]:h-auto [&_svg]:w-full" />;
  return (
    <div className="relative mt-2 grid h-44 place-items-center overflow-hidden rounded-xl border border-line" style={{ background: `radial-gradient(circle at 30% 30%, hsl(${m.hue} 70% 55%), hsl(${(m.hue + 60) % 360} 60% 18%))` }}>
      {m.kind === "video" ? <Play className="size-10 text-white/80" /> : m.kind === "meme" ? <span className="px-6 text-center text-[20px] font-black uppercase text-white [text-shadow:0_2px_0_#000]">{m.label}</span> : <ImageIcon className="size-8 text-white/50" />}
    </div>
  );
}

export function TrendingPanel({ s, now, limit = 10 }: { s: WorldState; now: number; limit?: number }) {
  const tr = trending(s, now, limit);
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between px-4 pb-2 pt-3"><h3 className="text-[17px] font-bold">Trending</h3></div>
      {tr.map((t) => (
        <button key={t.topic.id} onClick={() => go(`/chirp/tag/${t.topic.tag}`)} className="block w-full px-4 py-2.5 text-left hover:bg-surface-2">
          <div className="flex items-center gap-1 text-[11px] text-muted">{t.rank} · {t.topic.about === "god" ? "Trending with @god" : t.topic.category}{t.topic.breaking && <span className="ml-1 rounded bg-down px-1 text-[9px] font-bold text-white">BREAKING</span>}</div>
          <div className={clsx("break-all font-semibold", t.topic.about === "god" && "text-gold")}>#{t.topic.tag}</div>
          <div className="flex items-center gap-1 text-[11px] text-muted"><Flame className="size-3" />{fmtCount(t.posts)} posts</div>
        </button>
      ))}
    </div>
  );
}

export function Chirp({ route }: { route: Route }) {
  const { world: w, now } = useApp();
  const s = w!;
  const [tab, setTab] = useState<"foryou" | "god" | "breaking">("foryou");
  const [text, setText] = useState("");
  const [n, setN] = useState(60);
  const tag = route.parts[0] === "tag" ? route.parts[1] : undefined;
  const postId = route.parts[0] === "post" ? route.parts[1] : undefined;
  const all = visiblePosts(s, now).filter((p) => p.platform === "chirp");
  const topic = tag ? s.topics.find((t) => t.tag === tag) : undefined;

  const feed = (() => {
    let f = all;
    if (tag) f = f.filter((p) => (topic && p.topicId === topic.id) || p.text.includes(`#${tag}`) || p.text.includes(`$${tag}`));
    else if (tab === "god") f = f.filter((p) => p.authorId === "god" || /@god\b/i.test(p.text) || s.topics.find((t) => t.id === p.topicId)?.about === "god");
    else if (tab === "breaking") f = f.filter((p) => p.breaking || p.authorId.startsWith("o-") || (p.likes > 20000));
    return f.slice(-400).reverse().slice(0, n);
  })();

  if (postId) return <PostDetail s={s} id={postId} now={now} compose={route.query.get("compose") as "reply" | "quote" | null} />;

  const post = () => { if (!text.trim()) return; haptic(10); doPost("chirp", text.trim()); setText(""); setTab("foryou"); };
  return (
    <div className="flex h-full justify-center overflow-y-auto">
      <div className="w-full max-w-[620px] border-x border-line">
        <div className="glass sticky top-0 z-10 border-b border-line">
          {tag ? (
            <div className="flex items-center gap-3 px-4 py-3">
              <button aria-label="Back" className="grid size-9 place-items-center rounded-full hover:bg-surface-2" onClick={() => go("/chirp")}><ArrowLeft className="size-5" /></button>
              <div><div className={clsx("text-[17px] font-bold", topic?.about === "god" && "text-gold")}>#{tag}</div><div className="text-[12px] text-muted">{topic ? topic.label : "search"}</div></div>
            </div>
          ) : (
            <div className="flex">
              {(["foryou", "god", "breaking"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={clsx("flex-1 py-3.5 text-[14px] font-semibold", tab === t ? "text-fg" : "text-muted")}>
                  <span className={clsx("pb-3", tab === t && "border-b-4 border-brand")}>{t === "foryou" ? "For you" : t === "god" ? "@god" : "Breaking"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {!tag && (
          <div className="flex gap-3 border-b border-line px-4 py-3">
            <Avatar src={who(s, "god").avatar} size={40} ring="var(--gold)" />
            <div className="flex-1">
              <textarea aria-label="Write a post" value={text} onChange={(e) => setText(e.target.value)} maxLength={280} rows={2} placeholder="What's happening, God?" className="w-full resize-none bg-transparent text-[17px] outline-none placeholder:text-muted" />
              <div className="flex items-center justify-between"><span className="text-[11px] text-muted">{280 - text.length}</span><button onClick={post} disabled={!text.trim()} className="btn btn-gold rounded-full disabled:opacity-40">Post</button></div>
            </div>
          </div>
        )}
        {feed.map((p) => <PostCard key={p.id} s={s} p={p} now={now} onOpen={() => go(`/chirp/post/${p.id}`)} />)}
        {feed.length === n && <button onClick={() => setN(n + 60)} className="w-full py-4 text-[13px] text-brand">Show more</button>}
        {!feed.length && <div className="p-8 text-center text-muted">Nothing here yet.</div>}
      </div>
      <div className="sticky top-0 hidden w-[340px] shrink-0 space-y-4 self-start p-4 lg:block">
        <TrendingPanel s={s} now={now} />
        <WhoToFollow s={s} />
      </div>
    </div>
  );
}

function WhoToFollow({ s }: { s: WorldState }) {
  const list = s.characters.filter((c) => c.influencer).sort((a, b) => b.followers - a.followers).slice(0, 4);
  return (
    <div className="panel p-4">
      <h3 className="mb-2 text-[17px] font-bold">Big accounts</h3>
      {list.map((c) => { const x = who(s, c.id); return (
        <button key={c.id} onClick={() => go(`/u/${c.id}`)} className="flex w-full items-center gap-2 py-2 text-left">
          <Avatar src={x.avatar} size={36} />
          <div className="min-w-0 flex-1"><NameLine w={x} className="text-[14px]" /><div className="truncate text-[12px] text-muted">@{c.username} · {fmtCount(c.followers)}</div></div>
        </button>
      ); })}
    </div>
  );
}

function PostDetail({ s, id, now, compose }: { s: WorldState; id: string; now: number; compose: "reply" | "quote" | null }) {
  const [text, setText] = useState("");
  const p = s.posts.find((x) => x.id === id);
  if (!p) return <div className="p-8 text-muted">Post not found (it may have been deleted).</div>;
  const replies = s.posts.filter((x) => x.replyTo === id && x.t <= now);
  const quotes = s.posts.filter((x) => x.quoteOf === id && x.t <= now);
  const mode = compose ?? "reply";
  const send = () => {
    const t = text.trim();
    if (!t) return;
    haptic(10);
    if (mode === "quote") { doPost("chirp", t, p.id); setText(""); go("/chirp"); }
    else { doPost("chirp", t, undefined, p.id); setText(""); }
  };
  return (
    <div className="flex h-full justify-center overflow-y-auto">
      <div className="w-full max-w-[620px] border-x border-line">
        <div className="glass sticky top-0 z-10 flex items-center gap-3 border-b border-line px-4 py-2"><button aria-label="Back" className="grid size-10 place-items-center rounded-full hover:bg-surface-2" onClick={() => history.back()}><ArrowLeft className="size-5" /></button><span className="font-bold">Post</span></div>
        <PostCard s={s} p={p} now={now} />
        <div className="flex gap-3 border-b border-line px-4 py-3">
          <Avatar src={who(s, "god").avatar} size={36} ring="var(--gold)" />
          <div className="flex-1">
            <div className="mb-1 flex gap-1.5 text-[12px]">
              {(["reply", "quote"] as const).map((m) => <button key={m} onClick={() => go(`/chirp/post/${p.id}?compose=${m}`)} className={clsx("min-h-8 rounded-full px-3 font-semibold", mode === m ? "bg-brand/20 text-brand" : "bg-surface-3 text-muted")}>{m === "reply" ? "Reply" : "Quote"}</button>)}
            </div>
            <textarea autoFocus={!!compose} aria-label={mode === "quote" ? "Quote post" : "Reply"} value={text} onChange={(e) => setText(e.target.value)} maxLength={280} rows={2} placeholder={mode === "quote" ? "Add a comment" : `Reply to @${who(s, p.authorId).handle}`} className="w-full resize-none bg-transparent text-[16px] outline-none placeholder:text-muted" />
            <div className="flex items-center justify-between"><span className="text-[11px] text-muted">{280 - text.length}</span><button onClick={send} disabled={!text.trim()} className="btn btn-gold rounded-full disabled:opacity-40">{mode === "quote" ? "Quote" : "Reply"}</button></div>
          </div>
        </div>
        {quotes.length > 0 && <div className="border-b border-line px-4 py-2 text-[13px] font-semibold text-muted">Quotes · {quotes.length}</div>}
        {quotes.map((q) => <PostCard key={q.id} s={s} p={q} now={now} onOpen={() => go(`/chirp/post/${q.id}`)} />)}
        <div className="border-b border-line px-4 py-2 text-[13px] font-semibold text-muted">Replies · {replies.length}</div>
        {replies.map((q) => <PostCard key={q.id} s={s} p={q} now={now} onOpen={() => go(`/chirp/post/${q.id}`)} />)}
        {!replies.length && <div className="p-6 text-center text-[13px] text-muted">No replies yet.</div>}
      </div>
    </div>
  );
}
