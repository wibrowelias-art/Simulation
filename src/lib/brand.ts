/** Every name and mark in the suite is original. Rename here: everything visible reads from these. */
export const SUITE = "Lanternfish"; // the installable app (home screen + the four apps)
export const APP = {
  wallet: { id: "wallet", name: "Lanternfish", blurb: "Wallet", route: "/wallet" },
  trade: { id: "trade", name: "Kiteline", blurb: "Trade", route: "/trade" },
  lounge: { id: "lounge", name: "Lounge", blurb: "Chat", route: "/lounge" },
  feed: { id: "feed", name: "Murmur", blurb: "Feed", route: "/feed" },
} as const;
export type AppId = keyof typeof APP;
export const APP_ORDER: AppId[] = ["wallet", "trade", "lounge", "feed"];
/** the mark every exported image carries (rule: anything that leaves the app says it's fictional) */
export const exportMark = (app: AppId) => `fictional · ${APP[app].name}`;
