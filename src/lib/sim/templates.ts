/* Template banks. Slots: {god} {label} {subj} {amt} {tag} {celeb} {cmp} {thing} {user} {past} {ch} {server} {world} {personal} {outlet} {n} {coin} {laugh} {hype} {shade} */
import type { Stance } from "./types";

export const CMP = [
  "my entire bloodline", "my whole family tree", "my city's annual budget", "every job i will ever have", "my rent for 400 years", "my student loans x1000",
  "the GDP of my hometown", "my car (it's a 2009 civic)", "my net worth in pokemon cards", "my dad's entire retirement", "my whole street", "my 401k, my soul and my cat",
];
export const THING = ["a sandwich", "a hoodie", "gas money", "a concert ticket", "groceries", "a used scooter", "a parking ticket", "an energy drink", "rent", "a phone case"];

/** Openers about a @god topic, by stance. {label} is the topic label ("the island purchase"). */
export const GOD_OPEN: Record<Stance, string[]> = {
  worshipper: [
    "{god} is actually playing life on creative mode {laugh}", "HOW DOES THIS GUY KEEP WINNING", "{god} literally owns the internet at this point", "someone explain how this man casually did {label}",
    "bro's side quests are worth more than {cmp}", "not {god} doing {label} on a random {day} {hype}", "i woke up and {god} already did {label}. what did YOU do today", "{label} is the most {god} thing ever {hype}",
    "we are witnessing history and half of yall are asleep", "every day i wake up grateful to be in the same timeline as {god}", "{god} said 'watch this' and the whole internet watched", "the {label} is a masterclass. study it",
    "imagine being so rich {label} is a tuesday activity", "{god} doesn't chase trends, trends chase {god}", "if {god} sneezes the market moves fr", "my therapist asked who my role model is. i said {god} and showed her {label}",
    "glazing is not enough. we need a new word for what {god} deserves", "{god} could buy {cmp} and still have lunch money", "the aura on this man after {label} {hype}", "{label}??? he's not human",
  ],
  fan: [
    "ok {label} is actually kinda insane", "ngl {label} was a power move", "lowkey love that {god} just does stuff", "{label} has me hyped ngl", "i'm a fan but {label} is wild even for him",
    "{god} doing {label} is the content i signed up for", "can't lie {label} goes hard", "the {label} thing is so funny to me, he just does whatever", "rooting for him on this one", "honestly respect the {label} move",
    "this is why i joined this server lol", "{label} is peak {god}", "not gonna pretend i understand the money but {label} sounds sick", "ok {god} cooked with {label}", "W {label}",
  ],
  memer: [
    "{god} after {label}: 'it was a small purchase' {laugh}", "me checking my bank app after reading about {label} 🧍", "pov: you're the intern who has to explain {label} to the accountant", "{label} speedrun any%",
    "{god}: buys {subj}. me: buys {thing}. we are not the same", "this is going in #memes immediately", "new template just dropped: '{god} after {label}'", "{label} but every time he does it a frog gets a lambo",
    "my mom asked if i'm like {god}. i said yes, i also made a big purchase today ({thing})", "breaking: local man still processing {label}", "the {label} arc is my favorite season of the internet", "{god} is the final boss of capitalism and {label} was his ult",
    "average {god} enjoyer vs average {label} hater", "someone make the {label} wojak rn", "{label} has the same energy as buying a second fridge but it's {amt}",
  ],
  analyst: [
    "Back of the envelope: {label} at {amt} is maybe a low single-digit % of his estimated net worth.", "Interesting move. {label} only makes sense if he's playing a longer game.", "People are overreacting to {label}. Look at the actual numbers.",
    "{label}: reported {amt}. Nobody has verified the figure yet.", "my take on {label}: smart on paper, risky on execution", "the market reaction to {label} is more interesting than the thing itself",
    "Ran the numbers on {label}. If the {amt} figure is right, it's aggressive but not crazy.", "The real story with {label} is the signaling, not the money.", "Wait for filings before you get excited about {label}.", "{label} tells you where he thinks the next cycle is",
  ],
  skeptic: [
    "source on {label}? because i only see his own post", "{label} sounds made up ngl", "anyone actually verified {label} or are we just vibing", "funny how {label} drops right when people were talking about the other thing",
    "i'll believe {label} when i see paperwork", "{amt}? says who?", "half of these {label} numbers are coming from fan accounts lol", "not saying {label} is fake. saying nobody here has checked",
    "the {label} story has changed three times today", "watch {label} quietly turn out to be a lease",
  ],
  hater: [
    "{god} is so mid. {label} is just a rich guy buying stuff", "nobody cares about {label}", "imagine glazing a man for {label} 🤡", "{label} is the most try-hard thing i've ever seen", "{god} fell off and {label} proves it",
    "{label} is pure PR, wake up", "yall are paying attention to {label} and that's exactly what he wants", "overrated. {label} changes nothing", "the {label} glazing in here is embarrassing", "he did {label} and still can't buy taste {shade}",
    "ratio + {label} is cringe + he's overrated", "every {god} move is just {label} with extra steps", "i'm so tired of hearing about {label}", "cope thread for {label} incoming",
  ],
  jealous: [
    "must be nice to just do {label} lol", "ok but who actually NEEDS {label}", "i work 50 hours a week and {god} does {label} for fun. cool cool cool", "i'm not jealous i just think {label} is excessive",
    "if i had his money i'd do something more useful than {label}", "so we're just pretending {label} is normal?", "congrats i guess. some of us have rent", "lucky timing tbh, anyone could do {label} with his start",
  ],
  conspiracist: [
    "{label} is a distraction. look at what else happened today", "nobody is asking WHY {label} happened right now", "{label} lines up perfectly with the timestamp theory", "think about it. {label}. same week as the last one. coincidence?",
    "{label} is step 3. we're watching step 4 happen", "there's more to {label} than they're telling you", "{label} = {amt}. add the digits. you'll see", "i've been saying this for months. {label} was planned",
  ],
  indifferent: [
    "is {label} a big deal or", "ok so {label} happened. anyway", "saw something about {label} on my feed, didn't read it", "{label}? i'm just trying to finish my shift", "people really care about {label} huh",
  ],
};

