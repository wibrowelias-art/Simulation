/** Static vocab for procedural generation. All names are generic / invented. */

export const FIRST = [
  "jake","mia","leo","zara","noah","ivy","kai","luna","eli","nina","omar","sofia","theo","maya","ezra","aria","finn","lena","jonas","yara",
  "malik","chloe","diego","hana","ravi","amara","tobi","freya","milo","sasha","ari","kenji","nadia","felix","priya","otto","imani","luca","rosa","dev",
  "jade","marco","selin","axel","noor","bruno","talia","rhys","keiko","dante","esme","kofi","lea","sami","vera","jules","ines","cole","mira","hugo",
  "tariq","elin","rory","asha","bastian","nell","quinn","remy","suki","wes","zoe","andre","bea","cyrus","dina","emil","farah","gus","hiro","isla",
] as const;

export const SURNAME_BITS = ["", "", "", "k", "m", "v", "r", "s", "b", "t"] as const;

export const WORDS_SOFT = ["lunar","velvet","honey","cloud","moth","pixel","soft","dusk","neon","static","cherry","mint","ghost","echo","fern","plum","glow","haze","nova","koi","frost","peach","ink","drift","sol","wisp","opal","moss","rain","ember"];
export const WORDS_HARD = ["grind","stack","bag","chart","whale","degen","alpha","sigma","based","ratio","cope","goblin","rizz","drip","gains","pump","hodl","gwei","candle","wick","rekt","moon","sniper","lambo","flip","bull","bear","yield","floor","mint"];
export const WORDS_GAME = ["frag","noob","tilt","clutch","lag","speedrun","sweat","respawn","loot","grief","raid","combo","crit","aggro","nerf","buff","pog","gg","afk","tryhard"];
export const WORDS_THING = ["toast","bean","waffle","gremlin","possum","raccoon","noodle","pickle","spoon","goose","biscuit","taco","yeti","otter","crumb","sock","dumpling","muffin","pigeon","walrus"];

export const LOCATIONS: { name: string; tz: number }[] = [
  { name: "Berlin, DE", tz: 1 }, { name: "Hamburg, DE", tz: 1 }, { name: "Munich, DE", tz: 1 }, { name: "London, UK", tz: 0 }, { name: "Manchester, UK", tz: 0 },
  { name: "Paris, FR", tz: 1 }, { name: "Amsterdam, NL", tz: 1 }, { name: "Stockholm, SE", tz: 1 }, { name: "Madrid, ES", tz: 1 }, { name: "Milan, IT", tz: 1 },
  { name: "Warsaw, PL", tz: 1 }, { name: "Lisbon, PT", tz: 0 }, { name: "Dubai, AE", tz: 4 }, { name: "Istanbul, TR", tz: 3 }, { name: "Lagos, NG", tz: 1 },
  { name: "Nairobi, KE", tz: 3 }, { name: "Mumbai, IN", tz: 5.5 }, { name: "Singapore", tz: 8 }, { name: "Manila, PH", tz: 8 }, { name: "Seoul, KR", tz: 9 },
  { name: "Tokyo, JP", tz: 9 }, { name: "Sydney, AU", tz: 11 }, { name: "New York, US", tz: -5 }, { name: "Miami, US", tz: -5 }, { name: "Atlanta, US", tz: -5 },
  { name: "Chicago, US", tz: -6 }, { name: "Austin, US", tz: -6 }, { name: "Denver, US", tz: -7 }, { name: "Los Angeles, US", tz: -8 }, { name: "Seattle, US", tz: -8 },
  { name: "Toronto, CA", tz: -5 }, { name: "Vancouver, CA", tz: -8 }, { name: "Mexico City, MX", tz: -6 }, { name: "São Paulo, BR", tz: -3 }, { name: "Buenos Aires, AR", tz: -3 },
  { name: "Johannesburg, ZA", tz: 2 }, { name: "Vienna, AT", tz: 1 }, { name: "Zurich, CH", tz: 1 }, { name: "Dublin, IE", tz: 0 }, { name: "Oslo, NO", tz: 1 },
];

