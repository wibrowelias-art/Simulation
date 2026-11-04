/** Core data model for the GOD simulation. Everything here is fictional. */
import type { MemeSpec } from "./memes";

export type Stance =
  | "worshipper" // glazes constantly
  | "fan" // likes god, but has a life
  | "memer" // turns everything into a bit
  | "analyst" // numbers guy, neutral-ish
  | "skeptic" // "overrated", wants receipts
  | "hater" // actively dislikes god
  | "jealous" // envious, backhanded
  | "conspiracist" // sees a plan behind everything
  | "indifferent"; // has their own life, rarely cares

export type Voice = "zoomer" | "lowercase" | "caps" | "millennial" | "proper" | "boomer" | "terse" | "emoji" | "formal";

export type PfpStyle = "anime" | "default" | "pet" | "aesthetic" | "pixel" | "meme" | "game" | "monogram" | "abstract" | "hacker";
export type Tier = "lurker" | "regular" | "power";
export type Chronotype = "morning" | "evening" | "owl";

/** How a character relates to @god (derived from stance + opinion; evolves). */
export type Obsession = "obsessed" | "supporter" | "business" | "skeptic" | "rival" | "hater" | "indifferent";

export interface GodContact {
  t: number;
  kind: "replied" | "saw" | "dm" | "mentioned";
  text: string; // what @god said
  where: string; // "GOD HQ #general"
}

export interface Character {
  id: string;
  username: string;
  displayName: string;
  avatarSeed: number;
  age: number;
  location: string;
  occupation: string;
  finances: string; // e.g. "broke student", "comfortable", "crypto-rich"
  netWorthBand: number; // 0..5
  personality: string[]; // adjectives
  stance: Stance;
  opinion: number; // -100..100, opinion of @god
  voice: Voice;
  emojiRate: number; // 0..1
  typoRate: number; // 0..1
  slang: string[]; // personal shorthand set
  emojis: string[]; // signature emojis
  pfp: PfpStyle;
  tier: Tier;
  activity: number; // relative weight (zipf-ish)
  tz: number; // utc offset hours
  chronotype: Chronotype;
  nicknames: Record<string, string>; // per-server nickname
  isMod?: boolean;
  catchphrase: string;
  interests: string[]; // topic tags
  servers: string[]; // server ids
  friends: string[]; // character ids
  rivals: string[]; // character ids
  verified: boolean;
  influencer: boolean;
  followers: number;
  bio: string;
  memory: MemoryItem[]; // events this character referenced/witnessed
  postCount: number;
  edited?: boolean;
  core?: boolean; // one of the ~36 recurring regulars
  bond?: number; // 0..100 familiarity with @god (grows when he talks to / replies to them)
  godContacts?: GodContact[]; // conversation history with @god
  godFacts?: string[]; // things @god told them (from live chats), remembered later
}

export interface MemoryItem {
  topicId: string;
  label: string; // short reference e.g. "the island purchase"
  t: number;
  feeling: number; // -1..1
}

export interface Channel {
  id: string;
  name: string;
  topic: string;
  tags: string[]; // which topic tags flow here
  announce?: boolean;
}

export interface Server {
  id: string;
  name: string;
  icon: string; // emoji
  color: string;
  description: string;
  bias: number; // -1..1, community lean on @god
  vibe: string; // e.g. "glaze", "hater", "finance"
  tags: string[];
  channels: Channel[];
  members: string[]; // character ids
  moderators: string[];
  memberCount: number; // displayed member count (bigger than simulated cast)
  insideJokes: string[];
}

export interface Reaction {
  emoji: string;
  count: number;
  me?: boolean; // @god added this one
}

export interface Message {
  id: string;
  episodeId?: string;
  serverId: string;
  channelId: string;
  authorId: string; // character id or "god"
  text: string;
  t: number;
  topicId?: string;
  replyTo?: string;
  reactions: Reaction[];
  kind?: "chat" | "system" | "bot" | "meme";
  cascaded?: boolean; // god already reacted here and the room freaked out
  intent?: string; // conversational move that produced it (open, reply, pileon, drift, mod...)
  score: number; // engagement / value for pruning
  typingFrom?: number; // when the author started typing (typing indicator)
  threadOf?: string; // reply inside a thread rooted at this message id
  editedAt?: number;
  editText?: string; // text after a scheduled edit at editedAt
  deleted?: boolean;
  pinnedAt?: number;
  mentionsGod?: boolean;
  meme?: MemeSpec; // image attachment
  ai?: boolean; // written live by the model (an overlay on the seeded world)
  /** reactions that land over time: [emoji, t, by] (by = character id) */
  reactionLog?: [string, number, string][];
}

export type PlatformId = "chirp" | "snapgram" | "clipz" | "threadit" | "tubeverse" | "wire";

export interface Post {
  id: string;
  platform: PlatformId;
  authorId: string;
  text: string;
  t: number;
  topicId?: string;
  likes: number;
  reposts: number;
  godLiked?: boolean;
  godReposted?: boolean;
  replies: number;
  views: number;
  quoteOf?: string;
  replyTo?: string;
  communityNote?: string;
  breaking?: boolean;
  title?: string; // threadit/tubeverse
  community?: string; // threadit sub
  media?: { hue: number; label: string; kind: "photo" | "video" | "meme"; meme?: MemeSpec };
  score: number;
}

export type ArticleKind = "breaking" | "report" | "opinion" | "rumor" | "interview" | "investigation" | "financial";

