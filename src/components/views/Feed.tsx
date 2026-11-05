"use client";
import clsx from "clsx";
import { MemeImage } from "../MemeImage";
import { memo, useEffect, useRef, useState } from "react";
import { haptic } from "../App";
import { ArrowLeft, BarChart2, Heart, MessageCircle, Repeat2, Info, Play, Quote, Image as ImageIcon, Home as HomeIcon, Search as SearchIcon, User, Feather, TrendingUp, TrendingDown } from "lucide-react";
import type { Route } from "../App";
import { doPost, doPostAction, useApp } from "../store";
import { Avatar, NameLine, RichText, go, showHandle, who } from "../ui";
import { Sheet } from "../sheet";
import { trending } from "@/lib/sim/engine";
import { fmtCount, relTime } from "@/lib/sim/format";
import { APP } from "@/lib/brand";
import type { Post, Topic, WorldState } from "@/lib/sim/types";

export const visiblePosts = (s: WorldState, now: number) => s.posts.filter((p) => p.t <= now);
const feedPosts = (s: WorldState, now: number) => s.posts.filter((p) => p.t <= now && p.platform === "chirp");
const MAX = 280;

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
  const openUser = (h: string) => { const c = s.characters.find((x) => x.username === h); if (c) go(`/u/${c.id}`); };
  return (
    <article onClick={onOpen} className={clsx("cursor-pointer border-b border-[var(--border)] px-4 py-3 transition-colors active:bg-surface md:hover:bg-surface/60", fresh && "msg-in")}>
      {parent && <div className="mb-1 ml-[52px] text-[13px] text-muted">Replying to <span className="text-accent">@{who(s, parent.authorId).handle}</span></div>}
      <div className="flex gap-3">
        <button aria-label={`${a.name}'s profile`} className="shrink-0 self-start" onClick={(e) => { e.stopPropagation(); if (a.kind === "char") go(`/u/${a.id}`); else if (a.kind === "god") go("/feed/you"); }}><Avatar src={a.avatar} size={40} /></button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1 text-[15px]">
            <NameLine w={a} className="text-[var(--header)]" />
            <span className="truncate text-muted">@{a.handle}</span>
            <span className="shrink-0 text-muted">· {relTime(p.t, now)}</span>
          </div>
          {p.breaking && <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-down/15 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-down">Breaking</div>}
          {p.title && !article && <div className="mt-0.5 text-[15px] font-semibold text-[var(--header)]">{p.title}</div>}
          <div className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-[1.4] text-fg"><RichText text={p.text} onTag={(t) => go(`/feed/tag/${t}`)} onUser={openUser} /></div>
          {article && (
            <button onClick={(e) => { e.stopPropagation(); go(`/news/${article.id}`); }} className="mt-2 block w-full overflow-hidden rounded-2xl border border-[var(--border)] text-left">
              <div className="h-24 w-full" style={{ background: `linear-gradient(135deg, ${a.color ?? "#333"}, #0b0c0e)` }} />
              <div className="p-3"><div className="text-[12px] text-muted">{a.name}</div><div className="text-[15px] font-semibold text-[var(--header)]">{article.headline}</div></div>
            </button>
          )}
          {p.media && !compact && <Media m={p.media} id={p.id} />}
          {quoted && (
            <div className="mt-2 rounded-2xl border border-[var(--border)] p-3" onClick={(e) => { e.stopPropagation(); go(`/feed/post/${quoted.id}`); }}>
              <div className="flex items-center gap-1.5 text-[13px]"><Avatar src={who(s, quoted.authorId).avatar} size={18} /><NameLine w={who(s, quoted.authorId)} /><span className="truncate text-muted">@{who(s, quoted.authorId).handle}</span></div>
              <div className="mt-1 line-clamp-3 text-[14px]">{showHandle(quoted.text)}</div>
            </div>
          )}
          {p.communityNote && (
            <div className="mt-2 rounded-2xl border border-[var(--border)] bg-surface p-3 text-[13px]">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-[var(--header)]"><Info className="size-4 text-accent" /> Context from readers</div>
              <div className="text-muted">{p.communityNote.replace(/^Readers added context:\s*/, "")}</div>
            </div>
          )}
          <div className="-ml-2 mt-1 flex max-w-md justify-between text-[13px] text-muted">
            <Act label={`Reply, ${p.replies} replies`} onClick={() => go(`/feed/post/${p.id}?compose=reply`)} className="md:hover:text-accent"><MessageCircle className="size-[18px]" /><span className="num">{fmtCount(p.replies)}</span></Act>
            <Act label={p.godReposted ? "Undo repost" : "Repost"} pressed={p.godReposted} onClick={() => { haptic(8); doPostAction(p.id, "repost"); }} className={p.godReposted ? "text-up" : "md:hover:text-up"}><Repeat2 className="size-[18px]" /><span className="num">{fmtCount(p.reposts)}</span></Act>
            <Act label={p.godLiked ? "Unlike" : "Like"} pressed={p.godLiked} onClick={() => { haptic(8); doPostAction(p.id, "like"); }} className={p.godLiked ? "text-down" : "md:hover:text-down"}><Heart className={clsx("size-[18px]", p.godLiked && "react-pop fill-current")} /><span className="num">{fmtCount(p.likes)}</span></Act>
            <Act label="Quote" onClick={() => go(`/feed/post/${p.id}?compose=quote`)} className="md:hover:text-accent"><Quote className="size-[17px]" /></Act>
            <span className="flex min-h-11 items-center gap-1 px-2" aria-label={`${p.views} views`}><BarChart2 className="size-4" /><span className="num">{fmtCount(p.views)}</span></span>
          </div>
        </div>
      </div>
    </article>
  );
}

