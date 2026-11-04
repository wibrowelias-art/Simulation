import type { Obsession } from "./types";

/**
 * Phrase banks for reactions to @god appearing. Lines are combined (lead + core + tail)
 * and filled with context slots, so the same exact sentence rarely repeats.
 * Slots: {q} what god said, {kw} a keyword from it, {coin}, {ch}, {server}, {user},
 * {past} an older god line, {pastwhere}, {mem} a memory of the speaker, {holding},
 * {nw} god's net worth, {world}, {personal}, {laugh}, {hype}, {shade}, {n}.
 */

export type GodIntent = "greeting" | "question" | "announcement" | "flex" | "joke" | "crypto" | "purchase" | "compliment" | "insult" | "sad" | "hype" | "farewell" | "generic";

/** first-wave hype leads — mostly fans, often caps */
export const LEAD: Record<Obsession, string[]> = {
  obsessed: ["HE'S HERE", "GOD IS IN THE CHAT", "NO WAY", "WAIT", "CHAT", "IT'S HIM", "OMG OMG", "I'M SHAKING", "THIS IS NOT A DRILL", "HE'S ONLINE", "AAAAAA", "EVERYBODY ACT NORMAL", "GUYS", "BRO", "HOLD ON"],
  supporter: ["oh he's here", "yooo", "god's online", "omg", "wait", "ayy", "lets gooo", "oh hey", "no shot", "oh snap"],
  business: ["noted.", "interesting timing", "god in chat on a {day}", "ok", "attention please", "huh"],
  skeptic: ["sure", "hm", "ok", "right", "wait", "lol"],
  rival: ["oh great", "here we go", "of course", "ugh", "cool", "yay"],
  hater: ["oh no", "ew", "here we go again", "great", "lmao", "bruh"],
  indifferent: ["oh", "huh", "ok", "who", "lol", "neat"],
};

export const HYPE: string[] = [
  "everybody act normal", "EVERYBODY ACT NORMAL", "screenshot this", "SCREENSHOT THIS RN", "i got notified and ran here", "phone buzzed and i sprinted here",
  "my notifications just exploded", "dropped my food for this", "clip it clip it", "mods pin this", "i'm framing this message", "the king has spoken",
  "he's typing in OUR server", "i was literally about to log off", "wake up everyone", "historic day in #{ch}", "i'm telling my kids about this",
  "this is the best day of my life", "i've been waiting {n} days for this", "first time seeing him live 😭", "he actually reads this chat??",
  "act cool act cool act cool", "nobody say anything weird", "who pinged him", "we have to behave now", "sit up straight everyone",
];

