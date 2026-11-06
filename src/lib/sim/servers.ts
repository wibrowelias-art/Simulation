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

/**
 * Fictional servers, themed around trading, friends and the player's growing reputation ("god" in tags means
 * "about the player"). Channel weight ~ share of traffic (#general carries most, per research §5). Ids are stable.
 */
export const SERVER_DEFS: ServerDef[] = [
  { id: "godhq", name: "Trenches", icon: "🪖", color: "#c6f432", description: "Calls, charts and the people who made it out. You're kind of a regular here.", bias: 0.45, vibe: "glaze", tags: ["god", "crypto", "memecoins"], size: 18_420, cast: 90,
    channels: [["general", "anything goes (mostly coins)", ["god", "life", "world", "crypto"], 5], ["announcements", "mods only", ["god"], 0.2], ["calls", "post the ticker, post the reason", ["memecoins", "crypto", "god"], 2], ["pnl", "wins, losses, screenshots", ["god", "crypto", "memes"], 1.4], ["charts", "lines, levels, cope", ["crypto", "stocks"], 1]],
    jokes: ["the 3am ping", "the guy who bought the top twice", "'it's only a loss if you sell'", "mod tomas's 'last warning' count"] },
  { id: "cryptoug", name: "Degen Den", icon: "🕳️", color: "#7c5cff", description: "Degens, analysts and survivors of every cycle.", bias: 0.05, vibe: "finance", tags: ["crypto", "memecoins"], size: 96_400, cast: 70,
    channels: [["market-talk", "majors, macro, vibes", ["crypto", "world"], 4], ["memecoins", "frogs, dogs and regret", ["memecoins", "crypto"], 2], ["big-wallets", "who's moving what", ["god", "crypto", "wealth"], 1.2], ["rug-reports", "pain", ["memecoins", "drama"], 0.8]],
    jokes: ["the guy who sold at the bottom twice", "'wen'", "the rug nobody talks about", "chart crimes"] },
  { id: "netculture", name: "Internet Culture", icon: "🌐", color: "#30c6e8", description: "Whatever the internet is mad about today.", bias: 0, vibe: "culture", tags: ["celebrity", "drama", "memes"], size: 241_000, cast: 80,
    channels: [["general", "the timeline, discussed", ["celebrity", "drama", "world", "god"], 3], ["viral-moments", "what's blowing up", ["memes", "world", "god"], 2], ["main-character", "today's main character", ["drama", "god"], 1]],
    jokes: ["main character of the day", "the ratio hall of fame", "'who is this person and why are they trending'"] },
  { id: "billionaire", name: "Market Desk", icon: "📊", color: "#22c55e", description: "News that moves prices, and people who pretend they saw it coming.", bias: 0.1, vibe: "news", tags: ["news", "crypto", "business"], size: 58_900, cast: 55,
    channels: [["breaking", "drop it, add context", ["news", "crypto", "world"], 2.5], ["analysis", "longer takes", ["business", "crypto"], 1.5], ["macro", "rates, dollars, doom", ["business", "world"], 1]],
    jokes: ["'priced in'", "the analyst who's been bearish since 2019", "the 'this time is different' counter"] },
  { id: "fanclub", name: "Copy Desk", icon: "🧲", color: "#ff7ab6", description: "We watch what the good traders do. Then we do it, slower.", bias: 0.85, vibe: "glaze", tags: ["god", "glaze", "crypto"], size: 12_500, cast: 75,
    channels: [["copy-calls", "what the big accounts are buying", ["god", "crypto", "memecoins"], 3], ["wins", "it worked!!", ["god", "glaze"], 1.5], ["fan-chat", "general chatter", ["god", "life"], 1.5]],
    jokes: ["the glaze leaderboard", "'copied it 3 hours late'", "the guy who copies the copier"] },
  { id: "respawn", name: "Respawn Lounge", icon: "🎮", color: "#4ade80", description: "Gaming, LFG and rage-quits.", bias: 0, vibe: "gaming", tags: ["gaming"], size: 77_300, cast: 60,
    channels: [["general", "gaming talk", ["gaming", "life", "world"], 4], ["patch-notes", "nerfs, buffs, crying", ["gaming"], 1.2], ["clips", "post your clips", ["gaming", "memes"], 1], ["off-topic", "anything else", ["life", "god", "world"], 1]],
    jokes: ["'skill issue'", "the 0-14 game", "the duo who never shows up"] },
  { id: "newsroom", name: "Breaking Wire Room", icon: "📰", color: "#f97316", description: "Fast news, slower fact checks.", bias: 0, vibe: "news", tags: ["news"], size: 64_100, cast: 45,
    channels: [["breaking", "drop links, add context", ["news", "god", "world"], 3], ["fact-check", "is it real?", ["rumor", "news"], 1.2], ["analysis", "longer takes", ["news", "business"], 1]],
    jokes: ["'source?'", "the satire site incident", "the headline-only readers"] },
  { id: "creators", name: "Creator Collective", icon: "🎬", color: "#ec4899", description: "Influencers, editors, managers, clout.", bias: 0.1, vibe: "culture", tags: ["celebrity", "business"], size: 41_800, cast: 50,
    channels: [["general", "creator talk", ["celebrity", "life", "god"], 3], ["collabs", "who's working with who", ["celebrity", "business", "god"], 1.2], ["analytics", "views, CPMs, pain", ["business"], 0.8]],
    jokes: ["'the algorithm hates me'", "the collab that never dropped", "thumbnail face"] },
  { id: "vault", name: "Whale Watch", icon: "🐋", color: "#94a3b8", description: "Tracking the wallets that move markets.", bias: 0.1, vibe: "finance", tags: ["crypto", "wealth"], size: 9_240, cast: 30,
    channels: [["whale-alerts", "big buys, big sells", ["crypto", "god"], 2], ["wallet-tracking", "who's accumulating", ["crypto", "god"], 1.2], ["off-topic", "everything else", ["life"], 0.7]],
    jokes: ["the wallet that only buys tops", "'that's not a whale, that's an exchange'"] },
  { id: "founders", name: "Builders Club", icon: "🏗️", color: "#22d3ee", description: "Builders, operators and pitch-deck enjoyers.", bias: 0.1, vibe: "finance", tags: ["business", "tech"], size: 52_600, cast: 50,
    channels: [["general", "building stuff", ["business", "tech", "life"], 3], ["launches", "ship it", ["business", "tech"], 1.2], ["hiring", "jobs & talent", ["business"], 0.6]],
    jokes: ["'we're pre-revenue'", "the pivot to AI", "the 4am grind post"] },
  { id: "pumppit", name: "Pump Pit", icon: "🐸", color: "#84cc16", description: "Memecoin casino with a chat window.", bias: 0.2, vibe: "finance", tags: ["memecoins", "crypto"], size: 88_800, cast: 60,
    channels: [["degen-floor", "aping in real time", ["memecoins", "crypto", "god"], 4], ["trending-now", "what's moving", ["memecoins", "crypto"], 1.4], ["rug-reports", "pain", ["memecoins", "drama"], 0.8]],
    jokes: ["'it's only a loss if you sell'", "the frog that did 400x", "exit liquidity jokes"] },
  { id: "grass", name: "Touch Grass Society", icon: "🌱", color: "#65a30d", description: "Normal people talking about normal things.", bias: -0.05, vibe: "culture", tags: ["life"], size: 33_400, cast: 50,
    channels: [["general", "life, weather, food", ["life", "world"], 4], ["pets", "post your pets", ["life"], 1.2], ["rants", "vent safely", ["life", "drama", "god"], 1]],
    jokes: ["the sourdough guy", "'go outside' (said indoors)"] },
  { id: "overrated", name: "Fade Club", icon: "🧢", color: "#ef4444", description: "Whatever the famous accounts buy, we fade.", bias: -0.8, vibe: "hater", tags: ["god", "drama"], size: 29_700, cast: 55,
    channels: [["general", "overrated calls, discussed", ["god", "drama"], 4], ["receipts", "screenshots of bad calls", ["god", "rumor"], 1.2], ["cope-tracker", "copy-trader meltdowns", ["god", "memes"], 1]],
    jokes: ["the 'paid promo' theory", "'fade it'", "the member who got banned for copying"] },
  { id: "rabbithole", name: "Rabbit Hole", icon: "🕳", color: "#a855f7", description: "Connect the dots. Some dots are imaginary.", bias: -0.2, vibe: "conspiracy", tags: ["conspiracy", "rumor"], size: 22_100, cast: 40,
    channels: [["theories", "think about it", ["conspiracy", "god", "world"], 3], ["evidence", "blurry screenshots only", ["conspiracy", "rumor"], 1], ["debunked", "the graveyard", ["conspiracy"], 0.5]],
    jokes: ["'every pump is coordinated'", "the timestamp theory", "'they're three people'"] },
  { id: "tearoom", name: "The Tea Room", icon: "☕", color: "#f59e0b", description: "Celebrity gossip, served hot.", bias: 0.05, vibe: "gossip", tags: ["celebrity", "drama"], size: 119_000, cast: 65,
    channels: [["hot-tea", "the latest", ["celebrity", "drama", "god"], 3.5], ["blind-items", "guess who", ["rumor", "celebrity", "god"], 1.2], ["couples-watch", "who's dating who", ["celebrity"], 1]],
    jokes: ["the blind item everyone solved in a minute", "'sources close to'", "the unfollow investigation"] },
  { id: "chartgremlins", name: "Chart Gremlins", icon: "📈", color: "#10b981", description: "Lines on charts. Strong opinions.", bias: 0, vibe: "finance", tags: ["stocks", "crypto", "business"], size: 47_000, cast: 45,
    channels: [["markets", "stocks, macro", ["stocks", "business", "world"], 3], ["setups", "show your chart", ["crypto", "god"], 1.2], ["loss-porn", "share your pain", ["crypto", "memes"], 0.8]],
    jokes: ["'support is a feeling'", "the head-and-shoulders on everything", "'zoom out'"] },
  { id: "memefactory", name: "Meme Factory", icon: "🏭", color: "#fbbf24", description: "We make the memes you repost.", bias: 0.1, vibe: "culture", tags: ["memes"], size: 156_700, cast: 70,
    channels: [["shitposting", "low effort, high reward", ["memes", "god", "world"], 4], ["templates", "fresh formats", ["memes"], 1], ["trader-memes", "buy high sell low", ["god", "memes", "crypto"], 1.8]],
    jokes: ["the 'buy high sell low' template", "the deep-fried era", "'this is going in the hall of fame'"] },
  { id: "latenight", name: "Late Night Lounge", icon: "🌙", color: "#6366f1", description: "For people who should be asleep.", bias: 0, vibe: "culture", tags: ["life"], size: 38_200, cast: 45,
    channels: [["2am-thoughts", "unfiltered", ["life", "god", "world"], 3], ["music", "what are you listening to", ["music", "life"], 1.2], ["insomnia", "can't sleep club", ["life"], 1]],
    jokes: ["'why are we all awake'", "the 4am philosophy debate"] },
  { id: "wheelswings", name: "Study Hall", icon: "📚", color: "#38bdf8", description: "Exams, deadlines and procrastinating together.", bias: 0, vibe: "culture", tags: ["life"], size: 61_300, cast: 45,
    channels: [["general", "study buddies", ["life", "world"], 2.5], ["exam-panic", "it's fine (it's not)", ["life"], 1.2], ["off-topic", "anything else", ["life", "god"], 1]],
    jokes: ["the all-nighter club", "'just one more episode then I study'"] },
  { id: "pixelarena", name: "Pixel Arena", icon: "🕹️", color: "#f43f5e", description: "Esports, ranked, tournaments.", bias: -0.05, vibe: "gaming", tags: ["gaming"], size: 70_900, cast: 50,
    channels: [["ranked", "climb or cry", ["gaming"], 3], ["tournaments", "brackets & upsets", ["gaming", "world"], 1.2], ["off-topic", "not gaming", ["life", "god"], 1]],
    jokes: ["'hardstuck'", "the throw of the century", "'diff'"] },
  { id: "skeptics", name: "Skeptics Anonymous", icon: "🧐", color: "#a3a3a3", description: "Extraordinary claims require receipts.", bias: -0.35, vibe: "news", tags: ["rumor", "god", "news"], size: 18_900, cast: 40,
    channels: [["claims", "post claims, we check", ["god", "rumor"], 3], ["math", "does the P&L add up", ["wealth", "god"], 1.2]],
    jokes: ["'source: their own screenshot'", "the spreadsheet that broke the server"] },
  { id: "hustleu", name: "Hustle University", icon: "🎓", color: "#eab308", description: "Mindset, grind, and studying the best traders.", bias: 0.55, vibe: "glaze", tags: ["business", "god"], size: 104_300, cast: 60,
    channels: [["mindset", "daily grind", ["business", "god", "life"], 3], ["case-studies", "breaking down great trades", ["god", "business", "crypto"], 1.5], ["wins", "post your wins", ["life", "business"], 1]],
    jokes: ["the 5am club roll call", "'journal every trade'"] },
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
  { id: "godwatch", name: "The Ticker", short: "TT", color: "#c6f432", bias: 0.2, tagline: "Who's trading what, and why it matters.", beats: ["god", "crypto", "memecoins"], authors: [{ name: "Marta Kessling", role: "Markets correspondent" }, { name: "Dev Anand", role: "Senior reporter" }, { name: "Lio Brandt", role: "Night editor" }] },
  { id: "internetdaily", name: "Internet Daily", short: "ID", color: "#30c6e8", bias: 0, tagline: "The timeline, explained.", beats: ["celebrity", "drama", "memes", "god"], authors: [{ name: "Sasha Vey", role: "Culture writer" }, { name: "Rory Quint", role: "Trends reporter" }] },
  { id: "gwr", name: "Market Brief", short: "MB", color: "#d4af37", bias: 0.1, tagline: "Money, ranked.", beats: ["wealth", "business", "luxury", "markets", "investment", "property", "island", "jet", "coin", "crypto"], authors: [{ name: "Helena Oduya", role: "Wealth editor" }, { name: "Tomasz Reil", role: "Markets analyst" }] },
  { id: "cryptoinsider", name: "Crypto Insider", short: "CI", color: "#7c5cff", bias: 0, tagline: "On-chain, on time.", beats: ["crypto", "memecoins"], authors: [{ name: "Kai Moreno", role: "Crypto reporter" }, { name: "Nadia Fern", role: "DeFi analyst" }] },
  { id: "digitaltimes", name: "The Digital Times", short: "DT", color: "#e5e7eb", bias: -0.2, tagline: "Serious coverage of unserious times.", beats: ["tech", "business", "drama", "god"], authors: [{ name: "Owen Achterberg", role: "Investigations" }, { name: "Priya Lal", role: "Opinion columnist" }] },
  { id: "bnn", name: "Clout Report", short: "CR", color: "#f43f5e", bias: 0.15, tagline: "Who's blowing up online, and who's about to.", beats: ["god", "celebrity", "drama"], authors: [{ name: "Chase Whitlow", role: "Host" }, { name: "Gemma Sato", role: "Reporter" }] },
];
