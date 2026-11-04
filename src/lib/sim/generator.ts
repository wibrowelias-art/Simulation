import type { Rng } from "./rng";
import type { Article, ArticleKind, Character, Channel, Outlet, Server, Topic, WorldState } from "./types";
import { expand, type Slots } from "./grammar";
import { styleText } from "./style";
import { fmtMoney } from "./format";
import { CAT_OPEN, CHIRP_GOD, CHIRP_LIFE, CMP, GOD_OPEN, HEADLINES, PERSONAL, POLITE, REPLY, STANCE_TAIL, THING, WORLD_OPEN } from "./templates";
import { EMOJI_HYPE, EMOJI_LAUGH, EMOJI_SHADE } from "./data";
import { actionDef, type ActionKind } from "./topics";
import { ambientLine } from "./godspeak";
import { lifeLine } from "./life";

export type Intent =
  | "open" | "personal" | "inside" | "agree" | "disagreeFan" | "disagreeHater" | "disagreeNeutral" | "joke" | "question" | "answer"
  | "pileon" | "followup" | "memory" | "mod" | "backup" | "drift" | "godReply" | "godReplyHater" | "fix" | "ambient";

export interface ChatCtx {
  rng: Rng;
  state: WorldState;
  speaker: Character;
  intent: Intent;
  topic?: Topic;
  target?: Character;
  server: Server;
  channel: Channel;
  t: number;
  typoWord?: string;
}

export interface PostCtx { rng: Rng; state: WorldState; author: Character; topic?: Topic; t: number; platform: string }
export interface ArticleCtx { rng: Rng; state: WorldState; outlet: Outlet; topic: Topic; kind: ArticleKind; t: number; quotes: { who: Character; text: string; where: string }[] }

/**
 * Pluggable content generator. The default is a deterministic template grammar.
 * An LLM-backed generator could implement the same interface (e.g. rewriting text
 * from these contexts) without touching the engine. Must be deterministic for a
 * given rng state to keep catch-up reproducible.
 */
export interface ContentGenerator {
  id: string;
  chat(ctx: ChatCtx): { text: string; typoWord?: string; clean?: string; life?: boolean };
  /** optional: rewrite a reaction line to @god (an LLM could implement this); must stay deterministic for a given rng */
  react?(ctx: { rng: Rng; state: WorldState; speaker: Character; draft: string; godText: string }): string;
  post(ctx: PostCtx): { text: string; title?: string };
  article(ctx: ArticleCtx): Pick<Article, "headline" | "dek" | "body">;
}

const young = (c: Character) => c.voice === "zoomer" || c.voice === "lowercase" || c.voice === "terse" || c.voice === "emoji" || c.voice === "caps";

export function slotsFor(rng: Rng, state: WorldState, c: Character | undefined, topic?: Topic, extra: Slots = {}): Slots {
  const celeb = topic?.celebrityId ? state.characters[Number(topic.celebrityId.slice(1))]?.displayName : topic?.facts.celeb;
  const hotWorld = state.topics.filter((x) => x.about === "world" && x.heat > 1);
  return {
    god: () => (c && young(c) ? rng.pick(["god", "god", "bro", "this man", "@god", "him", "the goat"]) : c && (c.voice === "formal" || c.voice === "proper") ? rng.pick(["@god", "God", "he"]) : rng.pick(["god", "@god", "God", "the guy"])),
    label: topic?.label ?? "all this",
    subj: topic?.subject ?? topic?.label ?? "this",
    amt: topic?.amount ? fmtMoney(topic.amount) : rng.pick(["$400M", "a billion", "$2B", "$80M"]),
    tag: topic ? `#${topic.tag}` : "",
    coin: topic?.facts.coin ?? topic?.facts.ticker ?? "GOD",
    celeb: celeb || "some celeb",
    cmp: () => rng.pick(CMP),
    thing: () => rng.pick(THING),
    n: () => String(rng.int(2, 60)),
    outlet: () => rng.pick(state.outlets).name,
    day: () => ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][new Date(topic?.startedAt ?? 0).getDay()],
    laugh: () => (c && !young(c) ? rng.pick(["lol", "haha", "😂", "LOL"]) : rng.pick(c?.emojis.filter((e) => EMOJI_LAUGH.includes(e)).length ? c.emojis.filter((e) => EMOJI_LAUGH.includes(e)) : EMOJI_LAUGH)),
    hype: () => rng.pick(EMOJI_HYPE),
    shade: () => rng.pick(EMOJI_SHADE),
    world: () => (hotWorld.length ? rng.pick(hotWorld).label : rng.pick(PERSONAL)),
    personal: () => rng.pick(PERSONAL),
    ...extra,
  };
}