function Act({ label, onClick, pressed, className, children }: { label: string; onClick: () => void; pressed?: boolean; className?: string; children: React.ReactNode }) {
  return <button aria-label={label} aria-pressed={pressed} onClick={(e) => { e.stopPropagation(); onClick(); }} className={clsx("flex min-h-11 min-w-11 items-center gap-1 rounded-full px-2 transition-[color,transform] active:scale-90", className)}>{children}</button>;
}

function Media({ m, id }: { m: NonNullable<Post["media"]>; id?: string }) {
  if (m.meme) return <MemeImage m={m.meme} id={id ?? "p"} className="mt-2 block w-full max-w-[420px] overflow-hidden rounded-2xl border border-[var(--border)] [&_svg]:block [&_svg]:h-auto [&_svg]:w-full" />;
  return (
    <div className="relative mt-2 grid h-44 place-items-center overflow-hidden rounded-2xl border border-[var(--border)]" style={{ background: `radial-gradient(circle at 30% 30%, hsl(${m.hue} 70% 55%), hsl(${(m.hue + 60) % 360} 60% 18%))` }}>
      {m.kind === "video" ? <Play className="size-10 text-white/80" /> : m.kind === "meme" ? <span className="px-6 text-center text-[20px] font-black uppercase text-white [text-shadow:0_2px_0_#000]">{m.label}</span> : <ImageIcon className="size-8 text-white/50" />}
    </div>
  );
}

const TRADE_CATS = new Set(["trade", "tradeWin", "tradeLoss", "market", "crypto", "coin"]);
function trendContext(t: Topic) {
  if (t.about === "god") return t.category === "tradeLoss" ? "About you · rough trade" : t.category === "tradeWin" ? "About you · winning trade" : t.category === "trade" ? "About you · trade" : "About you";
  if (t.facts?.real) return "Markets · live price move";
  if (TRADE_CATS.has(t.category)) return "Markets";
  return t.category.charAt(0).toUpperCase() + t.category.slice(1);
}

/** Trends from the shared world: your trades, real price moves and the rest of the timeline. */
export function TrendingPanel({ s, now, limit = 10, flat }: { s: WorldState; now: number; limit?: number; flat?: boolean }) {
  const tr = trending(s, now, limit);
  return (
    <section aria-label="Trends" className={clsx(!flat && "overflow-hidden rounded-2xl bg-surface")}>
      <h2 className="px-4 pb-1 pt-3 text-[20px] font-extrabold text-[var(--header)]">Trends</h2>
      {!tr.length && <p className="px-4 py-6 text-[14px] text-muted">Quiet right now. Make a trade and see who notices.</p>}
      {tr.map((t) => {
        const up = t.topic.valence >= 0;
        return (
          <button key={t.topic.id} onClick={() => go(`/feed/tag/${t.topic.tag}`)} className="flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-2 md:hover:bg-surface-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] text-muted">{t.rank} · {trendContext(t.topic)}{t.topic.breaking && <span className="ml-1.5 rounded bg-down/15 px-1 text-[10px] font-bold text-down">Breaking</span>}</span>
              <span className={clsx("block truncate text-[16px] font-bold", t.topic.about === "god" ? "text-accent" : "text-[var(--header)]")}>#{t.topic.tag}</span>
              <span className="num block text-[12px] text-muted">{fmtCount(t.posts)} posts</span>
            </span>
            {t.topic.about === "god" && TRADE_CATS.has(t.topic.category) && (up ? <TrendingUp className="size-5 text-up" /> : <TrendingDown className="size-5 text-down" />)}
          </button>
        );
      })}
    </section>
  );
}