/**
 * Openers about a @god storyline he didn't *do* (a rumor, leak, viral clip, someone mentioning him, him chatting).
 * GOD_OPEN assumes an action ("god did {label}"), which reads as nonsense for "the garage photo leak".
 */
export const GOD_STORY: Record<Stance, string[]> = {
  worshipper: ["{label} won't touch him {hype}", "the {label} discourse is just haters coping", "{god} doesn't even need to respond to {label}", "imagine thinking {label} matters to {god}", "{label} only makes him bigger tbh"],
  fan: ["ok the {label} stuff is kinda funny", "still rooting for him through {label}", "{label} is so him lol", "lowkey invested in the {label} saga", "can't wait for him to address {label}"],
  memer: ["{label} is my roman empire", "the {label} lore keeps growing", "someone make a timeline of {label}", "{label} is peak content", "adding {label} to the god cinematic universe"],
  analyst: ["Worth separating facts from noise on {label}.", "On {label}: no primary source yet.", "Watch how his camp handles {label}.", "{label} is mostly engagement at this point."],
  skeptic: ["who's the actual source on {label}", "{label} smells like engagement bait", "screenshots aren't proof, {label} included", "give it a day, {label} will look different"],
  hater: ["{label} is the real {god}", "not surprised by {label} at all", "can't wait for the {label} apology post", "{label} and his fans still won't admit it"],
  jealous: ["of course {label} won't hurt him", "anyone else would be cooked over {label}", "must be nice to have {label} be your biggest problem"],
  conspiracist: ["{label} is a distraction", "the timing on {label} is not random", "{label} came out right on schedule. think about it"],
  indifferent: ["what's {label} even about", "{label} again? ok", "scrolled past {label}, didn't read it"],
};

