"use client";
import clsx from "clsx";
import { MemeImage } from "../MemeImage";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, AtSign, Bell, ChevronDown, ChevronLeft, ChevronRight, Copy, Crown, Headphones, HeadphoneOff, Home as HomeIcon, Lock, Mic, MicOff, Newspaper, PhoneOff, Plus, Settings as Cog, Smile, Volume2, Eye, Hash, Megaphone, MessageCircle, MessagesSquare, Pencil, Pin, Reply, Search, Send, SmilePlus, Trash2, Users, X } from "lucide-react";
import type { Route } from "../App";
import { haptic } from "../App";
import { doDelete, doEdit, doJoinVoice, doLeaveVoice, doPin, doReact, doSay, doStopTyping, doTyping, editWorld, lock, markRead, setFocus, toast, useApp } from "../store";
import { linkTo } from "../links";
import { AppMark } from "../brand";
import { APP } from "@/lib/brand";
import { overheardAt, speaking, voiceChannels, voiceRoster } from "@/lib/sim/presence";
import { Avatar, NameLine, RichText, go, who } from "../ui";
import { channelMessages, dmThreads, isEdited, localHour, pinnedIn, reactionsAt, textAt, threadMessages, typingIn, unreadIndex, type UnreadInfo } from "@/lib/sim/engine";
import { dmChannel, dmPeer } from "@/lib/sim/godspeak";
import { badgesFor, lastSeenMap, obsessionOf, OBSESSION_INFO, presenceOf, type Presence } from "@/lib/sim/social";
import { clockTime, dayLabel, dayOnly, fmtCount, fullDate, relTime } from "@/lib/sim/format";
import type { Channel, Message, Reaction, Server, WorldState } from "@/lib/sim/types";

const MOD = "#5eead4";
const QUICK = ["👑", "🔥", "😭", "💀", "👀", "🫡"];
const STICKERS = ["👑👑👑", "😭😭😭", "💀💀", "🔥🔥🔥", "🫡"];
const PICKER = ["👑", "🔥", "😭", "💀", "👀", "🫡", "😂", "🤣", "❤️", "💯", "🙏", "👏", "🤡", "🧢", "🥶", "🐐", "📈", "📉", "💸", "🚀", "🤝", "😤", "🥹", "👋", "✅", "❌", "🍿", "🧠", "😐", "🙄"];
const DM_SERVER: Server = { id: "dm", name: "Direct Messages", icon: "💬", color: "#8a6416", description: "", bias: 0, vibe: "culture", tags: [], channels: [], members: [], moderators: [], memberCount: 0, insideJokes: [] };
const nickOf = (s: WorldState, id: string, srv: Server) => { const x = who(s, id); return x.char?.nicknames[srv.id] ?? x.name; };

/* ======================================================================= */

type Tab = "servers" | "messages" | "inbox" | "you";
const lastChannel = new Map<string, string>(); // server -> the channel you last opened there
let lastServer = "";
let lastDm = "";

/** phones (<768 px) get the chat-app layout: tabs at the bottom, the chat as a full-screen layer that slides over */
function usePhone() {
  const [phone, setPhone] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const f = () => setPhone(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return phone;
}

export function Lounge({ route }: { route: Route }) {
  const { world: w, now, lastRead } = useApp();
  const s = w!;
  const phone = usePhone();
  const p0 = route.parts[0];
  const tab: Tab = p0 === "dm" ? "messages" : p0 === "inbox" ? "inbox" : p0 === "you" ? "you" : "servers";
  const isDm = tab === "messages";
  const asked = route.parts[1]; // the channel / DM in the URL: on a phone, that's what opens the chat
  const srv = isDm ? DM_SERVER : s.servers.find((x) => x.id === (tab === "servers" ? p0 : lastServer)) ?? s.servers.find((x) => x.id === lastServer) ?? s.servers[0];
  const dms = useMemo(() => dmThreads(s, now), [s, now]);
  const hasChat = tab === "servers" || isDm;
  const open = hasChat && (!phone || !!asked);
  // the chat layer always holds a conversation, so on a phone it can slide in from the right
  const dmId = isDm ? asked ?? (lastDm || dms.find((d) => d.withGod)?.channelId || dms[0]?.channelId) : undefined;
  const ch: Channel | undefined = isDm ? (dmId ? { id: dmId, name: "dm", topic: "", tags: [] } : undefined)
    : tab === "servers" ? srv.channels.find((c) => c.id === asked) ?? srv.channels.find((c) => c.id === lastChannel.get(srv.id)) ?? srv.channels.find((c) => c.name === "general") ?? srv.channels[0] : undefined;
  const chId = ch?.id ?? "";
  useEffect(() => {
    if (tab === "servers") { lastServer = srv.id; if (asked) lastChannel.set(srv.id, asked); }
    if (isDm && asked) lastDm = asked;
  }, [tab, srv.id, asked, isDm]);
  // Member panel is tied to the channel it was opened in, so navigating (e.g. into a DM) closes it.
  const [membersFor, setMembersFor] = useState<string | null>(null);
  const members = !isDm && open && membersFor === chId;
  const setMembers = (v: boolean | ((m: boolean) => boolean)) => setMembersFor((cur) => ((typeof v === "function" ? v(cur === chId) : v) ? chId : null));
  const [apps, setApps] = useState(false);
  const unread = unreadIndex(s, now, lastRead, now - 15 * 60e3);
  const back = () => go(isDm ? "/lounge/dm" : `/lounge/${srv.id}`);

  useEffect(() => { if (chId && open) markRead(chId); }, [chId, now, open]);
  useEffect(() => { setFocus(chId && open ? { serverId: srv.id, channelId: chId } : undefined); return () => setFocus(undefined); }, [srv.id, chId, open]);
  useEffect(() => {
    if (!members) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMembersFor(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [members]);

  // swipe right on the chat to go back to the list (it follows your finger); swipe left for the member list
  const layer = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; dx: number; axis?: "x" | "y" } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { if (!phone || !open) return; const t = e.touches[0]; drag.current = { x: t.clientX, y: t.clientY, dx: 0 }; };
  const onTouchMove = (e: React.TouchEvent) => {
    const d = drag.current, el = layer.current;
    if (!d || !el) return;
    const t = e.touches[0], dx = t.clientX - d.x, dy = t.clientY - d.y;
    if (!d.axis && Math.hypot(dx, dy) > 10) d.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
    if (d.axis !== "x") return;
    d.dx = dx;
    if (dx > 0 && !members) { el.style.transition = "none"; el.style.transform = `translateX(${dx}px)`; }
  };
  const onTouchEnd = () => {
    const d = drag.current, el = layer.current;
    drag.current = null;
    if (!d || d.axis !== "x" || !el) return;
    el.style.transition = "";
    if (d.dx > 0) {
      if (members) { setMembers(false); el.style.transform = ""; return; }
      if (d.dx > el.clientWidth * 0.28) { el.style.transform = "translateX(100%)"; haptic(6); back(); setTimeout(() => { if (layer.current) layer.current.style.transform = ""; }, 320); }
      else el.style.transform = "";
    } else if (d.dx < -60 && !isDm && !members) setMembers(true);
  };

  const chat = ch ? <ChannelView key={chId} s={s} srv={srv} ch={ch} now={now} lastReadAt={lastRead[chId] ?? now - 15 * 60e3} route={route} onMenu={back} onMembers={() => setMembers((m) => !m)} /> : null;
  const list = tab === "servers"
    ? <ChannelList s={s} srv={srv} chId={open ? chId : ""} now={now} unread={unread} />
    : tab === "messages" ? (phone ? <MessagesScreen s={s} now={now} dms={dms} unread={unread} /> : <DmList s={s} now={now} chId={chId} dms={dms} unread={unread} />)
      : tab === "inbox" ? <InboxScreen s={s} now={now} /> : <YouScreen s={s} />;

  return (
    <div className="lounge relative flex h-full flex-col overflow-clip bg-[var(--chat)] text-fg">
      <div className="relative flex min-h-0 flex-1">
        <nav aria-label="Servers and channels" className={clsx("flex min-w-0 bg-bg", phone ? "flex-1" : tab === "inbox" || tab === "you" ? "flex-1" : "shrink-0")}>
          {(!phone || tab === "servers") && <ServerRail s={s} srvId={tab === "servers" ? srv.id : tab === "messages" ? "dm" : ""} chId={open ? chId : ""} unread={unread} dms={dms} onApps={() => setApps(true)} />}
          {list}
        </nav>
        {hasChat && (
          <div ref={layer} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
            aria-hidden={phone && !open ? true : undefined} inert={phone && !open ? true : undefined}
            className={phone
              ? clsx("absolute inset-0 z-20 flex touch-pan-y bg-[var(--chat)] shadow-[-12px_0_32px_rgba(0,0,0,0.35)] transition-[transform,visibility] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]", open ? "visible translate-x-0" : "invisible translate-x-full")
              : "flex min-w-0 flex-1"}>
            {chat ?? <EmptyDms onMenu={back} />}
          </div>
        )}
        {phone && <div onClick={() => setMembers(false)} className={clsx("absolute inset-0 z-30 bg-black/60 transition-opacity duration-300", members ? "opacity-100" : "pointer-events-none opacity-0")} />}
        {!isDm && hasChat && ch && <MemberList s={s} srv={srv} chId={chId} now={now} open={members} onClose={() => setMembers(false)} />}
      </div>
      {phone && !open && <TabBar s={s} tab={tab} now={now} unread={unread} dms={dms} />}
      {apps && <AppSheet onClose={() => setApps(false)} />}
    </div>
  );
}

/* ------------------------------ bottom tabs ------------------------------ */

function TabBar({ s, tab, now, unread, dms }: { s: WorldState; tab: Tab; now: number; unread: Map<string, UnreadInfo>; dms: ReturnType<typeof dmThreads> }) {
  let serverMentions = 0;
  for (const x of s.servers) for (const c of x.channels) serverMentions += unread.get(c.id)?.mentions ?? 0;
  const dmUnread = dms.filter((d) => d.withGod).reduce((a, d) => a + (unread.get(d.channelId)?.n ?? 0), 0);
  const inbox = s.notifications.filter((n) => !n.read && n.t <= now && n.kind === "mention").length;
  const items: [Tab, string, React.ReactNode, string, number][] = [
    ["servers", "Servers", <MessagesSquare key="i" className="size-6" />, `/lounge/${lastServer || s.servers[0].id}`, serverMentions],
    ["messages", "Messages", <MessageCircle key="i" className="size-6" />, "/lounge/dm", dmUnread],
    ["inbox", "Notifications", <Bell key="i" className="size-6" />, "/lounge/inbox", inbox],
    ["you", "You", <Avatar key="i" src={who(s, "god").avatar} size={26} />, "/lounge/you", 0],
  ];
  return (
    <nav aria-label="Lounge tabs" className="flex shrink-0 border-t border-black/30 bg-bg pb-[env(safe-area-inset-bottom)]">
      {items.map(([id, label, icon, href, n]) => (
        <button key={id} aria-label={`${label}${n ? `, ${n} unread` : ""}`} aria-current={tab === id ? "page" : undefined} onClick={() => { haptic(5); go(href); }}
          className={clsx("relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold active:scale-95", tab === id ? "text-[var(--header)]" : "text-muted")}>
          <span className={clsx("relative", tab === id && id === "you" && "rounded-full ring-2 ring-[var(--header)]")}>{icon}
            {n > 0 && <span data-badge={`lounge-${id}`} className="absolute -right-2.5 -top-1 min-w-[18px] rounded-full border-[3px] border-bg bg-down px-1 text-center text-[10px] font-bold leading-[12px] text-white">{n > 99 ? "99+" : n}</span>}
          </span>
          {label}
        </button>
      ))}
    </nav>
  );
}

/* the other apps, from the button at the top of the server rail and from the You tab */
function AppGrid({ onPick }: { onPick?: () => void }) {
  const items: [string, React.ReactNode, string][] = [
    ["/", <span key="h" className="grid size-11 place-items-center rounded-[11px] bg-[var(--surface-3)] text-[var(--header)]"><HomeIcon className="size-6" /></span>, "Home"],
    ...(["wallet", "trade", "feed"] as const).map((id) => [APP[id].route, <AppMark key={id} app={id} size={44} />, APP[id].name] as [string, React.ReactNode, string]),
    ["/settings", <span key="s" className="grid size-11 place-items-center rounded-[11px] bg-[var(--surface-3)] text-[var(--header)]"><Cog className="size-6" /></span>, "Settings"],
  ];
  return (
    <div className="grid grid-cols-5 gap-1">
      {items.map(([href, icon, label]) => (
        <button key={href} onClick={() => { haptic(5); onPick?.(); go(href); }} className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold text-fg active:scale-95">
          {icon}{label}
        </button>
      ))}
    </div>
  );
}

function AppSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div role="dialog" aria-label="Apps" onClick={(e) => e.stopPropagation()} className="sheet-spring absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface p-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-6 md:left-1/2 md:w-[420px] md:-translate-x-1/2 md:rounded-2xl">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[var(--surface-3)]" />
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="text-[17px] font-bold text-[var(--header)]">Apps</span>
          <button aria-label="Close" onClick={onClose} className="grid size-11 place-items-center rounded-full bg-[var(--surface-3)]"><X className="size-4" /></button>
        </div>
        <AppGrid onPick={onClose} />
        <button onClick={() => { onClose(); lock(); }} className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--chat)] text-[14px] font-semibold text-muted"><Lock className="size-4" />Switch profile</button>
      </div>
    </div>
  );
}

