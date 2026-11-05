/**
 * Public market data, normalised. Prices are real; nothing here trades.
 * - DEX Screener (no key): search, token quotes, latest token profiles, boosted tokens.
 *   https://docs.dexscreener.com/api/reference — 300 req/min on market endpoints, 60/min on profiles/boosts.
 * - GeckoTerminal (no key): trending pools and OHLCV candles.
 *   https://api.geckoterminal.com/docs/index.html — about 30 req/min on the public tier; we budget 9/min.
 * Used by /api/market on the server, and directly by the browser when there is no server (static hosting).
 */

export interface TokenQuote {
  chain: string; // DEX Screener chain id: solana, ethereum, base, bsc, arbitrum, ...
  address: string;
  symbol: string;
  name: string;
  pair: string; // the deepest pool we price from
  dex: string;
  priceUsd: string; // decimal string, never a float in maths
  change: { m5: number; h1: number; h6: number; h24: number };
  liquidity: number;
  fdv: number;
  mcap: number;
  volume24: number;
  buys24: number;
  sells24: number;
  createdAt?: number;
}
export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number }
export interface MarketReply<T> { data: T; source: string; fetchedAt: number; stale?: boolean; note?: string }

const DS = "https://api.dexscreener.com";
const GT = "https://api.geckoterminal.com/api/v2";
/** DEX Screener chain ids -> GeckoTerminal network ids */
export const GT_NETWORK: Record<string, string> = { solana: "solana", ethereum: "eth", base: "base", bsc: "bsc", arbitrum: "arbitrum", polygon: "polygon_pos", avalanche: "avax", optimism: "optimism", sui: "sui-network", ton: "ton", tron: "tron" };
export const CHAIN_LABEL: Record<string, string> = { solana: "Solana", ethereum: "Ethereum", base: "Base", bsc: "BNB Chain", arbitrum: "Arbitrum", polygon: "Polygon", avalanche: "Avalanche", optimism: "Optimism", sui: "Sui", ton: "TON", tron: "Tron" };

export const tokenKey = (t: { chain: string; address: string }) => `${t.chain}:${t.address}`;

interface DsPair {
  chainId: string; dexId: string; pairAddress: string; priceUsd?: string;
  baseToken: { address: string; name: string; symbol: string };
  priceChange?: Partial<Record<"m5" | "h1" | "h6" | "h24", number>>;
  liquidity?: { usd?: number }; fdv?: number; marketCap?: number;
  volume?: { h24?: number }; txns?: { h24?: { buys?: number; sells?: number } }; pairCreatedAt?: number;
}

/** one quote per token: the pair with the most USD liquidity wins */
export function fromPairs(pairs: DsPair[]): TokenQuote[] {
  const best = new Map<string, DsPair>();
  for (const p of pairs) {
    if (!p?.baseToken?.address || !p.priceUsd || !(Number(p.priceUsd) > 0)) continue;
    const k = `${p.chainId}:${p.baseToken.address}`;
    const cur = best.get(k);
    if (!cur || (p.liquidity?.usd ?? 0) > (cur.liquidity?.usd ?? 0)) best.set(k, p);
  }
  return [...best.values()].map((p) => ({
    chain: p.chainId, address: p.baseToken.address, symbol: (p.baseToken.symbol || "?").slice(0, 16), name: (p.baseToken.name || p.baseToken.symbol || "?").slice(0, 40),
    pair: p.pairAddress, dex: p.dexId, priceUsd: p.priceUsd!,
    change: { m5: p.priceChange?.m5 ?? 0, h1: p.priceChange?.h1 ?? 0, h6: p.priceChange?.h6 ?? 0, h24: p.priceChange?.h24 ?? 0 },
    liquidity: p.liquidity?.usd ?? 0, fdv: p.fdv ?? 0, mcap: p.marketCap ?? p.fdv ?? 0, volume24: p.volume?.h24 ?? 0,
    buys24: p.txns?.h24?.buys ?? 0, sells24: p.txns?.h24?.sells ?? 0, createdAt: p.pairCreatedAt,
  }));
}

type Fetch = typeof fetch;
async function json<T>(f: Fetch, url: string, signal?: AbortSignal): Promise<T> {
  const r = await f(url, { signal, headers: { accept: "application/json" } });
  if (!r.ok) throw Object.assign(new Error(`${new URL(url).host} ${r.status}`), { status: r.status });
  return (await r.json()) as T;
}

export async function dsSearch(f: Fetch, q: string, signal?: AbortSignal): Promise<TokenQuote[]> {
  const j = await json<{ pairs?: DsPair[] }>(f, `${DS}/latest/dex/search?q=${encodeURIComponent(q.slice(0, 80))}`, signal);
  return fromPairs(j.pairs ?? []).filter((t) => t.liquidity >= 1000).sort((a, b) => b.liquidity - a.liquidity).slice(0, 30);
}