/** Stance tails appended to storyline openers (rumor/leak/viral/...). */
export const STANCE_TAIL: Record<Stance, string[]> = {
  worshipper: ["he can't lose", "still the goat", "haters will spin this", "he's untouchable"],
  fan: ["kinda wild", "lowkey funny", "still rooting for him", "this is so him"],
  memer: ["meme incoming", "someone make the edit", "the template writes itself", "adding to the lore"],
  analyst: ["wait for actual sources", "interesting if true", "numbers don't add up yet", "watch how his camp responds"],
  skeptic: ["source?", "doubt it", "convenient timing", "screenshots aren't proof"],
  hater: ["called it", "fell off", "this is the real him", "wake up people"],
  jealous: ["must be nice", "of course he gets away with it", "lucky guy as usual"],
  conspiracist: ["it's connected", "look at the timing", "nothing is random", "distraction from something bigger"],
  indifferent: ["anyway", "ok", "not my business", "whatever"],
};

/** Category specific openers (stance-neutral, styled later). */
export const CAT_OPEN: Record<string, string[]> = {
  island: ["{god} bought an ISLAND. {subj}. an actual island", "{subj} is his now. the whole island", "who's getting invited to {subj} first", "the {subj} drone footage is unreal", "imagine having your own island named {subj} {laugh}"],
  property: ["{god} picked up {subj}, reportedly {amt}", "the {subj} listing photos are insane", "{subj} has a garage bigger than my apartment complex", "{amt} for {subj} is crazy"],
  jet: ["{god} has a new jet: {subj}", "the {subj} cabin photos leaked and it has a bedroom bigger than my flat", "{subj} spotted taxiing already", "{amt} jet. flying privately is not enough, he flies privately-er"],
  vehicle: ["{god} just got the {subj}", "{subj} delivered today apparently", "{subj} for {amt}. in this economy", "the {subj} spec is ridiculous"],
  business: ["{god} launched {subj}", "{subj} is the new {god} company and it's already hiring", "{subj} valuation rumors are already flying", "is {subj} actually a good business or just a {god} thing"],
  coin: ["{god} launched a coin. ${coin}. money printer go brrr", "${coin} chart is doing things", "who aped ${coin}", "${coin} holders are either geniuses or exit liquidity, no in between", "${coin} at {amt} market cap already??"],
  investment: ["{god} put {amt} into {subj}", "{amt} into {subj} is a statement", "{subj} after the {god} money hits: 📈", "everyone is suddenly an expert in {subj}"],
  hire: ["{god} hired {n} people for {subj}", "{subj} just went on a hiring spree", "imagine your boss is {god}", "i applied to {subj} in 3 minutes flat"],
  organization: ["{god} started {subj}", "{subj} mission statement is actually decent", "{subj} already has a waitlist", "what even is {subj}"],
  event: ["{god} is hosting {subj}", "the {subj} guest list is going to be insane", "{subj} invites going out and i didn't get one, devastated", "how do you even get into {subj}"],
  announcement: ["{god} just posted: \"{subj}\"", "did yall see the announcement. \"{subj}\"", "\"{subj}\" is all he said and the internet is melting", "the {god} announcement has 4 different interpretations already"],
  controversy: ["{god} really said \"{subj}\" huh", "the \"{subj}\" thing is not going away", "{god} vs the internet over \"{subj}\", round 1", "people are big mad about \"{subj}\""],
  account: ["{god} made a new account: {subj}", "{subj} already has more followers than me lol", "first post from {subj} is wild"],
  chat: ["HE TYPED IN CHAT", "{god} just said \"{subj}\" in #{ch} {laugh}", "god is online. everybody act normal", "screenshot this, {god} said \"{subj}\""],
  rumor: ["heard {subj}, anyone confirm?", "{label} is everywhere", "{subj}?? if true that's huge", "my cousin's friend says {subj}", "ok {label} is getting louder"],
  allegation: ["anon account claims {subj}. no evidence yet", "{label} is spreading fast", "people really believe {subj} with zero proof", "so {label} has 2M views now"],
  leak: ["someone leaked {subj}", "{label} is either fake or disastrous", "who leaked {subj}", "{label} is the funniest thing this week"],
  viral: ["{label} is at {n}M views", "{label} is the most viral thing on Chirp today", "everyone is quote-posting {label}"],
  collab: ["{god} x {celeb}??", "{celeb} and {god} collab is not on my bingo card", "the {celeb} collab is going to break the internet"],
  acquisition: ["someone offered {amt} for {subj}", "{subj} buyout rumors heating up", "{god} turned down {amt}? or took it?"],
  interview: ["{god} interview with {outlet} is out", "the {outlet} interview clip where {god} smirks", "best quote from the {outlet} interview: \"{subj}\""],
  mention: ["{celeb} just mentioned {god}", "{celeb} said {god}'s name on stream", "{celeb} vs {god} beef incoming?"],
  // the player's paper trades (Kiteline), as the world sees them
  trade: ["{god} just aped {amt} into {subj} 👀", "{god} bought {subj}. i'm following", "wait {god} is in {subj}??", "{amt} into {subj} is crazy conviction", "{god} buying {subj} here is either genius or a donation",
    "screenshot this: {god} entered {subj}", "if {god} is in {subj} i'm in", "{subj} about to get the {god} effect", "not {god} buying {subj} after everyone said it's dead", "fading {god}'s {subj} buy, sorry", "{god} bought {subj} and i bought the top of {god}'s buy 💀", "who else saw {god} grab {subj}"],
  tradeWin: ["{god} just took {amt} profit on {subj} 😭", "{god} sold {subj} for a W. teach me", "{subj} paid {god}, again", "imagine being up {amt} on {subj} like {god}", "{god} called {subj} and actually took profit. respect", "{god} out of {subj} green. i'm still holding mine lol"],
  tradeLoss: ["{god} just ate a {amt} loss on {subj} 💀", "{god} sold {subj} red. it happens", "even {god} got cooked by {subj}", "{subj} took {amt} from {god}. pour one out", "{god} panic sold {subj}? lol", "{god} cutting {subj} at a loss is actually discipline"],
};

