import type { Outlet } from "./types";

export interface ServerDef {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  bias: number;
  vibe: string; // reaction culture key (see data.REACTIONS)
  tags: string[];
  size: number; // displayed member count
  cast: number; // simulated speaking members
  channels: [name: string, topic: string, tags: string[], weight?: number][];
  jokes: string[];
}

/** 24 fictional servers. Channel weight ~ share of traffic (#general carries most, per research §5). */
export const SERVER_DEFS: ServerDef[] = [
  { id: "godhq", name: "GOD HQ", icon: "👑", color: "#e8b84a", description: "The official-unofficial home of everything @god.", bias: 0.45, vibe: "glaze", tags: ["god", "wealth"], size: 184_220, cast: 90,
    channels: [["general", "talk about anything (mostly god)", ["god", "life", "world"], 5], ["god-announcements", "only god posts here", ["god"], 0.2], ["god-news", "news drops + articles", ["god", "news"], 1.2], ["fan-discussion", "theories, takes, debates", ["god", "drama"], 1.5], ["wealth-discussion", "net worth math & money talk", ["wealth", "business"], 1.2], ["exclusive-chat", "level 20+ only", ["god", "luxury"], 0.6], ["memes", "post the funnies", ["memes", "god"], 1.4], ["leaks-and-rumors", "unverified. treat it that way", ["rumor", "god", "drama"], 1]],
    jokes: ["the 3am ping", "the 'creative mode' copypasta", "the lambo-in-the-pool incident", "mod tomas's 'last warning' count"] },
  { id: "cryptoug", name: "Crypto Underground", icon: "🕳️", color: "#7c5cff", description: "Degens, analysts and survivors of every cycle.", bias: 0.05, vibe: "finance", tags: ["crypto", "memecoins"], size: 96_400, cast: 70,
    channels: [["market-discussion", "macro, majors, vibes", ["crypto", "world"], 4], ["god-portfolio", "tracking every god wallet rumor", ["god", "crypto", "wealth"], 1.6], ["memecoins", "frogs, dogs and regret", ["memecoins", "crypto"], 2.5], ["trading-signals", "NFA. seriously.", ["crypto"], 1], ["whale-watching", "big wallets moving", ["crypto", "wealth"], 1]],
    jokes: ["the guy who sold at the bottom twice", "'wen'", "the rug of '24 that nobody talks about", "chart crimes"] },
  { id: "netculture", name: "Internet Culture", icon: "🌐", color: "#30c6e8", description: "Whatever the internet is mad about today.", bias: 0, vibe: "culture", tags: ["celebrity", "drama", "memes"], size: 241_000, cast: 80,
    channels: [["celebrity-discussion", "famous people doing things", ["celebrity", "god"], 2], ["chirp-drama", "screenshots from Chirp", ["drama", "god", "celebrity"], 2], ["viral-moments", "what's blowing up", ["memes", "world", "god"], 2], ["internet-news", "the timeline, summarized", ["news", "world"], 1.5]],
    jokes: ["main character of the day", "the ratio hall of fame", "'who is this guy and why is he trending'"] },
  { id: "billionaire", name: "Billionaire Club", icon: "💎", color: "#d4af37", description: "Aspirational luxury talk. Mostly window shopping.", bias: 0.2, vibe: "luxury", tags: ["luxury", "wealth"], size: 58_900, cast: 55,
    channels: [["luxury-lifestyle", "watches, villas, vibes", ["luxury", "god"], 2.5], ["business", "deals and moves", ["business", "wealth"], 1.5], ["private-islands", "sand, sea, and tax lawyers", ["islands", "luxury"], 1], ["supercars", "spec sheets & spotted", ["cars", "luxury"], 1.4], ["private-jets", "tail numbers & cabins", ["jets", "luxury"], 1.1]],
    jokes: ["'just buy the island bro'", "the guy who rents the Lambo for photos", "the 'what's your net worth' thread"] },
  { id: "fanclub", name: "GOD Fan Club", icon: "🙏", color: "#ff7ab6", description: "Glazing is a lifestyle. Be nice.", bias: 0.9, vibe: "glaze", tags: ["god", "glaze"], size: 132_500, cast: 75,
    channels: [["daily-glazing", "say something nice about god (daily)", ["god", "glaze"], 4], ["god-is-legendary", "certified legendary moments", ["god", "glaze"], 1.5], ["fan-art", "post your art", ["god", "art"], 0.8], ["god-moments", "clips and screenshots", ["god"], 1.2], ["community-events", "watch parties & meetups", ["god", "life"], 0.6]],
    jokes: ["the glaze leaderboard", "'he's just like us' (he is not)", "the fan art that looked like a potato"] },
  { id: "respawn", name: "Respawn Lounge", icon: "🎮", color: "#4ade80", description: "Gaming, LFG and rage-quits.", bias: 0, vibe: "gaming", tags: ["gaming"], size: 77_300, cast: 60,
    channels: [["general", "gaming talk", ["gaming", "life", "world"], 4], ["patch-notes", "nerfs, buffs, crying", ["gaming"], 1.2], ["clips", "post your clips", ["gaming", "memes"], 1], ["off-topic", "anything else", ["life", "god", "world"], 1]],
    jokes: ["'skill issue'", "the 0-14 game", "the duo who never shows up"] },
  { id: "newsroom", name: "Breaking Wire Room", icon: "📰", color: "#f97316", description: "Fast news, slower fact checks.", bias: 0, vibe: "news", tags: ["news"], size: 64_100, cast: 45,
    channels: [["breaking", "drop links, add context", ["news", "god", "world"], 3], ["fact-check", "is it real?", ["rumor", "news"], 1.2], ["analysis", "longer takes", ["news", "business"], 1]],
    jokes: ["'source?'", "the satire site incident", "the headline-only readers"] },
  { id: "creators", name: "Creator Collective", icon: "🎬", color: "#ec4899", description: "Influencers, editors, managers, clout.", bias: 0.1, vibe: "culture", tags: ["celebrity", "business"], size: 41_800, cast: 50,
    channels: [["general", "creator talk", ["celebrity", "life", "god"], 3], ["collabs", "who's working with who", ["celebrity", "business", "god"], 1.2], ["analytics", "views, CPMs, pain", ["business"], 0.8]],
    jokes: ["'the algorithm hates me'", "the collab that never dropped", "thumbnail face"] },
  { id: "vault", name: "The Vault", icon: "🔐", color: "#94a3b8", description: "Invite-only. Old money, new money, quiet money.", bias: 0.1, vibe: "luxury", tags: ["wealth", "luxury", "business"], size: 1_240, cast: 30,
    channels: [["lounge", "members only", ["wealth", "god", "luxury"], 2], ["deals", "off-market", ["business", "wealth"], 1.2], ["concierge", "recommendations", ["luxury", "life"], 0.7]],
    jokes: ["the yacht parking dispute", "'my guy in Monaco'"] },
  { id: "founders", name: "Founders Floor", icon: "🏗️", color: "#22d3ee", description: "Builders, operators and pitch-deck enjoyers.", bias: 0.1, vibe: "finance", tags: ["business", "tech"], size: 52_600, cast: 50,
    channels: [["general", "building stuff", ["business", "tech", "life"], 3], ["fundraising", "rounds & valuations", ["business", "wealth"], 1.2], ["god-deals", "tracking god's companies", ["god", "business"], 1.3], ["hiring", "jobs & talent", ["business"], 0.6]],
    jokes: ["'we're pre-revenue'", "the pivot to AI", "the 4am grind post"] },
  { id: "pumppit", name: "Pump Pit", icon: "🐸", color: "#84cc16", description: "Memecoin casino with a chat window.", bias: 0.2, vibe: "finance", tags: ["memecoins", "crypto"], size: 88_800, cast: 60,
    channels: [["degen-floor", "aping in real time", ["memecoins", "crypto", "god"], 4], ["god-coin-watch", "every god coin rumor", ["god", "memecoins"], 1.4], ["rug-reports", "pain", ["memecoins", "drama"], 0.8]],
    jokes: ["'it's only a loss if you sell'", "the frog that did 400x", "exit liquidity jokes"] },
  { id: "grass", name: "Touch Grass Society", icon: "🌱", color: "#65a30d", description: "Normal people talking about normal things.", bias: -0.05, vibe: "culture", tags: ["life"], size: 33_400, cast: 50,
    channels: [["general", "life, weather, food", ["life", "world"], 4], ["pets", "post your pets", ["life"], 1.2], ["rants", "vent safely", ["life", "drama", "god"], 1]],
    jokes: ["the sourdough guy", "'go outside' (said indoors)"] },
  { id: "overrated", name: "Overrated HQ", icon: "🧢", color: "#ef4444", description: "Not impressed. Never were.", bias: -0.8, vibe: "hater", tags: ["god", "drama"], size: 29_700, cast: 55,
    channels: [["general", "he's mid and here's why", ["god", "drama"], 4], ["receipts", "evidence board", ["god", "rumor"], 1.2], ["cope-tracker", "fan meltdowns", ["god", "memes"], 1]],
    jokes: ["the 'paid actors' theory", "'ratio him'", "the fan who got banned for glazing here"] },
  { id: "rabbithole", name: "Rabbit Hole", icon: "🕳", color: "#a855f7", description: "Connect the dots. Some dots are imaginary.", bias: -0.2, vibe: "conspiracy", tags: ["conspiracy", "rumor"], size: 22_100, cast: 40,
    channels: [["theories", "think about it", ["conspiracy", "god", "world"], 3], ["evidence", "blurry photos only", ["conspiracy", "rumor"], 1], ["debunked", "the graveyard", ["conspiracy"], 0.5]],
    jokes: ["'the island has a second island'", "the timestamp theory", "'he's three people'"] },
  { id: "tearoom", name: "The Tea Room", icon: "☕", color: "#f59e0b", description: "Celebrity gossip, served hot.", bias: 0.05, vibe: "gossip", tags: ["celebrity", "drama"], size: 119_000, cast: 65,
    channels: [["hot-tea", "the latest", ["celebrity", "drama", "god"], 3.5], ["blind-items", "guess who", ["rumor", "celebrity", "god"], 1.2], ["couples-watch", "who's dating who", ["celebrity"], 1]],
    jokes: ["the blind item that was obviously god", "'sources close to'", "the unfollow investigation"] },
  { id: "chartgremlins", name: "Chart Gremlins", icon: "📈", color: "#10b981", description: "Lines on charts. Strong opinions.", bias: 0, vibe: "finance", tags: ["stocks", "crypto", "business"], size: 47_000, cast: 45,
    channels: [["markets", "stocks, macro", ["stocks", "business", "world"], 3], ["god-index", "tracking the god effect", ["god", "wealth"], 1.2], ["loss-porn", "share your pain", ["crypto", "memes"], 0.8]],
    jokes: ["'support is a feeling'", "the head-and-shoulders on everything", "the god effect index"] },
  { id: "memefactory", name: "Meme Factory", icon: "🏭", color: "#fbbf24", description: "We make the memes you repost.", bias: 0.1, vibe: "culture", tags: ["memes"], size: 156_700, cast: 70,
    channels: [["shitposting", "low effort, high reward", ["memes", "god", "world"], 4], ["templates", "fresh formats", ["memes"], 1], ["god-memes", "the man, the memes", ["god", "memes"], 1.8]],
    jokes: ["the 'creative mode' template", "the deep-fried era", "'this is going in the hall of fame'"] },
  { id: "latenight", name: "Late Night Lounge", icon: "🌙", color: "#6366f1", description: "For people who should be asleep.", bias: 0, vibe: "culture", tags: ["life"], size: 38_200, cast: 45,
    channels: [["2am-thoughts", "unfiltered", ["life", "god", "world"], 3], ["music", "what are you listening to", ["music", "life"], 1.2], ["insomnia", "can't sleep club", ["life"], 1]],
    jokes: ["'why are we all awake'", "the 4am philosophy debate"] },
  { id: "wheelswings", name: "Wheels & Wings", icon: "✈️", color: "#38bdf8", description: "Supercars, jets, and spotting.", bias: 0.2, vibe: "luxury", tags: ["cars", "jets"], size: 61_300, cast: 45,
    channels: [["spotted", "post your spots", ["cars", "jets", "god"], 2.5], ["specs", "numbers nerds", ["cars", "jets"], 1.2], ["god-garage", "everything god owns that moves", ["god", "cars", "jets"], 1.3]],
    jokes: ["the tail-number detectives", "the guy who only posts brake calipers"] },
  { id: "pixelarena", name: "Pixel Arena", icon: "🕹️", color: "#f43f5e", description: "Esports, ranked, tournaments.", bias: -0.05, vibe: "gaming", tags: ["gaming"], size: 70_900, cast: 50,
    channels: [["ranked", "climb or cry", ["gaming"], 3], ["tournaments", "brackets & upsets", ["gaming", "world"], 1.2], ["off-topic", "not gaming", ["life", "god"], 1]],
    jokes: ["'hardstuck'", "the throw of the century", "'diff'"] },
  { id: "skeptics", name: "Skeptics Anonymous", icon: "🧐", color: "#a3a3a3", description: "Extraordinary claims require receipts.", bias: -0.35, vibe: "news", tags: ["rumor", "god", "news"], size: 18_900, cast: 40,
    channels: [["claims", "post claims, we check", ["god", "rumor"], 3], ["math", "does the net worth add up", ["wealth", "god"], 1.2]],
    jokes: ["'source: his own post'", "the spreadsheet that broke the server"] },
  { id: "hustleu", name: "Hustle University", icon: "📚", color: "#eab308", description: "Mindset, grind, and studying the greats.", bias: 0.55, vibe: "glaze", tags: ["business", "god"], size: 104_300, cast: 60,
    channels: [["mindset", "daily grind", ["business", "god", "life"], 3], ["case-studies", "breaking down god's moves", ["god", "business"], 1.5], ["wins", "post your wins", ["life", "business"], 1]],
    jokes: ["'what would god do'", "the 5am club roll call"] },
  { id: "otaku", name: "Otaku Den", icon: "🍙", color: "#fb7185", description: "Anime, manga, and seasonal debates.", bias: 0, vibe: "culture", tags: ["anime"], size: 66_000, cast: 45,
    channels: [["seasonal", "this season's shows", ["anime", "life"], 3], ["off-topic", "everything else", ["life", "god", "world"], 1.2]],
    jokes: ["'the filler arc'", "the 3-hour tier list fight"] },
  { id: "globalwatch", name: "Global Watch", icon: "🛰️", color: "#0ea5e9", description: "World events and the business of everything.", bias: 0, vibe: "news", tags: ["news", "world"], size: 39_400, cast: 40,
    channels: [["world", "global headlines", ["world", "news"], 3], ["markets", "money moves", ["business", "wealth", "god"], 1.2]],
    jokes: ["'this will be in textbooks'", "the map guy"] },
];

