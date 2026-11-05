/** What the player's virtual money is worth right now, at the latest real prices we have. */
import type { Position, WorldState } from "@/lib/sim/types";
import { quoteOf } from "@/lib/market/client";
import { tokenKey } from "@/lib/market/providers";
import { D } from "./state";

export interface PositionValue { p: Position; price?: number; value: number; pnl: number; pnlPct: number; quotedAt?: number }
export function positionValue(p: Position): PositionValue {
  const q = quoteOf(tokenKey(p));
  const price = q ? Number(q.q.priceUsd) : undefined;
  const value = price !== undefined ? D(p.amount).mul(q!.q.priceUsd).toNumber() : Number(p.cost);
  const pnl = value - Number(p.cost);
  return { p, price, value, pnl, pnlPct: Number(p.cost) > 0 ? (pnl / Number(p.cost)) * 100 : 0, quotedAt: q?.t };
}

export function walletValue(s: WorldState, _now?: number, account?: string) {
  void _now;
  const w = s.wallet;
  if (!w) return { total: 0, cash: 0, positions: 0, change: 0, changePct: 0, unrealised: 0, items: [] as PositionValue[] };
  const accounts = account ? [account] : w.accounts.map((a) => a.id);
  const cash = accounts.reduce((a, id) => a + Number(w.cash[id] ?? 0), 0);
  const items = w.positions.filter((p) => accounts.includes(p.account)).map(positionValue).sort((a, b) => b.value - a.value);
  const positions = items.reduce((a, x) => a + x.value, 0);
  const total = cash + positions;
  const start = Number(w.start) * (account ? 1 : 1);
  const change = total - start;
  return { total, cash, positions, change, changePct: start > 0 ? (change / start) * 100 : 0, unrealised: items.reduce((a, x) => a + x.pnl, 0), items };
}

/** keep a sample of the total for the balance chart (at most every 5 minutes, and after every trade) */
export function sampleValue(s: WorldState, now: number, force = false) {
  const w = s.wallet;
  if (!w) return;
  const last = w.history.at(-1);
  if (!force && last && now - last[0] < 5 * 60_000) return;
  w.history.push([now, Math.round(walletValue(s).total * 100) / 100]);
  if (w.history.length > 2000) w.history = w.history.filter((_, i) => i % 2 === 0 || i > w.history.length - 300);
}