/** World (non-god) topics. */
export const WORLD_OPEN: Record<string, string[]> = {
  celebrity: ["{celeb} {subj}", "did yall see {celeb} {subj}", "{celeb} really {subj} {laugh}", "the {celeb} thing is all over my feed", "nobody's talking about god today, it's all {celeb}", "{celeb} {subj} and i have so many questions"],
  crypto: ["{label}", "${coin} {subj}", "anyone else watching ${coin} rn", "${coin} is the only thing i care about today", "${coin} holders right now: {laugh}"],
  gaming: ["{subj}", "the {subj} thing is crazy", "patch day and {subj}", "{subj}?? my main is dead"],
  tech: ["{subj}", "the {subj} launch event was so awkward", "{subj} and the replies are brutal"],
  sports: ["{subj}", "did anyone watch? {subj}", "{subj}. i'm devastated"],
  meme: ["the {subj} meme is everywhere", "who started {subj} {laugh}", "i can't escape {subj}"],
  markets: ["{subj}", "markets doing {subj} today", "portfolio after {subj}: 📉"],
  drama: ["{subj}", "the {subj} drama is unreal", "grabbing popcorn for {subj} 🍿"],
};

export const PERSONAL = [
  "just got off a 12 hour shift", "my cat knocked my monitor over again", "anyone else's wifi dying rn", "rent went up AGAIN", "what are yall eating tonight", "exam tomorrow and i'm here",
  "gym was packed today", "landlord texted 'we need to talk' 😬", "made pasta from scratch, 10/10", "my boss scheduled a meeting at 4:55 pm on a friday", "can't sleep", "coffee #4",
  "finally fixed my sleep schedule (it's 3am)", "dog ate my airpod", "first day at the new job tomorrow", "my mom just discovered stickers in texting", "it's raining sideways here", "bus never came",
  "sold my old gpu, feeling rich", "just watched the worst movie of my life", "my code works and i don't know why", "should i get a haircut or is that a mistake", "who's up", "lost my keys inside my own house",
  "im so tired", "my sister got engaged!!", "ordered food 2 hours ago where is it", "learning guitar, fingers are destroyed", "back from vacation and my inbox is a crime scene", "tried meditating, thought about tacos the whole time",
  "monday feels illegal", "just ran 5k without dying", "group project and i'm doing everything as usual", "power went out for 3 hours lol", "i think my neighbor is learning drums", "new keyboard arrived, clack clack",
];

