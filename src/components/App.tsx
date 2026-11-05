"use client";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { Home as HomeIcon, Settings as Cog } from "lucide-react";
import dynamic from "next/dynamic";
import { init, useApp, takeOverHere } from "./store";
import { go, setPlayerHandle } from "./ui";
import { AppMark } from "./brand";
import { APP, APP_ORDER, SUITE, type AppId } from "@/lib/brand";
import { Home } from "./views/Home";
import { Lounge } from "./views/Lounge";
import { AuthScreen, CatchUpScreen } from "./views/Auth";
import { AwaySummary, Toast } from "./views/Overlays";

// Home and the Lounge load with the page; everything else when first opened (smaller cold start)
const Loading = () => <div className="grid h-full place-items-center bg-bg"><span className="skeleton h-24 w-56 rounded-2xl" /></div>;
const Trade = dynamic(() => import("./views/trade/Trade").then((m) => m.Trade), { loading: Loading });
const Wallet = dynamic(() => import("./views/wallet/Wallet").then((m) => m.Wallet), { loading: Loading });
const Feed = dynamic(() => import("./views/Feed").then((m) => m.Murmur), { loading: Loading });
const News = dynamic(() => import("./views/News").then((m) => m.News), { loading: Loading });
const SearchView = dynamic(() => import("./views/Search").then((m) => m.SearchView), { loading: Loading });
const ProfileView = dynamic(() => import("./views/Profile").then((m) => m.ProfileView), { loading: Loading });
const SettingsView = dynamic(() => import("./views/Settings").then((m) => m.SettingsView), { loading: Loading });

