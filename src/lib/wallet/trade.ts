/**
 * Paper trading maths. Fills happen at the live quote with a simulated swap fee and a price impact that
 * grows with order size relative to pool liquidity. Money is decimal (decimal.js) and virtual.
 */
import type { Position, TokenRef, TradeFill, WalletState } from "@/lib/sim/types";
import type { TokenQuote } from "@/lib/market/providers";
import { D } from "./state";

export const FEE_RATE = "0.005"; // 0.5% simulated swap fee
export const MAX_IMPACT_BPS = 2500; // beyond 25% the pool can't take the order
export const QUOTE_MAX_AGE = 60_000;

/** constant-product estimate: selling x into one side of a pool holding L/2 moves price by about 2x/L */
export function impactBps(usd: number, liquidityUsd: number): number {
  if (!(liquidityUsd > 0)) return MAX_IMPACT_BPS + 1;
  return Math.round(((2 * usd) / liquidityUsd) * 10_000);
}

export interface Preview {
  ok: boolean; reason?: string;
  side: "buy" | "sell"; usd: string; amount: string; price: string; fee: string; impactBps: number; pnl?: string;
}

const pos = (w: WalletState, account: string, t: { chain: string; address: string }) => w.positions.find((p) => p.account === account && p.chain === t.chain && p.address === t.address);
const fail = (side: "buy" | "sell", reason: string): Preview => ({ ok: false, reason, side, usd: "0", amount: "0", price: "0", fee: "0", impactBps: 0 });

function checkQuote(q: TokenQuote | undefined, quotedAt: number, now: number) {
  if (!q || !(Number(q.priceUsd) > 0)) return "No live price for this token right now.";
  if (now - quotedAt > QUOTE_MAX_AGE) return "Price is out of date. Pull to refresh and try again.";
  return undefined;
}

export function previewBuy(w: WalletState, q: TokenQuote | undefined, usdIn: string, quotedAt: number, now: number): Preview {
  const bad = checkQuote(q, quotedAt, now);
  if (bad) return fail("buy", bad);
  const usd = D(usdIn);
  if (!usd.isFinite() || usd.lte(0)) return fail("buy", "Enter an amount.");
  const cash = D(w.cash[w.active] ?? 0);
  if (usd.gt(cash)) return fail("buy", "Not enough cash in this account.");
  const imp = impactBps(usd.toNumber(), q!.liquidity);
  if (imp > MAX_IMPACT_BPS) return fail("buy", "Not enough liquidity for an order this size.");
  const fee = usd.mul(FEE_RATE);
  const price = D(q!.priceUsd).mul(D(1).plus(D(imp).div(10_000)));
  const amount = usd.minus(fee).div(price);
  return { ok: true, side: "buy", usd: usd.toFixed(2), amount: amount.toString(), price: price.toString(), fee: fee.toFixed(2), impactBps: imp };
}

export function previewSell(w: WalletState, q: TokenQuote | undefined, amountIn: string, quotedAt: number, now: number): Preview {
  const bad = checkQuote(q, quotedAt, now);
  if (bad) return fail("sell", bad);
  const p = pos(w, w.active, q!);
  const amount = D(amountIn);
  if (!p || D(p.amount).lte(0)) return fail("sell", "You don't hold this token in this account.");
  if (!amount.isFinite() || amount.lte(0)) return fail("sell", "Enter an amount.");
  if (amount.gt(D(p.amount).mul("1.000000001"))) return fail("sell", "That's more than you hold.");
  const amt = amount.gt(p.amount) ? D(p.amount) : amount;
  const gross = amt.mul(q!.priceUsd);
  const imp = impactBps(gross.toNumber(), q!.liquidity);
  if (imp > MAX_IMPACT_BPS) return fail("sell", "Not enough liquidity for an order this size.");
  const price = D(q!.priceUsd).mul(D(1).minus(D(imp).div(10_000)));
  const proceeds = amt.mul(price);
  const fee = proceeds.mul(FEE_RATE);
  const costShare = D(p.cost).mul(amt.div(p.amount));
  const net = proceeds.minus(fee);
  return { ok: true, side: "sell", usd: net.toFixed(2), amount: amt.toString(), price: price.toString(), fee: fee.toFixed(2), impactBps: imp, pnl: net.minus(costShare).toFixed(2) };
}

let seq = 0;
const fillId = (now: number) => `f${now.toString(36)}${(seq++).toString(36)}`;
const refOf = (q: TokenQuote): TokenRef => ({ chain: q.chain, address: q.address, symbol: q.symbol, name: q.name, pair: q.pair });

/** apply a previewed buy to the wallet (re-checks everything) */
export function executeBuy(w: WalletState, q: TokenQuote, usdIn: string, quotedAt: number, now: number): TradeFill | { error: string } {
  const pv = previewBuy(w, q, usdIn, quotedAt, now);
  if (!pv.ok) return { error: pv.reason! };
  w.cash[w.active] = D(w.cash[w.active]).minus(pv.usd).toFixed(2);
  let p = pos(w, w.active, q);
  if (!p) { p = { ...refOf(q), account: w.active, amount: "0", cost: "0", opened: now } as Position; w.positions.push(p); }
  p.amount = D(p.amount).plus(pv.amount).toString();
  p.cost = D(p.cost).plus(pv.usd).toFixed(2);
  p.pair = q.pair;
  const f: TradeFill = { ...refOf(q), id: fillId(now), t: now, account: w.active, side: "buy", amount: pv.amount, price: pv.price, usd: pv.usd, fee: pv.fee, impactBps: pv.impactBps };
  w.fills.push(f);
  return f;
}

export function executeSell(w: WalletState, q: TokenQuote, amountIn: string, quotedAt: number, now: number): TradeFill | { error: string } {
  const pv = previewSell(w, q, amountIn, quotedAt, now);
  if (!pv.ok) return { error: pv.reason! };
  const p = pos(w, w.active, q)!;
  const share = D(pv.amount).div(p.amount);
  p.cost = D(p.cost).mul(D(1).minus(share)).toFixed(2);
  p.amount = D(p.amount).minus(pv.amount).toString();
  if (D(p.amount).lte(0) || share.gte(0.999999)) w.positions = w.positions.filter((x) => x !== p);
  w.cash[w.active] = D(w.cash[w.active]).plus(pv.usd).toFixed(2);
  const f: TradeFill = { ...refOf(q), id: fillId(now), t: now, account: w.active, side: "sell", amount: pv.amount, price: pv.price, usd: pv.usd, fee: pv.fee, impactBps: pv.impactBps, pnl: pv.pnl };
  w.fills.push(f);
  return f;
}

/** realised P&L over a period (sells only) */
export function realised(w: WalletState, since = 0): string {
  return w.fills.filter((f) => f.side === "sell" && f.t >= since).reduce((a, f) => a.plus(f.pnl ?? 0), D(0)).toFixed(2);
}