/** replies to god keyed by what he said */
export const TO_GOD: Record<GodIntent, string[]> = {
  greeting: [
    "sup {god}!!", "GOD SAID {Q} TO US", "hiii god 😭", "he said \"{q}\" to US. to us guys", "sup king 👑", "hey god how's your day going",
    "\"{q}\" 🥹", "yo god! how's {holding} doing", "hi god i've been here since day one", "@god sup!! long time", "he greeted us. we're family now",
    "@god hiii can you say hi to me specifically", "sup god, what are you up to today", "@god finally!! where have you been", "the way he just casually said {q}",
    "@god hey!! you picked the right server", "omg hi @god", "@god evening king (it's evening somewhere)",
  ],
  question: [
    "@god yes. whatever it is, yes", "ok god asked \"{q}\" everyone answer correctly", "@god depends, is this a test", "@god honestly? yes",
    "@god 100% do it", "god is asking US for advice 😭", "@god i'd say go for it", "@god i've thought about this for {n} minutes and the answer is yes",
    "he's asking about {kw}... is something coming", "@god why do you ask 👀", "@god what's your answer though", "everyone shut up he asked a question",
  ],
  announcement: [
    "WHAT IS IT", "@god drop it NOW", "he said \"{q}\" what does that mean", "announcing in #{ch} instead of #god-announcements is crazy", "i'm setting an alarm",
    "@god is it about {kw}?", "bro is about to change the timeline again", "@god hint pls", "clearing my schedule", "the leaks channel is going to be insane tonight",
    "@god how big are we talking", "everybody get ready",
  ],
  flex: [
    "the casual flex 😭", "bro said \"{q}\" like it's nothing", "@god can i have like 0.001%", "we're basically the same except the money",
    "net worth said hello", "@god teach me", "this man flexes in lowercase", "i felt that in my bank account", "@god how", "the {kw} flex is crazy",
    "not him flexing in #{ch} 😭", "@god adopt me",
  ],
  joke: ["LMAOOO he's funny too", "god has jokes 😭", "god shitposting in #{ch} was not on my bingo card", "💀💀 @god stop", "he's one of us fr",
    "@god this is why you're the goat", "the humor is also billionaire tier", "i actually laughed out loud", "@god chill i'm in class"],
  crypto: ["is that alpha??", "@god should i buy {coin}", "he mentioned {coin}. chart about to go vertical", "NFA but god said it", "@god are you in {coin}?",
    "buying {coin} with my rent money brb", "@god bull or bear", "whale alert 🐋", "if god says {kw} i'm listening", "@god which coin next"],
  purchase: ["@god what did you buy", "how much was it", "he's shopping again 😭", "{kw}?? receipts pls", "@god pics or it didn't happen",
    "@god was it expensive or GOD expensive", "the economy just moved", "@god can i come see it", "imagine just buying {kw} on a {day}"],
  compliment: ["he loves us 🥹", "@god we love you more", "i'm crying at work", "@god no YOU'RE the best", "he's so real for this", "wholesome god arc",
    "@god thank you for existing", "this is why we stan"],
  insult: ["god's in a mood lmao", "who made him mad", "he's talking to the haters 😭", "@god let them have it", "someone's getting ratioed",
    "@god it's not us right?", "the haters in #{ch} rn: 🫥"],
  sad: ["@god you ok?", "god having a rough day was not on my bingo card", "sending good vibes king", "@god we got you", "@god take a break, you earned it",
    "rich people get sad too i guess", "@god want us to cheer you up"],
  hype: ["LET'S GOOOO", "HE'S HYPED SO I'M HYPED", "@god WE'RE SO BACK", "the energy in #{ch} rn", "@god LFG", "this server is on fire", "god hype is contagious"],
  farewell: ["NOOO come back", "gn god", "he's leaving already 😭", "@god don't go", "@god come back soon", "he said {q} and left. iconic", "@god see you next time king"],
  generic: ["@god what have you been up to", "\"{q}\" — noted 📝", "he said \"{q}\"", "what does \"{q}\" mean", "@god say more", "@god explain", "@god elaborate pls",
    "we're analyzing \"{q}\" in #fan-discussion later", "\"{q}\" is going on a shirt", "@god what's new"],
};

/** stance-specific reactions to the appearance itself (any intent) */
export const BY_OBSESSION: Record<Obsession, string[]> = {
  obsessed: ["@god notice me pls", "@god i've been here every single day", "posting this on my fan account", "@god i named my cat after you", "I'M SCREAMING",
    "@god do you remember me?? i'm the one who made the {kw} edit", "i'm literally shaking rn", "@god marry me (platonically)", "god in #{ch} and i'm HERE for it",
    "mods please don't let this chat get flooded he has to see my message", "@god reply to me and i'll never ask for anything again", "this is going in my fan account highlights"],
  supporter: ["love to see it", "nice to see you around god", "good vibes in here today", "@god appreciate you popping in", "this server stays winning",
    "he actually hangs out here, that's cool", "god being normal in chat is so funny to me"],
  business: ["@god any thoughts on {holding}'s numbers?", "god in chat = volume up", "case study material", "@god what's the next move", "noting the time. markets react to less",
    "@god how do you decide what to buy", "@god hiring?", "every time he talks something moves", "@god quick question about {holding}"],
  skeptic: ["is it really him or a fan account", "verified badge or it didn't happen", "he types like a PR team", "we sure that's not a mod on an alt?",
    "god saying {q} is the least suspicious thing he's done this week", "y'all believe anything with a crown next to it", "ok but where's the {kw} receipts"],
  rival: ["he only shows up when he wants attention", "cool, now everyone's going to glaze for an hour", "i could say {q} and nobody would care",
    "watch the whole server forget i exist", "imagine being this excited about a greeting", "my message from earlier got 0 reacts btw",
    "of course he comes on right after i post my thing"],
  hater: ["oh great he's here", "y'all are embarrassing", "ratio'd by a {kw}", "mid message tbh", "can we go back to talking about literally anything else",
    "this chat lost all dignity in 4 seconds", "he's here to farm attention again", "{laugh} the glazing already started"],
  indifferent: ["who?", "anyway", "ok what did i miss", "oh is that the rich guy", "cool", "huh. ok"],
};

