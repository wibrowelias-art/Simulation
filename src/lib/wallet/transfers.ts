/** Sending virtual money and tokens: between your own accounts, or to characters in the world. */
import type { Character, Transfer, WorldState } from "@/lib/sim/types";
import { tokenKey } from "@/lib/market/providers";
import { quoteOf } from "@/lib/market/client";
import { D } from "./state";
import { transferRipple } from "./world";

/** people you'd plausibly send money to: the regulars you know best */
export function contactsFor(s: WorldState): Character[] {
  return s.characters.filter((c) => c.core || (c.bond ?? 0) > 10 || (c.godContacts ?? []).some((g) => g.kind === "dm"))
    .filter((c) => !s.undernet || !Object.values(s.undernet.crew).includes(c.id))
    .sort((a, b) => (b.bond ?? 0) - (a.bond ?? 0)).slice(0, 24);
}

/** a fictional, deterministic address for the player's wallet (not a real chain address) */
export function walletAddress(s: WorldState): string {
  let h = 2166136261;
  for (const ch of `${s.seed}:${s.player.handle}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "lf1";
  for (let i = 0; i < 28; i++) { h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; out += alphabet[h % alphabet.length]; }
  return out;
}

let n = 0;
const tid = (now: number) => `x${now.toString(36)}${(n++).toString(36)}`;

export function sendTransfer(s: WorldState, o: { to: string; asset: string; amount: string; memo?: string }, now: number): Transfer | { error: string } {
  const w = s.wallet;
  if (!w) return { error: "No wallet." };
  const amt = D(o.amount);
  if (!amt.isFinite() || amt.lte(0)) return { error: "Enter an amount." };
  const toAcct = o.to.startsWith("acct:") ? o.to.slice(5) : undefined;
  if (toAcct && !w.accounts.some((a) => a.id === toAcct)) return { error: "Unknown account." };
  if (toAcct === w.active) return { error: "That's this account." };
  if (!toAcct && !o.to.startsWith("c")) return { error: "Unknown recipient." };
  let symbol = "USD", usd = amt, chain: string | undefined, address: string | undefined;
  if (o.asset === "cash") {
    if (amt.gt(w.cash[w.active] ?? 0)) return { error: "Not enough cash in this account." };
    w.cash[w.active] = D(w.cash[w.active]).minus(amt).toFixed(2);
    if (toAcct) w.cash[toAcct] = D(w.cash[toAcct] ?? 0).plus(amt).toFixed(2);
  } else {
    const p = w.positions.find((x) => x.account === w.active && tokenKey(x) === o.asset);
    if (!p) return { error: "You don't hold that token here." };
    if (amt.gt(p.amount)) return { error: "That's more than you hold." };
    const share = amt.div(p.amount);
    const costOut = D(p.cost).mul(share);
    const q = quoteOf(o.asset);
    usd = q ? amt.mul(q.q.priceUsd) : costOut;
    symbol = p.symbol; chain = p.chain; address = p.address;
    p.amount = D(p.amount).minus(amt).toString();
    p.cost = D(p.cost).minus(costOut).toFixed(2);
    if (D(p.amount).lte(0)) w.positions = w.positions.filter((x) => x !== p);
    if (toAcct) {
      const dest = w.positions.find((x) => x.account === toAcct && tokenKey(x) === o.asset);
      if (dest) { dest.amount = D(dest.amount).plus(amt).toString(); dest.cost = D(dest.cost).plus(costOut).toFixed(2); }
      else w.positions.push({ ...p, account: toAcct, amount: amt.toString(), cost: costOut.toFixed(2), opened: now });
    }
  }
  const x: Transfer = { id: tid(now), t: now, account: w.active, dir: "out", symbol, chain, address, amount: amt.toString(), usd: usd.toFixed(2), peer: o.to, memo: o.memo };
  w.transfers.push(x);
  if (toAcct) w.transfers.push({ ...x, id: tid(now), account: toAcct, dir: "in", peer: `acct:${w.active}` });
  else transferRipple(s, x, now);
  return x;
}

/** a character sends the player something (in-world tips, paying back, gifts) */
export function receiveFrom(s: WorldState, from: string, usd: string, memo: string | undefined, now: number): Transfer | undefined {
  const w = s.wallet;
  if (!w) return;
  w.cash.main = D(w.cash.main ?? 0).plus(usd).toFixed(2);
  const x: Transfer = { id: tid(now), t: now, account: "main", dir: "in", symbol: "USD", amount: D(usd).toFixed(2), usd: D(usd).toFixed(2), peer: from, memo };
  w.transfers.push(x);
  return x;
}