/* ----------------------------- server rail ----------------------------- */

function Pill({ n, mention }: { n: number; mention?: boolean }) {
  if (!n) return null;
  return <span className={clsx("badge-bump min-w-[22px] rounded-full border-[3px] border-bg px-1 text-center text-[11px] font-bold leading-[14px]", mention ? "bg-down text-white" : "bg-gold text-[#1a1406]")}>{n > 99 ? "99+" : n}</span>;
}

function ServerRail({ s, srvId, chId, unread, dms, onApps }: { s: WorldState; srvId: string; chId: string; unread: Map<string, UnreadInfo>; dms: ReturnType<typeof dmThreads>; onApps: () => void }) {
  const dmMentions = dms.filter((d) => d.withGod && d.channelId !== chId).reduce((a, d) => a + (unread.get(d.channelId)?.n ?? 0), 0);
  return (
    <div className="no-scrollbar flex w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto bg-bg py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      {/* phones: the crown opens the rest of GOD (Messages has its own tab); desktop: direct messages, like chat apps */}
      <button aria-label="Apps" onClick={() => { haptic(5); onApps(); }} className="group relative flex w-full justify-center active:scale-95 md:hidden">
        <AppMark app="lounge" size={48} />
      </button>
      <button aria-label={`Direct messages${dmMentions ? `, ${dmMentions} unread` : ""}`} onClick={() => go("/lounge/dm")} className="group relative flex w-full justify-center active:scale-95 max-md:hidden">
        <span className={clsx("absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-[var(--header)] transition-all duration-200", srvId === "dm" ? "h-9" : "h-0 group-hover:h-5")} />
        <span className={clsx("grid size-12 place-items-center bg-accent text-accent-ink transition-all duration-200", srvId === "dm" ? "rounded-[16px]" : "rounded-[24px] group-hover:rounded-[16px]")}><MessageCircle className="size-6" /></span>
        {dmMentions > 0 && <span className="absolute bottom-0 right-2"><Pill n={dmMentions} mention /></span>}
      </button>
      <div className="h-0.5 w-8 rounded-full bg-[var(--surface-3)]" />
      {s.servers.map((x) => {
        const active = x.id === srvId;
        let n = 0, m = 0;
        for (const c of x.channels) { if (c.id === chId) continue; const u = unread.get(c.id); if (u) { n += u.n; m += u.mentions; } }
        return (
          <button key={x.id} title={x.name} aria-label={`${x.name}${m ? `, ${m} mentions` : n ? ", unread" : ""}`} aria-current={active ? "true" : undefined} onClick={() => { haptic(5); go(`/lounge/${x.id}`); }} className="group relative flex w-full shrink-0 justify-center active:scale-95">
            <span className={clsx("absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-fg transition-all duration-200", active ? "h-9" : n ? "h-2" : "h-0 group-hover:h-5")} />
            <span className={clsx("grid size-12 place-items-center text-[21px] transition-all duration-200", active ? "rounded-[16px]" : "rounded-[24px] group-hover:rounded-[16px]")}
              style={{ background: active ? `linear-gradient(140deg, ${x.color}, color-mix(in srgb, ${x.color} 55%, black))` : "var(--surface)" }}>{x.icon}</span>
            {m > 0 && <span className="absolute bottom-0 right-2"><Pill n={m} mention /></span>}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------- channel list ---------------------------- */

const groupOf = (c: Channel) => (c.announce ? "Information" : /general|chat|off-?topic|lounge|meme|welcome|intro|vc|hangout/i.test(c.name) ? "Community" : "Topics");

function ChannelList({ s, srv, chId, now, unread }: { s: WorldState; srv: Server; chId: string; now: number; unread: Map<string, UnreadInfo> }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const groups = ["Information", "Community", "Topics"].map((g) => [g, srv.channels.filter((c) => groupOf(c) === g)] as const).filter(([, cs]) => cs.length);
  const slot = Math.floor(now / 15000);
  const seen = useMemo(() => lastSeenMap(s, slot * 15000, srv.id, 3000), [s, srv.id, slot]);
  const online = srv.members.reduce((a, id) => a + (presenceOf(s.characters[Number(id.slice(1))], seen.get(id), now) === "online" ? 1 : 0), 0);
  const shown = Math.round(online * (srv.memberCount / Math.max(1, srv.members.length)) * 0.12) + online; // the visible crowd is bigger than the speaking cast
  return (
    <aside className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-tl-2xl bg-surface md:w-[248px] md:flex-none md:rounded-none">
      <div className="relative shrink-0">
        <div className="h-[72px] pt-[env(safe-area-inset-top)] md:h-14" style={{ background: `linear-gradient(120deg, ${srv.color}, color-mix(in srgb, ${srv.color} 35%, #111214))` }} />
        <div className="px-4 pb-3 pt-2.5">
          <h2 className="flex items-center gap-1 truncate text-[20px] font-extrabold text-[var(--header)]"><span className="truncate">{srv.icon} {srv.name}</span><ChevronRight className="size-5 shrink-0 text-muted" /></h2>
          <div className="mt-0.5 flex items-center gap-3 text-[13px] text-muted">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-up" />{fmtCount(shown)} Online</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted" />{fmtCount(srv.memberCount)} Members</span>
          </div>
          <button onClick={() => go(`/search?q=${encodeURIComponent(srv.name)}`)} className="mt-3 flex min-h-[44px] w-full items-center gap-2 rounded-full bg-bg px-3 text-[15px] text-muted"><Search className="size-4" />Search</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {groups.map(([label, cs]) => {
          const shut = collapsed[label];
          return (
            <div key={label}>
              <button aria-expanded={!shut} onClick={() => setCollapsed((c) => ({ ...c, [label]: !c[label] }))} className="flex min-h-[44px] w-full items-center gap-1 px-1 pt-2 text-[12px] font-bold uppercase tracking-[0.02em] text-muted hover:text-fg">
                <ChevronDown className={clsx("size-3 transition-transform duration-200", shut && "-rotate-90")} />{label}
              </button>
              {cs.map((c) => {
                const u = c.id === chId ? undefined : unread.get(c.id);
                const on = c.id === chId;
                if (shut && !on && !u?.mentions) return null;
                return (
                  <button key={c.id} onClick={() => { haptic(5); go(`/lounge/${srv.id}/${c.id}`); }} aria-current={on ? "page" : undefined} aria-label={`${c.name}${u?.mentions ? `, ${u.mentions} mention${u.mentions > 1 ? "s" : ""}` : u ? ", unread" : ""}`}
                    className={clsx("relative flex min-h-[44px] w-full items-center gap-2 rounded-md px-2.5 text-[16px] font-medium transition-colors md:min-h-[34px] md:text-[15px]", on ? "bg-[var(--selected)] text-[var(--header)]" : u ? "font-semibold text-[var(--header)] hover:bg-surface-2" : "text-muted hover:bg-surface-2 hover:text-fg")}>
                    {u && !on && <span className="absolute -left-2 h-2 w-1 rounded-r-full bg-[var(--header)]" />}
                    {c.announce ? <Megaphone className="size-5 shrink-0 opacity-70" /> : <Hash className="size-5 shrink-0 opacity-70" />}
                    <span className="truncate">{c.name}</span>
                    <span className="ml-auto">{u?.mentions ? <Pill n={u.mentions} mention /> : null}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
        <VoiceList s={s} srv={srv} now={now} />
      </div>
      <div className="max-md:hidden"><MeBar s={s} /></div>
    </aside>
  );
}

function VoiceList({ s, srv, now }: { s: WorldState; srv: Server; now: number }) {
  const [shut, setShut] = useState(false);
  const g = s.voice?.god && !s.voice.god.leftAt ? s.voice.god : undefined;
  return (
    <div data-testid="voice-list">
      <button aria-expanded={!shut} onClick={() => setShut(!shut)} className="flex min-h-[44px] w-full items-center gap-1 px-1 pt-2 text-[12px] font-semibold uppercase tracking-[0.02em] text-muted hover:text-fg">
        <ChevronDown className={clsx("size-3 transition-transform duration-200", shut && "-rotate-90")} />Voice
      </button>
      {!shut && voiceChannels(srv).map((vc) => {
        const roster = voiceRoster(s, srv, vc.id, now);
        const here = g?.channelId === vc.id;
        return (
          <div key={vc.id} className={clsx("rounded-xl px-1 py-0.5", here && "bg-gold/[0.07]")}>
            <div className="flex min-h-[40px] items-center gap-2 px-1.5 md:min-h-[34px]">
              <Volume2 className={clsx("size-4 shrink-0", here ? "text-gold" : "opacity-70")} />
              <span className={clsx("truncate text-[14px]", here ? "font-semibold text-gold" : "text-muted")}>{vc.name}</span>
              <span className="num text-[10.5px] text-muted">{roster.length || ""}</span>
              {here
                ? <button onClick={() => { haptic(8); doLeaveVoice(); }} className="ml-auto flex min-h-[44px] items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-down md:min-h-8"><PhoneOff className="size-3.5" />Leave</button>
                : <button onClick={() => { haptic(8); doJoinVoice(srv.id, vc.id); }} className="ml-auto min-h-[44px] rounded-full px-3 text-[12px] font-semibold text-fg hover:text-gold md:min-h-8">Join voice</button>}
            </div>
            {roster.length > 0 && (
              <ul className="mb-1 ml-7 space-y-0.5">
                {roster.slice(0, 9).map((m) => {
                  const x = who(s, m.id);
                  const talk = !m.muted && !m.deaf && speaking(m.id, now, m.god);
                  return (
                    <li key={m.id} className="flex items-center gap-2 text-[12.5px]" data-speaking={talk || undefined}>
                      <span className={clsx("rounded-full", talk && "vc-speaking")}><Avatar src={x.avatar} size={20} /></span>
                      <span className={clsx("truncate", m.god ? "font-semibold text-gold" : "text-fg/80")}>{m.god ? "God" : x.char?.nicknames[srv.id] ?? x.name}</span>
                      <span className="ml-auto flex items-center gap-1 pr-1 text-muted">
                        {m.muted && <MicOff aria-label="muted" className="size-3" />}
                        {m.deaf && <HeadphoneOff aria-label="deafened" className="size-3" />}
                      </span>
                    </li>
                  );
                })}
                {roster.length > 9 && <li className="text-[11px] text-muted">+{roster.length - 9} more</li>}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VoiceBar({ s, srv, now }: { s: WorldState; srv: Server; now: number }) {
  const g = s.voice?.god;
  if (!g || g.leftAt) return null;
  const home = s.servers.find((x) => x.id === g.serverId);
  const vc = home && voiceChannels(home).find((v) => v.id === g.channelId);
  if (!home || !vc) return null;
  const lines = overheardAt(s, g.channelId, now, 3);
  const last = lines.at(-1);
  const talking = speaking("god", now, true);
  return (
    <div data-testid="voice-bar" className="flex items-center gap-2 border-b border-line bg-gold/[0.06] px-3 py-1.5 text-[12px]" onClick={(e) => e.stopPropagation()}>
      <span className={clsx("relative rounded-full", talking && "vc-speaking")}><Avatar src={who(s, "god").avatar} size={22} ring="var(--gold)" /></span>
      <span className="flex shrink-0 items-center gap-1.5 font-semibold text-gold">{talking ? <span className="vc-wave" aria-label="You are speaking"><i /><i /><i /><i /></span> : <Mic className="size-3.5" />}{vc.name}{home.id !== srv.id ? ` · ${home.name}` : ""}</span>
      <span className="min-w-0 flex-1 truncate text-muted" aria-live="off">{last ? <><b className="font-semibold text-fg/85">{who(s, last.who).char?.nicknames[home.id] ?? who(s, last.who).name}:</b> {last.text}</> : "connecting…"}</span>
      <Headphones className="size-3.5 shrink-0 text-muted" />
      <button aria-label="Leave voice" onClick={() => { haptic(8); doLeaveVoice(); }} className="-my-1.5 grid size-11 shrink-0 place-items-center rounded-full text-down"><PhoneOff className="size-4" /></button>
    </div>
  );
}

function MeBar({ s }: { s: WorldState }) {
  const me = who(s, "god");
  return (
    <div className="flex items-center gap-2.5 border-t border-line bg-bg/60 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] md:pb-2.5">
      <span className="relative"><Avatar src={me.avatar} size={32} ring="var(--gold)" /><span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-bg bg-up" /></span>
      <div className="min-w-0 leading-tight"><div className="truncate text-[13px] font-semibold text-gold">{me.name}</div><div className="text-[11px] text-muted">@god · online</div></div>
    </div>
  );
}

/* -------------------------------- DMs ---------------------------------- */

function DmRow({ s, d, now, active, u }: { s: WorldState; d: ReturnType<typeof dmThreads>[number]; now: number; active?: boolean; u?: UnreadInfo }) {
  const ids = d.channelId.split(":").slice(1);
  const peer = d.withGod ? who(s, dmPeer(d.channelId)) : who(s, ids[0]);
  const other = d.withGod ? undefined : who(s, ids[1]);
  const lastBy = d.last.authorId === "god" ? "You: " : !d.withGod ? `${who(s, d.last.authorId).name}: ` : "";
  const unreadHere = u && d.withGod ? u.n : 0;
  return (
    <button onClick={() => go(`/lounge/dm/${d.channelId}`)} className={clsx("flex min-h-[64px] w-full items-center gap-3 rounded-lg px-2 py-2 text-left", active ? "bg-[var(--selected)]" : "active:bg-surface-2 md:hover:bg-surface-2")}>
      <span className="relative shrink-0">
        <Avatar src={peer.avatar} size={40} />
        {other ? <Avatar src={other.avatar} size={20} className="absolute -bottom-1 -right-1 ring-2 ring-[var(--surface)]" /> : <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-[3px] border-[var(--surface)] bg-up" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={clsx("truncate text-[16px]", unreadHere ? "font-bold text-[var(--header)]" : "font-semibold text-fg")}>{peer.name}{other ? ` & ${other.name}` : ""}</span>
          <span className="ml-auto shrink-0 text-[12px] text-muted">{relTime(d.last.t, now)}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className={clsx("truncate text-[14px]", unreadHere ? "text-fg" : "text-muted")}>{lastBy}{textAt(d.last, now) || (d.last.meme ? "sent an image" : "")}</span>
          {unreadHere > 0 && <span className="ml-auto"><Pill n={unreadHere} mention /></span>}
        </span>
      </span>
    </button>
  );
}

function DmList({ s, now, chId, dms, unread }: { s: WorldState; now: number; chId: string; dms: ReturnType<typeof dmThreads>; unread: Map<string, UnreadInfo> }) {
  const mine = dms.filter((d) => d.withGod), others = dms.filter((d) => !d.withGod).slice(0, 25);
  return (
    <aside className="flex w-[300px] min-w-0 flex-col bg-surface">
      <div className="flex h-12 items-center border-b border-black/25 px-4 shadow-[0_1px_0_rgba(0,0,0,0.12)]"><h2 className="text-[16px] font-bold text-[var(--header)]">Direct Messages</h2></div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 pt-2">
        {mine.length ? mine.map((d) => <DmRow key={d.channelId} s={s} d={d} now={now} active={d.channelId === chId} u={d.channelId === chId ? undefined : unread.get(d.channelId)} />) : <p className="px-2 py-2 text-[13px] text-muted">No DMs yet. Open someone&apos;s profile or the member list and tap Message.</p>}
        {others.length > 0 && <div className="flex items-center gap-1.5 px-2 pb-1 pt-4 text-[12px] font-bold uppercase text-muted"><Eye className="size-3.5" /> God sees every DM</div>}
        {others.map((d) => <DmRow key={d.channelId} s={s} d={d} now={now} active={d.channelId === chId} />)}
      </div>
      <MeBar s={s} />
    </aside>
  );
}

/** phone: the Messages tab (search, who's active now, conversations) */
function MessagesScreen({ s, now, dms, unread }: { s: WorldState; now: number; dms: ReturnType<typeof dmThreads>; unread: Map<string, UnreadInfo> }) {
  const [q, setQ] = useState("");
  const slot = Math.floor(now / 15000);
  const active = useMemo(() => {
    const seen = lastSeenMap(s, slot * 15000, undefined, 3000);
    return s.characters.filter((c) => c.core && presenceOf(c, seen.get(c.id), slot * 15000) === "online").sort((a, b) => (b.bond ?? 0) - (a.bond ?? 0)).slice(0, 14);
  }, [s, slot]);
  const match = (d: ReturnType<typeof dmThreads>[number]) => !q.trim() || d.channelId.split(":").slice(1).some((id) => { const x = who(s, id); return x.name.toLowerCase().includes(q.toLowerCase()) || x.handle.toLowerCase().includes(q.toLowerCase()); });
  const mine = dms.filter((d) => d.withGod && match(d)), others = dms.filter((d) => !d.withGod && match(d)).slice(0, 25);
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-surface">
      <div className="px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="text-[24px] font-extrabold text-[var(--header)]">Messages</h1>
        <label className="mt-2 flex items-center gap-2 rounded-full bg-bg px-3 text-muted"><Search className="size-4 shrink-0" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search messages" className="min-h-[44px] min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-muted" /></label>
      </div>
      <div className="flex-1 overflow-y-auto pb-2">
        {active.length > 0 && !q && (
          <div className="mb-1">
            <div className="px-4 pb-1 pt-1 text-[12px] font-bold uppercase text-muted">Active now</div>
            <div data-scroll-x className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-2">
              {active.map((c) => (
                <button key={c.id} aria-label={`Message ${c.displayName}`} onClick={() => go(`/lounge/dm/${dmChannel("god", c.id)}`)} className="flex w-14 shrink-0 flex-col items-center gap-1 active:scale-95">
                  <span className="relative"><Avatar src={who(s, c.id).avatar} size={52} /><span className="absolute bottom-0 right-0 size-4 rounded-full border-[3px] border-[var(--surface)] bg-up" /></span>
                  <span className="w-full truncate text-center text-[12px] text-muted">{c.displayName.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="px-2">
          {mine.map((d) => <DmRow key={d.channelId} s={s} d={d} now={now} u={unread.get(d.channelId)} />)}
          {!mine.length && <p className="px-2 py-3 text-[14px] text-muted">{q ? "Nobody by that name." : "No DMs yet. Tap someone above, or Message from the member list."}</p>}
          {others.length > 0 && <div className="flex items-center gap-1.5 px-2 pb-1 pt-4 text-[12px] font-bold uppercase text-muted"><Eye className="size-3.5" /> God sees every DM</div>}
          {others.map((d) => <DmRow key={d.channelId} s={s} d={d} now={now} />)}
        </div>
      </div>
    </section>
  );
}

/** the Notifications tab: mentions and replies first, then everything else that happened */
function InboxScreen({ s, now }: { s: WorldState; now: number }) {
  const [only, setOnly] = useState<"all" | "mentions">("all");
  const list = s.notifications.filter((n) => n.t <= now && (only === "all" || n.kind === "mention")).slice(-150).reverse();
  useEffect(() => () => { editWorld((x) => { const t = Date.now(); x.notifications.forEach((n) => { if (n.t <= t) n.read = true; }); }); }, []);
  return (
    <section className="flex min-w-0 flex-1 flex-col bg-surface">
      <div className="px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="text-[24px] font-extrabold text-[var(--header)]">Notifications</h1>
        <div className="mt-2 flex gap-2">
          {(["all", "mentions"] as const).map((k) => <button key={k} aria-pressed={only === k} onClick={() => setOnly(k)} className={clsx("min-h-[44px] rounded-full px-4 text-[14px] font-semibold", only === k ? "bg-[var(--selected)] text-[var(--header)]" : "bg-bg text-muted")}>{k === "all" ? "For you" : "Mentions"}</button>)}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {list.map((n) => {
          const handle = /^@([\w.]+)/.exec(n.text)?.[1];
          const c = handle ? s.characters.find((x) => x.username === handle) : undefined;
          const rest = handle ? n.text.slice(handle.length + 1) : n.text;
          return (
            <button key={n.id} onClick={() => linkTo(n.link)} className={clsx("flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left active:bg-surface-2 md:hover:bg-surface-2", !n.read && "bg-white/[0.035]")}>
              {c ? <Avatar src={who(s, c.id).avatar} size={40} /> : <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--surface-3)] text-gold">{n.kind === "mention" ? <AtSign className="size-5" /> : n.kind === "news" ? <Newspaper className="size-5" /> : n.kind === "money" ? <Crown className="size-5" /> : <Bell className="size-5" />}</span>}
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] leading-snug text-fg">{c ? <><b className="text-[var(--header)]">{c.displayName}</b>{rest}</> : n.text}</span>
                <span className="text-[12px] text-muted">{relTime(n.t, now)}</span>
              </span>
              {!n.read && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-down" />}
            </button>
          );
        })}
        {!list.length && <p className="p-6 text-center text-[14px] text-muted">Nothing yet.</p>}
      </div>
    </section>
  );
}

/** the You tab: your profile card, and the way to the rest of GOD */
function YouScreen({ s }: { s: WorldState }) {
  const me = who(s, "god");
  return (
    <section className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-surface">
      <div className="relative h-[120px] shrink-0 bg-gradient-to-br from-accent to-[#5d8a00] pt-[env(safe-area-inset-top)]">
        <button aria-label="Settings" onClick={() => go("/settings")} className="absolute right-3 top-[max(0.5rem,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full bg-black/35 text-white"><Cog className="size-5" /></button>
      </div>
      <div className="px-4">
        <span className="relative -mt-12 inline-block rounded-full border-[6px] border-[var(--surface)]"><Avatar src={me.avatar} size={84} /><span className="absolute bottom-1 right-1 size-5 rounded-full border-[4px] border-[var(--surface)] bg-up" /></span>
        <h1 className="text-[24px] font-extrabold leading-tight text-[var(--header)]">{me.name}</h1>
        <div className="text-[15px] text-fg">god <span className="text-muted">· online</span></div>
        <button onClick={() => go("/settings")} className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-[var(--selected)] text-[15px] font-semibold text-[var(--header)]"><Pencil className="size-4" />Edit Profile</button>
        <div className="mt-3 rounded-xl bg-[var(--chat)] p-4">
          <div className="text-[12px] font-bold uppercase text-muted">About me</div>
          <p className="mt-1 text-[15px] text-fg">The main character of the internet.</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div><div className="text-[16px] font-bold text-[var(--header)]">{fmtCount(s.player.followers)}</div><div className="text-[12px] text-muted">Followers</div></div>
            <div><div className="text-[16px] font-bold text-[var(--header)]">{Math.round(s.player.reputation)}</div><div className="text-[12px] text-muted">Reputation</div></div>
            <div><div className="text-[16px] font-bold text-[var(--header)]">{Math.round(s.player.influence)}</div><div className="text-[12px] text-muted">Influence</div></div>
          </div>
        </div>
        <div className="mb-2 mt-4 text-[12px] font-bold uppercase text-muted">Apps</div>
        <AppGrid />
        <button onClick={() => lock()} className="mb-6 mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--chat)] text-[14px] font-semibold text-muted"><Lock className="size-4" />Switch profile</button>
      </div>
    </section>
  );
}

function EmptyDms({ onMenu }: { onMenu: () => void }) {
  return (
    <section className="grid min-w-0 flex-1 place-items-center p-6 text-center">
      <div>
        <button aria-label="Open channels" onClick={onMenu} className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-surface-3 md:hidden"><ChevronLeft className="size-6" /></button>
        <MessageCircle className="mx-auto size-10 text-gold" />
        <p className="mt-2 text-[14px] text-muted">Pick a conversation, or message someone from the member list.</p>
      </div>
    </section>
  );
}

/* ----------------------------- channel view ---------------------------- */

function findMsg(s: WorldState, id?: string) {
  if (!id) return undefined;
  for (let i = s.messages.length - 1; i >= 0; i--) if (s.messages[i].id === id) return s.messages[i];
  return s.pending.find((x) => x.id === id);
}

function typingLabel(names: string[]) {
  if (names.length === 1) return <><b>{names[0]}</b> is typing…</>;
  if (names.length === 2) return <><b>{names[0]}</b> and <b>{names[1]}</b> are typing…</>;
  if (names.length === 3) return <><b>{names[0]}</b>, <b>{names[1]}</b> and <b>{names[2]}</b> are typing…</>;
  return <><b>{names[0]}</b>, <b>{names[1]}</b> and <b>{names.length - 2} others</b> are typing…</>;
}

type Panel = "search" | "pins" | { thread: string } | undefined;

const WINDOW = 60; // rows rendered from the bottom; older ones load as you scroll up
const PAGE = 40;
const isPhone = () => typeof window !== "undefined" && window.innerWidth < 768;

/** press and hold (touch or mouse) without moving: fires once, then swallows the click that follows */
function useLongPress(onLong: () => void, ms = 420) {
  const st = useRef<{ x: number; y: number; t?: ReturnType<typeof setTimeout>; fired?: boolean; el?: HTMLElement } | null>(null);
  const clear = () => { const c = st.current; if (c?.t) clearTimeout(c.t); c?.el?.removeAttribute("data-pressing"); };
  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      clear();
      const el = e.currentTarget;
      st.current = { x: e.clientX, y: e.clientY, el };
      st.current.t = setTimeout(() => { if (!st.current) return; st.current.fired = true; el.removeAttribute("data-pressing"); haptic(12); onLong(); }, ms);
      setTimeout(() => { if (st.current?.el === el && !st.current.fired) el.setAttribute("data-pressing", ""); }, 140);
    },
    onPointerMove: (e: React.PointerEvent) => { const c = st.current; if (c && !c.fired && Math.hypot(e.clientX - c.x, e.clientY - c.y) > 8) { clear(); st.current = null; } },
    onPointerUp: () => clear(),
    onPointerCancel: () => { clear(); st.current = null; },
    /** true if the click that follows a press should be ignored */
    consumed: () => { const f = !!st.current?.fired; if (st.current) st.current.fired = false; return f; },
  };
}

function ChannelView({ s, srv, ch, now, lastReadAt, route, onMenu, onMembers }: { s: WorldState; srv: Server; ch: Channel; now: number; lastReadAt: number; route: Route; onMenu: () => void; onMembers: () => void }) {
  const isDm = srv.id === "dm";
  const jump = route.query.get("m") ?? undefined;
  const all = channelMessages(s, ch.id, now, jump ? 600 : 400);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [readMark] = useState(lastReadAt); // "new messages" divider stays where it was when you opened the channel
  const [text, setText] = useState("");
  const [sel, setSel] = useState<string>();
  const [sheet, setSheet] = useState<string>(); // phone: long-press action sheet for this message
  const [compose, setCompose] = useState(false); // the + / emoji tray under the composer
  const input = useRef<HTMLInputElement>(null);
  const [reply, setReply] = useState<Message>();
  const [editing, setEditing] = useState<Message>();
  const [picker, setPicker] = useState<string>();
  const [panel, setPanel] = useState<Panel>(() => (route.query.get("thread") ? { thread: route.query.get("thread")! } : undefined));
  const [scrolledUp, setScrolledUp] = useState(false);
  // windowing: stuck to the bottom we render the last WINDOW rows; scrolled up, the top row is frozen so new
  // messages arriving below never shift what you're reading
  const [fromId, setFromId] = useState<string>();
  const pendingRestore = useRef<number | null>(null);
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPanel(undefined); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);
  let start = Math.max(0, all.length - WINDOW);
  if (jump) { const j = all.findIndex((m) => m.id === jump); if (j >= 0) start = Math.max(0, Math.min(start, j - 20)); }
  if (fromId) { const f = all.findIndex((m) => m.id === fromId); if (f >= 0) start = f; }
  const msgs = all.slice(start);
  const atStart = start === 0;
  const [seenCount, setSeenCount] = useState(msgs.length);
  const lastId = msgs.at(-1)?.id;
  const peer = isDm ? who(s, dmPeer(ch.id)) : undefined;
  const withGod = !isDm || ch.id.split(":").includes("god");
  const title = isDm ? (withGod ? peer!.name : ch.id.split(":").slice(1).map((id) => who(s, id).name).join(" & ")) : ch.name;
  const pins = isDm ? [] : pinnedIn(s, ch.id, now);
  const threadCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of s.messages) if (x.threadOf && x.channelId === ch.id) m.set(x.threadOf, (m.get(x.threadOf) ?? 0) + 1);
    for (const x of s.pending) if (x.threadOf && x.channelId === ch.id && x.t <= now) m.set(x.threadOf, (m.get(x.threadOf) ?? 0) + 1);
    return m;
  }, [s, ch.id, now]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (pendingRestore.current !== null) { el.scrollTop += el.scrollHeight - pendingRestore.current; pendingRestore.current = null; return; }
    if (jump) {
      const t = el.querySelector(`[data-mid="${jump}"]`);
      // Scroll only the message list (scrollIntoView would also shift overflow-hidden ancestors).
      if (t) { const r = t.getBoundingClientRect(), e = el.getBoundingClientRect(); el.scrollTop += r.top - e.top - (e.height - r.height) / 2; stick.current = false; }
      return;
    }
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [lastId, jump, start]);
  // stay pinned to the bottom when something below grows (a meme loads, reactions wrap, the keyboard opens)
  useEffect(() => {
    const el = scroller.current, inner = content.current;
    if (!el || !inner || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { if (stick.current && !jump) el.scrollTop = el.scrollHeight; });
    ro.observe(inner);
    ro.observe(el);
    return () => ro.disconnect();
  }, [jump]);

  // Keep a selected message's inline action bar fully visible above the composer.
  useLayoutEffect(() => {
    const el = scroller.current;
    const row = sel && el?.querySelector(`[data-mid="${sel}"]`);
    if (!el || !row) return;
    const r = row.getBoundingClientRect(), e = el.getBoundingClientRect();
    if (r.bottom > e.bottom - 8) el.scrollTop += r.bottom - e.bottom + 12;
  }, [sel]);
  const newBelow = scrolledUp ? Math.max(0, msgs.length - seenCount) : 0;
  const typingIds = typingIn(s, ch.id, now);
  const typing = typingIds.map((id) => nickOf(s, id, srv));

  const toBottom = () => { const el = scroller.current; setFromId(undefined); stick.current = true; setScrolledUp(false); if (el) requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })); if (jump) go(`/lounge/${srv.id}/${ch.id}`); };
  const onScroll = (el: HTMLDivElement) => {
    const up = el.scrollHeight - el.scrollTop - el.clientHeight > 140;
    stick.current = !up;
    if (up !== scrolledUp) {
      setScrolledUp(up);
      if (up) { setSeenCount(msgs.length); setFromId(msgs[0]?.id); } else setFromId(undefined);
    }
    // near the top: load an older page, keeping the view where it is
    if (up && el.scrollTop < 240 && start > 0 && pendingRestore.current === null) {
      pendingRestore.current = el.scrollHeight;
      setFromId(all[Math.max(0, start - PAGE)].id);
    }
  };
  const send = () => {
    const t = text.trim();
    if (!t || ch.announce) return;
    haptic(10);
    if (editing) { if (t !== editing.text) doEdit(editing.id, t); setEditing(undefined); setText(""); return; }
    stick.current = true;
    setFromId(undefined);
    doSay(srv.id, ch.id, t, reply?.id);
    setText(""); setReply(undefined); setSel(undefined);
    if (jump) go(`/lounge/${srv.id}/${ch.id}`);
  };
  // the room notices when god starts typing (debounced in the engine), and calms down if he clears it
  const onType = (v: string) => {
    if (!isDm && !editing && !ch.announce) {
      if (!text.trim() && v.trim()) doTyping(srv.id, ch.id);
      else if (text.trim() && !v.trim()) doStopTyping(ch.id);
    }
    setText(v);
  };
  const react = (id: string, emoji: string) => { haptic(6); doReact(id, emoji); setSel(undefined); setSheet(undefined); setPicker(undefined); };
  const startEdit = (m: Message) => { setEditing(m); setText(m.text); setReply(undefined); setSel(undefined); setSheet(undefined); };
  // @mention autocomplete
  const mq = /(?:^|\s)@([\w.]{0,20})$/.exec(text);
  const suggestions = useMemo(() => {
    if (!mq || isDm) return [];
    const q = mq[1].toLowerCase();
    const ids = [...new Set([...msgs.slice(-60).map((m) => m.authorId), ...srv.members])].filter((id) => id.startsWith("c"));
    return ids.map((id) => s.characters[Number(id.slice(1))]).filter((c) => c.username.toLowerCase().startsWith(q) || c.displayName.toLowerCase().startsWith(q)).slice(0, 5);
  }, [mq?.[1], ch.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const thread = panel && typeof panel === "object" ? findMsg(s, panel.thread) : undefined;
  const sheetMsg = sheet ? findMsg(s, sheet) : undefined;

  return (
    <section className="chat-pane relative flex min-w-0 flex-1 flex-col" onClick={() => { setSel(undefined); setPicker(undefined); }}>
      <header className="flex h-[calc(3rem+env(safe-area-inset-top))] shrink-0 items-center gap-1 border-b border-black/25 px-1 pt-[env(safe-area-inset-top)] shadow-[0_1px_0_rgba(0,0,0,0.12)] md:h-12 md:px-3 md:pt-0">
        <button aria-label="Open channels" onClick={(e) => { e.stopPropagation(); onMenu(); }} className="grid size-11 shrink-0 place-items-center rounded-full text-[var(--header)] active:bg-surface-2 md:hidden"><ChevronLeft className="size-7" /></button>
        {isDm
          ? <span className="relative shrink-0"><Avatar src={peer!.avatar} size={28} /><span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[var(--chat)] bg-up" /></span>
          : ch.announce ? <Megaphone className="size-5 shrink-0 text-muted" /> : <Hash className="size-6 shrink-0 text-muted" />}
        <div className="min-w-0 flex-1 pl-1 leading-tight">
          <div className="flex items-center gap-0.5 text-[17px] font-bold text-[var(--header)]"><span className="truncate">{title}</span><ChevronRight className="size-4 shrink-0 text-muted md:hidden" /></div>
          <div className="truncate text-[12px] text-muted max-md:hidden">{isDm ? (withGod ? `@${peer!.handle}` : "A DM you're not part of") : `${srv.icon} ${srv.name} · ${ch.topic}`}</div>
        </div>
        <button aria-label="Search messages" onClick={(e) => { e.stopPropagation(); setPanel(panel === "search" ? undefined : "search"); }} className={clsx("grid size-11 place-items-center rounded-full hover:bg-surface-2", panel === "search" ? "text-[var(--header)]" : "text-muted")}><Search className="size-5" /></button>
        {!isDm && <button aria-label={`Pinned messages (${pins.length})`} onClick={(e) => { e.stopPropagation(); setPanel(panel === "pins" ? undefined : "pins"); }} className={clsx("relative grid size-11 place-items-center rounded-full hover:bg-surface-2", panel === "pins" ? "text-[var(--header)]" : "text-muted")}><Pin className="size-5" />{pins.length > 0 && <span className="num absolute right-1.5 top-1.5 text-[9px] font-bold text-gold">{pins.length}</span>}</button>}
        {!isDm && <button aria-label="Members" onClick={(e) => { e.stopPropagation(); onMembers(); }} className="grid size-11 place-items-center rounded-full text-muted hover:bg-surface-2"><Users className="size-5" /></button>}
      </header>
      <VoiceBar s={s} srv={srv} now={now} />

      <div ref={scroller} role="log" aria-live="polite" aria-label={`Messages in ${title}`}
        onScroll={(e) => onScroll(e.currentTarget)}
        className="flex-1 overflow-y-auto overscroll-contain [overflow-anchor:none]">
        <div ref={content} className="pb-2 pt-3">
          {atStart && !jump && all.length < 400 && (
            <div className="mb-4 px-4 pt-6">
              <div className="grid size-16 place-items-center rounded-full bg-surface-3 text-[26px]">{isDm ? <Avatar src={peer!.avatar} size={64} /> : <Hash className="size-8" />}</div>
              <h3 className="mt-2 text-[24px] font-extrabold text-[var(--header)]">{isDm ? title : `Welcome to #${ch.name}!`}</h3>
              <p className="text-[14px] text-muted">{isDm ? (withGod ? `This is the beginning of your DMs with @${peer!.handle}.` : "Everything said here, God sees.") : `This is the start of the #${ch.name} channel. ${ch.topic}`}</p>
            </div>
          )}
          {!atStart && <div className="py-3 text-center text-[12px] text-muted" aria-hidden>Loading older messages…</div>}
          {msgs.map((m, i) => {
            const prev = msgs[i - 1];
            const showNew = m.t > readMark && (!prev || prev.t <= readMark) && i > 0 && m.authorId !== "god";
            const parent = m.replyTo ? findMsg(s, m.replyTo) : undefined;
            const rx = reactionsAt(m, now);
            const txt = textAt(m, now);
            const grouped = !!prev && !showNew && prev.authorId === m.authorId && m.t - prev.t < 5 * 60e3 && !m.replyTo && prev.kind === m.kind && dayOnly(prev.t, now) === dayOnly(m.t, now);
            const newDay = !prev || dayOnly(prev.t, now) !== dayOnly(m.t, now);
            return (
              <Row key={m.id} s={s} srv={srv} m={m} text={txt} edited={isEdited(m, now)} rx={rx} rxSig={rx.map((r) => `${r.emoji}${r.count}${r.me ? "*" : ""}`).join("")}
                parent={parent} parentText={parent ? textAt(parent, now) : undefined} grouped={grouped} dayLabel={newDay ? fullDate(m.t) : undefined} stamp={dayLabel(m.t, now)} showNew={showNew}
                fresh={now - m.t < 6000} flash={jump === m.id} selected={sel === m.id} picker={picker === m.id} threadCount={threadCounts.get(m.id) ?? 0} pinned={!!m.pinnedAt && m.pinnedAt <= now}
                canWrite={withGod && !ch.announce}
                onSelect={() => { haptic(4); setSel(sel === m.id ? undefined : m.id); setPicker(undefined); }}
                onLong={() => { setSel(undefined); setPicker(undefined); setSheet(m.id); }}
                onReact={(e) => react(m.id, e)} onPicker={() => setPicker(picker === m.id ? undefined : m.id)}
                onReply={() => { setReply(m); setEditing(undefined); setSel(undefined); }}
                onEdit={() => startEdit(m)} onDelete={() => { doDelete(m.id); setSel(undefined); }} onPin={() => { doPin(m.id); setSel(undefined); }}
                onThread={() => setPanel({ thread: m.id })} />
            );
          })}
        </div>
      </div>

      {(scrolledUp || jump) && (
        <button onClick={(e) => { e.stopPropagation(); toBottom(); }} className="pop mx-2 mb-1 flex min-h-[40px] items-center justify-between rounded-lg bg-[var(--selected)] px-3 text-[13px] font-semibold text-[var(--header)] shadow-lg">
          <span>{newBelow > 0 ? `${newBelow} new message${newBelow > 1 ? "s" : ""}` : "You're viewing older messages"}</span>
          <span className="flex items-center gap-1 text-gold">Jump to present <ArrowDown className="size-4" /></span>
        </button>
      )}

      <div className="relative px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-4 md:pb-3" onClick={(e) => e.stopPropagation()}>
        <div className="h-5 px-1 text-[12px] text-muted" aria-live="polite">
          {typing.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="typing-dots"><i /><i /><i /></span>
              <span className="truncate [&_b]:font-semibold [&_b]:text-[var(--header)]">{typingLabel(typing)}</span>
            </span>
          )}
        </div>
        {suggestions.length > 0 && (
          <div className="pop absolute inset-x-3 bottom-full mb-1 overflow-hidden rounded-lg bg-surface shadow-2xl md:inset-x-4">
            {suggestions.map((c) => (
              <button key={c.id} onClick={() => setText(text.replace(/@([\w.]*)$/, `@${c.username} `))} className="flex min-h-[44px] w-full items-center gap-2.5 px-3 text-left hover:bg-surface-2">
                <Avatar src={who(s, c.id).avatar} size={26} /><span className="text-[15px] font-medium">{c.nicknames[srv.id] ?? c.displayName}</span><span className="text-[13px] text-muted">@{c.username}</span>
              </button>
            ))}
          </div>
        )}
        {(reply || editing) && (
          <div className="flex items-center gap-2 rounded-t-lg bg-surface px-3 py-1.5 text-[13px] text-muted">
            {editing ? <Pencil className="size-3.5 shrink-0" /> : <Reply className="size-3.5 shrink-0" />}
            <span className="truncate">{editing ? "Editing message" : <>Replying to <b className="text-[var(--header)]">{nickOf(s, reply!.authorId, srv)}</b></>}</span>
            <button aria-label="Cancel" className="-my-2 ml-auto grid size-11 shrink-0 place-items-center rounded-full" onClick={() => { setReply(undefined); if (editing) { setEditing(undefined); setText(""); } }}><X className="size-4" /></button>
          </div>
        )}
        {withGod ? (
          <div className="flex items-end gap-2">
            {!editing && !ch.announce && <button aria-label="Emoji and stickers" onClick={() => setCompose(!compose)} className={clsx("grid size-11 shrink-0 place-items-center rounded-full bg-surface-3 transition-transform", compose ? "rotate-45 text-[var(--header)]" : "text-muted")}><Plus className="size-6" /></button>}
            <div className={clsx("flex min-w-0 flex-1 items-center bg-surface-3 pl-4 pr-0.5", reply || editing ? "rounded-b-[22px]" : "rounded-[22px]")}>
              <input ref={input} value={text} disabled={ch.announce} aria-label={`Message ${isDm ? title : `#${ch.name}`}`} onChange={(e) => onType(e.target.value)} onFocus={() => { stick.current = true; setCompose(false); if (text.trim() && !isDm && !editing) doTyping(srv.id, ch.id); }}
                onKeyDown={(e) => { if (e.key === "Enter") send(); if (e.key === "Escape") { setReply(undefined); setEditing(undefined); } if (e.key === "ArrowUp" && !text) { const mine = [...msgs].reverse().find((m) => m.authorId === "god" && !m.deleted); if (mine) startEdit(mine); } }}
                enterKeyHint="send" autoComplete="off"
                placeholder={ch.announce ? "Only mods can post in announcements" : isDm ? `Message @${peer!.handle}` : `Message #${ch.name}`} className="min-h-[44px] min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-muted md:text-[15px]" />
              {text.trim() || editing
                ? <button aria-label={editing ? "Save edit" : "Send"} onClick={send} disabled={!text.trim()} className="pop grid size-11 shrink-0 place-items-center rounded-full bg-gold text-[#1a1406] active:scale-90"><Send className="size-[18px]" /></button>
                : !ch.announce && <button aria-label="Emoji" onClick={() => setCompose(!compose)} className="grid size-11 shrink-0 place-items-center rounded-full text-muted"><Smile className="size-6" /></button>}
            </div>
          </div>
        ) : <div className="rounded-[22px] bg-surface-3/60 px-4 py-2.5 text-center text-[14px] text-muted">You&apos;re reading someone else&apos;s DMs. They can&apos;t see you.</div>}
        {compose && withGod && (
          <div className="pop mt-2 rounded-xl bg-surface p-2">
            <div className="px-1 pb-1 text-[12px] font-bold uppercase text-muted">Emoji</div>
            <div className="grid grid-cols-8 gap-0.5">
              {PICKER.map((e) => <button key={e} aria-label={`Insert ${e}`} onClick={() => { onType(text + e); input.current?.focus({ preventScroll: true }); }} className="grid size-11 place-items-center rounded-lg text-[22px] active:bg-surface-2 md:hover:bg-surface-2">{e}</button>)}
            </div>
            <div className="px-1 pb-1 pt-2 text-[12px] font-bold uppercase text-muted">Stickers</div>
            <div className="flex gap-1">
              {STICKERS.map((st) => <button key={st} aria-label={`Send ${st}`} onClick={() => { setCompose(false); stick.current = true; setFromId(undefined); doSay(srv.id, ch.id, st, reply?.id); setReply(undefined); }} className="grid min-h-[52px] min-w-0 flex-1 place-items-center whitespace-nowrap rounded-lg bg-[var(--chat)] text-[17px] tracking-[-0.15em] active:scale-95">{st}</button>)}
            </div>
          </div>
        )}
      </div>

      {sheetMsg && <ActionSheet s={s} srv={srv} m={sheetMsg} now={now} canWrite={withGod && !ch.announce} threadCount={threadCounts.get(sheetMsg.id) ?? 0}
        onClose={() => setSheet(undefined)} onReact={(e) => react(sheetMsg.id, e)}
        onReply={() => { setReply(sheetMsg); setEditing(undefined); setSheet(undefined); }} onEdit={() => startEdit(sheetMsg)}
        onDelete={() => { doDelete(sheetMsg.id); setSheet(undefined); }} onPin={() => { doPin(sheetMsg.id); setSheet(undefined); }}
        onThread={() => { setSheet(undefined); setPanel({ thread: sheetMsg.id }); }} />}
      {panel === "search" && <SearchPanel s={s} srv={srv} ch={ch} now={now} onClose={() => setPanel(undefined)} />}
      {panel === "pins" && <SidePanel title={`Pinned in #${ch.name}`} onClose={() => setPanel(undefined)}>
        {pins.length ? pins.map((m) => <MiniMsg key={m.id} s={s} srv={srv} m={m} now={now} onClick={() => { setPanel(undefined); go(`/lounge/${srv.id}/${ch.id}?m=${m.id}`); }} />) : <p className="p-4 text-[13px] text-muted">Nothing pinned yet. Mods pin the moments people want to keep.</p>}
      </SidePanel>}
      {thread && <ThreadPanel s={s} srv={srv} root={thread} now={now} onClose={() => setPanel(undefined)} />}
    </section>
  );
}

/* ---------------------------- phone action sheet ----------------------------- */

function SheetItem({ icon: I, label, name, onClick, danger }: { icon: typeof Reply; label: string; name?: string; onClick: () => void; danger?: boolean }) {
  return <button aria-label={name ?? label} onClick={onClick} className={clsx("flex min-h-[48px] w-full items-center gap-3 px-4 text-left text-[16px] font-medium active:bg-surface-2", danger ? "text-down" : "text-fg")}><I className="size-5 opacity-80" />{label}</button>;
}

function ActionSheet({ s, srv, m, now, canWrite, threadCount, onClose, onReact, onReply, onEdit, onDelete, onPin, onThread }: { s: WorldState; srv: Server; m: Message; now: number; canWrite: boolean; threadCount: number; onClose: () => void; onReact: (e: string) => void; onReply: () => void; onEdit: () => void; onDelete: () => void; onPin: () => void; onThread: () => void }) {
  const [more, setMore] = useState(false);
  const mine = m.authorId === "god";
  const pinned = !!m.pinnedAt && m.pinnedAt <= now;
  const a = who(s, m.authorId);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const copy = () => { void navigator.clipboard?.writeText(textAt(m, now)).catch(() => {}); toast("Copied text"); onClose(); };
  return (
    <div className="fixed inset-0 z-50" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="absolute inset-0 bg-black/60" />
      <div role="dialog" aria-label="Message actions" onClick={(e) => e.stopPropagation()} className="sheet-spring absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-2xl bg-surface pb-[max(0.75rem,env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-6 md:left-1/2 md:w-[420px] md:-translate-x-1/2 md:rounded-2xl">
        <div className="mx-auto mb-1 mt-2 h-1 w-10 rounded-full bg-[var(--surface-3)]" />
        <div className="flex items-center gap-2 px-4 pb-2 pt-1 text-[13px] text-muted"><Avatar src={a.avatar} size={20} /><b className="text-[var(--header)]">{a.char?.nicknames[srv.id] ?? a.name}</b><span className="truncate">{textAt(m, now) || (m.meme ? "sent a meme" : "")}</span></div>
        <div className="flex justify-between gap-1 px-3 pb-2">
          {QUICK.map((e) => <button key={e} aria-label={`React ${e}`} onClick={() => onReact(e)} className="grid size-12 place-items-center rounded-full bg-[var(--surface-3)] text-[22px] active:scale-90">{e}</button>)}
          <button aria-label="More reactions" onClick={() => setMore(!more)} className="grid size-12 place-items-center rounded-full bg-[var(--surface-3)] text-muted"><SmilePlus className="size-5" /></button>
        </div>
        {more && <div className="grid grid-cols-8 gap-0.5 px-3 pb-2">{PICKER.map((e) => <button key={e} aria-label={`React ${e}`} onClick={() => onReact(e)} className="grid size-11 place-items-center rounded-lg text-[20px] active:bg-surface-2">{e}</button>)}</div>}
        <div className="mx-3 overflow-hidden rounded-xl bg-[var(--chat)]">
          {canWrite && <SheetItem icon={Reply} label="Reply" onClick={onReply} />}
          {threadCount > 0 && <SheetItem icon={MessageCircle} label={`Open thread (${threadCount})`} onClick={onThread} />}
          {mine && canWrite && <SheetItem icon={Pencil} label="Edit Message" name="Edit" onClick={onEdit} />}
          {srv.id !== "dm" && <SheetItem icon={Pin} label={pinned ? "Unpin Message" : "Pin Message"} name={pinned ? "Unpin" : "Pin"} onClick={onPin} />}
          <SheetItem icon={Copy} label="Copy Text" onClick={copy} />
          {mine && <SheetItem icon={Trash2} label="Delete Message" name="Delete" onClick={onDelete} danger />}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- rows -------------------------------- */

interface RowProps {
  s: WorldState; srv: Server; m: Message; text: string; edited: boolean; rx: Reaction[]; rxSig: string; parent?: Message; parentText?: string; grouped: boolean; dayLabel?: string; stamp: string; showNew: boolean;
  fresh: boolean; flash: boolean; selected: boolean; picker: boolean; threadCount: number; pinned: boolean; canWrite: boolean;
  onSelect: () => void; onLong: () => void; onReact: (e: string) => void; onPicker: () => void; onReply: () => void; onEdit: () => void; onDelete: () => void; onPin: () => void; onThread: () => void;
}
const same = (a: RowProps, b: RowProps) => a.m === b.m && a.stamp === b.stamp && a.text === b.text && a.edited === b.edited && a.rxSig === b.rxSig && a.parentText === b.parentText && a.grouped === b.grouped && a.dayLabel === b.dayLabel && a.showNew === b.showNew && a.fresh === b.fresh && a.flash === b.flash && a.selected === b.selected && a.picker === b.picker && a.threadCount === b.threadCount && a.pinned === b.pinned && a.m.deleted === b.m.deleted && a.m.authorId === b.m.authorId && a.m.meme === b.m.meme;

const Row = memo(function Row({ s, srv, m, text, edited, rx, parent, parentText, grouped, dayLabel, stamp, showNew, fresh, flash, selected, picker, threadCount, pinned, canWrite, onSelect, onLong, onReact, onPicker, onReply, onEdit, onDelete, onPin, onThread }: RowProps) {
  const a = who(s, m.authorId);
  const nick = a.char?.nicknames[srv.id];
  const mine = m.authorId === "god";
  const pinged = !mine && srv.id !== "dm" && (m.mentionsGod || /@god\b/i.test(text)); // a 1:1 DM isn't a "mention"
  const press = useLongPress(onLong);
  const open = (e: React.MouseEvent) => { e.stopPropagation(); if (a.kind === "char") go(`/u/${a.id}`); };
  const pa = parent ? who(s, parent.authorId) : undefined;
  if (m.deleted) return null;
  if (m.intent === "pin") return (
    <div data-mid={m.id} data-author={m.authorId} className={clsx("msg-row flex items-start gap-3 px-4 py-1.5", fresh && "msg-in")}>
      <span className="grid w-10 shrink-0 place-items-center pt-0.5 text-muted"><Pin className="size-4" /></span>
      <span className="min-w-0 flex-1 text-[15px] text-muted"><b className="font-semibold text-[var(--header)]">{nick ?? a.name}</b> pinned a message to this channel. <span className="text-[12px]">{stamp}</span></span>
    </div>
  );
  if (m.intent === "voiceJoin") return (
    <div data-mid={m.id} data-testid="voice-banner" className={clsx("vc-banner mx-3 my-2 rounded-lg px-3 py-2 text-center", fresh && "msg-in")}>
      <div className="flex items-center justify-center gap-2 text-[14px] font-semibold text-gold"><Mic className="size-4" />@god {text}</div>
      {rx.length > 0 && <div className="mt-1 flex flex-wrap justify-center gap-1">{rx.map((r) => <span key={r.emoji} className="num rounded-lg bg-surface px-2 py-0.5 text-[13px]">{r.emoji} {r.count}</span>)}</div>}
    </div>
  );
  return (
    <>
      {dayLabel && <div className="mx-4 my-4 flex items-center gap-2 text-[12px] font-semibold text-muted"><div className="h-px flex-1 bg-[var(--border)]" /><span>{dayLabel}</span><div className="h-px flex-1 bg-[var(--border)]" /></div>}
      {showNew && <div className="relative mx-4 my-2 h-px bg-down"><span className="absolute -top-[8px] right-0 rounded-[4px] bg-down px-1 text-[10px] font-bold leading-4 text-white">NEW</span></div>}
      <div data-mid={m.id} data-author={m.authorId} data-reply-author={parent?.authorId}
        {...press}
        onClick={(e) => { e.stopPropagation(); if (press.consumed()) return; if (!isPhone()) onSelect(); }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (isPhone()) onLong(); else if (!selected) onSelect(); }}
        className={clsx("msg-row press row-cv group relative cursor-default select-none px-4 md:select-text", grouped ? "py-[2px]" : "mt-[14px] pb-[2px] pt-[2px]", fresh && "msg-in", flash && "flash-gold",
          pinged && "mention-row", selected && "!bg-[var(--chat-hover)]")}>
        {parent && pa && (
          <div className="reply-spine mb-1 ml-[52px] flex items-center gap-1.5 truncate text-[13px] text-muted">
            <Avatar src={pa.avatar} size={16} />
            <span className={clsx("shrink-0 font-semibold", pa.kind === "god" ? "text-gold" : "text-[var(--header)]/80")}>{pa.kind === "god" ? "" : "@"}{pa.char?.nicknames[srv.id] ?? pa.name}</span>
            <span className="truncate">{parent.deleted ? <i>Original message was deleted</i> : parentText}</span>
          </div>
        )}
        <div className="flex gap-3">
          {grouped ? (
            <span className="w-10 shrink-0 pt-1 text-right text-[10px] leading-[22px] text-muted opacity-0 md:group-hover:opacity-100">{clockTime(m.t)}</span>
          ) : (
            <button onClick={open} aria-label={`${a.name}'s profile`} className="hit mt-0.5 shrink-0 self-start"><Avatar src={a.avatar} size={40} ring={mine ? "var(--gold)" : undefined} /></button>
          )}
          <div className="min-w-0 flex-1">
            {!grouped && (
              <div className="flex items-baseline gap-2">
                <button onClick={open} className="msg-name hit-lg min-w-0 truncate" style={{ color: a.char && srv.moderators.includes(a.id) ? MOD : mine ? "var(--gold)" : undefined }}><NameLine w={{ ...a, verified: mine }} nick={nick} /></button>
                <span className="shrink-0 text-[12px] font-medium text-muted">{stamp}</span>
                {pinned && <Pin className="size-3 shrink-0 text-gold" aria-label="pinned" />}
              </div>
            )}
            <div className={clsx("msg-text whitespace-pre-wrap break-words", m.kind === "bot" && "mt-0.5 rounded-md border-l-4 border-[var(--brand)] bg-surface px-3 py-1.5 not-italic")}>
              <RichText text={text} onUser={(h) => { const c = s.characters.find((x) => x.username === h); if (c) go(`/u/${c.id}`); }} onTag={(t) => go(`/chirp/tag/${t}`)} />
              {edited && <span className="ml-1 text-[11px] text-muted">(edited)</span>}
            </div>
            {m.meme && <MemeImage m={m.meme} id={m.id} />}
            {threadCount > 0 && (
              <button aria-label={`${threadCount} ${threadCount === 1 ? "reply" : "replies"} in thread`} onClick={(e) => { e.stopPropagation(); onThread(); }} className="mt-1 flex min-h-[44px] items-center gap-1.5 rounded-lg bg-surface px-3 text-[13px] font-semibold text-[var(--header)] hover:bg-surface-2"><MessageCircle className="size-4 text-muted" />{threadCount} {threadCount === 1 ? "Message" : "Messages"} <span className="font-normal text-gold">›</span></button>
            )}
            {rx.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {rx.slice(0, 12).map((r) => (
                  <button key={r.emoji} aria-label={`${r.emoji} ${r.count}${r.me ? ", you reacted" : ""}`} aria-pressed={!!r.me} onClick={(e) => { e.stopPropagation(); onReact(r.emoji); }}
                    className={clsx("hit react-pop flex h-[30px] items-center gap-1.5 rounded-lg border px-2 text-[14px] transition-colors active:scale-95", r.me ? "border-gold/80 bg-gold/15" : "border-transparent bg-surface hover:border-[var(--border)]")}>
                    {r.emoji} <span className={clsx("num text-[13px] font-semibold", r.me ? "text-gold" : "text-muted")}>{r.count}</span>
                  </button>
                ))}
                {rx.length > 12 && <span className="self-center text-[12px] text-muted">+{rx.length - 12}</span>}
              </div>
            )}
            {selected && (
              <div onClick={(e) => e.stopPropagation()} className="pop mt-1.5 flex w-fit max-w-full flex-wrap items-center gap-0.5 rounded-lg border border-black/30 bg-surface p-1 shadow-xl">
                {QUICK.map((e) => <button key={e} aria-label={`React ${e}`} onClick={() => onReact(e)} className="grid size-9 place-items-center rounded-md text-[18px] hover:bg-surface-2 active:scale-90">{e}</button>)}
                <button aria-label="More reactions" onClick={onPicker} className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2"><SmilePlus className="size-4" /></button>
                <span className="mx-0.5 h-5 w-px bg-[var(--border)]" />
                {canWrite && <ActBtn icon={Reply} label="Reply" onClick={onReply} />}
                {mine && canWrite && <ActBtn icon={Pencil} label="Edit" onClick={onEdit} />}
                {srv.id !== "dm" && <ActBtn icon={Pin} label={pinned ? "Unpin" : "Pin"} onClick={onPin} />}
                {mine && <ActBtn icon={Trash2} label="Delete" onClick={onDelete} danger />}
                {picker && (
                  <div className="grid w-full grid-cols-8 gap-0.5 border-t border-[var(--border)] pt-1 sm:grid-cols-10">
                    {PICKER.map((e) => <button key={e} aria-label={`React ${e}`} onClick={() => onReact(e)} className="grid size-9 place-items-center rounded-md text-[18px] hover:bg-surface-2 active:scale-90">{e}</button>)}
                  </div>
                )}
              </div>
            )}
          </div>
          {!selected && <button aria-label="Message actions" onClick={(e) => { e.stopPropagation(); onSelect(); }} className="hidden self-start text-muted opacity-0 group-hover:opacity-100 md:block"><SmilePlus className="size-4" /></button>}
        </div>
      </div>
    </>
  );
}, same);

function ActBtn({ icon: I, label, onClick, danger }: { icon: typeof Reply; label: string; onClick: () => void; danger?: boolean }) {
  return <button onClick={onClick} className={clsx("flex min-h-9 items-center gap-1 rounded-md px-2.5 text-[13px] font-semibold hover:bg-surface-2", danger && "text-down")}><I className="size-3.5" /> {label}</button>;
}

function MiniMsg({ s, srv, m, now, onClick, hl }: { s: WorldState; srv: Server; m: Message; now: number; onClick?: () => void; hl?: string }) {
  const a = who(s, m.authorId);
  const t = textAt(m, now);
  let body: React.ReactNode = t;
  if (hl) { const i = t.toLowerCase().indexOf(hl.toLowerCase()); if (i >= 0) body = <>{t.slice(0, i)}<mark className="rounded bg-gold/30 px-0.5 text-fg">{t.slice(i, i + hl.length)}</mark>{t.slice(i + hl.length)}</>; }
  const chName = srv.channels.find((c) => c.id === m.channelId)?.name;
  return (
    <button onClick={onClick} className="flex w-full gap-2.5 rounded-xl p-2 text-left hover:bg-surface-2">
      <Avatar src={a.avatar} size={30} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2 text-[13px]"><span className={clsx("truncate font-semibold", a.kind === "god" && "text-gold")}>{a.char?.nicknames[srv.id] ?? a.name}</span><span className="shrink-0 text-[10.5px] text-muted">{chName ? `#${chName} · ` : ""}{relTime(m.t, now)}</span></span>
        <span className="block break-words text-[13.5px] leading-snug">{body}</span>
      </span>
    </button>
  );
}

function SidePanel({ title, onClose, children }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={(e) => e.stopPropagation()} className="sheet-up absolute inset-0 z-30 flex flex-col bg-surface md:inset-y-0 md:left-auto md:right-0 md:w-[380px] md:border-l md:border-line md:shadow-[-12px_0_40px_rgba(0,0,0,0.35)]">
      <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-line px-3">
        <div className="min-w-0 flex-1 truncate text-[15px] font-bold">{title}</div>
        <button aria-label="Close panel" onClick={onClose} className="grid size-10 place-items-center rounded-full hover:bg-surface-2"><X className="size-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">{children}</div>
    </div>
  );
}

function SearchPanel({ s, srv, ch, now, onClose }: { s: WorldState; srv: Server; ch: Channel; now: number; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"channel" | "server">("channel");
  const res = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (k.length < 2) return [];
    const from = k.startsWith("from:") ? k.slice(5).split(" ")[0] : undefined;
    const word = from ? k.slice(5 + from.length).trim() : k;
    const out: Message[] = [];
    const all = [...s.messages, ...s.pending.filter((m) => m.t <= now)];
    for (let i = all.length - 1; i >= 0 && out.length < 80; i--) {
      const m = all[i];
      if (m.deleted || (scope === "channel" ? m.channelId !== ch.id : m.serverId !== srv.id)) continue;
      if (from) { const a = who(s, m.authorId); if (!a.handle.toLowerCase().startsWith(from) && !a.name.toLowerCase().startsWith(from)) continue; }
      if (word && !textAt(m, now).toLowerCase().includes(word)) continue;
      out.push(m);
    }
    return out;
  }, [q, scope, s, ch.id, srv.id, now]);
  const hl = q.trim().toLowerCase().startsWith("from:") ? q.trim().split(" ").slice(1).join(" ") : q.trim();
  return (
    <SidePanel title="Search" onClose={onClose}>
      <div className="sticky top-0 z-10 bg-surface pb-2">
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface-3 px-3 focus-within:border-gold/50">
          <Search className="size-4 text-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages, or from:username" aria-label="Search messages" className="min-w-0 flex-1 bg-transparent py-2.5 text-[16px] outline-none md:text-[14px]" />
        </div>
        {srv.id !== "dm" && <div className="mt-2 flex gap-1.5 text-[12px]">{(["channel", "server"] as const).map((x) => <button key={x} onClick={() => setScope(x)} className={clsx("min-h-8 rounded-full px-3", scope === x ? "bg-gold text-[#1a1406] font-semibold" : "bg-surface-3 text-muted")}>{x === "channel" ? `#${ch.name}` : `All of ${srv.name}`}</button>)}</div>}
      </div>
      {q.trim().length >= 2 && <div className="px-2 pb-1 text-[11px] text-muted">{res.length >= 80 ? "80+" : res.length} results</div>}
      {res.map((m) => <MiniMsg key={m.id} s={s} srv={srv} m={m} now={now} hl={hl} onClick={() => { onClose(); go(`/lounge/${srv.id}/${m.channelId}?m=${m.id}`); }} />)}
      {q.trim().length < 2 && <p className="p-3 text-[13px] text-muted">The whole history is searchable. Try <b>god</b>, <b>from:</b> a username, or a coin.</p>}
    </SidePanel>
  );
}

function ThreadPanel({ s, srv, root, now, onClose }: { s: WorldState; srv: Server; root: Message; now: number; onClose: () => void }) {
  const list = threadMessages(s, root.id, now);
  const typing = typingIn(s, root.channelId, now, root.id).map((id) => nickOf(s, id, srv));
  return (
    <SidePanel title={<span className="flex items-center gap-2"><MessageCircle className="size-4 text-brand" /> Thread</span>} onClose={onClose}>
      <MiniMsg s={s} srv={srv} m={root} now={now} />
      <div className="my-1 flex items-center gap-2 px-2 text-[11px] text-muted"><div className="h-px flex-1 bg-line" />{list.length} {list.length === 1 ? "reply" : "replies"}<div className="h-px flex-1 bg-line" /></div>
      {list.map((m) => <MiniMsg key={m.id} s={s} srv={srv} m={m} now={now} />)}
      {typing.length > 0 && <div className="flex items-center gap-1.5 px-3 py-2 text-[11.5px] text-muted"><span className="typing-dots"><i /><i /><i /></span><span className="[&_b]:font-semibold">{typingLabel(typing)}</span></div>}
    </SidePanel>
  );
}

/* ------------------------------- members ------------------------------- */

type WhoT = ReturnType<typeof who>;
const DOT: Record<Presence, string> = { online: "bg-up", idle: "bg-gold", offline: "bg-muted/50" };

function MemberItem({ x, srv, now, presence, typing }: { x: WhoT; srv: Server; now: number; presence: Presence; typing: boolean }) {
  const c = x.char!;
  const h = localHour(c, now);
  const mod = srv.moderators.includes(x.id);
  const badges = badgesFor(c, srv);
  const ob = OBSESSION_INFO[obsessionOf(c)];
  return (
    <div className={clsx("group flex w-full items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-surface-2", presence === "offline" && "opacity-45")}>
      <button onClick={() => go(`/u/${x.id}`)} className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 text-left">
        <span className="relative shrink-0"><Avatar src={x.avatar} size={32} /><span className={clsx("absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface", DOT[presence])} /></span>
        <span className="min-w-0">
          <span className="flex items-center gap-1" style={{ color: mod ? MOD : c.core ? "var(--gold)" : undefined }}><NameLine w={{ ...x, verified: false }} nick={c.nicknames[srv.id]} className="text-[13.5px]" /></span>
          <span className="flex items-center gap-1 truncate text-[10.5px] text-muted">
            {typing ? <span className="text-up">typing…</span> : presence === "offline" ? <span>{c.location}</span> : <span>{c.location} · {Math.floor(h)}:{String(Math.floor((h % 1) * 60)).padStart(2, "0")}</span>}
          </span>
          {badges.length > 0 && <span className="mt-0.5 flex flex-wrap gap-1">{badges.map((b) => <span key={b.label} className="rounded px-1 text-[9.5px] font-semibold leading-[15px]" style={{ background: b.color + "22", color: b.color }}>{b.label}</span>)}<span className="sr-only">{ob.label}</span></span>}
        </span>
      </button>
      <button aria-label={`Message ${c.displayName}`} onClick={() => go(`/lounge/dm/${dmChannel("god", x.id)}`)} className="grid size-11 shrink-0 place-items-center rounded-full text-muted opacity-100 hover:bg-surface-3 hover:text-fg md:opacity-0 md:group-hover:opacity-100"><MessageCircle className="size-4" /></button>
    </div>
  );
}

function MemberList({ s, srv, chId, now, open, onClose }: { s: WorldState; srv: Server; chId: string; now: number; open: boolean; onClose: () => void }) {
  const slot = Math.floor(now / 10_000);
  const groups = useMemo(() => {
    const seen = lastSeenMap(s, slot * 10_000, srv.id, 4000);
    const g: Record<Presence, { id: string; t: number; core: boolean; mod: boolean; p: Presence }[]> = { online: [], idle: [], offline: [] };
    for (const id of srv.members) {
      const c = s.characters[Number(id.slice(1))];
      const p = presenceOf(c, seen.get(id), slot * 10_000);
      g[p].push({ id, t: seen.get(id) ?? 0, core: !!c.core, mod: srv.moderators.includes(id), p });
    }
    const sort = (a: { t: number; core: boolean; mod: boolean }, b: { t: number; core: boolean; mod: boolean }) => Number(b.core) - Number(a.core) || b.t - a.t;
    // moderators are a hoisted role, shown above everyone else while they're around
    const mods = [...g.online, ...g.idle].filter((m) => m.mod).sort(sort);
    return { mods, online: g.online.filter((m) => !m.mod).sort(sort), idle: g.idle.filter((m) => !m.mod).sort(sort), offline: g.offline.sort(sort) };
  }, [s, srv, slot]);
  const typing = new Set(typingIn(s, chId, now));
  const CAP: Record<Presence, number> = { online: 80, idle: 40, offline: 30 };
  return (
    <aside aria-label="Members" className={clsx("shrink-0 overflow-y-auto border-l border-line bg-surface p-2",
      "max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-40 max-md:w-[min(86vw,320px)] max-md:shadow-[-8px_0_40px_rgba(0,0,0,0.5)] max-md:transition-transform max-md:duration-300 max-md:ease-[cubic-bezier(.2,.8,.2,1)]",
      open ? "max-md:translate-x-0" : "max-md:translate-x-[105%]",
      "md:w-[250px]", open ? "md:block" : "md:hidden xl:block")}>
      <div className="flex items-center justify-between px-2 pt-2">
        <div className="text-[14px] font-bold">Members <span className="num text-muted">{fmtCount(srv.memberCount)}</span></div>
        <button aria-label="Close members" className="grid size-11 place-items-center rounded-full bg-surface-3 md:hidden" onClick={onClose}><X className="size-4" /></button>
      </div>
      {(["mods", "online", "idle", "offline"] as const).map((p) => groups[p].length > 0 && (
        <div key={p}>
          <div className="px-2 pb-1 pt-4 text-[12px] font-bold uppercase text-muted">{p === "mods" ? "Moderators" : p} — {groups[p].length}</div>
          {groups[p].slice(0, p === "mods" ? 20 : CAP[p]).map((m) => <MemberItem key={m.id} x={who(s, m.id)} srv={srv} now={now} presence={m.p} typing={typing.has(m.id)} />)}
          {p !== "mods" && groups[p].length > CAP[p] && <div className="px-2 py-1 text-[12px] text-muted">and {groups[p].length - CAP[p]} more</div>}
        </div>
      ))}
      <div className="mt-3 flex items-center gap-1.5 px-2 pb-4 text-[10px] text-muted"><AtSign className="size-3" />{srv.members.length} regulars · {fmtCount(srv.memberCount)} total</div>
    </aside>
  );
}
