import { describe, expect, it } from "vitest";
import { T0, world } from "./helpers";
import { simulate } from "../src/lib/sim/engine";
import { executeBuy, executeSell } from "../src/lib/wallet/trade";
import { newWallet } from "../src/lib/wallet/state";
import { marketTopics, newsworthy, tradeRipple, transferRipple } from "../src/lib/wallet/world";
import { sendTransfer } from "../src/lib/wallet/transfers";
import { instructions, parseScene, sanitize, sanitizeScene, sceneInstructions } from "../src/lib/live/prompt";
import type { TokenQuote } from "../src/lib/market/providers";

const q = (price: string, over: Partial<TokenQuote> = {}): TokenQuote => ({
  chain: "solana", address: "Tok222222222222222222222222222222222222222", symbol: "LOOT", name: "Loot", pair: "Pool2222", dex: "orca",
  priceUsd: price, change: { m5: 0, h1: 0, h6: 0, h24: 0 }, liquidity: 2_000_000, fdv: 1e7, mcap: 1e7, volume24: 1e6, buys24: 100, sells24: 90, ...over,
});

describe("the world hears about your trades", () => {
  it("a big paper buy: 3+ Lounge characters mention it within a minute, and it's on Murmur", () => {
    const s = world("trade-news");
    const now = T0 + 120_000;
    simulate(s, now);
    s.wallet = newWallet("10000", now);
    const f = executeBuy(s.wallet, q("0.01"), "1500", now, now);
    if ("error" in f) throw new Error(f.error);
    expect(newsworthy(s, f)).toBe(true);
    tradeRipple(s, f, now);
    const topic = s.topics.at(-1)!;
    expect(topic.category).toBe("trade");
    const lounge = [...s.messages, ...s.pending].filter((m) => m.topicId === topic.id && m.serverId !== "dm" && m.authorId.startsWith("c") && m.t <= now + 60_000);
    expect(new Set(lounge.map((m) => m.authorId)).size).toBeGreaterThanOrEqual(3);
    expect(lounge.some((m) => m.text.includes("LOOT"))).toBe(true);
    const posts = s.posts.filter((p) => p.topicId === topic.id);
    expect(posts.length).toBeGreaterThan(1);
    expect(posts.every((p) => p.t <= now + 90_000)).toBe(true);
  });

  it("small trades stay quiet; a big win or loss is news", () => {
    const s = world("trade-news2");
    s.wallet = newWallet("10000", T0);
    const small = executeBuy(s.wallet, q("0.01"), "50", T0, T0);
    if ("error" in small) throw new Error(small.error);
    expect(newsworthy(s, small)).toBe(false);
    const big = executeBuy(s.wallet, q("0.01"), "3000", T0, T0);
    if ("error" in big) throw new Error(big.error);
    const sold = executeSell(s.wallet, q("0.02"), s.wallet.positions[0].amount, T0, T0);
    if ("error" in sold) throw new Error(sold.error);
    expect(newsworthy(s, sold)).toBe(true);
    const before = s.topics.length;
    tradeRipple(s, sold, T0);
    expect(s.topics.at(-1)!.category).toBe("tradeWin");
    expect(s.topics.length).toBe(before + 1);
  });

  it("sending money to someone gets a DM back and they remember it", () => {
    const s = world("tip");
    s.wallet = newWallet("10000", T0);
    const c = s.characters.find((x) => x.core)!;
    const r = sendTransfer(s, { to: c.id, asset: "cash", amount: "25", memo: "for the pizza" }, T0);
    if ("error" in r) throw new Error(r.error);
    expect(s.wallet.cash.main).toBe("9975.00");
    const dm = s.pending.filter((m) => m.serverId === "dm" && m.authorId === c.id);
    expect(dm.length).toBeGreaterThan(0);
    expect(c.mem?.some((m) => /sent me/.test(m.text))).toBe(true);
    void transferRipple;
  });

  it("moves between your own accounts keep cost basis", () => {
    const s = world("acct");
    s.wallet = newWallet("10000", T0);
    s.wallet.accounts.push({ id: "b", name: "Degen", hue: 200 }); s.wallet.cash.b = "0.00";
    const f = executeBuy(s.wallet, q("1"), "1000", T0, T0);
    if ("error" in f) throw new Error(f.error);
    const key = "solana:Tok222222222222222222222222222222222222222";
    const half = (Number(s.wallet.positions[0].amount) / 2).toString();
    const r = sendTransfer(s, { to: "acct:b", asset: key, amount: half }, T0);
    if ("error" in r) throw new Error(r.error);
    const total = s.wallet.positions.reduce((a, p) => a + Number(p.cost), 0);
    expect(total).toBeCloseTo(1000, 1);
    expect(s.wallet.positions.map((p) => p.account).sort()).toEqual(["b", "main"]);
  });

  it("real coins moving hard become topics, once", () => {
    const s = world("movers");
    const rows = [q("1", { symbol: "PUMP", address: "A1", change: { m5: 0, h1: 0, h6: 0, h24: 180 } }), q("1", { symbol: "DUMP", address: "A2", change: { m5: 0, h1: 0, h6: 0, h24: -70 } }), q("1", { symbol: "MEH", address: "A3", change: { m5: 0, h1: 0, h6: 0, h24: 5 } })];
    expect(marketTopics(s, rows, T0)).toBe(2);
    expect(s.topics.some((t) => t.label === "$PUMP up 180% today")).toBe(true);
    expect(marketTopics(s, rows, T0 + 60_000)).toBe(0);
  });
});

describe("prompts know who the player is", () => {
  it("names the player by handle, not as a billionaire 'god'", () => {
    const r = sanitize({ persona: { username: "kai", name: "Kai" }, god: "yo", player: "Alex.R!" })!;
    expect(r.player).toBe("alex.r");
    const sys = instructions(r);
    expect(sys).toMatch(/@alex\.r is a memecoin trader/);
    expect(sys).not.toMatch(/richest/);
    const sc = sanitizeScene({ kind: "scene", cast: [{ username: "kai" }], lines: 3, player: "alex" })!;
    expect(sceneInstructions(sc)).toMatch(/@alex/);
    expect(parseScene(JSON.stringify({ lines: [{ who: "kai", text: "lol", to: "alex" }] }), ["kai"], 8, "alex")[0].to).toBe("god");
  });
});
