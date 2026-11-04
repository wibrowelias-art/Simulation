"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, MapPin, Briefcase, Wallet, Clock, Pencil, MessageCircle } from "lucide-react";
import { badgesFor, OBSESSION_INFO, obsessionOf } from "@/lib/sim/social";
import { dmChannel } from "@/lib/sim/godspeak";
import { editWorld, useApp } from "../store";
import { Avatar, NameLine, RichText, Section, StanceChip, go, who } from "../ui";
import { PostCard } from "./Chirp";
import { STANCE_INFO } from "@/lib/sim/characters";
import { localHour, textAt } from "@/lib/sim/engine";
import { fmtCount, relTime } from "@/lib/sim/format";
import type { Character, Stance } from "@/lib/sim/types";

export function ProfileView({ id }: { id: string }) {
  const { world: w, now } = useApp();
  const s = w!;
  const [edit, setEdit] = useState(false);
  useEffect(() => { if (id === "god") go("/dashboard"); }, [id]);
  if (id === "god") return null;
  const x = who(s, id);
  const c = x.char;
  if (!c) return <div className="p-8 text-muted">Unknown profile.</div>;
  const msgs = s.messages.filter((m) => m.authorId === id && !m.deleted && m.t <= now).slice(-12).reverse();
  const ob = OBSESSION_INFO[obsessionOf(c)];
  const badges = badgesFor(c);
  const bond = Math.round(c.bond ?? 0);
  const contacts = (c.godContacts ?? []).slice(-6).reverse();
  const posts = s.posts.filter((p) => p.authorId === id && p.t <= now).slice(-8).reverse();
  const lh = localHour(c, now);
  const srvs = c.servers.map((sid) => s.servers.find((v) => v.id === sid)!).filter(Boolean);
  const op = c.opinion;
  return (
    <div className="h-full overflow-y-auto">
      <div className="h-32 md:h-44" style={{ background: `linear-gradient(120deg, ${STANCE_INFO[c.stance].color}55, var(--surface) 70%)` }} />
      <div className="mx-auto -mt-14 max-w-4xl space-y-4 px-3 pb-8 md:px-6">
        <div className="flex items-end justify-between gap-3">
          <Avatar src={x.avatar} size={104} className="border-4 border-bg" />
          <div className="flex gap-2"><button aria-label="Back" onClick={() => history.back()} className="btn min-h-10"><ArrowLeft className="size-4" /></button><button onClick={() => go(`/lounge/dm/${dmChannel("god", c.id)}`)} className="btn btn-gold min-h-10"><MessageCircle className="size-4" /> Message</button><button onClick={() => setEdit(!edit)} className="btn min-h-10"><Pencil className="size-4" /> {edit ? "Close" : "Edit"}</button></div>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[22px]"><NameLine w={x} /><StanceChip c={c} />{c.edited && <span className="text-[11px] text-muted">(edited)</span>}</div>
          <div className="text-muted">@{c.username} · {fmtCount(c.followers)} followers · {c.tier}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {badges.filter((b) => b.label !== ob.label).map((b) => <span key={b.label} className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: b.color + "22", color: b.color }}>{b.label}</span>)}
          </div>
          <p className="mt-2 max-w-2xl"><RichText text={c.bio} /></p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
            <span className="flex items-center gap-1"><MapPin className="size-3.5" />{c.location}</span>
            <span className="flex items-center gap-1"><Briefcase className="size-3.5" />{c.occupation}, {c.age}</span>
            <span className="flex items-center gap-1"><Wallet className="size-3.5" />{c.finances}</span>
            <span className="flex items-center gap-1"><Clock className="size-3.5" />{String(Math.floor(lh)).padStart(2, "0")}:{String(Math.floor((lh % 1) * 60)).padStart(2, "0")} local · {c.chronotype === "owl" ? "night owl" : c.chronotype === "morning" ? "early bird" : "evenings"}</span>
          </div>
        </div>
        {edit && <Editor c={c} onDone={() => setEdit(false)} />}
        <div className="grid gap-4 md:grid-cols-2">
          <Section title="Opinion of @god">
            <div className="relative h-3 rounded-full bg-gradient-to-r from-down via-surface-3 to-gold"><span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-fg" style={{ left: `${(op + 100) / 2}%` }} /></div>
            <div className="mt-2 flex justify-between text-[11px] text-muted"><span>can&apos;t stand him</span><span className="num text-fg">{op > 0 ? "+" : ""}{Math.round(op)}</span><span>would die for him</span></div>
            <div className="mt-3 flex items-center gap-2 text-[12px] text-muted"><span>Bond with you</span><div className="h-1.5 flex-1 rounded-full bg-surface-3"><div className="h-full rounded-full bg-gold" style={{ width: `${bond}%` }} /></div><span className="num text-fg">{bond}</span></div>
            {contacts.length > 0 && <div className="mt-2 space-y-1 text-[12px]">{contacts.map((g, i) => <div key={i} className="truncate"><span className="text-gold">●</span> {g.kind === "dm" ? "You DM'd them" : g.kind === "replied" ? "You replied to them" : g.kind === "mentioned" ? "You mentioned them" : "They saw you post"}: <span className="text-fg">&ldquo;{g.text}&rdquo;</span> <span className="text-muted">· {relTime(g.t, now)}</span></div>)}</div>}
            <p className="mt-3 text-[13px] text-muted">Catchphrase: <span className="text-fg">&ldquo;{c.catchphrase}&rdquo;</span></p>
          </Section>
          <Section title="Personality & voice">
            <div className="flex flex-wrap gap-1.5">{c.personality.map((p) => <span key={p} className="rounded-full bg-surface-3 px-2 py-0.5 text-[12px]">{p}</span>)}</div>
            <div className="mt-2 text-[13px] text-muted">Talks <span className="text-fg">{c.voice}</span> · emoji {Math.round(c.emojiRate * 100)}% · {c.emojis.join(" ")} · says {c.slang.slice(0, 4).join(", ") || "—"}</div>
            <div className="mt-1 text-[13px] text-muted">Into: {c.interests.join(", ")}</div>
          </Section>
          <Section title="Relationships">
            <div className="text-[12px] text-muted">Friends</div>
            <div className="mb-2 mt-1 flex flex-wrap gap-1.5">{c.friends.slice(0, 8).map((f) => <Chip key={f} s={s} id={f} />)}</div>
            <div className="text-[12px] text-muted">Rivals</div>
            <div className="mt-1 flex flex-wrap gap-1.5">{c.rivals.slice(0, 6).map((f) => <Chip key={f} s={s} id={f} />)}{!c.rivals.length && <span className="text-[12px] text-muted">none, somehow</span>}</div>
          </Section>
          <Section title="Servers & memory">
            <div className="flex flex-wrap gap-1.5">{srvs.map((v) => <button key={v.id} onClick={() => go(`/lounge/${v.id}`)} className="rounded-full border border-line px-2 py-0.5 text-[12px]">{v.icon} {v.name}{c.nicknames[v.id] ? <span className="text-muted"> as {c.nicknames[v.id]}</span> : null}</button>)}</div>
            <div className="mt-3 space-y-1 text-[12px]">{c.memory.slice(-5).reverse().map((m, i) => <div key={i}><span className={m.feeling >= 0 ? "text-up" : "text-down"}>●</span> remembers {m.label} <span className="text-muted">· {relTime(m.t, now)}</span></div>)}{!c.memory.length && <span className="text-muted">Nothing memorable yet.</span>}</div>
          </Section>
        </div>
        <Section title="Recent messages">
          <div className="space-y-2">{msgs.map((m) => { const srv = s.servers.find((v) => v.id === m.serverId); const ch = srv?.channels.find((h) => h.id === m.channelId); return (
            <button key={m.id} onClick={() => go(`/lounge/${m.serverId}/${m.channelId}?m=${m.id}`)} className="block w-full text-left text-[14px]"><span className="text-[11px] text-muted">{m.serverId === "dm" ? "Direct message" : `${srv?.name} #${ch?.name}`} · {relTime(m.t, now)}</span><div>{textAt(m, now)}</div></button>
          ); })}{!msgs.length && <span className="text-[13px] text-muted">Lurker. Hasn&apos;t said anything recently.</span>}</div>
        </Section>
        {posts.length > 0 && <div className="panel overflow-hidden">{posts.map((p) => <PostCard key={p.id} s={s} p={p} now={now} onOpen={() => go(`/chirp/post/${p.id}`)} />)}</div>}
      </div>
    </div>
  );
}