/** Outlets that only ever cover their own beats (never fall back to off-topic stories). */
export const STRICT_BEATS: Record<string, string[]> = { gwr: ["wealth", "business", "luxury", "markets", "investment", "property", "island", "jet", "coin", "crypto"] };

export const OUTLETS: Outlet[] = [
  { id: "godwatch", name: "GODWATCH", short: "GW", color: "#e8b84a", bias: 0.3, tagline: "Every move. Every dollar.", beats: ["god"], authors: [{ name: "Marta Kessling", role: "Chief GOD correspondent" }, { name: "Dev Anand", role: "Senior reporter" }, { name: "Lio Brandt", role: "Night editor" }] },
  { id: "internetdaily", name: "Internet Daily", short: "ID", color: "#30c6e8", bias: 0, tagline: "The timeline, explained.", beats: ["celebrity", "drama", "memes", "god"], authors: [{ name: "Sasha Vey", role: "Culture writer" }, { name: "Rory Quint", role: "Trends reporter" }] },
  { id: "gwr", name: "Global Wealth Report", short: "GWR", color: "#d4af37", bias: 0.1, tagline: "Money, ranked.", beats: ["wealth", "business", "luxury", "markets", "investment", "property", "island", "jet", "coin", "crypto"], authors: [{ name: "Helena Oduya", role: "Wealth editor" }, { name: "Tomasz Reil", role: "Markets analyst" }] },
  { id: "cryptoinsider", name: "Crypto Insider", short: "CI", color: "#7c5cff", bias: 0, tagline: "On-chain, on time.", beats: ["crypto", "memecoins"], authors: [{ name: "Kai Moreno", role: "Crypto reporter" }, { name: "Nadia Fern", role: "DeFi analyst" }] },
  { id: "digitaltimes", name: "The Digital Times", short: "DT", color: "#e5e7eb", bias: -0.2, tagline: "Serious coverage of unserious times.", beats: ["tech", "business", "drama", "god"], authors: [{ name: "Owen Achterberg", role: "Investigations" }, { name: "Priya Lal", role: "Opinion columnist" }] },
  { id: "bnn", name: "Billionaire News Network", short: "BNN", color: "#f43f5e", bias: 0.15, tagline: "LIVE from the top 0.0001%.", beats: ["wealth", "luxury", "god", "islands", "jets"], authors: [{ name: "Chase Whitlow", role: "Anchor" }, { name: "Gemma Sato", role: "Field reporter" }] },
];
