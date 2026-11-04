import type { Rng } from "./rng";
import type { Holding, Topic } from "./types";

export type ActionKind = "business" | "property" | "island" | "jet" | "vehicle" | "coin" | "investment" | "hire" | "organization" | "event" | "announcement" | "controversy";

export interface ActionDef {
  kind: ActionKind;
  title: string;
  verb: string; // headline verb
  icon: string;
  base: number; // base magnitude
  valence: number;
  cost: [number, number]; // default range
  names: string[];
  label: (name: string) => string;
  holding?: Holding["kind"];
  prompt: string;
}

export const ACTIONS: ActionDef[] = [
  { kind: "business", title: "Launch a business", verb: "launches", icon: "🏢", base: 3, valence: 0.3, cost: [50e6, 2e9], holding: "business", prompt: "Company name",
    names: ["Aurum Systems", "Godspeed Logistics", "Halo Foods", "Sovereign Studios", "Paragon Robotics", "Gilded Air", "Crown Labs"], label: (n) => `the ${n} launch` },
  { kind: "property", title: "Buy property", verb: "buys", icon: "🏰", base: 2.5, valence: 0.15, cost: [20e6, 600e6], holding: "property", prompt: "Property",
    names: ["a cliffside mansion in Monte Vero", "the Halcyon Tower penthouse", "a 40-room castle in the Highlands", "a skyscraper in Port Aurelia", "a vineyard estate in Valle Oro"], label: (n) => `the ${n.replace(/^(a|an|the) /, "")} purchase` },
  { kind: "island", title: "Buy an island", verb: "buys private island", icon: "🏝️", base: 4.5, valence: 0.25, cost: [80e6, 900e6], holding: "island", prompt: "Island name",
    names: ["Isla Corona", "Marrow Cay", "Solenne Island", "Gilt Atoll", "Kestrel Key", "Isla Aurum"], label: (n) => `the ${n} island buy` },
  { kind: "jet", title: "Buy a jet", verb: "takes delivery of", icon: "✈️", base: 3, valence: 0.1, cost: [60e6, 400e6], holding: "jet", prompt: "Jet model",
    names: ["Skyhaven 900", "Aerion Sovereign", "Corvane X-Long Range", "Halcyon Strato", "Vireo Skyliner"], label: (n) => `the ${n} jet` },
  { kind: "vehicle", title: "Buy a car", verb: "buys", icon: "🏎️", base: 1.5, valence: 0.1, cost: [500e3, 20e6], holding: "vehicle", prompt: "Car",
    names: ["Vantor Spectre", "Marquis GT Noir", "Ferrano Tempesta", "Kestrel Hypercar", "Aurelia V16", "Stradale Nero"], label: (n) => `the ${n}` },
  { kind: "coin", title: "Launch a coin", verb: "launches token", icon: "🪙", base: 4.5, valence: 0, cost: [5e6, 100e6], holding: "coin", prompt: "Ticker",
    names: ["GOD", "HALO", "CROWN", "DIVINE", "AURA", "GLAZE"], label: (n) => `the $${n} launch` },
  { kind: "investment", title: "Make an investment", verb: "invests in", icon: "📈", base: 2.5, valence: 0.2, cost: [10e6, 3e9], holding: "investment", prompt: "Target",
    names: ["a fusion startup", "an esports franchise", "a lab-grown coffee company", "a space-tourism venture", "a streaming network", "a stablecoin bank"], label: (n) => `the ${n.replace(/^(a|an|the) /, "")} bet` },
  { kind: "hire", title: "Hire people", verb: "hires", icon: "🧑‍💼", base: 2, valence: 0.35, cost: [5e6, 400e6], prompt: "Team / role",
    names: ["a 500-person AI team", "a celebrity chef", "an ex-pro gamer as CEO", "a private orchestra", "200 meme engineers"], label: (n) => `the ${n.replace(/^(a|an|the) /, "")} hire` },
  { kind: "organization", title: "Start an organization", verb: "founds", icon: "🏛️", base: 2.5, valence: 0.5, cost: [10e6, 1e9], holding: "organization", prompt: "Organization",
    names: ["The God Foundation", "Halo Scholars", "Open Ocean Trust", "The Glaze Institute", "Founders Without Borders"], label: (n) => `${n}` },
  { kind: "event", title: "Host an event", verb: "hosts", icon: "🎉", base: 3, valence: 0.2, cost: [2e6, 150e6], prompt: "Event",
    names: ["a yacht party in Monte Vero", "GODCON 2026", "a midnight island rave", "a billion-dollar poker night", "a charity gala on the moon (VR edition)"], label: (n) => `the ${n.replace(/^(a|an|the) /, "")}` },
  { kind: "announcement", title: "Make an announcement", verb: "announces", icon: "📣", base: 3.5, valence: 0.1, cost: [0, 0], prompt: "Announcement text",
    names: ["Something big is coming Friday.", "I'm giving away 100 cars.", "I'm moving my HQ to an island.", "Retiring. Kidding.", "New project. 48 hours."], label: () => `the announcement` },
  { kind: "controversy", title: "Start a controversy", verb: "sparks outrage with", icon: "🔥", base: 5, valence: -0.5, cost: [0, 0], prompt: "Hot take",
    names: ["Remote work is for quitters.", "Pineapple on pizza is elite and I'll fund it.", "I could buy the internet.", "College is a scam.", "Most billionaires are boring."], label: () => `the hot take` },
];