export const REPLY: Record<string, string[]> = {
  agree: ["real", "this", "fr", "fr fr", "facts", "^", "100%", "exactly", "say it louder", "W take", "couldn't have said it better", "literally what i said yesterday", "based", "no notes", "you get it", "THIS", "real and true", "yep", "true", "ong"],
  disagreeFan: ["jealousy is a disease", "say that to his net worth", "imagine hating a man who doesn't know you exist", "stay mad", "why are you even here then", "cope", "the haters are louder than usual today {laugh}", "ratio", "he lives in your head rent free", "you'd glaze too if you had any taste", "bro is MAD mad"],
  disagreeHater: ["nah you're glazing", "the glaze is unreal", "he's literally mid", "touch grass", "you'd defend him if he set the server on fire", "ok and?", "this is so delulu", "bro thinks he's in the will {laugh}", "parasocial much", "he doesn't know you exist", "imagine simping this hard"],
  disagreeNeutral: ["idk about that", "hard disagree", "that's a stretch", "nah", "eh", "i don't think that's how it works", "source?", "respectfully no", "that's not what happened tho", "wrong but go off"],
  joke: ["{laugh}", "not the {subj} {laugh}", "this server is a sitcom", "chat is cooked", "i'm crying", "{god} reading this chat rn: 🧍", "screenshotting this", "hall of fame material", "the way i just spat out my drink", "LMAOOO", "bro typed that with his whole chest"],
  question: ["wait what happened", "context?", "who is god and why is he in my notifications", "is this real or a bit", "how much is that in normal money", "did i miss something", "what's going on in here", "sorry just got here, what did he do", "is this the {subj} thing?"],
  answerNone: ["no idea", "idk tbh", "same question lol", "good question", "nobody knows"],
  answer: ["{label}, keep up {laugh}", "scroll up lol", "check #god-news", "basically {label}", "it's real, {outlet} covered it", "{label}. yes really", "long story. {label}", "google it lol. oh wait you can't, just scroll"],
  pileon: ["LMAOOO", "not the {subj} 💀", "he's done", "the replies are brutal", "😭😭😭", "chat is cooked", "nah this is too funny", "the timeline is eating", "{laugh} {laugh}", "everybody's dunking", "it's over for him", "pack it up"],
  followup: ["wait", "like actually", "nvm", "ok i'm done", "also", "and nobody's talking about {subj}??", "lmao", "sorry i'm heated", "anyway", "like i'm serious", "and another thing", "ok one more thing", "brb"],
  memory: ["this is {past} all over again", "remember {past}? same energy", "yall said the same thing about {past}", "{past} flashbacks", "after {past} nothing surprises me", "still not over {past} tbh"],
  mod: ["keep it civil", "take it to dms please", "moving this to #memes", "last warning to both of you", "no personal attacks pls", "please keep #{ch} on topic", "chill. both of you", "ok this thread is done", "slowmode on for 5 min"],
  backup: ["@{user} is right tho", "listen to {user}", "+1 to what {user} said", "{user} said it best", "what {user} said"],
  drift: ["anyway did anyone see {world}", "unrelated but: {personal}", "ok changing topic, {world} is crazy", "can we talk about {world} instead", "meanwhile {world} and nobody cares"],
  godReply: ["HE REPLIED", "{god} spoke 🙏", "omg he's here", "act natural guys", "screenshotting before he deletes", "god is in the chat {laugh}", "W god", "@god notice me", "he's online!!", "god's typing is a blessing"],
  godReplyHater: ["oh look who showed up", "ratio'd by a server of nobodies", "lol he reads this", "even his chat messages are mid", "pr team typing", "nobody asked"],
};

/** Older / formal voices don't say "ong" (research §2). */
export const POLITE: Record<string, string[]> = {
  agree: ["Agreed", "Exactly right", "Well said", "Fair point", "This is the correct take", "Couldn't agree more", "Yes", "True"],
  joke: ["Ha!", "That's hilarious", "I laughed out loud", "Oh dear", "Priceless"],
  pileon: ["That's brutal", "Oof", "He's not recovering from this one", "The replies are something else"],
  backup: ["{user} makes a good point", "I'm with {user} on this", "What {user} said"],
};

export const BOT_LINES = [
  "GG @{user}, you just advanced to **level {n}**!", "⭐ A message from @{user} hit the starboard ({n} ⭐)", "📊 Poll: Is {label} a W? React ✅ or ❌", "👋 Welcome @{user}! Read #rules and say hi.",
];

