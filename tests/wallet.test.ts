import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { executeBuy, executeSell, impactBps, previewBuy, previewSell, realised } from "../src/lib/wallet/trade";
import { newWallet, setupPlayer, toHandle } from "../src/lib/wallet/state";
import { fmtPrice, fmtUsd, fmtPct } from "../src/lib/wallet/format";
import { __resetMarket, __seedQuote } from "../src/lib/market/client";
import { walletValue } from "../src/lib/wallet/value";
import type { TokenQuote } from "../src/lib/market/providers";
import { T0, world } from "./helpers";

const q = (price: string, liquidity = 1_000_000, over: Partial<TokenQuote> = {}): TokenQuote => ({
  chain: "solana", address: "Tok111111111111111111111111111111111111111", symbol: "FROGX", name: "Frog X", pair: "Pool1111", dex: "orca",
  priceUsd: price, change: { m5: 0, h1: 0, h6: 0, h24: 0 }, liquidity, fdv: 1e7, mcap: 1e7, volume24: 1e6, buys24: 100, sells24: 90, ...over,
});

describe("paper trading maths", () => {
  it("buys at the live price plus impact and fee, with exact decimal money", () => {
    const w = newWallet("10000", T0);
    const f = executeBuy(w, q("0.002"), "1000", T0, T0 + 1000);
    if ("error" in f) throw new Error(f.error);
    expect(f.fee).toBe("5.00");
    expect(f.impactBps).toBe(impactBps(1000, 1_000_000)); // 20 bps
    expect(new Decimal(f.price).toNumber()).toBeCloseTo(0.002 * 1.002, 12);
    expect(new Decimal(f.amount).mul(f.price).plus(f.fee).toFixed(2)).toBe("1000.00");
    expect(w.cash.main).toBe("9000.00");
    expect(w.positions[0].cost).toBe("1000.00");
  });

  it("sells for a realised P&L that adds up", () => {
    const w = newWallet("10000", T0);
    const b = executeBuy(w, q("0.002"), "1000", T0, T0);
    if ("error" in b) throw new Error(b.error);
    const s = executeSell(w, q("0.004"), b.amount, T0 + 60_000, T0 + 60_000);
    if ("error" in s) throw new Error(s.error);
    expect(w.positions).toHaveLength(0);
    expect(Number(s.pnl)).toBeGreaterThan(900); // ~2x minus fees and impact
    expect(new Decimal(w.cash.main).minus("9000").toFixed(2)).toBe(s.usd);
    expect(realised(w)).toBe(s.pnl);
  });

  it("partial sells keep the right cost basis", () => {
    const w = newWallet("10000", T0);
    const b = executeBuy(w, q("1"), "1000", T0, T0);
    if ("error" in b) throw new Error(b.error);
    const half = new Decimal(b.amount).div(2).toString();
    const s = executeSell(w, q("1"), half, T0, T0);
    if ("error" in s) throw new Error(s.error);
    expect(w.positions[0].cost).toBe("500.00");
    expect(Number(s.pnl)).toBeLessThan(0); // fees both ways at a flat price lose a little
  });

  it("refuses stale quotes, missing prices, too little cash or liquidity, and overselling", () => {
    const w = newWallet("1000", T0);
    expect(previewBuy(w, q("1"), "100", T0, T0 + 61_000).reason).toMatch(/out of date/);
    expect(previewBuy(w, undefined, "100", T0, T0).reason).toMatch(/No live price/);
    expect(previewBuy(w, q("1"), "5000", T0, T0).reason).toMatch(/Not enough cash/);
    expect(previewBuy(w, q("1", 2000), "900", T0, T0).reason).toMatch(/liquidity/);
    expect(previewSell(w, q("1"), "1", T0, T0).reason).toMatch(/don't hold/);
    const b = executeBuy(w, q("1"), "100", T0, T0);
    if ("error" in b) throw new Error(b.error);
    expect(previewSell(w, q("1"), new Decimal(b.amount).mul(2).toString(), T0, T0).reason).toMatch(/more than you hold/);
  });

  it("values the wallet at the latest quotes", () => {
    __resetMarket();
    const s = world();
    s.wallet = newWallet("10000", T0);
    const b = executeBuy(s.wallet, q("0.01"), "2000", T0, T0);
    if ("error" in b) throw new Error(b.error);
    __seedQuote(q("0.02"));
    const v = walletValue(s);
    expect(v.cash).toBe(8000);
    expect(v.positions).toBeGreaterThan(3900);
    expect(v.change).toBeGreaterThan(1900);
  });
});

describe("formatting", () => {
  it("formats money, tiny prices and percentages", () => {
    expect(fmtUsd(1234.5)).toBe("$1,234.50");
    expect(fmtUsd(-3, { sign: true })).toBe("−$3.00");
    expect(fmtPrice("0.000002995")).toBe("$0.0₅2995");
    expect(fmtPrice("1.5")).toBe("$1.50");
    expect(fmtPct(3.456)).toBe("+3.46%");
  });
  it("makes handles from names", () => {
    expect(toHandle("Alex Rivera")).toBe("alexrivera");
    expect(toHandle("!")).toBe("player");
  });
});

describe("v8 -> v9 migration", () => {
  it("old saves get a handle and the default virtual stake", async () => {
    const { migrateWorld, WORLD_VERSION } = await import("../src/lib/sim/world");
    const w = world();
    w.version = 8;
    delete w.wallet;
    delete w.player.handle;
    const m = migrateWorld(w)!;
    expect(m.version).toBe(WORLD_VERSION);
    expect(m.wallet?.cash.main).toBe("10000.00");
    expect(m.player.handle).toBeTruthy();
    expect(setupPlayer(m, { now: T0, start: "50" }).wallet?.cash.main).toBe("10000.00"); // never overwrites money
  });
});