export interface Outlet {
  id: string;
  name: string;
  short: string;
  color: string;
  bias: number;
  tagline: string;
  beats: string[];
  authors: { name: string; role: string }[];
}

export interface Article {
  id: string;
  outletId: string;
  kind: ArticleKind;
  headline: string;
  dek: string;
  body: string[];
  author: string;
  t: number;
  topicId?: string;
  reactions: Reaction[];
  comments: { authorId: string; text: string; t: number; likes: number }[];
  reads: number;
}

export interface Topic {
  id: string;
  tag: string; // hashtag/trend label, e.g. "GodIsland"
  label: string; // "the island purchase"
  about: "god" | "world";
  category: string; // island, business, coin, controversy, celebrity, crypto, gaming, tech, drama...
  valence: number; // -1..1 how positive for god
  magnitude: number; // 0..10
  heat: number; // current heat, decays
  startedAt: number;
  subject?: string; // e.g. island name
  amount?: number;
  breaking?: boolean;
  celebrityId?: string;
  facts: Record<string, string>;
}

export interface Holding {
  id: string;
  kind: "business" | "property" | "island" | "jet" | "vehicle" | "investment" | "coin" | "organization" | "account";
  name: string;
  value: number;
  acquiredAt: number;
  detail: string;
  employees?: number;
  yieldPerDay?: number; // fictional income
}

export interface Player {
  username: string;
  displayName: string;
  cash: number;
  holdings: Holding[];
  followers: number;
  reputation: number; // 0..100
  influence: number; // 0..100
  history: { t: number; text: string; topicId?: string }[];
  netWorthHistory: { t: number; v: number }[];
  avatarSeed: number;
}

export interface Choice {
  id: string;
  label: string;
  hint: string;
}

export interface InteractiveEvent {
  id: string;
  type: string;
  title: string;
  body: string;
  fromId?: string;
  t: number;
  choices: Choice[];
  resolved?: { choiceId: string; outcome: string; t: number };
  expiresAt: number;
  data: Record<string, string | number>;
}

export interface Notification {
  id: string;
  t: number;
  text: string;
  kind: "mention" | "trend" | "news" | "event" | "money" | "system";
  link?: string;
  read: boolean;
}

export interface Settings {
  activity: number; // 0.25..3 multiplier
  glazeRatio: number; // 0..1 (0.5 = default mix)
  drama: number; // 0..1
  theme: "midnight" | "obsidian" | "royal" | "terminal";
  reducedMotion: boolean;
  liveReplies?: boolean; // characters write fresh replies to you via /api/chat (default on)
  breakCharacter?: boolean; // characters may admit they are AI if you ask (default off)
}

export interface Celebrity {
  id: string; // character id
  field: string;
}

/** One shared event bus entry: a world event that fans out to every surface when due. */
export interface BusEvent {
  id: string;
  t: number;
  kind: "echo" | "followup" | "godDm" | "screenshot" | "undernet";
  topicId?: string;
  data: Record<string, string | number>;
}

/** @god's own past messages, so characters can quote / reference them. */
export interface GodLine { id: string; t: number; text: string; serverId: string; channelId: string; intent: string }

export interface WorldState {
  version: number;
  seed: string;
  createdAt: number;
  simTime: number; // time processed up to (ms, bucket aligned)
  lastSeenAt: number;
  characters: Character[];
  servers: Server[];
  outlets: Outlet[];
  celebrities: Celebrity[];
  messages: Message[];
  posts: Post[];
  articles: Article[];
  topics: Topic[];
  events: InteractiveEvent[];
  notifications: Notification[];
  player: Player;
  settings: Settings;
  counter: number; // id counter
  stats: { messages: number; posts: number; articles: number; pruned: number };
  recentTexts: string[]; // dedupe ring
  pending: Message[]; // scheduled episode messages not yet "sent"
  bus: BusEvent[]; // scheduled world events (shared event bus)
  godLog: GodLine[]; // recent @god chat lines
  focus?: { serverId: string; channelId: string; t: number }; // channel the player is looking at (live only)
  undernet?: UndernetState; // the gh0st storyline (fiction only)
  voice?: VoiceState; // fictional voice lounge presence
  godMoments?: GodMoment[]; // god's interactions (typing, reactions, voice) for the away recap
}

export type CrewRole = "gh0st" | "kid" | "wren" | "broker" | "hype";
export interface UndernetState {
  crew: Record<CrewRole, string>; // character ids
  grudge: number; // 0..100: how fixated gh0st is on @god
  leaks: number;
  nextLeakAt: number;
  announce?: boolean; // added to an existing save: show the one-time "New: The Undernet" tip
  hiredUntil?: number; // the white hat is watching: leaks come slower and land softer
  lastLeakAt?: number;
}

export interface VoiceState {
  god?: { serverId: string; channelId: string; since: number; joiners: [id: string, t: number][]; leftAt?: number };
  lines: { t: number; serverId: string; channelId: string; who: string; text: string }[]; // overheard transcript
}

export interface GodMoment { t: number; kind: "typing" | "react" | "voice" | "voiceLeave" | "command" | "leak"; text: string; link?: string }

export interface CatchUpSummary {
  from: number;
  to: number;
  simulatedFrom: number;
  messages: number;
  posts: number;
  articles: number;
  events: number;
  topTopics: { tag: string; heat: number }[];
  topServers: { name: string; count: number }[];
  opinionShift: number;
  highlights: string[];
  compressed: boolean;
  mentions?: number; // messages that tagged @god while you were away
}