const Chip = ({ s, id }: { s: Parameters<typeof who>[0]; id: string }) => { const x = who(s, id); return <button onClick={() => go(`/u/${id}`)} className="flex items-center gap-1 rounded-full bg-surface-3 py-0.5 pl-0.5 pr-2 text-[12px]"><Avatar src={x.avatar} size={18} />{x.name}</button>; };

function Editor({ c, onDone }: { c: Character; onDone: () => void }) {
  const [f, setF] = useState({ displayName: c.displayName, bio: c.bio, occupation: c.occupation, location: c.location, catchphrase: c.catchphrase, stance: c.stance, opinion: c.opinion });
  const save = () => { editWorld((w) => { const t = w.characters.find((x) => x.id === c.id)!; Object.assign(t, f, { edited: true }); }); onDone(); };
  const field = (k: "displayName" | "bio" | "occupation" | "location" | "catchphrase", label: string) => (
    <label className="block"><span className="text-[11px] uppercase tracking-wider text-muted">{label}</span><input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="input mt-1 w-full" /></label>
  );
  return (
    <div className="panel grid gap-3 p-4 sm:grid-cols-2">
      {field("displayName", "Display name")}{field("occupation", "Occupation")}{field("location", "Location")}{field("catchphrase", "Catchphrase")}
      <div className="sm:col-span-2">{field("bio", "Bio")}</div>
      <label className="block"><span className="text-[11px] uppercase tracking-wider text-muted">Stance</span>
        <select value={f.stance} onChange={(e) => setF({ ...f, stance: e.target.value as Stance })} className="input mt-1 w-full">{Object.entries(STANCE_INFO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
      <label className="block"><span className="text-[11px] uppercase tracking-wider text-muted">Opinion of @god ({Math.round(f.opinion)})</span><input type="range" min={-100} max={100} value={f.opinion} onChange={(e) => setF({ ...f, opinion: Number(e.target.value) })} className="mt-3 w-full" /></label>
      <div className="flex gap-2 sm:col-span-2"><button onClick={save} className="btn btn-gold">Save character</button><button onClick={onDone} className="btn">Cancel</button><span className="self-center text-[11px] text-muted">Their future messages follow the new stance and opinion.</span></div>
    </div>
  );
}