/** character → character chains during the burst */
export const CHAIN = {
  fanToHater: ["@{user} let us have this", "@{user} then leave lol", "@{user} you're in his server", "@{user} nobody asked", "@{user} cope", "@{user} you're literally here too"],
  haterToFan: ["@{user} you're literally shaking", "@{user} he doesn't know you exist", "@{user} it's a greeting not a marriage proposal", "@{user} get up off the floor",
    "@{user} he's not going to reply bro", "@{user} touch grass"],
  fanToFan: ["@{user} DID YOU SEE", "@{user} we're in the same timeline as him", "@{user} i screenshotted it first", "@{user} i can't breathe", "@{user} we're so lucky",
    "@{user} HE'S STILL TYPING??", "@{user} told you he reads this"],
  skepticToFan: ["@{user} calm down he said {q}", "@{user} it's two words", "@{user} breathe", "@{user} he's a person not a meteor shower"],
  noticed: ["@{user} bro thinks he got noticed 😭", "if he replies to me i'm retiring", "@{user} he looked at your message, i saw it", "the race to get noticed has begun",
    "@{user} you have to be funnier than that to get a reply", "everyone typing essays hoping he replies 😭"],
  catchUp: ["wait what did i miss", "what did he say??", "i was gone for 2 minutes", "someone summarize"],
  catchUpAnswer: ["@{user} he said \"{q}\"", "@{user} \"{q}\". that's it. we're losing it", "@{user} scroll up, he said {q}", "@{user} he said {q} and the server combusted"],
  memory: ["last time he was here he said \"{past}\"", "this is like when he said \"{past}\" in {pastwhere}", "@god was {mem} real?", "@god still thinking about {mem}",
    "@god remember \"{past}\"? we do", "first time since the \"{past}\" message", "@god are we getting a sequel to \"{past}\""],
  upTo: ["@god what have you been up to lately", "@god how's {holding}", "@god you've been quiet, what's cooking", "@god where were you all week", "@god what are you doing today"],
  drift: ["anyway did anyone see {world}", "ok anyway. {personal}", "unrelated but {world} is wild", "while we're here, anyone watching {world}?", "i'm eating cereal for dinner btw"],
  mod: ["ok everyone breathe, he's allowed to say hi", "keep it chill or he'll leave", "slowmode is on for 10s, behave", "please don't spam pings", "one message each, let's not scare him off"],
  still: ["is he still here?", "@god come back", "ok he left", "he's gone isn't he", "@god you still there?", "he's lurking, i can feel it"],
};

/** when @god replies to a specific character */
export const FREAK: Record<Obsession, string[]> = {
  obsessed: ["HE REPLIED TO ME", "GOD REPLIED TO ME I'M FRAMING THIS", "@god 😭😭😭 thank you", "i'm never deleting this account", "MOM GET THE CAMERA", "I CAN'T FEEL MY HANDS",
    "@god i will remember this forever", "SCREENSHOTTING SCREENSHOTTING"],
  supporter: ["wait he replied to me??", "@god thank you!! 🥹", "omg he replied", "@god this made my week", "not me getting a reply from god"],
  business: ["@god appreciate the reply. noted.", "@god thank you, i'll keep that in mind", "he replied. that's going in the portfolio", "@god follow-up: what's next"],
  skeptic: ["...ok that was actually him", "@god fine. you're real.", "he replied to me. i don't know how to feel", "@god respect for replying i guess"],
  rival: ["oh so NOW he replies", "@god took you long enough", "ok that was kind of cool", "don't make it a big deal guys"],
  hater: ["...ok that was kinda funny", "doesn't change anything", "he replied to ME? noted", "@god still not a fan", "ok fine one point to god"],
  indifferent: ["oh he replied", "huh. hi", "@god hi?", "cool"],
};
export const FREAK_OTHERS = ["@{user} you're famous now", "not fair he never replies to me", "@{user} what did it feel like", "bro got noticed", "screenshot before he deletes it",
  "@{user} you've been chosen", "@{user} you owe us a speech", "{user} got a god reply and i got nothing", "@{user} change your bio to 'noticed by god'", "@god reply to me next 😭"];