export type Route = { view: string; parts: string[]; query: URLSearchParams };
function parse(): Route {
  const h = typeof location === "undefined" ? "" : location.hash.replace(/^#\/?/, "");
  const [path, q] = h.split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  return { view: parts[0] ?? "home", parts: parts.slice(1), query: new URLSearchParams(q ?? "") };
}
function useRoute() {
  const [r, setR] = useState<Route>({ view: "home", parts: [], query: new URLSearchParams() });
  useEffect(() => {
    const f = () => { setR(parse()); };
    f();
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return r;
}

/** which of the four apps a route belongs to (for the dock) */
const appOf = (view: string): AppId | "home" | undefined => (view === "wallet" ? "wallet" : view === "trade" ? "trade" : view === "lounge" ? "lounge" : view === "feed" || view === "chirp" || view === "news" ? "feed" : view === "home" ? "home" : undefined);

export function App() {
  const app = useApp();
  const route = useRoute();
  useEffect(() => { init(); }, []);
  const w = app.world;
  useEffect(() => {
    if (!w) return;
    document.documentElement.dataset.motion = w.settings.reducedMotion ? "reduced" : "full";
    setPlayerHandle(w.player.handle ?? "god");
  }, [w, w?.settings.reducedMotion, w?.player.handle]);
  // iOS doesn't shrink the layout for the keyboard: size the app to the visible area so inputs stay in view
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const fit = () => { document.documentElement.style.setProperty("--app-h", `${Math.round(vv.height)}px`); if (vv.offsetTop || window.scrollY) window.scrollTo(0, 0); };
    // the app is a fixed-height shell: if focusing an input nudged the page, put it back once the input lets go
    const settle = () => setTimeout(() => { if (window.scrollY) window.scrollTo(0, 0); }, 50);
    fit();
    vv.addEventListener("resize", fit);
    document.addEventListener("focusout", settle);
    return () => { vv.removeEventListener("resize", fit); document.removeEventListener("focusout", settle); };
  }, []);

  if (app.phase === "boot") return <Splash />;
  if (app.phase === "profiles") return <AuthScreen />;
  if (app.phase === "elsewhere") return <Elsewhere />;
  if (app.phase === "catchup" || !w) return <CatchUpScreen progress={app.progress} />;

  let body: React.ReactNode;
  switch (route.view) {
    case "wallet": body = <Wallet route={route} />; break;
    case "trade": body = <Trade route={route} />; break;
    case "lounge": body = <Lounge route={route} />; break;
    case "feed": case "chirp": body = <Feed route={route} />; break;
    case "news": body = <News route={route} />; break;
    case "search": body = <SearchView route={route} />; break;
    case "u": body = <ProfileView id={route.parts[0]} />; break;
    case "settings": body = <SettingsView />; break;
    default: body = <Home />;
  }
  const current = appOf(route.view);

  return (
    <div className="flex h-[var(--app-h,100dvh)] bg-bg">
      {/* desktop: a slim dock with home and the four apps */}
      <nav aria-label="Apps" className="hidden w-[76px] shrink-0 flex-col items-center gap-3 border-r border-[var(--border)] bg-bg py-4 md:flex">
        <button aria-label="Home" aria-current={current === "home" ? "page" : undefined} onClick={() => go("/")} className={clsx("grid size-12 place-items-center rounded-2xl", current === "home" ? "bg-surface-3 text-[var(--header)]" : "text-muted hover:bg-surface")}><HomeIcon className="size-6" /></button>
        {APP_ORDER.map((id) => (
          <button key={id} aria-label={APP[id].name} title={APP[id].name} aria-current={current === id ? "page" : undefined} onClick={() => go(APP[id].route)} className={clsx("relative rounded-[16px] p-0.5 transition", current === id ? "ring-2 ring-accent" : "opacity-80 hover:opacity-100")}>
            <AppMark app={id} size={44} />
          </button>
        ))}
        <button aria-label="Settings" onClick={() => go("/settings")} className={clsx("mt-auto grid size-12 place-items-center rounded-2xl", route.view === "settings" ? "bg-surface-3 text-[var(--header)]" : "text-muted hover:bg-surface")}><Cog className="size-6" /></button>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 overflow-hidden">{body}</main>
        {route.view !== "home" && <HomeIndicator />}
      </div>
      {app.summary && <AwaySummary s={app.summary} />}
      <Toast />
    </div>
  );
}

/** phones: the slim bar at the bottom of every app; tap it or swipe up on it to go home */
function HomeIndicator() {
  const start = useRef<number | null>(null);
  return (
    <button aria-label="Home" onClick={() => { haptic(6); go("/"); }}
      onTouchStart={(e) => { start.current = e.touches[0].clientY; }}
      onTouchEnd={(e) => { const s0 = start.current; start.current = null; if (s0 !== null && s0 - e.changedTouches[0].clientY > 24) { haptic(6); go("/"); } }}
      className="hit-lg relative flex h-[calc(1.25rem+env(safe-area-inset-bottom))] min-h-[22px] w-full shrink-0 touch-none items-start justify-center bg-bg pt-2 md:hidden">
      <span className="h-[5px] w-[134px] rounded-full bg-[var(--text)] opacity-80" />
    </button>
  );
}

export const haptic = (ms = 8) => { try { if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms); } catch { /* not supported */ } };

function Elsewhere() {
  return (
    <div className="grid h-dvh place-items-center bg-bg p-6">
      <div className="max-w-sm text-center">
        <AppMark app="wallet" size={56} />
        <div className="mt-3 text-[17px] font-semibold text-[var(--header)]">{SUITE} is open in another tab</div>
        <p className="mt-1 text-[14px] text-muted">Only one tab keeps your world running at a time, so nothing gets out of sync.</p>
        <button onClick={takeOverHere} className="mt-5 min-h-[48px] rounded-2xl bg-accent px-6 text-[16px] font-bold text-accent-ink">Use here</button>
      </div>
    </div>
  );
}

function Splash() {
  return (
    <main className="grid h-dvh place-items-center bg-bg">
      <div className="flex gap-3">{APP_ORDER.map((id) => <AppMark key={id} app={id} size={44} />)}</div>
    </main>
  );
}