/** quotes for up to 30 tokens per chain per call */
export async function dsTokens(f: Fetch, chain: string, addresses: string[], signal?: AbortSignal): Promise<TokenQuote[]> {
  const out: TokenQuote[] = [];
  for (let i = 0; i < addresses.length; i += 30) {
    const batch = addresses.slice(i, i + 30).map(encodeURIComponent).join(",");
    out.push(...fromPairs(await json<DsPair[]>(f, `${DS}/tokens/v1/${encodeURIComponent(chain)}/${batch}`, signal)));
  }
  return out;
}

async function quotesFor(f: Fetch, refs: { chainId: string; tokenAddress: string }[], signal?: AbortSignal) {
  const byChain = new Map<string, string[]>();
  for (const r of refs) { const l = byChain.get(r.chainId) ?? []; if (!l.includes(r.tokenAddress)) l.push(r.tokenAddress); byChain.set(r.chainId, l); }
  const all = await Promise.all([...byChain].map(([c, a]) => dsTokens(f, c, a.slice(0, 30), signal).catch(() => [] as TokenQuote[])));
  return all.flat();
}

/** newest token pages on DEX Screener, priced */
export async function dsNew(f: Fetch, signal?: AbortSignal): Promise<TokenQuote[]> {
  const refs = await json<{ chainId: string; tokenAddress: string }[]>(f, `${DS}/token-profiles/latest/v1`, signal);
  const q = await quotesFor(f, refs.slice(0, 40), signal);
  const order = new Map(refs.map((r, i) => [`${r.chainId}:${r.tokenAddress}`, i]));
  return q.filter((t) => t.liquidity >= 2000).sort((a, b) => (order.get(tokenKey(a)) ?? 99) - (order.get(tokenKey(b)) ?? 99));
}

/** most-boosted tokens on DEX Screener (promoted listings: labelled as such, never as "trending") */
export async function dsBoosted(f: Fetch, signal?: AbortSignal): Promise<TokenQuote[]> {
  const refs = await json<{ chainId: string; tokenAddress: string }[]>(f, `${DS}/token-boosts/top/v1`, signal);
  return (await quotesFor(f, refs.slice(0, 40), signal)).filter((t) => t.liquidity >= 5000);
}

/** trending pools across networks on GeckoTerminal, re-priced through DEX Screener so every row has the same shape */
export async function gtTrending(f: Fetch, signal?: AbortSignal): Promise<TokenQuote[]> {
  const j = await json<{ data?: { relationships?: { base_token?: { data?: { id?: string } } } }[] }>(f, `${GT}/networks/trending_pools?page=1`, signal);
  const back: Record<string, string> = Object.fromEntries(Object.entries(GT_NETWORK).map(([k, v]) => [v, k]));
  const refs: { chainId: string; tokenAddress: string }[] = [];
  for (const p of j.data ?? []) {
    const id = p.relationships?.base_token?.data?.id ?? ""; // "<network>_<address>"
    const i = id.indexOf("_");
    const chain = back[id.slice(0, i)];
    if (chain && i > 0) refs.push({ chainId: chain, tokenAddress: id.slice(i + 1) });
  }
  const order = new Map(refs.map((r, i) => [`${r.chainId}:${r.tokenAddress}`, i]));
  return (await quotesFor(f, refs.slice(0, 30), signal)).sort((a, b) => (order.get(tokenKey(a)) ?? 99) - (order.get(tokenKey(b)) ?? 99));
}

export const TIMEFRAMES = { "1H": { tf: "minute", agg: 1, limit: 60 }, "1D": { tf: "minute", agg: 15, limit: 96 }, "1W": { tf: "hour", agg: 4, limit: 42 }, "1M": { tf: "day", agg: 1, limit: 30 } } as const;
export type Timeframe = keyof typeof TIMEFRAMES;

export async function gtCandles(f: Fetch, chain: string, pool: string, tf: Timeframe, signal?: AbortSignal): Promise<Candle[]> {
  const net = GT_NETWORK[chain];
  if (!net) throw new Error(`no candle source for ${chain}`);
  const o = TIMEFRAMES[tf];
  const j = await json<{ data?: { attributes?: { ohlcv_list?: number[][] } } }>(f, `${GT}/networks/${net}/pools/${encodeURIComponent(pool)}/ohlcv/${o.tf}?aggregate=${o.agg}&limit=${o.limit}&currency=usd`, signal);
  return (j.data?.attributes?.ohlcv_list ?? []).map(([t, op, h, l, c, v]) => ({ t: t * 1000, o: op, h, l, c, v })).filter((c) => c.c > 0).sort((a, b) => a.t - b.t);
}