export const actionDef = (k: ActionKind) => ACTIONS.find((a) => a.kind === k)!;

export function magnitudeFor(kind: ActionKind, cost: number, boost = 0): number {
  const d = actionDef(kind);
  const m = d.base + Math.log10(Math.max(cost, 1e6) / 1e6) * 1.2 + boost;
  return Math.round(Math.max(1, Math.min(10, m)) * 10) / 10;
}

export const tagify = (s: string) =>
  s.replace(/^(the|a|an) /i, "").replace(/[^a-z0-9 ]/gi, "").split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("").slice(0, 24);

/** World (non-@god) topics keep the internet from being only about him. All names fictional. */
export const COINS = ["FROG", "MOONCAT", "BONKLE", "WAGMI", "GOOSE", "TOAST", "PIXL", "NOODL", "YETI", "SOCK"];
const WORLD_DEFS: { category: string; subj: string[]; tagger?: (s: string) => string }[] = [
  { category: "celebrity", subj: ["dropped a surprise album at 3am", "got spotted at a gas station in a full ballgown", "announced retirement for the third time", "launched a sneaker line that's just crocs with wings", "lost a bet live on stream and shaved an eyebrow", "started a podcast about birds", "is beefing with a fast-food mascot", "posted a 14-slide apology", "got married in a parking lot", "said cereal is a soup"] },
  { category: "crypto", subj: ["up 300% in an hour", "down 40% after the dev went quiet", "listed on three exchanges at once", "whale wallet just moved 90 million tokens", "rug-pull rumors all over Chirp", "flipped the old meta in market cap"] },
  { category: "gaming", subj: ["Starfall 3 got delayed again", "the new Pixel Arena patch nerfed every fun build", "a speedrunner shaved 0.3s off the Neon Drift record", "ranked servers have been down for 6 hours", "Mythbound's new season leaked early", "a 12-year-old beat the top pro in a showmatch"] },
  { category: "tech", subj: ["Quanta launched a phone with zero buttons", "Nimbus Labs' smart fridge started posting on Chirp", "Orbitly's app update deleted everyone's playlists", "a robot vacuum went viral for escaping an apartment", "Halo Cloud had a 4 hour outage"] },
  { category: "sports", subj: ["Northport FC lost 5-0 at home", "a goalkeeper scored from his own box", "the Valley Kings traded their star at midnight", "Port Aurelia won the cup on penalties"] },
  { category: "meme", subj: ["the 'it's giving tuesday' trend", "cats in tiny hats", "the 'sir this is a lounge' copypasta", "people rating their fridges out of 10", "the dramatic hamster edit"] },
  { category: "markets", subj: ["the NOVA index fell 2% on rate fears", "gold hit a record", "a meme stock tripled before lunch", "oil prices spiked overnight"] },
  { category: "drama", subj: ["two streamers beefing over a burrito order", "a Respawn Lounge mod got caught alt-accounting", "a creator's 'authentic' morning routine was staged", "the Tea Room leaked its own mod chat", "a fan account got exposed for buying followers"] },
];

