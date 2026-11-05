import { afterEach, describe, expect, it, vi } from "vitest";
import { __resetMarket, __seedQuote, boardOf, errorOf, loadBoard, quoteOf, refreshQuotes } from "../src/lib/market/client";
import { previewBuy } from "../src/lib/wallet/trade";
import { newWallet } from "../src/lib/wallet/state";
import { tokenKey, type TokenQuote } from "../src/lib/market/providers";

const tok: TokenQuote = {
  chain: "solana", address: "Off111111111111111111111111111111111111111", symbol: "OFFL", name: "Offline", pair: "Pool2222", dex: "orca",
  priceUsd: "0.0042", change: { m5: 0, h1: 0, h6: 0, h24: 12 }, liquidity: 900_000, fdv: 4e6, mcap: 4e6, volume24: 2e5, buys24: 40, sells24: 30,
};

afterEach(() => { vi.unstubAllGlobals(); __resetMarket(); });

describe("with the network off", () => {
  it("keeps the last real price with its time, flags the error, and never makes one up", async () => {
    __resetMarket();
    const seenAt = Date.now() - 10 * 60_000;
    __seedQuote(tok, seenAt);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await refreshQuotes([{ chain: tok.chain, address: tok.address }]);
    const k = tokenKey(tok);
    const q = quoteOf(k)!;
    expect(q.q.priceUsd).toBe("0.0042"); // unchanged, not extrapolated
    expect(q.t).toBe(seenAt); // still dated to when it was really seen
    expect(errorOf(k)).toMatch(/unavailable/i);
    // a ten-minute-old quote can't fill a paper order
    const p = previewBuy(newWallet("1000", seenAt), q.q, "100", q.t, Date.now());
    expect(p.ok).toBe(false);
    expect(p.reason).toMatch(/out of date/);
  });

  it("a token it has never seen has no price at all", async () => {
    __resetMarket();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await refreshQuotes([{ chain: "solana", address: "Never1111111111111111111111111111111111111" }]);
    expect(quoteOf("solana:Never1111111111111111111111111111111111111")).toBeUndefined();
  });

  it("boards that fail to load show an error, not invented rows", async () => {
    __resetMarket();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await loadBoard("trending");
    expect(boardOf("trending")).toBeUndefined();
    expect(errorOf("board:trending")).toBeTruthy();
  });
});
