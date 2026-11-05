import { dsBoosted, dsNew, dsSearch, dsTokens, gtCandles, gtTrending, TIMEFRAMES, type MarketReply, type Timeframe, type TokenQuote } from "@/lib/market/providers";

export const runtime = "nodejs";
export const maxDuration = 15;

/**
 * Read-only market data proxy: caches public provider responses so many players share one upstream call,
 * and keeps each provider inside a per-instance request budget. Never trades, never needs a key.
 */
const TTL = { quote: 10_000, search: 30_000, boards: 60_000, trending: 300_000, candles: 300_000 };
const BUDGET = { ds: 200, gt: 9 }; // requests per minute per instance (DEX Screener documents 300, GeckoTerminal ~30)
const used: Record<keyof typeof BUDGET, number[]> = { ds: [], gt: [] };
function take(p: keyof typeof BUDGET, n = 1) {
  const now = Date.now();
  used[p] = used[p].filter((t) => now - t < 60_000);
  if (used[p].length + n > BUDGET[p]) return false;
  for (let i = 0; i < n; i++) used[p].push(now);
  return true;
}

const cache = new Map<string, { t: number; v: MarketReply<unknown> }>();
const inflight = new Map<string, Promise<MarketReply<unknown>>>();
async function cached<T>(key: string, ttl: number, provider: keyof typeof BUDGET, cost: number, source: string, load: () => Promise<T>): Promise<MarketReply<T>> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.v as MarketReply<T>;
  const running = inflight.get(key);
  if (running) return running as Promise<MarketReply<T>>;
  if (!take(provider, cost)) {
    if (hit) return { ...(hit.v as MarketReply<T>), stale: true, note: "busy: showing the last good copy" };
    throw Object.assign(new Error("busy"), { status: 429 });
  }
  const p = (async () => {
    try {
      const v: MarketReply<T> = { data: await load(), source, fetchedAt: Date.now() };
      cache.set(key, { t: Date.now(), v });
      if (cache.size > 800) for (const [k, x] of cache) if (Date.now() - x.t > 600_000) cache.delete(k);
      return v;
    } catch (e) {
      if (hit) return { ...(hit.v as MarketReply<T>), stale: true, note: "provider unavailable: showing the last good copy" };
      throw e;
    } finally { inflight.delete(key); }
  })();
  inflight.set(key, p as Promise<MarketReply<unknown>>);
  return p;
}

const ADDR = /^[\w.-]{6,80}$/;
const CHAIN = /^[a-z0-9-]{2,20}$/;

export async function GET(req: Request) {
  const u = new URL(req.url);
  const op = u.searchParams.get("op");
  try {
    if (op === "search") {
      const q = (u.searchParams.get("q") ?? "").trim().slice(0, 80);
      if (q.length < 2) return Response.json({ data: [], source: "DEX Screener", fetchedAt: Date.now() });
      return Response.json(await cached(`s:${q.toLowerCase()}`, TTL.search, "ds", 1, "DEX Screener", () => dsSearch(fetch, q)));
    }
    if (op === "quote") {
      const chain = u.searchParams.get("chain") ?? "";
      const addrs = (u.searchParams.get("addrs") ?? "").split(",").filter((a) => ADDR.test(a)).slice(0, 30);
      if (!CHAIN.test(chain) || !addrs.length) return Response.json({ error: "bad request" }, { status: 400 });
      return Response.json(await cached(`q:${chain}:${[...addrs].sort().join(",")}`, TTL.quote, "ds", 1, "DEX Screener", () => dsTokens(fetch, chain, addrs)));
    }
    if (op === "board") {
      const b = u.searchParams.get("b");
      if (b === "trending") {
        try { return Response.json(await cached("b:trending", TTL.trending, "gt", 1, "GeckoTerminal trending · DEX Screener prices", () => gtTrending(fetch))); }
        catch { return Response.json({ ...(await cached<TokenQuote[]>("b:boosted", TTL.boards, "ds", 3, "DEX Screener boosted (promoted)", () => dsBoosted(fetch))), note: "GeckoTerminal trending unavailable; showing DEX Screener's boosted tokens, which are paid promotions" }); }
      }
      if (b === "new") return Response.json(await cached("b:new", TTL.boards, "ds", 3, "DEX Screener latest token pages", () => dsNew(fetch)));
      if (b === "boosted") return Response.json(await cached("b:boosted", TTL.boards, "ds", 3, "DEX Screener boosted (promoted)", () => dsBoosted(fetch)));
      return Response.json({ error: "unknown board" }, { status: 400 });
    }
    if (op === "candles") {
      const chain = u.searchParams.get("chain") ?? "", pool = u.searchParams.get("pool") ?? "", tf = (u.searchParams.get("tf") ?? "1D") as Timeframe;
      if (!CHAIN.test(chain) || !ADDR.test(pool) || !(tf in TIMEFRAMES)) return Response.json({ error: "bad request" }, { status: 400 });
      return Response.json(await cached(`c:${chain}:${pool}:${tf}`, TTL.candles, "gt", 1, "GeckoTerminal OHLCV", () => gtCandles(fetch, chain, pool, tf)));
    }
    return Response.json({ error: "unknown op" }, { status: 400 });
  } catch (e) {
    const status = Number((e as { status?: number }).status) === 429 ? 429 : 502;
    return Response.json({ error: status === 429 ? "busy" : "provider unavailable", code: status === 429 ? "busy" : "upstream" }, { status });
  }
}
