/** Virtual money for the player: set up, migrate and read. Everything here is simulated; nothing touches a real wallet. */
import Decimal from "decimal.js";
import type { WalletState, WorldState } from "@/lib/sim/types";

export const START_OPTIONS = ["1000", "10000", "50000"] as const;
export const DEFAULT_START = "10000";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });
export const D = (v: Decimal.Value) => new Decimal(v || 0);

export function newWallet(start: string, now: number): WalletState {
  const amt = D(start).isFinite() && D(start).gt(0) ? D(start).toFixed(2) : DEFAULT_START;
  return {
    start: amt, cash: { main: amt }, accounts: [{ id: "main", name: "Main", hue: 78 }], active: "main",
    positions: [], fills: [], transfers: [], history: [[now, Number(amt)]], watch: [],
  };
}

/** a handle from a display name: lowercase letters, digits, dot and underscore, 2-24 chars */
export function toHandle(name: string): string {
  const h = name.toLowerCase().normalize("NFKD").replace(/[^\w.]+/g, "").replace(/^\.+|\.+$/g, "").slice(0, 24);
  return h.length >= 2 ? h : "player";
}

/** give a world its player identity and virtual money (new worlds, and old saves on migration) */
export function setupPlayer(w: WorldState, o: { name?: string; handle?: string; start?: string; now: number }) {
  if (o.name) w.player.displayName = o.name;
  w.player.handle = o.handle ? toHandle(o.handle) : w.player.handle ?? toHandle(w.player.displayName || "player");
  if (!w.wallet) w.wallet = newWallet(o.start ?? DEFAULT_START, o.now);
  return w;
}

export const handleOf = (w: WorldState) => w.player.handle ?? "god";
