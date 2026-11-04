"use client";
import clsx from "clsx";
import { MemeImage } from "../MemeImage";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, AtSign, ChevronDown, Headphones, HeadphoneOff, Mic, MicOff, PhoneOff, Volume2, CornerUpLeft, Eye, Hash, Megaphone, Menu, MessageCircle, MessagesSquare, Pencil, Pin, Reply, Search, Send, SmilePlus, Trash2, Users, X } from "lucide-react";
import type { Route } from "../App";
import { haptic } from "../App";
import { doDelete, doEdit, doJoinVoice, doLeaveVoice, doPin, doReact, doSay, doStopTyping, doTyping, markRead, setFocus, useApp } from "../store";
import { overheardAt, speaking, voiceChannels, voiceRoster } from "@/lib/sim/presence";
import { Avatar, NameLine, RichText, go, who } from "../ui";
import { channelMessages, dmThreads, isEdited, localHour, pinnedIn, reactionsAt, textAt, threadMessages, typingIn, unreadIndex, type UnreadInfo } from "@/lib/sim/engine";
import { dmChannel, dmPeer } from "@/lib/sim/godspeak";
import { badgesFor, lastSeenMap, obsessionOf, OBSESSION_INFO, presenceOf, type Presence } from "@/lib/sim/social";
import { clockTime, dayOnly, fmtCount, relTime } from "@/lib/sim/format";
import type { Channel, Message, Reaction, Server, WorldState } from "@/lib/sim/types";

const MOD = "#5eead4";
const QUICK = ["👑", "🔥", "😭", "💀", "👀", "🫡"];
const PICKER = ["👑", "🔥", "😭", "💀", "👀", "🫡", "😂", "🤣", "❤️", "💯", "🙏", "👏", "🤡", "🧢", "🥶", "🐐", "📈", "📉", "💸", "🚀", "🤝", "😤", "🥹", "👋", "✅", "❌", "🍿", "🧠", "😐", "🙄"];
const DM_SERVER: Server = { id: "dm", name: "Direct Messages", icon: "💬", color: "#8a6416", description: "", bias: 0, vibe: "culture", tags: [], channels: [], members: [], moderators: [], memberCount: 0, insideJokes: [] };
const nickOf = (s: WorldState, id: string, srv: Server) => { const x = who(s, id); return x.char?.nicknames[srv.id] ?? x.name; };

/* ======================================================================= */

export function Lounge({ route }: { route: Route }) {
  const { world: w, now, lastRead } = useApp();
  const s = w!;
  const isDm = route.parts[0] === "dm";
  const srv = isDm ? DM_SERVER : s.servers.find((x) => x.id === route.parts[0]) ?? s.servers[0];
  const dms = useMemo(() => dmThreads(s, now), [s, now]);
  const dmId = isDm ? route.parts[1] ?? dms.find((d) => d.withGod)?.channelId ?? dms[0]?.channelId : undefined;
  const ch: Channel | undefined = isDm ? (dmId ? { id: dmId, name: "dm", topic: "", tags: [] } : undefined) : srv.channels.find((c) => c.id === route.parts[1]) ?? srv.channels.find((c) => c.name === "general") ?? srv.channels[0];
  const chId = ch?.id ?? "";
  const [drawer, setDrawer] = useState(false);
  // Member panel is tied to the channel it was opened in, so navigating (e.g. into a DM) closes it.
  const [membersFor, setMembersFor] = useState<string | null>(null);
  const members = !isDm && membersFor === chId;
  const setMembers = (v: boolean | ((m: boolean) => boolean)) => setMembersFor((cur) => ((typeof v === "function" ? v(cur === chId) : v) ? chId : null));
  const touch = useRef<{ x: number; y: number } | null>(null);
  const unread = unreadIndex(s, now, lastRead, now - 15 * 60e3);

  useEffect(() => { if (chId) markRead(chId); }, [chId, now]);
  useEffect(() => { setFocus(chId ? { serverId: srv.id, channelId: chId } : undefined); return () => setFocus(undefined); }, [srv.id, chId]);

  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const st = touch.current; touch.current = null;
    if (!st || window.innerWidth >= 768) return;
    const t = e.changedTouches[0], dx = t.clientX - st.x, dy = t.clientY - st.y;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    if (dx > 0) { if (members) setMembers(false); else setDrawer(true); }
    else { if (drawer) setDrawer(false); else if (!isDm) setMembers(true); }
  };
  const close = () => { setDrawer(false); setMembers(false); };
  useEffect(() => {
    if (!drawer && !members) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setDrawer(false); setMembersFor(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer, members]);

  return (
    <div className="relative flex h-full overflow-clip" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <nav aria-label="Servers and channels" className={clsx("flex shrink-0 bg-bg",
        "max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:w-[min(90vw,350px)] max-md:shadow-[8px_0_40px_rgba(0,0,0,0.5)] max-md:transition-transform max-md:duration-300 max-md:ease-[cubic-bezier(.2,.8,.2,1)]",
        drawer ? "max-md:translate-x-0" : "max-md:-translate-x-[105%]")}>
        <ServerRail s={s} srvId={srv.id} chId={chId} unread={unread} dms={dms} />
        {isDm
          ? <DmList s={s} now={now} chId={chId} dms={dms} unread={unread} onPick={() => setDrawer(false)} onClose={() => setDrawer(false)} />
          : <ChannelList s={s} srv={srv} chId={chId} now={now} unread={unread} onPick={() => setDrawer(false)} onClose={() => setDrawer(false)} />}
      </nav>
      <div onClick={close} className={clsx("absolute inset-0 z-30 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 md:hidden", drawer || members ? "opacity-100" : "pointer-events-none opacity-0")} />
      {ch
        ? <ChannelView key={chId} s={s} srv={srv} ch={ch} now={now} lastReadAt={lastRead[chId] ?? now - 15 * 60e3} route={route} onMenu={() => setDrawer(true)} onMembers={() => setMembers((m) => !m)} />
        : <EmptyDms onMenu={() => setDrawer(true)} />}
      {!isDm && <MemberList s={s} srv={srv} chId={chId} now={now} open={members} onClose={() => setMembers(false)} />}
    </div>
  );
}