export const TemplateGenerator: ContentGenerator = {
  id: "template-grammar-v1",
  chat(ctx) {
    const { rng, speaker: c, topic, intent, target, channel, server } = ctx;
    const past = c.memory.filter((m) => m.topicId !== topic?.id);
    const slots = slotsFor(rng, ctx.state, c, topic, {
      user: target?.username ?? "someone",
      ch: channel.name,
      server: server.name,
      past: past.length ? rng.pick(past).label : rng.pick(server.insideJokes),
    });
    let tpl: string;
    switch (intent) {
      case "open":
        if (!topic) { tpl = rng.pick(PERSONAL); break; }
        if (topic.about === "world") { tpl = rng.pick(WORLD_OPEN[topic.category] ?? WORLD_OPEN.drama); break; }
        if (!topic.facts.action && CAT_OPEN[topic.category] && rng.chance(0.75)) tpl = (() => { const base = rng.pick(CAT_OPEN[topic.category]); return rng.chance(0.55) ? `${base}${/[?!]$/.test(base) ? " " : rng.pick([". ", ", ", " "])}${rng.pick(STANCE_TAIL[c.stance])}` : base; })();
        else tpl = CAT_OPEN[topic.category] && rng.chance(0.35) ? rng.pick(CAT_OPEN[topic.category]) : rng.pick(GOD_OPEN[c.stance]);
        break;
      case "personal": {
        // people mostly talk about what's actually going on in their life right now
        const ll = c.life && rng.chance(0.65) ? lifeLine(rng, c) : undefined;
        if (ll) return { ...styleText(rng, c, ll, { short: false }), life: true };
        tpl = rng.pick(PERSONAL);
        break;
      }
      case "ambient": return styleText(rng, c, ambientLine(ctx.state, rng, c), { short: true });
      case "inside": tpl = rng.pick([`{?remember }${rng.pick(server.insideJokes)}{? lmao| 😭| lol|}`, `not ${rng.pick(server.insideJokes)} again`, `this is giving ${rng.pick(server.insideJokes)}`]); break;
      case "fix": tpl = `*${ctx.typoWord ?? "that"}`; break;
      case "answer": tpl = rng.pick(topic ? REPLY.answer : REPLY.answerNone); break;
      case "question": tpl = rng.pick(topic ? REPLY.question : ["wait what", "huh", "?", "what"]); break;
      default: tpl = (c.voice === "formal" || c.voice === "proper" || c.voice === "boomer") && POLITE[intent] && rng.chance(0.8) ? rng.pick(POLITE[intent]) : rng.pick(REPLY[intent] ?? REPLY.agree);
    }
    let raw = expand(tpl, slots, rng);
    if (target && intent !== "backup" && intent !== "fix" && rng.chance(intent.startsWith("disagree") ? 0.3 : 0.12)) raw = `@${target.username} ${raw}`;
    if (intent === "fix") return { text: raw };
    const short = intent !== "open" && intent !== "personal";
    if (intent === "mod") {
      const s = raw[0].toUpperCase() + raw.slice(1);
      return { text: /[.!?]$/.test(s) ? s : s + "." };
    }
    return styleText(rng, c, raw, { short });
  },
  post(ctx) {
    const { rng, author: c, topic, platform } = ctx;
    const slots = slotsFor(rng, ctx.state, c, topic);
    let tpl: string;
    if (!topic) tpl = rng.pick(CHIRP_LIFE);
    else if (topic.about === "god") tpl = rng.chance(0.7) ? rng.pick(CHIRP_GOD[c.stance]) : rng.pick(GOD_OPEN[c.stance]) + " {tag}";
    else tpl = rng.pick(WORLD_OPEN[topic.category] ?? WORLD_OPEN.drama) + " {tag}";
    let text = expand(tpl, slots, rng);
    if (c.voice === "zoomer" || c.voice === "lowercase") text = styleText(rng, c, text, { allowTypo: false }).text;
    let title: string | undefined;
    if (platform === "threadit") title = topic ? expand(rng.pick(["[Discussion] {label}", "Can we talk about {label}?", "{label} megathread", "Unpopular opinion about {label}", "Serious question about {label}"]), slots, rng) : expand(rng.pick(["What's something small that made your week?", "Rate my setup", "Anyone else exhausted lately?"]), slots, rng);
    if (platform === "tubeverse") title = topic ? expand(rng.pick(["I Tried Living Like @god For 24 Hours", "{label} EXPLAINED (it's worse than you think)", "Reacting to {label}", "The TRUTH About {label}", "Why Everyone Is Talking About {tag}"]), slots, rng) : expand(rng.pick(["Day in my life (realistic)", "I Tested Every Fast Food Fries", "My Honest Setup Tour 2026"]), slots, rng);
    if (platform === "snapgram") text = expand(rng.pick(["{?living my best life }✨ {tag}", "{label} has me thinking big {hype}", "weekend mood {hype}", "felt cute, might glaze later {tag}", "not me recreating {label} on a budget {laugh}"]), slots, rng);
    if (platform === "clipz") text = expand(rng.pick(["pov: you just heard about {label} {laugh}", "rating {label} out of 10 {tag}", "this sound + {label} 😭 {tag}", "{god} speedrun compilation {tag}", "day {n} of reacting to {label}"]), slots, rng);
    if (platform === "wire") text = expand(rng.pick(["📡 {label}. Thread below.", "Channel update: {label}", "⚡ Quick alpha: {label}", "Pinned: everything we know about {label}"]), slots, rng);
    return { text, title };
  },
  article(ctx) {
    const { rng, outlet, topic, kind, quotes } = ctx;
    const def = topic.about === "god" && (topic.facts.action as ActionKind | undefined) ? actionDef(topic.facts.action as ActionKind) : undefined;
    const slots = slotsFor(rng, ctx.state, undefined, topic, {
      headverb: def?.verb ?? ({ rumor: "is rumored to", allegation: "faces claims", leak: "hit by leak", viral: "goes viral", mention: "gets called out" } as Record<string, string>)[topic.category] ?? "makes waves with",
      hsubj: topic.subject ?? topic.label,
      gain: topic.amount ? fmtMoney(topic.amount * rng.range(0.05, 0.4)) : "millions",
    });
    let headline: string;
    const L = topic.label[0].toUpperCase() + topic.label.slice(1);
    if (topic.about === "world") headline = rng.pick([L, `${L}: what happened`, `The internet can't stop talking about ${topic.label.replace(/^the /, "how the ")}`, `Why "${topic.label}" took over the timeline`]);
    else headline = expand(rng.pick(HEADLINES[kind] ?? HEADLINES.report), slots, rng);
    if (topic.about === "god" && !def && kind === "breaking") headline = `BREAKING: ${topic.label[0].toUpperCase()}${topic.label.slice(1)}`;
    const amt = topic.amount ? fmtMoney(topic.amount) : undefined;
    const dek = expand(rng.pick([
      "The internet's main character did it again. Here's how the timeline reacted.",
      "Fans call it legendary. Critics call it excess. Everyone's talking.",
      `${amt ? `A reported ${amt}. ` : ""}Servers lit up within minutes.`,
      "What happened, who's mad, and what it means.",
      "It started with one post. Then everything moved at once.",
    ]), slots, rng);
    const body: string[] = [];
    body.push(expand(topic.about === "god"
      ? rng.pick([`@god ${slots.headverb} ${slots.hsubj}${amt ? `, in a move reportedly valued at ${amt}` : ""}, setting off a wave of reactions across Chirp, Lounge servers and fan communities.`,
        `It took less than ten minutes for {tag} to trend after @god ${slots.headverb} ${slots.hsubj}.`,
        `In the latest chapter of the internet's favorite storyline, @god ${slots.headverb} ${slots.hsubj}.`])
      : `${L}. The story spread quickly from Chirp to Lounge servers, where reactions ranged from delight to exhaustion.`, slots, rng));
    if (topic.about === "world") body.push(rng.pick([
      `By the afternoon, #${topic.tag} had picked up its own vocabulary: inside jokes, a copypasta, and at least one fan account dedicated to the saga.`,
      `Several large accounts weighed in, though as usual the most-liked replies were jokes rather than analysis.`,
      `Not everyone is interested. "${rng.pick(["i have a job", "who asked", "this is the dumbest week online"])}," one reply with thousands of likes reads.`,
      `${outlet.name} reviewed hundreds of posts on the topic; roughly half were memes.`,
    ]));
    if (amt) body.push(rng.pick([`${outlet.name} could not independently verify the ${amt} figure. Representatives for @god did not respond to a request for comment.`, `The ${amt} number, first floated by fan accounts, has since been repeated by several outlets.`, `For scale: ${amt} is more than most people will earn in ${Math.round(rng.range(200, 4000))} lifetimes.`]));
    const q = quotes.slice(0, 3);
    for (const x of q) body.push(`"${x.text}," wrote ${x.who.displayName} (@${x.who.username}), ${rng.pick(["a member of", "posting in", "a regular in"])} ${x.where}.`);
    body.push(kind === "opinion"
      ? rng.pick(["Whatever you think of him, the reaction says more about us than about him.", "We have to ask why one person's purchases occupy this much of our collective attention.", "Love it or hate it, it worked: everyone is looking."])
      : kind === "financial" || kind === "investigation" ? rng.pick(["Analysts say the move fits a pattern of high-visibility spending that tends to precede new ventures.", "Questions remain about how the deal was structured.", "Markets shrugged, then didn't."])
      : rng.pick(["This is a developing story.", "We'll update this article as more details emerge.", "Fans are already speculating about what comes next."]));
    return { headline, dek, body };
  },
};

let current: ContentGenerator = TemplateGenerator;
export const getGenerator = () => current;
export const setGenerator = (g: ContentGenerator) => { current = g; };
