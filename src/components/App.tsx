"use client";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Bell, Crown, Globe2, LayoutDashboard, MessagesSquare, Newspaper, Search, Settings as Cog, Zap, Feather, Lock, MoreHorizontal, X } from "lucide-react";
import { init, lock, useApp, takeOverHere } from "./store";
import { go, Money } from "./ui";
import { netWorth } from "@/lib/sim/world";
import { trending, unreadIndex } from "@/lib/sim/engine";
import { fmtCount } from "@/lib/sim/format";
import dynamic from "next/dynamic";
import { Lounge } from "./views/Lounge";

// the Lounge is the front door; everything else loads when first opened (smaller cold start)
const Loading = () => <div className="grid h-full place-items-center"><Crown className="size-7 animate-pulse text-gold/60" /></div>;
const Chirp = dynamic(() => import("./views/Chirp").then((m) => m.Chirp), { loading: Loading });
const Platforms = dynamic(() => import("./views/Platforms").then((m) => m.Platforms), { loading: Loading });
const News = dynamic(() => import("./views/News").then((m) => m.News), { loading: Loading });
const Dashboard = dynamic(() => import("./views/Dashboard").then((m) => m.Dashboard), { loading: Loading });
const GodMode = dynamic(() => import("./views/GodMode").then((m) => m.GodMode), { loading: Loading });
const Events = dynamic(() => import("./views/Events").then((m) => m.Events), { loading: Loading });
const SearchView = dynamic(() => import("./views/Search").then((m) => m.SearchView), { loading: Loading });
const Alerts = dynamic(() => import("./views/Alerts").then((m) => m.Alerts), { loading: Loading });
const ProfileView = dynamic(() => import("./views/Profile").then((m) => m.ProfileView), { loading: Loading });
const SettingsView = dynamic(() => import("./views/Settings").then((m) => m.SettingsView), { loading: Loading });
import { AuthScreen, CatchUpScreen } from "./views/Auth";
import { AwaySummary, BreakingOverlay, Toast } from "./views/Overlays";

