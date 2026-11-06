/**
 * How the world hears about the player's money: big paper trades get talked about in the Lounge and on Murmur,
 * people you send money to answer you, and real coins moving hard on the real market become topics.
 * This is an overlay on the seeded world (it runs from player actions and live market data, never in catch-up).
 */
import type { Message, Server, Topic, TradeFill, Transfer, WorldState } from "@/lib/sim/types";
import { makePost, nid, notify, runEpisode } from "@/lib/sim/engine";
import { marketTopic } from "@/lib/sim/topics";
import { rngFor } from "@/lib/sim/rng";
import { charById } from "@/lib/sim/world";
import { dmChannel } from "@/lib/sim/godspeak";
import { adjustRel, nudgeMood, rememberLong } from "@/lib/sim/memory";
import { obsessionOf } from "@/lib/sim/social";
import { fmtMoney } from "@/lib/sim/format";
import type { TokenQuote } from "@/lib/market/providers";

const SEC = 1000;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** servers that care about the player's trades, most interested first */
const TRADING = ["godhq", "fanclub", "cryptoug", "pumppit", "overrated", "chartgremlins", "vault"];

/** is this trade worth talking about? big for this player's stake, or a big win/loss */
export function newsworthy(s: WorldState, f: TradeFill) {
  const start = Number(s.wallet?.start ?? 10_000);
  const usd = Number(f.usd), pnl = Math.abs(Number(f.pnl ?? 0));
  return usd >= Math.max(200, start * 0.04) || pnl >= Math.max(100, start * 0.02);
}

export function tradeRipple(s: WorldState, f: TradeFill, now: number) {
  if (!newsworthy(s, f)) return;
  const rng = rngFor(s.seed, "trade", f.id);
  const sym = f.symbol.replace(/^\$/, "");
  const pnl = Number(f.pnl ?? 0);
  const category = f.side === "buy" ? "trade" : pnl >= 0 ? "tradeWin" : "tradeLoss";
  const amount = f.side === "buy" ? Number(f.usd) : Math.abs(pnl);
  const mag = clamp(2.5 + Math.log10(Math.max(10, amount)) / 1.3, 2.5, 6);
  const topic: Topic = {
    id: nid(s, "t"), tag: sym.toUpperCase().slice(0, 16), about: "god", category, startedAt: now, subject: `$${sym}`, amount,
    label: f.side === "buy" ? `god's ${fmtMoney(amount)} $${sym} buy` : `god's ${pnl >= 0 ? "win" : "loss"} on $${sym}`,
    valence: f.side === "buy" ? 0.1 : pnl >= 0 ? 0.35 : -0.25, magnitude: mag, heat: mag * 3, facts: { coin: sym, side: f.side },
  };
  s.topics.push(topic);
  // the trading servers react: the home server within seconds, others over the next minute
  const servers = TRADING.map((id) => s.servers.find((x) => x.id === id)).filter((x): x is Server => !!x);
  servers.forEach((srv, i) => {
    if (i > 0 && !rng.chance(0.75 - i * 0.08)) return;
    const ch = srv.channels.find((c) => !c.announce && c.tags.includes("god") && /general|calls|pnl|copy|degen|wins|setups/.test(c.name)) ?? srv.channels.find((c) => !c.announce)!;
    runEpisode(s, rng, srv, ch, now + (i === 0 ? rng.range(3, 8) : rng.range(10, 55)) * SEC, topic, { mode: "reaction", minLen: i === 0 ? 4 : 2 });
  });
  // Murmur posts about it
  for (let i = 0, n = Math.round(2 + mag); i < n; i++) makePost(s, rng, now + rng.range(8, 75) * SEC, { topic, platform: "chirp" });
  s.player.followers += Math.round(amount * rng.range(0.05, 0.3));
  notify(s, now + 15 * SEC, "mention", f.side === "buy" ? `People are talking about your $${sym} buy` : `People saw your ${pnl >= 0 ? "win" : "loss"} on $${sym}`, "lounge:godhq:godhq-general");
}

const THANKS = ["omg thank you 😭", "wait you didn't have to 😭🙏", "ok i owe you one fr", "THANK YOU", "you're actually the best", "bro what 😭 thank you", "appreciate you fr 🙏", "lunch is on me next time lol"];
const THANKS_COLD = ["oh. thanks i guess", "...thanks", "is this an apology?", "ok. thanks."];

/** someone you sent money to answers you in DMs, and remembers it */
export function transferRipple(s: WorldState, x: Transfer, now: number) {
  if (!x.peer.startsWith("c")) return;
  const c = charById(s, x.peer);
  if (!c) return;
  const rng = rngFor(s.seed, "tip", x.id);
  const cold = (c.rel?.god ?? 0) < -20 || obsessionOf(c) === "hater";
  const what = x.symbol === "USD" ? fmtMoney(Number(x.amount)) : `${x.symbol}`;
  const lines = [rng.pick(cold ? THANKS_COLD : THANKS)];
  if (x.memo && rng.chance(0.6)) lines.push(`${x.memo.toLowerCase().replace(/[.!]+$/, "")} 😂`);
  else if (!cold && rng.chance(0.5)) lines.push(x.symbol === "USD" ? `${what} just landed` : `holding the ${x.symbol} forever now`);
  const ch = dmChannel("god", c.id);
  let t = now + rng.range(4, 15) * SEC;
  for (const text of lines) {
    const m: Message = { id: nid(s, "m"), serverId: "dm", channelId: ch, authorId: c.id, text, t: Math.round(t), typingFrom: Math.round(t - clamp(text.length * 60, 1200, 4000)), reactions: [], kind: "chat", score: 2, mentionsGod: true };
    s.pending.push(m);
    t += rng.range(2, 6) * SEC;
  }
  notify(s, now + 5 * SEC, "mention", `@${c.username} got your ${what}`, `lounge:dm:${ch}`);
  adjustRel(c, "god", cold ? 6 : 10);
  c.bond = clamp((c.bond ?? 0) + 6, 0, 100);
  nudgeMood(c, 0.3);
  rememberLong(c, { about: "god", text: `god sent me ${what}${x.memo ? ` ("${x.memo}")` : ""}`, t: now, w: 0.75 });
}

/** real coins moving hard on the real market become topics (at most two new ones, none repeated within 6 h) */
export function marketTopics(s: WorldState, rows: TokenQuote[], now: number): number {
  const recent = new Set(s.topics.filter((t) => t.facts.real && now - t.startedAt < 6 * 3600e3).map((t) => t.facts.address));
  const movers = rows.filter((q) => Math.abs(q.change.h24) >= 40 && q.liquidity >= 50_000 && !recent.has(q.address)).sort((a, b) => Math.abs(b.change.h24) - Math.abs(a.change.h24)).slice(0, 2);
  for (const q of movers) s.topics.push(marketTopic(nid(s, "t"), now, { symbol: q.symbol, name: q.name, change: q.change.h24, chain: q.chain, address: q.address }));
  return movers.length;
}