export const OCCUPATIONS: { job: string; band: number }[] = [
  { job: "CS student", band: 0 }, { job: "high school senior", band: 0 }, { job: "barista", band: 0 }, { job: "warehouse picker", band: 1 }, { job: "delivery rider", band: 0 },
  { job: "junior dev", band: 2 }, { job: "UX designer", band: 2 }, { job: "nurse", band: 2 }, { job: "teacher", band: 2 }, { job: "electrician", band: 2 },
  { job: "full-time crypto trader", band: 3 }, { job: "day trader (losing)", band: 1 }, { job: "streamer", band: 2 }, { job: "video editor", band: 1 }, { job: "unemployed", band: 0 },
  { job: "real-estate agent", band: 3 }, { job: "startup founder", band: 3 }, { job: "VC associate", band: 3 }, { job: "hedge fund analyst", band: 4 }, { job: "dentist", band: 3 },
  { job: "tattoo artist", band: 1 }, { job: "freelance journalist", band: 1 }, { job: "car dealer", band: 3 }, { job: "lawyer", band: 4 }, { job: "retired accountant", band: 3 },
  { job: "uber driver", band: 1 }, { job: "music producer", band: 1 }, { job: "esports coach", band: 1 }, { job: "pharmacist", band: 3 }, { job: "line cook", band: 0 },
  { job: "yacht broker", band: 4 }, { job: "family-office heir", band: 5 }, { job: "self-made SaaS millionaire", band: 5 }, { job: "influencer manager", band: 2 }, { job: "security guard", band: 1 },
  { job: "PhD candidate", band: 1 }, { job: "graphic designer", band: 1 }, { job: "mechanic", band: 1 }, { job: "financial advisor", band: 3 }, { job: "NFT artist", band: 1 },
];

export const FINANCES = ["broke", "living paycheck to paycheck", "doing ok", "comfortable", "quietly rich", "absurdly rich"] as const;

export const PERSONALITY = [
  "sarcastic","loyal","chronically online","anxious","hype","dry","petty","wholesome","contrarian","nerdy","dramatic","chill","competitive","curious","cynical",
  "gossipy","earnest","unhinged","stoic","flirty","paranoid","generous","cocky","shy","goofy","pedantic","romantic","impulsive","meticulous","nostalgic",
];

export const INTERESTS = ["crypto","memecoins","gaming","fashion","cars","jets","islands","business","tech","celebrity","drama","music","fitness","anime","real-estate","stocks","art","food","football","conspiracy"];

/** Shorthand per voice family (from docs/research.md §2). */
export const SLANG_ZOOMER = ["fr","fr fr","ong","ngl","lowkey","no cap","istg","bet","mid","iykyk","deadass","bro","bruh","nah","icl","on god","ts","pmo","gng","ate"];
export const SLANG_MILLENNIAL = ["lol","tbh","imo","omg","literally","lmao","smh","tbf","idk","same","mood","yikes","rn","btw"];
export const SLANG_BOOMER = ["...", "Interesting.", "LOL", "Well", "Folks", "In my day", "Hmm."];

export const EMOJI_LAUGH = ["💀","😭","💀💀","😭😭😭","💀😭","🤣","😂"];
export const EMOJI_HYPE = ["🔥","🐐","👑","💯","🚀","⚡","🙌","💎","🤑","😤"];
export const EMOJI_SHADE = ["🤡","🧢","🙄","😬","🥱","👀","🫠","🤨","📉","🗑️"];
export const EMOJI_SOFT = ["✨","🥺","🫶","🌙","☁️","🌸","💫","🤍"];

export const REACTIONS: Record<string, string[]> = {
  hacker: ["👁️", "🕸️", "💀", "📁", "🔥", "😭", "🤫"],
  glaze: ["🐐","👑","🔥","😭","💯","🙏","⚡"],
  hater: ["🤡","🧢","💀","🙄","📉","🗑️","😂"],
  finance: ["📈","📉","🤑","💰","🧐","👀","🔥"],
  culture: ["💀","😭","👀","🍿","🔥","🫠","😂"],
  gaming: ["💀","🎮","gg","🔥","😭","🫡","🤓"],
  luxury: ["🥂","💎","✈️","🏝️","🔥","👀","🤌"],
  conspiracy: ["👁️","🤔","🧠","👀","🚨","🔺","🤨"],
  gossip: ["👀","🍿","😭","💅","☕","🫢","💀"],
  news: ["👀","📰","😮","🤔","🔥","🧐","📉"],
};

export const CATCHPHRASES = [
  "we are so back","it's so over","trust the process","i'm just saying","cope harder","zoom out","source: trust me","not financial advice","let him cook","touch grass",
  "average enjoyer","main character energy","i called it","this is the timeline","emotional damage","ratio","stay humble","bullish on vibes","it's giving","no thoughts just vibes",
  "receipts or it didn't happen","ok but hear me out","i'm calm i'm calm","this aged well","certified moment","lmk if u need alpha","we ride at dawn","all gas no brakes",
];

export const CELEB_FIELDS = ["pop star","pro gamer","tech founder","rapper","fashion mogul","streamer","football star","crypto fund manager","film director","reality TV star","chef","racing driver"];