/** Chirp (X-like) posts. Longer, hashtags, quote-able. */
export const CHIRP_GOD: Record<Stance, string[]> = {
  worshipper: ["{god} is playing life on creative mode and we're all in survival 😭 {tag}", "Day {n} of saying {god} is the most important person on the internet. {label} only proves it. {tag}", "If you're not paying attention to {label} you're NGMI {tag} 🐐", "{god} did {label} before most of you opened your eyes this morning {tag}"],
  fan: ["ngl {label} is the most entertaining thing on my timeline {tag}", "{label} is why I keep my notifications on for {god} {tag}", "{label}. Honestly respect it. {tag}"],
  memer: ["{god} after {label}: 'it was a small purchase' 🧍 {tag}", "pov: your accountant finds out about {label} {tag}", "me: buys {thing}\n{god}: {label}\n\nwe are not the same {tag}"],
  analyst: ["Thread on {label} 🧵\n1/ The reported {amt} figure is unverified.\n2/ Even if true, it's a small share of estimated holdings.\n3/ The signal matters more than the spend. {tag}", "Quick math on {label}: aggressive, not irrational. {tag}", "Everyone's reacting to {label}. Few are reading the details. {tag}"],
  skeptic: ["Has anyone independently confirmed {label}? Genuine question. {tag}", "{label} trending off one post and 40 fan accounts. Be careful. {tag}"],
  hater: ["Unpopular opinion: {label} is the most overrated news of the year {tag}", "{god} does {label} and the glazers act like he cured something {tag} 🤡", "Imagine thinking {label} is impressive. {tag}"],
  jealous: ["Cool, {label}. Some of us are figuring out groceries. {tag}", "Not to be that person but {label} could've funded a lot of things {tag}"],
  conspiracist: ["{label} is a distraction. Check what else dropped today. {tag} 👁️", "Nobody connecting {label} to the last move? {tag}"],
  indifferent: ["My whole feed is {label} and I still don't get it {tag}", "{label} is trending, ok, can I see my friends' posts now {tag}"],
};

export const CHIRP_LIFE = [
  "hot take: breakfast for dinner is elite", "just finished a 10 hour shift, what did I miss", "my landlord is the final boss", "I love when my code works on the first try (it never does)", "the gym at 6am is a different society",
  "rating my day: 6/10, coffee carried", "city's been grey for a week, I'm becoming a ghost", "spent 40 minutes choosing a show and then went to sleep", "unpopular opinion: voice notes over 1 minute should be illegal", "cooked tonight. nobody died.",
];

/** News headlines by kind. */
export const HEADLINES: Record<string, string[]> = {
  breaking: ["BREAKING: @god {headverb} {hsubj}", "BREAKING: @god {headverb} {hsubj} in reported {amt} move", "JUST IN: @god {headverb} {hsubj}", "BREAKING: Internet reacts as @god {headverb} {hsubj}"],
  report: ["@god {headverb} {hsubj}: what we know so far", "Inside the {label}: sources, numbers and reactions", "How the {label} unfolded, hour by hour", "@god's {label} sends {tag} to #1 on Chirp"],
  financial: ["@god reportedly adds {gain} to fortune after {label}", "Markets weigh 'God effect' after {label}", "By the numbers: the {label}", "Analysts split on what the {label} means for @god's empire"],
  opinion: ["Opinion: The {label} tells us everything about our era", "Opinion: Nobody needs {hsubj}. @god bought it anyway.", "Opinion: Stop glazing. The {label} is just money.", "Opinion: Love him or hate him, the {label} was a masterstroke"],
  rumor: ["Rumor mill: Is the {label} bigger than reported?", "Unconfirmed: insiders say the {label} was months in the making", "Fans think the {label} hints at something bigger"],
  interview: ["'I didn't expect this': a GOD HQ moderator on the {label}", "We asked {n} fans about the {label}. Here's what they said", "A longtime critic explains why the {label} doesn't impress them"],
  investigation: ["Investigation: The numbers behind the {label} don't fully add up", "Following the money: who benefits from the {label}?"],
};

export const WORLD_HEADLINES = ["{celeb} {subj}", "{subj}: what happened", "The internet can't stop talking about {subj}", "Why {subj} matters more than you think"];