type Tab = "home" | "explore" | "you";

/** Murmur: the timeline everyone in this world posts to, including about your trades. */
export function Murmur({ route }: { route: Route }) {
  const { world: w, now } = useApp();
  const s = w!;
  const [composing, setComposing] = useState(false);
  const tag = route.parts[0] === "tag" ? route.parts[1] : undefined;
  const postId = route.parts[0] === "post" ? route.parts[1] : undefined;
  if (postId) return <PostDetail s={s} id={postId} now={now} compose={route.query.get("compose") as "reply" | "quote" | null} />;
  if (tag) return <TagPage s={s} tag={tag} now={now} />;
  const tab: Tab = route.parts[0] === "explore" ? "explore" : route.parts[0] === "you" ? "you" : "home";
  return (
    <div className="relative flex h-full flex-col bg-bg">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1000px] justify-center">
          <div className="w-full max-w-[600px] md:border-x md:border-[var(--border)]">
            {tab === "home" ? <HomeTab s={s} now={now} /> : tab === "explore" ? <ExploreTab s={s} now={now} /> : <YouTab s={s} now={now} />}
          </div>
          <aside className="sticky top-0 hidden w-[340px] shrink-0 space-y-4 self-start p-4 lg:block">
            <TrendingPanel s={s} now={now} />
            <WhoToFollow s={s} />
          </aside>
        </div>
      </div>
      <button aria-label="New post" onClick={() => { haptic(8); setComposing(true); }} className="absolute bottom-[76px] right-4 z-10 grid size-14 place-items-center rounded-full bg-accent text-accent-ink shadow-[0_8px_24px_rgb(0_0_0/.5)] transition-transform active:scale-90"><Feather className="size-6" /></button>
      <nav aria-label="Murmur tabs" className="flex shrink-0 border-t border-[var(--border)] bg-bg">
        {([["home", "Home", HomeIcon, "/feed"], ["explore", "Explore", SearchIcon, "/feed/explore"], ["you", "You", User, "/feed/you"]] as const).map(([id, label, I, href]) => (
          <button key={id} aria-current={tab === id ? "page" : undefined} onClick={() => { haptic(6); go(href); }} className={clsx("relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", tab === id ? "text-[var(--header)]" : "text-muted")}>
            <I className="size-6" />{label}
            {tab === id && <span className="absolute top-1 size-1 rounded-full bg-accent" />}
          </button>
        ))}
      </nav>
      {composing && <Compose s={s} onClose={() => setComposing(false)} />}
    </div>
  );
}