export function worldTopic(rng: Rng, id: string, t: number, celebName?: string, celebId?: string): Topic {
  const def = rng.pick(WORLD_DEFS);
  const subj = rng.pick(def.subj);
  const coin = rng.pick(COINS);
  const label = def.category === "celebrity" ? `${celebName ?? "a celebrity"} ${subj}` : def.category === "crypto" ? `$${coin} ${subj}` : subj;
  const tag = def.category === "celebrity" ? tagify(`${celebName ?? "Celeb"} ${subj.split(" ").slice(0, 2).join(" ")}`) : def.category === "crypto" ? coin : tagify(subj.split(" ").slice(0, 3).join(" "));
  return {
    id, tag, label, about: "world", category: def.category, valence: 0, magnitude: rng.range(1.5, 6), heat: rng.range(4, 14), startedAt: t, subject: subj,
    celebrityId: def.category === "celebrity" ? celebId : undefined, facts: { coin, celeb: celebName ?? "" },
  };
}

/** Autonomous @god storylines (rumors, leaks, mentions...) so the world moves without the player. */
const AUTO_GOD: { category: string; items: [subject: string, label: string][]; valence: number; mag: [number, number] }[] = [
  { category: "rumor", items: [["god is buying a football club", "the football club rumor"], ["god has a secret second account", "the burner account rumor"], ["god is launching a phone", "the GOD phone rumor"], ["god is about to buy Breaking Wire Room", "the Wire Room buyout rumor"], ["god is moving to an island full time", "the island move rumor"], ["god turned down a $4B offer", "the $4B offer rumor"]], valence: 0.1, mag: [2, 5] },
  { category: "allegation", items: [["god's net worth is half what people think", "the net worth claim"], ["god's jet is rented", "the rented jet claim"], ["god bought his followers", "the bought followers claim"], ["god ghost-writes his own fan accounts", "the fan account claim"]], valence: -0.6, mag: [3, 6] },
  { category: "leak", items: [["god's pitch deck for a 'GOD phone'", "the pitch deck leak"], ["an old GOD HQ mod chat roasting fans", "the mod chat leak"], ["a menu from god's private chef", "the chef menu leak"], ["a photo of god's garage", "the garage photo leak"]], valence: -0.1, mag: [2, 5] },
  { category: "viral", items: [["god's 6-word reply to a fan", "the 6-word reply"], ["god's 'stay humble' post from 2019", "the 'stay humble' post"], ["a clip of god tipping a waiter", "the tipping clip"], ["god rating fan art", "the fan art ratings"]], valence: 0.4, mag: [2, 4.5] },
  { category: "mention", items: [["called god 'the main character of the internet'", "the 'main character' comment"], ["said god owes them a jet ride", "the jet ride callout"], ["challenged god to a charity boxing match", "the boxing challenge"], ["said they'd never collab with god", "the 'never collab' comment"]], valence: 0, mag: [2.5, 5] },
];

export function autoGodTopic(rng: Rng, id: string, t: number, celebName: string, celebId: string): Topic {
  const def = rng.pick(AUTO_GOD);
  const [subj0, short] = rng.pick(def.items);
  const subj = def.category === "mention" ? `${celebName} ${subj0}` : subj0;
  const label = def.category === "mention" ? `${celebName}'s ${short.replace(/^the /, "")}` : short;
  return {
    id, tag: def.category === "mention" ? tagify(`${celebName} God`) : tagify(`God ${short.replace(/^the /, "").replace(/ (rumor|claim|leak)$/, "")}`), label, about: "god", category: def.category,
    valence: def.valence, magnitude: rng.range(...def.mag), heat: rng.range(6, 18), startedAt: t, subject: subj, celebrityId: def.category === "mention" ? celebId : undefined, facts: { celeb: celebName },
  };
}