/* ----------------------------- server rail ----------------------------- */

function Pill({ n, mention }: { n: number; mention?: boolean }) {
  if (!n) return null;
  return <span className={clsx("badge-bump num min-w-[18px] rounded-full px-1.5 text-center text-[10px] font-bold leading-[18px]", mention ? "bg-down text-white" : "bg-gold text-[#1a1406]")}>{n > 99 ? "99+" : n}</span>;
}

function ServerRail({ s, srvId, chId, unread, dms }: { s: WorldState; srvId: string; chId: string; unread: Map<string, UnreadInfo>; dms: ReturnType<typeof dmThreads> }) {
  const dmMentions = dms.filter((d) => d.withGod && d.channelId !== chId).reduce((a, d) => a + (unread.get(d.channelId)?.n ?? 0), 0);
  return (
    <div className="no-scrollbar flex w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-line bg-bg py-3">
      <button aria-label={`Direct messages${dmMentions ? `, ${dmMentions} unread` : ""}`} onClick={() => go("/lounge/dm")} className="relative mb-0.5 flex flex-col items-center gap-1 active:scale-95">
        <span className={clsx("grid size-12 place-items-center bg-gradient-to-br from-gold to-[#b9832a] text-[#1a1406] shadow-[0_6px_20px_rgb(var(--glow)/0.25)] transition-all duration-200", srvId === "dm" ? "rounded-2xl" : "rounded-full")}><MessagesSquare className="size-5" /></span>
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-gold">Lounge</span>
        {dmMentions > 0 && <span className="absolute -right-1 top-7"><Pill n={dmMentions} mention /></span>}
      </button>
      <div className="h-px w-8 bg-line" />
      {s.servers.map((x) => {
        const active = x.id === srvId;
        let n = 0, m = 0;
        for (const c of x.channels) { if (c.id === chId) continue; const u = unread.get(c.id); if (u) { n += u.n; m += u.mentions; } }
        return (
          <button key={x.id} title={x.name} aria-label={`${x.name}${m ? `, ${m} mentions` : n ? ", unread" : ""}`} aria-current={active ? "true" : undefined} onClick={() => { haptic(5); go(`/lounge/${x.id}`); }} className="group relative flex w-full shrink-0 justify-center active:scale-95">
            <span className={clsx("absolute left-0 top-1/2 w-1 -translate-y-1/2 rounded-r-full bg-fg transition-all duration-200", active ? "h-9" : n ? "h-2" : "h-0 group-hover:h-5")} />
            <span className={clsx("grid size-12 place-items-center text-[21px] transition-all duration-200", active ? "rounded-2xl ring-2 ring-gold/70" : "rounded-full opacity-85 group-hover:rounded-2xl group-hover:opacity-100")}
              style={{ background: active ? `linear-gradient(140deg, ${x.color}, color-mix(in srgb, ${x.color} 55%, black))` : "var(--surface-3)" }}>{x.icon}</span>
            {m > 0 && <span className="absolute bottom-0 right-2"><Pill n={m} mention /></span>}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------- channel list ---------------------------- */

const groupOf = (c: Channel) => (c.announce ? "Information" : /general|chat|off-?topic|lounge|meme|welcome|intro|vc|hangout/i.test(c.name) ? "Community" : "Topics");

function ChannelList({ s, srv, chId, now, unread, onPick, onClose }: { s: WorldState; srv: Server; chId: string; now: number; unread: Map<string, UnreadInfo>; onPick: () => void; onClose: () => void }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const groups = ["Information", "Community", "Topics"].map((g) => [g, srv.channels.filter((c) => groupOf(c) === g)] as const).filter(([, cs]) => cs.length);
  const slot = Math.floor(now / 15000);
  const seen = useMemo(() => lastSeenMap(s, slot * 15000, srv.id, 3000), [s, srv.id, slot]);
  const online = srv.members.reduce((a, id) => a + (presenceOf(s.characters[Number(id.slice(1))], seen.get(id), now) === "online" ? 1 : 0), 0);
  return (
    <aside className="flex w-full min-w-0 flex-col border-r border-line bg-surface md:w-[248px]">
      <div className="relative overflow-hidden border-b border-line p-4 pt-5">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ background: `radial-gradient(120% 90% at 0% 0%, ${srv.color}, transparent 70%)` }} />
        <div className="relative flex items-start justify-between gap-2">
          <h2 className="truncate text-[17px] font-bold tracking-tight">{srv.icon} {srv.name}</h2>
          <button aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full bg-black/30 md:hidden" onClick={onClose}><X className="size-4" /></button>
        </div>
        <p className="relative mt-1 line-clamp-2 text-[12px] text-muted">{srv.description}</p>
        <div className="relative mt-2 flex items-center gap-3 text-[11px] text-muted">
          <span><span className="mr-1 inline-block size-2 rounded-full bg-up" />{online} regulars online</span>
          <span>{fmtCount(srv.memberCount)} members</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {groups.map(([label, cs]) => {
          const shut = collapsed[label];
          return (
            <div key={label}>
              <button aria-expanded={!shut} onClick={() => setCollapsed((c) => ({ ...c, [label]: !c[label] }))} className="flex w-full items-center gap-1 px-1 pb-1 pt-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted hover:text-fg">
                <ChevronDown className={clsx("size-3 transition-transform duration-200", shut && "-rotate-90")} />{label}
              </button>
              {cs.map((c) => {
                const u = c.id === chId ? undefined : unread.get(c.id);
                const on = c.id === chId;
                if (shut && !on && !u?.mentions) return null;
                return (
                  <button key={c.id} onClick={() => { haptic(5); go(`/lounge/${srv.id}/${c.id}`); onPick(); }} aria-current={on ? "page" : undefined}
                    className={clsx("relative flex min-h-[40px] w-full items-center gap-2 rounded-xl px-2.5 text-[14.5px] transition-colors md:min-h-[34px] md:text-[14px]", on ? "bg-gold/10 text-gold" : u ? "font-semibold text-fg hover:bg-surface-2" : "text-muted hover:bg-surface-2 hover:text-fg")}>
                    {u && !on && <span className="absolute -left-2 h-2 w-1 rounded-r-full bg-fg" />}
                    {c.announce ? <Megaphone className="size-4 shrink-0 opacity-70" /> : <Hash className="size-4 shrink-0 opacity-70" />}
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
      <MeBar s={s} />
    </aside>
  );
}

function VoiceList({ s, srv, now }: { s: WorldState; srv: Server; now: number }) {
  const [shut, setShut] = useState(false);
  const g = s.voice?.god && !s.voice.god.leftAt ? s.voice.god : undefined;
  return (
    <div data-testid="voice-list">
      <button aria-expanded={!shut} onClick={() => setShut(!shut)} className="flex w-full items-center gap-1 px-1 pb-1 pt-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted hover:text-fg">
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
                ? <button onClick={() => { haptic(8); doLeaveVoice(); }} className="ml-auto flex items-center gap-1 rounded-full bg-down/15 px-2.5 py-1 text-[11.5px] font-semibold text-down"><PhoneOff className="size-3.5" />Leave</button>
                : <button onClick={() => { haptic(8); doJoinVoice(srv.id, vc.id); }} className="ml-auto rounded-full bg-surface-3 px-2.5 py-1 text-[11.5px] font-semibold text-fg hover:bg-gold hover:text-[#1a1406]">Join voice</button>}
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
      <button aria-label="Leave voice" onClick={() => { haptic(8); doLeaveVoice(); }} className="grid size-7 shrink-0 place-items-center rounded-full bg-down/15 text-down"><PhoneOff className="size-3.5" /></button>
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

function DmList({ s, now, chId, dms, unread, onPick, onClose }: { s: WorldState; now: number; chId: string; dms: ReturnType<typeof dmThreads>; unread: Map<string, UnreadInfo>; onPick: () => void; onClose: () => void }) {
  const mine = dms.filter((d) => d.withGod), others = dms.filter((d) => !d.withGod).slice(0, 25);
  const item = (d: (typeof dms)[number]) => {
    const ids = d.channelId.split(":").slice(1);
    const peer = d.withGod ? who(s, dmPeer(d.channelId)) : who(s, ids[0]);
    const other = d.withGod ? undefined : who(s, ids[1]);
    const u = d.channelId === chId ? undefined : unread.get(d.channelId);
    const lastBy = d.last.authorId === "god" ? "You: " : !d.withGod ? `${who(s, d.last.authorId).name}: ` : "";
    return (
      <button key={d.channelId} onClick={() => { go(`/lounge/dm/${d.channelId}`); onPick(); }} className={clsx("flex min-h-[52px] w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left", d.channelId === chId ? "bg-gold/10" : "hover:bg-surface-2")}>
        <span className="relative shrink-0">
          <Avatar src={peer.avatar} size={36} />
          {other && <Avatar src={other.avatar} size={20} className="absolute -bottom-1 -right-1 ring-2 ring-surface" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={clsx("block truncate text-[14px]", u ? "font-bold" : "font-medium")}>{peer.name}{other ? ` & ${other.name}` : ""}</span>
          <span className="block truncate text-[12px] text-muted">{lastBy}{textAt(d.last, now)}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1"><span className="text-[10px] text-muted">{relTime(d.last.t, now)}</span>{u && d.withGod ? <Pill n={u.n} mention /> : null}</span>
      </button>
    );
  };
  return (
    <aside className="flex w-full min-w-0 flex-col border-r border-line bg-surface md:w-[268px]">
      <div className="flex items-center justify-between border-b border-line p-4 pt-5">
        <h2 className="text-[17px] font-bold">Direct messages</h2>
        <button aria-label="Close" className="grid size-9 place-items-center rounded-full bg-surface-3 md:hidden" onClick={onClose}><X className="size-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <div className="px-2 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">Your DMs</div>
        {mine.length ? mine.map(item) : <p className="px-2 py-2 text-[12.5px] text-muted">No DMs yet. Open someone&apos;s profile or the member list and tap Message.</p>}
        {others.length > 0 && <div className="flex items-center gap-1.5 px-2 pb-1 pt-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted"><Eye className="size-3" /> God sees every DM</div>}
        {others.map(item)}
      </div>
      <MeBar s={s} />
    </aside>
  );
}

function EmptyDms({ onMenu }: { onMenu: () => void }) {
  return (
    <section className="grid min-w-0 flex-1 place-items-center p-6 text-center">
      <div>
        <button aria-label="Open channels" onClick={onMenu} className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-surface-3 md:hidden"><Menu className="size-5" /></button>
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

function ChannelView({ s, srv, ch, now, lastReadAt, route, onMenu, onMembers }: { s: WorldState; srv: Server; ch: Channel; now: number; lastReadAt: number; route: Route; onMenu: () => void; onMembers: () => void }) {
  const isDm = srv.id === "dm";
  const jump = route.query.get("m") ?? undefined;
  const msgs = channelMessages(s, ch.id, now, jump ? 600 : 160);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [readMark] = useState(lastReadAt); // "new messages" divider stays where it was when you opened the channel
  const [text, setText] = useState("");
  const [sel, setSel] = useState<string>();
  const [reply, setReply] = useState<Message>();
  const [editing, setEditing] = useState<Message>();
  const [picker, setPicker] = useState<string>();
  const [panel, setPanel] = useState<Panel>(() => (route.query.get("thread") ? { thread: route.query.get("thread")! } : undefined));
  const [scrolledUp, setScrolledUp] = useState(false);
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setPanel(undefined); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);
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
    if (jump) {
      const t = el.querySelector(`[data-mid="${jump}"]`);
      // Scroll only the message list (scrollIntoView would also shift overflow-hidden ancestors).
      if (t) { const r = t.getBoundingClientRect(), e = el.getBoundingClientRect(); el.scrollTop += r.top - e.top - (e.height - r.height) / 2; stick.current = false; }
      return;
    }
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [lastId, jump]);

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

  const toBottom = () => { const el = scroller.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); stick.current = true; setScrolledUp(false); if (jump) go(`/lounge/${srv.id}/${ch.id}`); };
  const send = () => {
    const t = text.trim();
    if (!t || ch.announce) return;
    haptic(10);
    if (editing) { if (t !== editing.text) doEdit(editing.id, t); setEditing(undefined); setText(""); return; }
    stick.current = true;
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
  const react = (id: string, emoji: string) => { haptic(6); doReact(id, emoji); setSel(undefined); setPicker(undefined); };
  const startEdit = (m: Message) => { setEditing(m); setText(m.text); setReply(undefined); setSel(undefined); };
  // @mention autocomplete
  const mq = /(?:^|\s)@([\w.]{0,20})$/.exec(text);
  const suggestions = useMemo(() => {
    if (!mq || isDm) return [];
    const q = mq[1].toLowerCase();
    const ids = [...new Set([...msgs.slice(-60).map((m) => m.authorId), ...srv.members])].filter((id) => id.startsWith("c"));
    return ids.map((id) => s.characters[Number(id.slice(1))]).filter((c) => c.username.toLowerCase().startsWith(q) || c.displayName.toLowerCase().startsWith(q)).slice(0, 5);
  }, [mq?.[1], ch.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const thread = panel && typeof panel === "object" ? findMsg(s, panel.thread) : undefined;

  return (
    <section className="relative flex min-w-0 flex-1 flex-col" onClick={() => { setSel(undefined); setPicker(undefined); }}>
      <header className="flex h-[52px] shrink-0 items-center gap-1.5 border-b border-line px-2 md:px-4">
        <button aria-label="Open channels" onClick={(e) => { e.stopPropagation(); onMenu(); }} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2 md:hidden"><Menu className="size-5" /></button>
        {isDm ? <Avatar src={peer!.avatar} size={26} /> : ch.announce ? <Megaphone className="size-5 shrink-0 text-muted" /> : <Hash className="size-5 shrink-0 text-muted" />}
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[15.5px] font-bold">{title}</div>
          <div className="truncate text-[11.5px] text-muted">{isDm ? (withGod ? `@${peer!.handle}` : "A DM you're not part of") : `${srv.icon} ${srv.name} · ${ch.topic}`}</div>
        </div>
        <button aria-label="Search messages" onClick={(e) => { e.stopPropagation(); setPanel(panel === "search" ? undefined : "search"); }} className={clsx("grid size-10 place-items-center rounded-full hover:bg-surface-2", panel === "search" ? "text-gold" : "text-muted")}><Search className="size-[19px]" /></button>
        {!isDm && <button aria-label={`Pinned messages (${pins.length})`} onClick={(e) => { e.stopPropagation(); setPanel(panel === "pins" ? undefined : "pins"); }} className={clsx("relative grid size-10 place-items-center rounded-full hover:bg-surface-2", panel === "pins" ? "text-gold" : "text-muted")}><Pin className="size-[19px]" />{pins.length > 0 && <span className="num absolute right-1 top-1 text-[9px] font-bold text-gold">{pins.length}</span>}</button>}
        {!isDm && <button aria-label="Members" onClick={(e) => { e.stopPropagation(); onMembers(); }} className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface-2"><Users className="size-[19px]" /></button>}
      </header>
      <VoiceBar s={s} srv={srv} now={now} />

      <div ref={scroller} role="log" aria-live="polite" aria-label={`Messages in ${title}`}
        onScroll={(e) => { const el = e.currentTarget; const up = el.scrollHeight - el.scrollTop - el.clientHeight > 140; stick.current = !up; if (up !== scrolledUp) { setScrolledUp(up); if (up) setSeenCount(msgs.length); } }}
        className="flex-1 overflow-y-auto overscroll-contain px-2 pb-2 pt-3 md:px-4">
        {msgs.length < 160 && !jump && (
          <div className="mb-4 px-2 pt-6">
            <div className="grid size-14 place-items-center rounded-full bg-surface-3 text-[26px]">{isDm ? <Avatar src={peer!.avatar} size={56} /> : <Hash className="size-7" />}</div>
            <h3 className="mt-2 text-[22px] font-black">{isDm ? title : `Welcome to #${ch.name}`}</h3>
            <p className="text-[13px] text-muted">{isDm ? (withGod ? `This is the beginning of your DMs with @${peer!.handle}.` : "Everything said here, God sees.") : `This is the start of #${ch.name}. ${ch.topic}`}</p>
          </div>
        )}
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
              parent={parent} parentText={parent ? textAt(parent, now) : undefined} grouped={grouped} dayLabel={newDay ? dayOnly(m.t, now) : undefined} showNew={showNew}
              fresh={now - m.t < 6000} flash={jump === m.id} selected={sel === m.id} picker={picker === m.id} threadCount={threadCounts.get(m.id) ?? 0} pinned={!!m.pinnedAt && m.pinnedAt <= now}
              canWrite={withGod && !ch.announce}
              onSelect={() => { haptic(4); setSel(sel === m.id ? undefined : m.id); setPicker(undefined); }}
              onReact={(e) => react(m.id, e)} onPicker={() => setPicker(picker === m.id ? undefined : m.id)}
              onReply={() => { setReply(m); setEditing(undefined); setSel(undefined); }}
              onEdit={() => startEdit(m)} onDelete={() => { doDelete(m.id); setSel(undefined); }} onPin={() => { doPin(m.id); setSel(undefined); }}
              onThread={() => setPanel({ thread: m.id })} />
          );
        })}
      </div>

      {(scrolledUp || jump) && (
        <button onClick={(e) => { e.stopPropagation(); toBottom(); }} className="pop absolute bottom-[92px] left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-line bg-surface-3/95 px-3.5 py-2 text-[12px] font-semibold shadow-xl backdrop-blur">
          <ArrowDown className="size-3.5" /> {newBelow > 0 ? `${newBelow} new message${newBelow > 1 ? "s" : ""}` : "Jump to latest"}
        </button>
      )}

      <div className="h-5 px-4 text-[11.5px] text-muted" aria-live="polite">
        {typing.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="typing-dots"><i /><i /><i /></span>
            <span className="truncate [&_b]:font-semibold [&_b]:text-fg/85">{typingLabel(typing)}</span>
          </span>
        )}
      </div>
      <div className="relative px-2.5 pb-2.5 md:px-4 md:pb-3" onClick={(e) => e.stopPropagation()}>
        {suggestions.length > 0 && (
          <div className="pop absolute inset-x-2.5 bottom-full mb-1 overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl md:inset-x-4">
            {suggestions.map((c) => (
              <button key={c.id} onClick={() => setText(text.replace(/@([\w.]*)$/, `@${c.username} `))} className="flex min-h-[44px] w-full items-center gap-2.5 px-3 text-left hover:bg-surface-2">
                <Avatar src={who(s, c.id).avatar} size={26} /><span className="text-[14px] font-medium">{c.nicknames[srv.id] ?? c.displayName}</span><span className="text-[12px] text-muted">@{c.username}</span>
              </button>
            ))}
          </div>
        )}
        {(reply || editing) && (
          <div className="mb-1.5 flex items-center gap-2 rounded-xl bg-surface-3/70 px-3 py-1.5 text-[12px] text-muted">
            {editing ? <Pencil className="size-3.5 shrink-0" /> : <Reply className="size-3.5 shrink-0" />}
            <span className="truncate">{editing ? "Editing your message" : <>Replying to <b className="text-fg">{nickOf(s, reply!.authorId, srv)}</b> · {textAt(reply!, now)}</>}</span>
            <button aria-label="Cancel" className="ml-auto grid size-7 shrink-0 place-items-center rounded-full" onClick={() => { setReply(undefined); if (editing) { setEditing(undefined); setText(""); } }}><X className="size-3.5" /></button>
          </div>
        )}
        {withGod ? (
          <div className="flex items-center gap-2 rounded-full border border-line bg-surface-3 py-1.5 pl-4 pr-1.5 transition-colors focus-within:border-gold/50">
            <input value={text} disabled={ch.announce} aria-label={`Message ${isDm ? title : `#${ch.name}`}`} onChange={(e) => onType(e.target.value)} onFocus={() => { if (text.trim() && !isDm && !editing) doTyping(srv.id, ch.id); }}
              onKeyDown={(e) => { if (e.key === "Enter") send(); if (e.key === "Escape") { setReply(undefined); setEditing(undefined); } if (e.key === "ArrowUp" && !text) { const mine = [...msgs].reverse().find((m) => m.authorId === "god" && !m.deleted); if (mine) startEdit(mine); } }}
              placeholder={ch.announce ? "Only mods can post in announcements" : isDm ? `Message @${peer!.handle}` : `Message #${ch.name}`} className="min-w-0 flex-1 bg-transparent py-1.5 text-[16px] outline-none placeholder:text-muted md:text-[14px]" />
            <button aria-label={editing ? "Save edit" : "Send"} onClick={send} disabled={!text.trim()} className={clsx("grid size-10 shrink-0 place-items-center rounded-full transition-all", text.trim() ? "bg-gold text-[#1a1406] active:scale-90" : "text-muted")}><Send className="size-[17px]" /></button>
          </div>
        ) : <div className="rounded-full border border-line bg-surface-3/60 px-4 py-2.5 text-center text-[13px] text-muted">You&apos;re reading someone else&apos;s DMs. They can&apos;t see you.</div>}
      </div>

      {panel === "search" && <SearchPanel s={s} srv={srv} ch={ch} now={now} onClose={() => setPanel(undefined)} />}
      {panel === "pins" && <SidePanel title={`Pinned in #${ch.name}`} onClose={() => setPanel(undefined)}>
        {pins.length ? pins.map((m) => <MiniMsg key={m.id} s={s} srv={srv} m={m} now={now} onClick={() => { setPanel(undefined); go(`/lounge/${srv.id}/${ch.id}?m=${m.id}`); }} />) : <p className="p-4 text-[13px] text-muted">Nothing pinned yet. Mods pin the moments people want to keep.</p>}
      </SidePanel>}
      {thread && <ThreadPanel s={s} srv={srv} root={thread} now={now} onClose={() => setPanel(undefined)} />}
    </section>
  );
}

/* --------------------------------- rows -------------------------------- */

interface RowProps {
  s: WorldState; srv: Server; m: Message; text: string; edited: boolean; rx: Reaction[]; rxSig: string; parent?: Message; parentText?: string; grouped: boolean; dayLabel?: string; showNew: boolean;
  fresh: boolean; flash: boolean; selected: boolean; picker: boolean; threadCount: number; pinned: boolean; canWrite: boolean;
  onSelect: () => void; onReact: (e: string) => void; onPicker: () => void; onReply: () => void; onEdit: () => void; onDelete: () => void; onPin: () => void; onThread: () => void;
}
const same = (a: RowProps, b: RowProps) => a.m === b.m && a.text === b.text && a.edited === b.edited && a.rxSig === b.rxSig && a.parentText === b.parentText && a.grouped === b.grouped && a.dayLabel === b.dayLabel && a.showNew === b.showNew && a.fresh === b.fresh && a.flash === b.flash && a.selected === b.selected && a.picker === b.picker && a.threadCount === b.threadCount && a.pinned === b.pinned && a.m.deleted === b.m.deleted;

const Row = memo(function Row({ s, srv, m, text, edited, rx, parent, parentText, grouped, dayLabel, showNew, fresh, flash, selected, picker, threadCount, pinned, canWrite, onSelect, onReact, onPicker, onReply, onEdit, onDelete, onPin, onThread }: RowProps) {
  const a = who(s, m.authorId);
  const nick = a.char?.nicknames[srv.id];
  const mine = m.authorId === "god";
  const pinged = !mine && (m.mentionsGod || /@god\b/i.test(text));
  const isSystem = m.kind === "system";
  const open = (e: React.MouseEvent) => { e.stopPropagation(); if (a.kind === "char") go(`/u/${a.id}`); };
  const pa = parent ? who(s, parent.authorId) : undefined;
  if (m.deleted) return null;
  if (m.intent === "voiceJoin") return (
    <div data-mid={m.id} data-testid="voice-banner" className={clsx("vc-banner my-2 rounded-xl px-3 py-2 text-center", fresh && "msg-in")}>
      <div className="flex items-center justify-center gap-2 text-[13px] font-semibold text-gold"><Mic className="size-4" />@god {text}</div>
      {rx.length > 0 && <div className="mt-1 flex flex-wrap justify-center gap-1">{rx.map((r) => <span key={r.emoji} className="num rounded-full bg-surface-3 px-2 py-0.5 text-[12px]">{r.emoji} {r.count}</span>)}</div>}
    </div>
  );
  return (
    <>
      {dayLabel && <div className="my-3 flex items-center gap-3 text-[11px] font-semibold text-muted"><div className="h-px flex-1 bg-line" /><span className="rounded-full bg-surface-3 px-2.5 py-0.5">{dayLabel}</span><div className="h-px flex-1 bg-line" /></div>}
      {showNew && <div className="my-2 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider text-down"><div className="h-px flex-1 bg-down/60" />New</div>}
      <div data-mid={m.id} data-author={m.authorId} data-reply-author={parent?.authorId} onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (!selected) onSelect(); }}
        className={clsx("row-cv group relative cursor-default rounded-xl px-2 transition-colors md:hover:bg-surface-3/40", grouped ? "py-0.5" : "mt-2 py-1", fresh && "msg-in", flash && "flash-gold",
          pinged && "bg-gold/[0.07] shadow-[inset_3px_0_0_var(--gold)]", mine && "bg-gold/[0.04]", selected && "!bg-surface-3/70")}>
        {parent && pa && (
          <div className="mb-0.5 ml-[48px] flex items-center gap-1.5 truncate text-[12px] text-muted">
            <CornerUpLeft className="size-3 shrink-0 -scale-x-100" />
            <Avatar src={pa.avatar} size={14} />
            <span className={clsx("font-medium", pa.kind === "god" ? "text-gold" : "text-fg/80")}>{pa.char?.nicknames[srv.id] ?? pa.name}</span>
            <span className="truncate">{parent.deleted ? <i>message deleted</i> : parentText}</span>
          </div>
        )}
        <div className="flex gap-2.5">
          {grouped ? (
            <span className="w-[38px] shrink-0 pt-0.5 text-right text-[10px] text-muted opacity-0 md:group-hover:opacity-100">{clockTime(m.t)}</span>
          ) : (
            <button onClick={open} aria-label={`${a.name}'s profile`} className="shrink-0"><Avatar src={a.avatar} size={38} ring={mine ? "var(--gold)" : undefined} /></button>
          )}
          <div className="min-w-0 flex-1">
            {!grouped && (
              <div className="flex items-baseline gap-2">
                <button onClick={open} className="min-w-0 text-[14.5px] font-semibold" style={{ color: a.char && srv.moderators.includes(a.id) ? MOD : undefined }}><NameLine w={{ ...a, verified: mine }} nick={nick} /></button>
                <span className="num shrink-0 text-[11px] text-muted">{clockTime(m.t)}</span>
                {pinned && <Pin className="size-3 shrink-0 text-gold" aria-label="pinned" />}
              </div>
            )}
            <div className={clsx("whitespace-pre-wrap break-words text-[15px] leading-[1.42] md:text-[14.5px]", isSystem && "italic text-muted", m.kind === "bot" && "rounded-lg border border-line bg-surface-3/70 px-3 py-1.5 not-italic shadow-[inset_3px_0_0_var(--brand)]")}>
              <RichText text={text} onUser={(h) => { const c = s.characters.find((x) => x.username === h); if (c) go(`/u/${c.id}`); }} onTag={(t) => go(`/chirp/tag/${t}`)} />
              {edited && <span className="ml-1 text-[10.5px] text-muted">(edited)</span>}
            </div>
            {m.meme && <MemeImage m={m.meme} id={m.id} />}
            {threadCount > 0 && (
              <button onClick={(e) => { e.stopPropagation(); onThread(); }} className="mt-1 flex items-center gap-1.5 rounded-lg bg-surface-3/70 px-2.5 py-1 text-[12px] font-semibold text-brand hover:bg-surface-3"><MessageCircle className="size-3.5" />{threadCount} {threadCount === 1 ? "reply" : "replies"} in thread</button>
            )}
            {rx.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {rx.slice(0, 12).map((r) => (
                  <button key={r.emoji} aria-label={`${r.emoji} ${r.count}${r.me ? ", you reacted" : ""}`} aria-pressed={!!r.me} onClick={(e) => { e.stopPropagation(); onReact(r.emoji); }}
                    className={clsx("react-pop flex min-h-[28px] items-center gap-1 rounded-full border px-2 text-[12.5px] transition-colors active:scale-95", r.me ? "border-gold/70 bg-gold/15" : "border-line bg-surface-3/70 hover:border-fg/30")}>
                    {r.emoji} <span className={clsx("num", r.me ? "text-gold" : "text-muted")}>{r.count}</span>
                  </button>
                ))}
                {rx.length > 12 && <span className="self-center text-[11px] text-muted">+{rx.length - 12}</span>}
              </div>
            )}
            {selected && (
              <div onClick={(e) => e.stopPropagation()} className="pop mt-1.5 flex w-fit max-w-full flex-wrap items-center gap-0.5 rounded-2xl border border-line bg-surface p-1 shadow-xl">
                {QUICK.map((e) => <button key={e} aria-label={`React ${e}`} onClick={() => onReact(e)} className="grid size-9 place-items-center rounded-full text-[17px] hover:bg-surface-3 active:scale-90">{e}</button>)}
                <button aria-label="More reactions" onClick={onPicker} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-3"><SmilePlus className="size-4" /></button>
                <span className="mx-0.5 h-5 w-px bg-line" />
                {canWrite && <ActBtn icon={Reply} label="Reply" onClick={onReply} />}
                {mine && canWrite && <ActBtn icon={Pencil} label="Edit" onClick={onEdit} />}
                {srv.id !== "dm" && <ActBtn icon={Pin} label={pinned ? "Unpin" : "Pin"} onClick={onPin} />}
                {mine && <ActBtn icon={Trash2} label="Delete" onClick={onDelete} danger />}
                {picker && (
                  <div className="grid w-full grid-cols-8 gap-0.5 border-t border-line pt-1 sm:grid-cols-10">
                    {PICKER.map((e) => <button key={e} aria-label={`React ${e}`} onClick={() => onReact(e)} className="grid size-9 place-items-center rounded-lg text-[18px] hover:bg-surface-3 active:scale-90">{e}</button>)}
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
  return <button onClick={onClick} className={clsx("flex min-h-9 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold hover:bg-surface-3", danger && "text-down")}><I className="size-3.5" /> {label}</button>;
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
      <button aria-label={`Message ${c.displayName}`} onClick={() => go(`/lounge/dm/${dmChannel("god", x.id)}`)} className="grid size-9 shrink-0 place-items-center rounded-full text-muted opacity-100 hover:bg-surface-3 hover:text-fg md:opacity-0 md:group-hover:opacity-100"><MessageCircle className="size-4" /></button>
    </div>
  );
}

function MemberList({ s, srv, chId, now, open, onClose }: { s: WorldState; srv: Server; chId: string; now: number; open: boolean; onClose: () => void }) {
  const slot = Math.floor(now / 10_000);
  const groups = useMemo(() => {
    const seen = lastSeenMap(s, slot * 10_000, srv.id, 4000);
    const g: Record<Presence, { id: string; t: number; core: boolean; mod: boolean }[]> = { online: [], idle: [], offline: [] };
    for (const id of srv.members) {
      const c = s.characters[Number(id.slice(1))];
      g[presenceOf(c, seen.get(id), slot * 10_000)].push({ id, t: seen.get(id) ?? 0, core: !!c.core, mod: srv.moderators.includes(id) });
    }
    const sort = (a: { t: number; core: boolean; mod: boolean }, b: { t: number; core: boolean; mod: boolean }) => Number(b.mod) - Number(a.mod) || Number(b.core) - Number(a.core) || b.t - a.t;
    return { online: g.online.sort(sort), idle: g.idle.sort(sort), offline: g.offline.sort(sort) };
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
        <button aria-label="Close members" className="grid size-9 place-items-center rounded-full bg-surface-3 md:hidden" onClick={onClose}><X className="size-4" /></button>
      </div>
      {(["online", "idle", "offline"] as const).map((p) => groups[p].length > 0 && (
        <div key={p}>
          <div className="flex items-center gap-1.5 px-2 pb-1 pt-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted"><span className={clsx("size-2 rounded-full", DOT[p])} />{p} — {groups[p].length}</div>
          {groups[p].slice(0, CAP[p]).map((m) => <MemberItem key={m.id} x={who(s, m.id)} srv={srv} now={now} presence={p} typing={typing.has(m.id)} />)}
          {groups[p].length > CAP[p] && <div className="px-2 py-1 text-[11px] text-muted">and {groups[p].length - CAP[p]} more</div>}
        </div>
      ))}
      <div className="mt-3 flex items-center gap-1.5 px-2 pb-4 text-[10px] text-muted"><AtSign className="size-3" />{srv.members.length} regulars · {fmtCount(srv.memberCount)} total</div>
    </aside>
  );
}