function HomeTab({ s, now }: { s: WorldState; now: number }) {
  const [tab, setTab] = useState<"foryou" | "following">("foryou");
  const [n, setN] = useState(60);
  const all = feedPosts(s, now);
  const close = new Set(s.characters.filter((c) => (c.bond ?? 0) >= 15 || (c.rel?.god ?? 0) >= 10 || c.stance === "fan" || c.stance === "worshipper").map((c) => c.id));
  const aboutYou = new Set(s.topics.filter((t) => t.about === "god").map((t) => t.id));
  const f = tab === "following" ? all.filter((p) => p.authorId === "god" || close.has(p.authorId) || (p.topicId && aboutYou.has(p.topicId))) : all;
  const feed = f.slice(-400).reverse().slice(0, n);
  return (
    <>
      <header className="glass sticky top-0 z-10 border-b border-[var(--border)] pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 pb-1 pt-2">
          <h1 className="text-[22px] font-extrabold text-[var(--header)]">{APP.feed.name}</h1>
          <button aria-label="Your profile" onClick={() => go("/feed/you")} className="hit"><Avatar src={who(s, "god").avatar} size={32} /></button>
        </div>
        <div className="flex" role="tablist">
          {(["foryou", "following"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => { haptic(5); setTab(t); setN(60); }} className={clsx("relative flex min-h-[48px] flex-1 items-center justify-center text-[15px] font-semibold", tab === t ? "text-[var(--header)]" : "text-muted")}>
              {t === "foryou" ? "For you" : "Following"}
              {tab === t && <span className="absolute bottom-0 h-[3px] w-14 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      </header>
      {feed.map((p) => <PostCard key={p.id} s={s} p={p} now={now} onOpen={() => go(`/feed/post/${p.id}`)} />)}
      {feed.length === n && <button onClick={() => setN(n + 60)} className="min-h-[56px] w-full text-[14px] font-semibold text-accent">Show more</button>}
      {!feed.length && <p className="p-10 text-center text-[15px] text-muted">{tab === "following" ? "Nobody you're close to has posted yet. Talk to people in the Lounge." : "Nothing here yet."}</p>}
      <div className="h-20" />
    </>
  );
}

function ExploreTab({ s, now }: { s: WorldState; now: number }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase().replace(/^[#$@]/, "");
  const hits = query ? feedPosts(s, now).filter((p) => p.text.toLowerCase().includes(query)).slice(-40).reverse() : [];
  const people = query ? s.characters.filter((c) => c.username.toLowerCase().includes(query) || c.displayName.toLowerCase().includes(query)).slice(0, 5) : [];
  return (
    <div className="pb-24 pt-[env(safe-area-inset-top)]">
      <div className="glass sticky top-0 z-10 px-4 py-2">
        <label className="flex min-h-[44px] items-center gap-2 rounded-full bg-surface px-4">
          <SearchIcon className="size-5 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${APP.feed.name}`} aria-label={`Search ${APP.feed.name}`} className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted" />
        </label>
      </div>
      {query ? (
        <>
          {people.map((c) => { const x = who(s, c.id); return (
            <button key={c.id} onClick={() => go(`/u/${c.id}`)} className="flex min-h-[60px] w-full items-center gap-3 px-4 text-left active:bg-surface">
              <Avatar src={x.avatar} size={40} />
              <span className="min-w-0 flex-1"><NameLine w={x} className="text-[15px] text-[var(--header)]" /><span className="block truncate text-[13px] text-muted">@{c.username} · {fmtCount(c.followers)} followers</span></span>
            </button>
          ); })}
          {hits.map((p) => <PostCard key={p.id} s={s} p={p} now={now} compact onOpen={() => go(`/feed/post/${p.id}`)} />)}
          {!hits.length && !people.length && <p className="p-10 text-center text-[15px] text-muted">No results for “{q.trim()}”.</p>}
        </>
      ) : (
        <>
          <TrendingPanel s={s} now={now} flat limit={15} />
          <div className="mt-2 lg:hidden"><WhoToFollow s={s} flat /></div>
        </>
      )}
    </div>
  );
}

function YouTab({ s, now }: { s: WorldState; now: number }) {
  const me = who(s, "god");
  const mine = feedPosts(s, now).filter((p) => p.authorId === "god").reverse();
  const mentions = feedPosts(s, now).filter((p) => p.authorId !== "god" && (/@god\b/i.test(p.text) || s.topics.find((t) => t.id === p.topicId)?.about === "god")).slice(-60).reverse();
  const [tab, setTab] = useState<"posts" | "mentions">("posts");
  const list = tab === "posts" ? mine : mentions;
  return (
    <div className="pb-24">
      <div className="h-28 bg-[radial-gradient(120%_120%_at_0%_0%,rgb(198_244_50/.35),transparent_60%),linear-gradient(135deg,#1b1d21,#0b0c0e)]" />
      <div className="px-4">
        <Avatar src={me.avatar} size={76} className="-mt-10 border-4 border-[var(--bg)]" />
        <div className="mt-2 text-[22px] font-extrabold text-[var(--header)]">{me.name}</div>
        <div className="text-[15px] text-muted">@{me.handle}</div>
        <div className="mt-2 flex gap-4 text-[14px]">
          <span><b className="num text-[var(--header)]">{fmtCount(s.player.followers)}</b> <span className="text-muted">followers</span></span>
          <span><b className="num text-[var(--header)]">{fmtCount(mine.length)}</b> <span className="text-muted">posts</span></span>
        </div>
      </div>
      <div className="mt-3 flex border-b border-[var(--border)]" role="tablist">
        {(["posts", "mentions"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={clsx("relative flex min-h-[48px] flex-1 items-center justify-center text-[15px] font-semibold", tab === t ? "text-[var(--header)]" : "text-muted")}>
            {t === "posts" ? "Posts" : "About you"}
            {tab === t && <span className="absolute bottom-0 h-[3px] w-14 rounded-full bg-accent" />}
          </button>
        ))}
      </div>
      {list.map((p) => <PostCard key={p.id} s={s} p={p} now={now} onOpen={() => go(`/feed/post/${p.id}`)} />)}
      {!list.length && <p className="p-10 text-center text-[15px] text-muted">{tab === "posts" ? "You haven't posted yet. Tap the feather to say something." : "Nobody's talking about you yet. Big trades get noticed."}</p>}
    </div>
  );
}

function TagPage({ s, tag, now }: { s: WorldState; tag: string; now: number }) {
  const [n, setN] = useState(60);
  const topic = s.topics.find((t) => t.tag === tag);
  const all = feedPosts(s, now).filter((p) => (topic && p.topicId === topic.id) || p.text.includes(`#${tag}`) || p.text.includes(`$${tag}`));
  const feed = all.slice(-400).reverse().slice(0, n);
  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto w-full max-w-[600px] md:border-x md:border-[var(--border)]">
        <header className="glass sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--border)] px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button aria-label="Back" className="grid size-11 place-items-center rounded-full active:bg-surface" onClick={() => (history.length > 1 ? history.back() : go("/feed"))}><ArrowLeft className="size-5" /></button>
          <div className="min-w-0">
            <div className={clsx("truncate text-[18px] font-bold", topic?.about === "god" ? "text-accent" : "text-[var(--header)]")}>#{tag}</div>
            <div className="truncate text-[13px] text-muted">{topic ? showHandle(topic.label) : "Search"} · <span className="num">{fmtCount(all.length)}</span> posts</div>
          </div>
        </header>
        {feed.map((p) => <PostCard key={p.id} s={s} p={p} now={now} onOpen={() => go(`/feed/post/${p.id}`)} />)}
        {feed.length === n && <button onClick={() => setN(n + 60)} className="min-h-[56px] w-full text-[14px] font-semibold text-accent">Show more</button>}
        {!feed.length && <p className="p-10 text-center text-[15px] text-muted">No posts with #{tag} yet.</p>}
        <div className="h-16" />
      </div>
    </div>
  );
}

function WhoToFollow({ s, flat }: { s: WorldState; flat?: boolean }) {
  const list = s.characters.filter((c) => c.influencer).sort((a, b) => b.followers - a.followers).slice(0, 4);
  return (
    <section aria-label="Big accounts" className={clsx("py-1", !flat && "rounded-2xl bg-surface")}>
      <h2 className="px-4 pb-1 pt-2 text-[20px] font-extrabold text-[var(--header)]">Big accounts</h2>
      {list.map((c) => { const x = who(s, c.id); return (
        <button key={c.id} onClick={() => go(`/u/${c.id}`)} className="flex min-h-[60px] w-full items-center gap-3 px-4 text-left active:bg-surface-2 md:hover:bg-surface-2">
          <Avatar src={x.avatar} size={40} />
          <span className="min-w-0 flex-1"><NameLine w={x} className="text-[15px] text-[var(--header)]" /><span className="num block truncate text-[13px] text-muted">@{c.username} · {fmtCount(c.followers)}</span></span>
        </button>
      ); })}
    </section>
  );
}

function Compose({ s, onClose }: { s: WorldState; onClose: () => void }) {
  const [text, setText] = useState("");
  const box = useRef<HTMLTextAreaElement>(null);
  // focus without letting the browser pan the page under the sheet
  useEffect(() => { const t = setTimeout(() => box.current?.focus({ preventScroll: true }), 260); return () => clearTimeout(t); }, []);
  const left = MAX - text.length;
  const send = () => { const t = text.trim(); if (!t) return; haptic(10); doPost("chirp", t); onClose(); go("/feed"); };
  return (
    <Sheet label="New post" onClose={onClose} footer={
      <div className="flex items-center justify-between">
        <span className={clsx("num text-[13px]", left < 20 ? "text-warn" : "text-muted")}>{left}</span>
        <button onClick={send} disabled={!text.trim()} className="min-h-[44px] rounded-full bg-accent px-6 text-[15px] font-bold text-accent-ink transition-opacity disabled:opacity-40">Post</button>
      </div>
    }>
      <div className="flex gap-3 px-4 pb-2">
        <Avatar src={who(s, "god").avatar} size={40} />
        <textarea ref={box} aria-label="Write a post" value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX} rows={5} placeholder="What's on your mind?" className="min-h-[120px] w-full resize-none bg-transparent text-[18px] leading-snug text-fg outline-none placeholder:text-muted" />
      </div>
    </Sheet>
  );
}

function PostDetail({ s, id, now, compose }: { s: WorldState; id: string; now: number; compose: "reply" | "quote" | null }) {
  const [text, setText] = useState("");
  const p = s.posts.find((x) => x.id === id);
  const back = () => (history.length > 1 ? history.back() : go("/feed"));
  if (!p) return <div className="p-8 text-muted">This post isn&apos;t available. It may have been deleted.</div>;
  const replies = s.posts.filter((x) => x.replyTo === id && x.t <= now);
  const quotes = s.posts.filter((x) => x.quoteOf === id && x.t <= now);
  const mode = compose ?? "reply";
  const send = () => {
    const t = text.trim();
    if (!t) return;
    haptic(10);
    if (mode === "quote") { doPost("chirp", t, p.id); setText(""); go("/feed"); }
    else { doPost("chirp", t, undefined, p.id); setText(""); }
  };
  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto w-full max-w-[600px] md:border-x md:border-[var(--border)]">
        <header className="glass sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--border)] px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]"><button aria-label="Back" className="grid size-11 place-items-center rounded-full active:bg-surface" onClick={back}><ArrowLeft className="size-5" /></button><span className="text-[18px] font-bold text-[var(--header)]">Post</span></header>
        <PostCard s={s} p={p} now={now} />
        <div className="flex gap-3 border-b border-[var(--border)] px-4 py-3">
          <Avatar src={who(s, "god").avatar} size={36} />
          <div className="flex-1">
            <div className="mb-1 flex gap-1.5 text-[13px]">
              {(["reply", "quote"] as const).map((m) => <button key={m} onClick={() => go(`/feed/post/${p.id}?compose=${m}`)} className={clsx("min-h-9 rounded-full px-3.5 font-semibold", mode === m ? "bg-accent text-accent-ink" : "bg-surface text-muted")}>{m === "reply" ? "Reply" : "Quote"}</button>)}
            </div>
            <textarea autoFocus={!!compose} aria-label={mode === "quote" ? "Quote post" : "Reply"} value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX} rows={2} placeholder={mode === "quote" ? "Add a comment" : `Reply to @${who(s, p.authorId).handle}`} className="w-full resize-none bg-transparent text-[16px] outline-none placeholder:text-muted" />
            <div className="flex items-center justify-between"><span className="num text-[12px] text-muted">{MAX - text.length}</span><button onClick={send} disabled={!text.trim()} className="min-h-[40px] rounded-full bg-accent px-5 text-[14px] font-bold text-accent-ink disabled:opacity-40">{mode === "quote" ? "Quote" : "Reply"}</button></div>
          </div>
        </div>
        {quotes.length > 0 && <div className="border-b border-[var(--border)] px-4 py-2 text-[13px] font-semibold text-muted">Quotes · {quotes.length}</div>}
        {quotes.map((q) => <PostCard key={q.id} s={s} p={q} now={now} onOpen={() => go(`/feed/post/${q.id}`)} />)}
        <div className="border-b border-[var(--border)] px-4 py-2 text-[13px] font-semibold text-muted">Replies · {replies.length}</div>
        {replies.map((q) => <PostCard key={q.id} s={s} p={q} now={now} onOpen={() => go(`/feed/post/${q.id}`)} />)}
        {!replies.length && <p className="p-6 text-center text-[14px] text-muted">No replies yet.</p>}
        <div className="h-16" />
      </div>
    </div>
  );
}