export type Route = { view: string; parts: string[]; query: URLSearchParams };
function parse(): Route {
  const h = typeof location === "undefined" ? "" : location.hash.replace(/^#\/?/, "");
  const [path, q] = h.split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  return { view: parts[0] ?? "lounge", parts: parts.slice(1), query: new URLSearchParams(q ?? "") };
}
function useRoute() {
  const [r, setR] = useState<Route>({ view: "lounge", parts: [], query: new URLSearchParams() });
  useEffect(() => {
    const f = () => { setR(parse()); };
    f();
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return r;
}

const NAV = [
  { id: "lounge", label: "Lounge", icon: MessagesSquare },
  { id: "chirp", label: "Chirp", icon: Feather },
  { id: "platforms", label: "Platforms", icon: Globe2 },
  { id: "news", label: "News", icon: Newspaper },
  { id: "dashboard", label: "Empire", icon: LayoutDashboard },
  { id: "god", label: "GOD MODE", icon: Crown },
  { id: "events", label: "Events", icon: Zap },
  { id: "search", label: "Search", icon: Search },
  { id: "alerts", label: "Alerts", icon: Bell },
  { id: "settings", label: "Settings", icon: Cog },
];
const MOBILE = ["lounge", "chirp", "news", "god"];

export function App() {
  const app = useApp();
  const route = useRoute();
  const [more, setMore] = useState(false);
  useEffect(() => { init(); }, []);
  // iOS doesn't shrink the layout for the keyboard: size the app to the visible area so the composer stays in view
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const fit = () => { document.documentElement.style.setProperty("--app-h", `${Math.round(vv.height)}px`); if (vv.offsetTop) window.scrollTo(0, 0); };
    fit();
    vv.addEventListener("resize", fit);
    return () => vv.removeEventListener("resize", fit);
  }, []);
  const w = app.world;
  useEffect(() => {
    if (!w) return;
    document.documentElement.dataset.theme = w.settings.theme;
    document.documentElement.dataset.motion = w.settings.reducedMotion ? "reduced" : "full";
  }, [w, w?.settings.theme, w?.settings.reducedMotion]);

  if (app.phase === "boot") return <Splash />;
  if (app.phase === "profiles") return <AuthScreen />;
  if (app.phase === "elsewhere") return <Elsewhere />;
  if (app.phase === "catchup" || !w) return <CatchUpScreen progress={app.progress} />;

  const now = app.now;
  const openEvents = w.events.filter((e) => !e.resolved && e.t <= now && e.expiresAt > now).length;
  const unreadAlerts = w.notifications.filter((n) => !n.read && n.t <= now).length;
  const badge: Record<string, number> = { events: openEvents, alerts: unreadAlerts };
  const lounge = unreadIndex(w, now, app.lastRead, now - 15 * 60e3);
  let mentions = 0; for (const u of lounge.values()) mentions += u.mentions;
  badge.lounge = mentions;
  const moreBadge = NAV.filter((n) => !MOBILE.includes(n.id)).reduce((a, n) => a + (badge[n.id] ?? 0), 0);

  const inLounge = route.view === "lounge" || !NAV.some((x) => x.id === route.view) && route.view !== "u";
  let body: React.ReactNode;
  switch (route.view) {
    case "chirp": body = <Chirp route={route} />; break;
    case "platforms": body = <Platforms route={route} />; break;
    case "news": body = <News route={route} />; break;
    case "dashboard": body = <Dashboard />; break;
    case "god": body = <GodMode />; break;
    case "events": body = <Events />; break;
    case "search": body = <SearchView route={route} />; break;
    case "alerts": body = <Alerts />; break;
    case "u": body = <ProfileView id={route.parts[0]} />; break;
    case "settings": body = <SettingsView />; break;
    default: body = <Lounge route={route} />;
  }

  return (
    <div className="flex h-[var(--app-h,100dvh)] flex-col">
      {/* in the Lounge on a phone the chat gets the whole screen, like a chat app; the ticker lives everywhere else */}
      <div className={clsx(inLounge && "max-md:hidden")}><TopBar /></div>
      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-[76px] shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-3 md:flex lg:w-[200px] lg:items-stretch lg:px-3">
          {NAV.map((n) => {
            const active = route.view === n.id || (n.id === "lounge" && !NAV.some((x) => x.id === route.view) && route.view !== "u");
            return (
              <button key={n.id} aria-label={n.label} aria-current={active ? "page" : undefined} onClick={() => go(`/${n.id}`)} className={clsx("group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition", active ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg", n.id === "god" && "text-gold")}>
                <n.icon className="size-5 shrink-0" />
                <span className="hidden lg:inline">{n.label}</span>
                {badge[n.id] ? <span className="absolute right-1.5 top-1.5 rounded-full bg-down px-1.5 text-[10px] font-bold text-white lg:static lg:ml-auto">{badge[n.id]}</span> : null}
              </button>
            );
          })}
          <div className="mt-auto hidden lg:block">
            <button onClick={lock} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[12px] text-muted hover:bg-surface-2"><Lock className="size-4" /> Lock / switch profile</button>
          </div>
        </nav>
        <main className="min-w-0 flex-1 overflow-hidden">{body}</main>
      </div>
      {/* in the Lounge the phone gets the Lounge's own tabs (Servers, Messages, Notifications, You); the crown there leads back here */}
      <nav aria-label="Sections" className={clsx("flex shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden", inLounge && "hidden")}>
        {NAV.filter((n) => MOBILE.includes(n.id)).map((n) => (
          <button key={n.id} onClick={() => { haptic(); go(`/${n.id}`); }} aria-current={route.view === n.id ? "page" : undefined} className={clsx("relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] transition-colors active:scale-95", route.view === n.id ? "text-fg" : "text-muted", n.id === "god" && "text-gold")}>
            <n.icon className="size-5" />
            {n.label === "GOD MODE" ? "GOD" : n.label}
            {badge[n.id] ? <span data-badge={n.id} className="absolute right-[22%] top-1.5 min-w-4 rounded-full bg-down px-1 text-center text-[9px] font-bold leading-4 text-white">{badge[n.id] > 99 ? "99+" : badge[n.id]}</span> : null}
            {route.view === n.id && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gold" />}
          </button>
        ))}
        <button onClick={() => { haptic(); setMore(true); }} aria-label="More" className={clsx("relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] active:scale-95", !MOBILE.includes(route.view) && route.view !== "u" ? "text-fg" : "text-muted")}>
          <MoreHorizontal className="size-5" />More
          {moreBadge > 0 && <span data-badge="more" className="absolute right-[22%] top-1.5 min-w-4 rounded-full bg-down px-1 text-center text-[9px] font-bold leading-4 text-white">{moreBadge > 99 ? "99+" : moreBadge}</span>}
        </button>
      </nav>
      {more && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
          <div role="dialog" aria-label="More" className="sheet-up absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-line bg-surface p-3 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <div className="mb-2 flex items-center justify-between px-1"><span className="text-[13px] font-semibold uppercase tracking-wider text-muted">More</span><button aria-label="Close" onClick={() => setMore(false)} className="grid size-11 place-items-center rounded-full bg-surface-3"><X className="size-4" /></button></div>
            <div className="grid grid-cols-3 gap-2">
              {NAV.filter((n) => !MOBILE.includes(n.id)).map((n) => (
                <button key={n.id} onClick={() => { haptic(); setMore(false); go(`/${n.id}`); }} className={clsx("relative flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface-2 text-[12px] font-medium active:scale-95", route.view === n.id && "ring-1 ring-gold")}>
                  <n.icon className="size-5" />{n.label}
                  {badge[n.id] ? <span className="absolute right-2 top-2 rounded-full bg-down px-1.5 text-[10px] font-bold text-white">{badge[n.id]}</span> : null}
                </button>
              ))}
              <button onClick={() => { setMore(false); lock(); }} className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-surface-2 text-[12px] font-medium active:scale-95"><Lock className="size-5" />Switch profile</button>
            </div>
          </div>
        </div>
      )}
      {app.summary && <AwaySummary s={app.summary} />}
      {app.breaking && <BreakingOverlay r={app.breaking} />}
      <Toast />
    </div>
  );
}

function TopBar() {
  const { world: w, now } = useApp();
  const slot = Math.floor(now / 15_000); // trending only needs to refresh every 15s
  const tr = useMemo(() => (w ? trending(w, slot * 15_000 + 14_999, 8) : []), [w, slot]);
  if (!w) return null;
  const nw = netWorth(w);
  const hist = w.player.netWorthHistory;
  const prev = hist.length > 8 ? hist[hist.length - 8].v : nw;
  const godTop = tr.find((t) => t.topic.about === "god");
  return (
    <header className="glass relative z-20 shrink-0 border-b border-line">
      <div className="flex items-center gap-3 px-3 py-2 md:px-4">
        <button onClick={() => go("/dashboard")} aria-label="Empire dashboard" className="-my-1.5 flex min-h-[44px] items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-[#fff3c4] via-gold to-[#8a6416] text-[#120c02]"><Crown className="size-5" /></span>
          <span className="hidden text-[15px] font-black tracking-[0.2em] sm:inline">GOD</span>
        </button>
        <div className="ml-auto flex items-center gap-4 text-[12px]">
          <div className="hidden text-right sm:block">
            <div className="text-[10px] uppercase tracking-wider text-muted">Net worth</div>
            <div className="flex items-center gap-1.5"><Money v={nw} className="text-[14px] font-semibold" /><span className={clsx("num text-[11px]", nw >= prev ? "text-up" : "text-down")}>{nw >= prev ? "▲" : "▼"}{Math.abs(((nw - prev) / (prev || 1)) * 100).toFixed(2)}%</span></div>
          </div>
          <div className="hidden text-right md:block">
            <div className="text-[10px] uppercase tracking-wider text-muted">Followers</div>
            <div className="num text-[14px] font-semibold">{fmtCount(w.player.followers)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted">Status</div>
            <div className={clsx("text-[12px] font-semibold", godTop && godTop.rank <= 3 ? "text-down" : "text-muted")}>{godTop ? `#${godTop.rank} trending` : "quiet"}</div>
          </div>
        </div>
      </div>
      <div className="relative overflow-hidden border-t border-line/60 bg-bg/40 py-1 text-[11px]">
        <div className="ticker flex w-max gap-8 whitespace-nowrap px-4">
          {[...tr, ...tr].map((t, i) => (
            <button key={i} onClick={() => go(`/chirp/tag/${t.topic.tag}`)} className="flex items-center gap-1.5 text-muted hover:text-fg">
              <span className={t.topic.about === "god" ? "text-gold" : "text-brand"}>#{t.topic.tag}</span>
              <span className="num">{fmtCount(t.posts)} posts</span>
              {t.topic.breaking && <span className="rounded bg-down px-1 font-bold text-white">BREAKING</span>}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

export const haptic = (ms = 8) => { try { if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms); } catch { /* not supported */ } };

function Elsewhere() {
  return (
    <div className="grid h-dvh place-items-center p-6">
      <div className="max-w-sm text-center">
        <Crown className="mx-auto size-10 text-gold" />
        <div className="mt-3 text-[17px] font-semibold">GOD is open in another tab</div>
        <p className="mt-1 text-[13px] text-muted">Only one tab keeps your world running at a time so nothing gets out of sync.</p>
        <button onClick={takeOverHere} className="btn btn-gold mt-5">Use here</button>
      </div>
    </div>
  );
}

function Splash() {
  return (
    <main className="grid h-dvh place-items-center">
      <div className="flex flex-col items-center gap-3">
        <Crown className="size-10 animate-pulse text-gold" />
      </div>
    </main>
  );
}