/** other servers talking about the appearance afterwards */
export const ECHO_OPEN = ["god was in {server} #{ch}", "he said \"{q}\" in {server} lmao", "{server} is losing it, god just typed \"{q}\"", "why does he always go to {server} and never here",
  "someone post the screenshot from {server}", "is the {server} thing real?", "god just showed up in {server} #{ch} and said \"{q}\"", "heard god was chatting in {server} 👀",
  "breaking: god said {q} in {server}", "{server} people are going to be insufferable now"];
export const ECHO_REPLY = ["wait what did he say", "he said \"{q}\"", "why never here 😭", "screenshot or fake", "i was there 😤", "@god come to {here} too", "jealous ngl",
  "{server} doesn't deserve him", "he'll come here next, trust", "they're all going to put it in their bios", "lowkey want to join {server} now", "it's just a message guys", "the {server} mods must be sweating"];

/** DMs to @god */
export const DM_OPEN: Record<Obsession, string[]> = {
  obsessed: ["hi god sorry to bother you. saw you in {server} today and just wanted to say you're the reason i'm online", "god!!! i saw you in #{ch} 😭 hi", "hey god, it's me from {server}. hope you're having a good day 🙏"],
  supporter: ["hey! saw you in {server}, just wanted to say hi", "hi god, big fan. no pressure to reply"],
  business: ["Hi — quick pitch, 30 seconds? I think {holding} could use a partner", "Hey, saw your message in {server}. Would love to talk about an investment idea."],
  skeptic: ["genuine question: is this account actually you?", "hey, are you actually god or a team"],
  rival: ["you know half that server only likes you for the money right", "ok i'll admit the {server} thing was funny"],
  hater: ["why do you even come to these servers", "you could just... not post"],
  indifferent: ["hi, someone told me to message you", "hey"],
};
export const DM_REPLY: Record<Obsession, string[]> = {
  obsessed: ["OMG HI", "you actually replied 😭😭", "i'm shaking. hi. thank you", "can i screenshot this", "this is the best day of my life"],
  supporter: ["oh hey! thanks for replying", "haha that's so cool you answered", "appreciate you"],
  business: ["Thanks for getting back to me.", "Great. I'll send details.", "Appreciate the reply."],
  skeptic: ["ok so it IS you", "huh. fair enough", "interesting"],
  rival: ["oh. ok. hi", "didn't think you'd answer tbh", "cool i guess"],
  hater: ["...still not a fan", "ok that was kinda decent of you", "whatever"],
  indifferent: ["oh hi", "ok cool", "nice"],
};

/** everyday god talk when he's NOT around (obsession behaviours) */
export const AMBIENT: Record<Obsession, string[]> = {
  obsessed: ["@god when are you coming back to #general", "has anyone seen god online today", "my fan account just hit {n}k btw", "never forget when he said \"{past}\"",
    "i check this server every 5 min in case he shows up", "if god ever replies to me i'm changing my name to 'noticed'", "@god good morning (he won't see this but still)",
    "rewatching the \"{past}\" screenshot for the {n}th time", "who else has notifications on for god", "day {n} of waiting for god to say hi again",
    "leave him alone he's doing his thing", "i'd defend god in court for free"],
  supporter: ["god's been quiet. too quiet", "what do we think god is up to today", "i miss when god posted more", "his last message was \"{past}\" right?",
    "lowkey wonder what god's day looks like", "god would love this channel today", "remember \"{past}\"? classic"],
  business: ["his net worth is {nw} and y'all still argue", "{holding} is underrated as a move", "i think he's about to buy something big. pattern's there",
    "god effect index is up again", "studying god's moves like it's homework", "what's everyone's read on {holding}"],
  skeptic: ["still waiting for proof on half of these god stories", "\"{past}\" is the most PR thing anyone has ever typed", "is {nw} even real",
    "y'all treat screenshots like court evidence", "notice how he only shows up when there's news"],
  rival: ["why does everyone care so much about god", "i've done more for this server than god", "i could be god if i had his luck",
    "fan accounts for a guy who says \"{past}\" 😭", "attention economy and he's the landlord"],
  hater: ["god fans are actually the worst", "\"{past}\" is the cringiest message in server history", "his net worth won't buy taste", "we need a god-free channel",
    "every day this server is 80% glazing", "can a mod ban the word god"],
  indifferent: ["is god that rich guy?", "anyway. {personal}", "this server is weird about that guy", "i'm just here for {world}"],
};
