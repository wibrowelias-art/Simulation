import type { Rng } from "./rng";
import type { Choice, WorldState } from "./types";
import { LEAK_CHOICES, resolveLeak } from "./undernet";

export interface Effect {
  cash?: number;
  reputation?: number;
  influence?: number;
  followers?: number;
  opinion?: number; // global opinion nudge
  topic?: { category: string; label: string; subject: string; valence: number; magnitude: number; amount?: number };
  outcome: string;
}

export interface EventDef {
  type: string;
  weight: number;
  make: (rng: Rng, s: WorldState) => { title: string; body: string; fromId?: string; data: Record<string, string | number> };
  choices: Choice[];
  resolve: (choiceId: string, rng: Rng, data: Record<string, string | number>, s: WorldState) => Effect;
}

const celebOf = (rng: Rng, s: WorldState) => {
  const c = rng.pick(s.celebrities);
  return s.characters[Number(c.id.slice(1))];
};

export const EVENT_DEFS: EventDef[] = [
  {
    type: "interview", weight: 3,
    make: (rng, s) => { const o = rng.pick(s.outlets); return { title: `${o.name} wants an interview`, body: `${rng.pick(o.authors).name} is asking for 30 minutes on camera about "the God effect".`, data: { outlet: o.name } }; },
    choices: [{ id: "accept", label: "Do the interview", hint: "+influence, risky quotes" }, { id: "decline", label: "Decline", hint: "mystery intact" }, { id: "troll", label: "Answer only in emojis", hint: "memes guaranteed" }],
    resolve: (c, rng, d) => c === "accept"
      ? (rng.chance(0.7) ? { influence: 4, reputation: 3, followers: 600_000, outcome: `The ${d.outlet} interview landed well. Clips everywhere.`, topic: { category: "interview", label: `the ${d.outlet} interview`, subject: "I don't chase attention. It finds me.", valence: 0.5, magnitude: 5 } }
        : { influence: 3, reputation: -6, followers: 300_000, outcome: `One quote from the ${d.outlet} interview got taken out of context.`, topic: { category: "controversy", label: `the ${d.outlet} interview quote`, subject: "Most people just don't want it enough.", valence: -0.5, magnitude: 6 } })
      : c === "troll" ? { influence: 2, followers: 900_000, reputation: -1, outcome: "The emoji-only interview is now a meme format.", topic: { category: "viral", label: "the emoji-only interview", subject: "👑🏝️💸🤫", valence: 0.3, magnitude: 5.5 } }
      : { reputation: 1, outcome: "You declined. Fan theories about why are already circulating." },
  },
  {
    type: "collab", weight: 3,
    make: (rng, s) => { const c = celebOf(rng, s); return { title: `${c.displayName} wants a collab`, fromId: c.id, body: `${c.displayName} (${c.occupation}) DM'd: "us two. one project. internet breaks. you in?"`, data: { celeb: c.displayName, fee: rng.int(2, 40) * 1e6 } }; },
    choices: [{ id: "yes", label: "Collab", hint: "costs money, huge reach" }, { id: "no", label: "Leave on read", hint: "might start beef" }, { id: "counter", label: "Counter: they come to the island", hint: "flex" }],
    resolve: (c, rng, d) => c === "yes" ? { cash: -Number(d.fee), influence: 5, followers: 2_000_000, reputation: 2, outcome: `The ${d.celeb} collab is announced. Both fanbases are losing it.`, topic: { category: "collab", label: `the ${d.celeb} collab`, subject: `${d.celeb}`, valence: 0.5, magnitude: 6.5, amount: Number(d.fee) } }
      : c === "no" ? { reputation: -2, outcome: `${d.celeb} posted "noted." Fans smell beef.`, topic: { category: "mention", label: `${d.celeb} getting left on read`, subject: `left ${d.celeb} on read`, valence: -0.3, magnitude: 5 } }
      : { influence: 3, followers: 800_000, outcome: `${d.celeb} accepted the island invite. Paparazzi boats spotted.`, topic: { category: "collab", label: `${d.celeb}'s island visit`, subject: `${d.celeb}`, valence: 0.4, magnitude: 6 } },
  },
  {
    type: "buyout", weight: 2,
    make: (rng, s) => { const h = s.player.holdings.filter((x) => x.kind === "business" || x.kind === "investment"); const t = h.length ? rng.pick(h) : undefined; const mult = rng.range(1.2, 2.2); return { title: `Buyout offer for ${t?.name ?? "GOD Holdings"}`, body: `A private fund offers ${mult.toFixed(1)}x value. Deadline tonight.`, data: { holding: t?.id ?? "", name: t?.name ?? "GOD Holdings", mult } }; },
    choices: [{ id: "sell", label: "Sell", hint: "cash now" }, { id: "refuse", label: "Refuse publicly", hint: "+reputation" }, { id: "raise", label: "Ask for 3x", hint: "gamble" }],
    resolve: (c, rng, d, s) => {
      const h = s.player.holdings.find((x) => x.id === d.holding);
      const val = h?.value ?? 0;
      if (c === "sell" && h) { s.player.holdings = s.player.holdings.filter((x) => x !== h); return { cash: val * Number(d.mult), influence: -2, outcome: `Sold ${d.name} for ${Number(d.mult).toFixed(1)}x.`, topic: { category: "acquisition", label: `the ${d.name} sale`, subject: `${d.name}`, valence: 0.1, magnitude: 6, amount: val * Number(d.mult) } }; }
      if (c === "raise") return rng.chance(0.35) && h ? (s.player.holdings = s.player.holdings.filter((x) => x !== h), { cash: val * 3, outcome: `They paid 3x for ${d.name}. Legendary.`, topic: { category: "acquisition", label: `the 3x ${d.name} deal`, subject: `${d.name}`, valence: 0.6, magnitude: 7.5, amount: val * 3 } }) : { reputation: -1, outcome: "The fund walked. Analysts call it greedy." };
      return { reputation: 4, influence: 1, outcome: `"${d.name} isn't for sale." Fans are printing it on shirts.`, topic: { category: "announcement", label: `the "not for sale" post`, subject: `${d.name} isn't for sale.`, valence: 0.5, magnitude: 4.5 } };
    },
  },
  {
    type: "allegation", weight: 2,
    make: (rng) => { const claim = rng.pick(["your island is a rental", "you bought 10M bot followers", "your coin team dumped on fans", "you never wrote your own posts"]); return { title: "An anonymous account is accusing you", body: `A Chirp thread claiming ${claim} has 2M views and climbing.`, data: { claim } }; },
    choices: [{ id: "deny", label: "Deny with receipts", hint: "costs time, fixes rep" }, { id: "ignore", label: "Ignore", hint: "might fade, might grow" }, { id: "sue", label: "Threaten to sue", hint: "Streisand risk" }],
    resolve: (c, rng, d) => c === "deny" ? { reputation: 5, outcome: "Receipts posted. Community note added to the original thread.", topic: { category: "announcement", label: "the receipts thread", subject: "Receipts. Have a nice day.", valence: 0.5, magnitude: 5 } }
      : c === "sue" ? { reputation: -5, influence: 2, outcome: "The lawsuit threat made the claim go 10x more viral.", topic: { category: "controversy", label: `the claim that ${d.claim}`, subject: `${d.claim}`, valence: -0.7, magnitude: 7.5 } }
      : rng.chance(0.5) ? { outcome: "It fizzled. The internet moved on." } : { reputation: -6, outcome: "Silence was read as guilt. It's trending.", topic: { category: "allegation", label: `the claim that ${d.claim}`, subject: `${d.claim}`, valence: -0.6, magnitude: 6 } },
  },
  {
    type: "fan", weight: 3,
    make: (rng, s) => { const c = rng.pick(s.characters.filter((x) => x.opinion > 40)); const ask = rng.pick(["pay for my mom's surgery", "rate my startup pitch", "shout out my art", "come to my graduation", "buy my car so I can pay rent"]); return { title: `@${c.username} is asking you to ${ask}`, fromId: c.id, body: `${c.displayName} (${c.age}, ${c.location}) posted in GOD HQ. 4k reactions.`, data: { ask, who: c.username, cid: c.id } }; },
    choices: [{ id: "help", label: "Do it", hint: "costs a little, big love" }, { id: "shout", label: "Just reply", hint: "cheap" }, { id: "ignore", label: "Ignore", hint: "nothing" }],
    resolve: (c, rng, d) => c === "help" ? { cash: -rng.int(20, 400) * 1000, reputation: 6, opinion: 3, followers: 400_000, outcome: `You did it. @${d.who} is crying on stream.`, topic: { category: "viral", label: `god helping @${d.who}`, subject: `god agreed to ${d.ask}`, valence: 0.9, magnitude: 5.5 } }
      : c === "shout" ? { reputation: 1, followers: 50_000, outcome: `@${d.who} framed your reply.` } : { outcome: "The post scrolled away." },
  },
  {
    type: "coinpump", weight: 2,
    make: (rng) => { const coin = rng.pick(["FROG", "MOONCAT", "BONKLE", "TOAST", "YETI"]); return { title: `Degens want you to post about $${coin}`, body: `Pump Pit is begging you to mention $${coin}. One post could 10x it.`, data: { coin } }; },
    choices: [{ id: "post", label: "Post about it", hint: "influence, possible backlash" }, { id: "refuse", label: "Refuse", hint: "+trust" }],
    resolve: (c, rng, d) => c === "post" ? (rng.chance(0.5) ? { influence: 4, cash: rng.int(5, 40) * 1e6, outcome: `$${d.coin} went 8x. Pump Pit is building you a shrine.`, topic: { category: "coin", label: `the $${d.coin} pump`, subject: `${d.coin}`, valence: 0.1, magnitude: 6.5 } } : { reputation: -8, outcome: `$${d.coin} crashed 70% after the pump. Community notes everywhere.`, topic: { category: "controversy", label: `the $${d.coin} crash`, subject: `${d.coin}`, valence: -0.7, magnitude: 7 } })
      : { reputation: 3, outcome: "You said no. Skeptics Anonymous grudgingly respects it." },
  },
  {
    type: "rival", weight: 2,
    make: (rng, s) => { const c = celebOf(rng, s); return { title: `${c.displayName} is talking trash`, fromId: c.id, body: `"${rng.pick(["god is a brand, not a person", "I could out-buy him any day", "his island is smaller than my pool", "god peaked in 2024"])}" — ${c.displayName}`, data: { celeb: c.displayName } }; },
    choices: [{ id: "clap", label: "Clap back", hint: "drama ↑" }, { id: "rise", label: "Take the high road", hint: "+reputation" }, { id: "buy", label: "Buy something bigger", hint: "costs $" }],
    resolve: (c, rng, d) => c === "clap" ? { influence: 3, reputation: -2, followers: 1_200_000, outcome: `The clapback has 30M views. ${d.celeb} is typing...`, topic: { category: "controversy", label: `the ${d.celeb} clapback`, subject: `${d.celeb} is a footnote.`, valence: -0.1, magnitude: 7 } }
      : c === "buy" ? { cash: -250e6, influence: 4, outcome: "You bought a bigger pool. On a bigger island.", topic: { category: "property", label: "the bigger pool", subject: "a pool visible from orbit", valence: 0.2, magnitude: 6, amount: 250e6 } }
      : { reputation: 4, outcome: "\"Wishing them well.\" The restraint is somehow trending." },
  },
  {
    type: "charity", weight: 2,
    make: (rng) => { const cause = rng.pick(["ocean cleanup", "a children's hospital", "free school lunches", "wildfire relief"]); return { title: `Fans want you to fund ${cause}`, body: "A GOD Fan Club petition hit 200k signatures.", data: { cause, amt: rng.int(5, 100) * 1e6 } }; },
    choices: [{ id: "give", label: "Donate", hint: "big reputation" }, { id: "match", label: "Match fan donations", hint: "community moment" }, { id: "no", label: "Not now", hint: "-reputation" }],
    resolve: (c, rng, d) => c === "give" ? { cash: -Number(d.amt), reputation: 10, opinion: 4, outcome: `Donated to ${d.cause}. Even Overrated HQ went quiet.`, topic: { category: "organization", label: `the ${d.cause} donation`, subject: `${d.cause}`, valence: 0.9, magnitude: 6.5, amount: Number(d.amt) } }
      : c === "match" ? { cash: -Number(d.amt) / 3, reputation: 7, followers: 500_000, outcome: "Fans raised a record amount. You matched it.", topic: { category: "event", label: `the ${d.cause} match`, subject: `${d.cause}`, valence: 0.8, magnitude: 5.5, amount: Number(d.amt) / 3 } }
      : { reputation: -4, outcome: "\"Not now\" did not go down well." },
  },
  {
    // only spawned by the gh0st storyline (undernet.ts), never at random
    type: "leak", weight: 0,
    make: () => ({ title: "gh0st leak", body: "", data: {} }),
    choices: LEAK_CHOICES,
    resolve: (c, rng, d, s) => resolveLeak(c, rng, d, s),
  },
];
