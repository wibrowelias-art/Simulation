/**
 * Characters' own lives: short arcs (exams, a job hunt, a breakup, a game grind...) that move forward over days of
 * sim time and show up in what they say. Seeded per character, so the same world tells the same stories.
 */
import { rngFor, type Rng } from "./rng";
import type { Character, LifeState, WorldState } from "./types";
import { nudgeMood, rememberLong } from "./memory";

const HOUR = 3_600_000, DAY = 24 * HOUR;

interface Stage { label: string; lines: string[]; days: [number, number]; mood: number }
interface Arc { id: string; fits: (c: Character) => boolean; vars: (r: Rng) => Record<string, string>; stages: Stage[]; ends?: { label: string; lines: string[]; mood: number; memory: string }[] }

const SUBJECTS = ["chem", "stats", "calc", "bio", "econ", "history", "orgo", "physics"];
const COMPANIES = ["Lumen Logistics", "Halcyon Bank", "a tiny game studio", "Brightloop", "the new cafe downtown", "Northwind Health", "a startup that sells socks", "the city library"];
const GAMES = ["Rift Arena", "Pixel Legends", "Starfall Tactics", "Kart Riot", "Hollowcrest", "Deadline Drift"];
const RANKS = ["diamond", "platinum", "master", "top 500", "gold finally"];
const PLACES = ["Port Aurelia", "Glasshaven", "the coast", "a smaller town", "Novagrad", "across the country"];
const PETS: [string, string[]][] = [["cat", ["Mochi", "Beans", "Toast", "Pickle", "Nugget"]], ["dog", ["Biscuit", "Waffles", "Moose", "Pepper", "Taco"]], ["frog", ["Kermie", "Lily", "Sir Hops"]]];
const STUFF = ["stickers", "candles", "crochet hats", "custom keycaps", "phone charms", "hot sauce"];

const ARCS: Arc[] = [
  { id: "exams", fits: (c) => c.age <= 25, vars: (r) => ({ subject: r.pick(SUBJECTS) }),
    stages: [
      { label: "studying for a {subject} final", days: [1, 3], mood: -0.15, lines: ["can't talk, studying for my {subject} final", "{subject} final in 3 days and i know nothing", "why did i pick {subject}", "library till midnight again 📚", "if anyone understands {subject} pls dm me"] },
      { label: "exam week ({subject} final tomorrow)", days: [1, 1], mood: -0.35, lines: ["{subject} exam tomorrow i'm cooked", "pray for me tomorrow 🙏 {subject} final", "studied 9 hours today and i still don't get it", "if i fail {subject} i'm moving to the woods"] },
      { label: "waiting on {subject} results", days: [1, 2], mood: -0.1, lines: ["results come out this week 😬", "keep refreshing the grade portal", "that {subject} exam was so much worse than the practice one"] },
    ],
    ends: [
      { label: "passed the {subject} final", lines: ["I PASSED {subject} 😭😭", "passed {subject}!! barely but it counts", "we passed. we're so back"], mood: 0.6, memory: "passed my {subject} final" },
      { label: "failed the {subject} final", lines: ["failed {subject}. retaking it next term i guess", "don't ask about {subject}. please", "well {subject} didn't go great"], mood: -0.5, memory: "failed my {subject} final" },
    ] },
  { id: "jobhunt", fits: (c) => c.age >= 18 && c.age <= 45, vars: (r) => ({ company: r.pick(COMPANIES) }),
    stages: [
      { label: "applying for jobs", days: [1, 3], mood: -0.1, lines: ["sent 14 applications today, 0 replies", "job hunting is a full time job fr", "rewrote my resume for the 5th time"] },
      { label: "has an interview at {company}", days: [1, 2], mood: 0.1, lines: ["got an interview at {company}!!", "interview at {company} tomorrow, what do i wear", "practicing interview answers to my cat"] },
    ],
    ends: [
      { label: "just got a job at {company}", lines: ["I GOT THE JOB at {company} 🎉", "start at {company} on monday!!", "officially employed at {company}"], mood: 0.7, memory: "got hired at {company}" },
      { label: "didn't get the {company} job", lines: ["{company} said no 💀", "didn't get it. on to the next one", "rejected by {company}, it's fine (it's not fine)"], mood: -0.4, memory: "got rejected by {company}" },
    ] },
  { id: "breakup", fits: (c) => c.age >= 17, vars: () => ({}),
    stages: [
      { label: "just went through a breakup", days: [1, 3], mood: -0.6, lines: ["we broke up. don't wanna talk about it", "it's fine i'm fine 🙂", "deleting all the pics rn", "ice cream for dinner tonight"] },
      { label: "getting over a breakup", days: [2, 4], mood: -0.15, lines: ["ok i'm doing a little better", "went out with friends, felt normal again", "new haircut, new me"] },
    ],
    ends: [{ label: "over the breakup", lines: ["genuinely happy rn. healing arc complete", "i'm so over it. thriving actually"], mood: 0.4, memory: "got through a rough breakup" }] },
  { id: "grind", fits: (c) => c.interests.includes("gaming") || c.age < 30, vars: (r) => ({ game: r.pick(GAMES), rank: r.pick(RANKS) }),
    stages: [
      { label: "grinding ranked in {game}", days: [1, 3], mood: 0.05, lines: ["one more {game} match then bed (lie)", "lost 6 in a row in {game} i'm uninstalling", "carried my whole team in {game} today", "anyone wanna duo {game}"] },
      { label: "almost {rank} in {game}", days: [1, 2], mood: 0.2, lines: ["2 wins from {rank} in {game}!!", "so close to {rank} it hurts"] },
    ],
    ends: [{ label: "hit {rank} in {game}", lines: ["HIT {rank} IN {game} 🏆", "{rank}. finally. i can rest"], mood: 0.6, memory: "hit {rank} in {game}" }] },
  { id: "moving", fits: (c) => c.age >= 19, vars: (r) => ({ place: r.pick(PLACES) }),
    stages: [
      { label: "packing to move to {place}", days: [1, 3], mood: -0.1, lines: ["boxes everywhere, moving to {place} friday", "why do i own so many cables", "packing is a nightmare"] },
      { label: "just moved to {place}", days: [1, 3], mood: 0.2, lines: ["first night in the new place in {place}", "no wifi yet at the new place, typing from my phone", "{place} recs anyone?"] },
    ],
    ends: [{ label: "settled in {place}", lines: ["ok {place} is growing on me"], mood: 0.3, memory: "moved to {place}" }] },
  { id: "pet", fits: () => true, vars: (r) => { const [kind, names] = r.pick(PETS); return { pet: kind, petname: r.pick(names) }; },
    stages: [
      { label: "just adopted a {pet} named {petname}", days: [1, 3], mood: 0.4, lines: ["I ADOPTED A {pet}. her name is {petname}", "{petname} is asleep on my keyboard", "{petname} update: still perfect"] },
      { label: "raising {petname} the {pet}", days: [2, 4], mood: 0.2, lines: ["{petname} chewed my charger", "{petname} woke me up at 5am", "vet trip with {petname} today 😭"] },
    ],
    ends: [{ label: "has a {pet} named {petname}", lines: ["{petname} has fully taken over the apartment"], mood: 0.2, memory: "adopted a {pet} called {petname}" }] },
  { id: "hustle", fits: (c) => c.age >= 16, vars: (r) => ({ stuff: r.pick(STUFF) }),
    stages: [
      { label: "starting a side hustle selling {stuff}", days: [1, 3], mood: 0.15, lines: ["started selling {stuff} online!!", "first {stuff} order came in 😭", "if anyone wants {stuff} i'm taking orders"] },
      { label: "swamped with {stuff} orders", days: [1, 2], mood: -0.05, lines: ["made {stuff} till 2am", "my whole room is {stuff} now"] },
    ],
    ends: [{ label: "runs a small {stuff} shop", lines: ["sold out of {stuff} lol", "my {stuff} shop made rent this month"], mood: 0.5, memory: "started a {stuff} shop" }] },
  { id: "sick", fits: () => true, vars: () => ({}),
    stages: [{ label: "sick in bed with a cold", days: [1, 2], mood: -0.3, lines: ["sick in bed, entertain me", "my throat is sandpaper", "day 2 of being sick, soup era"] }],
    ends: [{ label: "over the cold", lines: ["finally not sick anymore"], mood: 0.2, memory: "had a nasty cold" }] },
];

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_m, k: string) => v[k] ?? k);
const arcOf = (id: string) => ARCS.find((a) => a.id === id);

/** what's going on in their life right now, as a short phrase (undefined if nothing) */
export function lifeLabel(c: Character): string | undefined {
  const l = c.life;
  const arc = l && arcOf(l.arc);
  if (!l || !arc) return undefined;
  const st = arc.stages[l.stage];
  return st ? fill(st.label, l.vars) : l.end !== undefined && arc.ends ? fill(arc.ends[l.end].label, l.vars) : undefined;
}

/** a chat line about their own life, or undefined */
export function lifeLine(rng: Rng, c: Character): string | undefined {
  const l = c.life;
  const arc = l && arcOf(l.arc);
  if (!l || !arc) return undefined;
  const st = arc.stages[l.stage];
  const lines = st ? st.lines : l.end !== undefined && arc.ends ? arc.ends[l.end].lines : undefined;
  return lines ? fill(rng.pick(lines), l.vars) : undefined;
}

/** who has lives worth telling (regulars and power users; lurkers rarely say anything anyway) */
const living = (c: Character) => c.core || c.tier !== "lurker";

/** hourly: start, advance and finish life arcs */
export function lifeTick(s: WorldState, t: number) {
  const hour = Math.floor(t / HOUR);
  for (const c of s.characters) {
    if (!living(c)) continue;
    const l = c.life;
    if (!l) {
      const r = rngFor(s.seed, "life", c.id, hour);
      if (!r.chance(c.core ? 0.07 : 0.025)) continue;
      const done = c.lifeDone ?? [];
      const arcs = ARCS.filter((a) => a.fits(c) && !done.slice(-3).includes(a.id));
      if (!arcs.length) continue;
      const arc = r.pick(arcs);
      const st = arc.stages[0];
      c.life = { arc: arc.id, stage: 0, since: t, next: Math.round(t + r.range(st.days[0], st.days[1] + 0.99) * DAY * (0.6 + r.next() * 0.4)), vars: arc.vars(r) };
      nudgeMood(c, st.mood);
      continue;
    }
    if (t < l.next) continue;
    const arc = arcOf(l.arc);
    if (!arc) { delete c.life; continue; }
    const r = rngFor(s.seed, "life-step", c.id, l.arc, l.stage, l.since);
    if (l.end !== undefined) {
      // the epilogue has been talked about: the arc becomes a memory
      rememberLong(c, { about: "self", text: fill(arc.ends![l.end].memory, l.vars), t, w: 0.7 });
      c.lifeDone = [...(c.lifeDone ?? []), arc.id].slice(-6);
      delete c.life;
      continue;
    }
    if (l.stage + 1 < arc.stages.length) {
      l.stage++;
      const st = arc.stages[l.stage];
      l.next = Math.round(t + r.range(st.days[0], st.days[1] + 0.99) * DAY * (0.6 + r.next() * 0.4));
      nudgeMood(c, st.mood);
    } else if (arc.ends?.length) {
      const bias = (c.mood ?? 0) + (c.opinion > 0 ? 0.1 : 0);
      l.end = arc.ends.length > 1 && r.next() > 0.62 + bias * 0.2 ? 1 : 0;
      l.stage = arc.stages.length;
      l.next = Math.round(t + r.range(0.5, 1.5) * DAY);
      nudgeMood(c, arc.ends[l.end].mood);
    } else delete c.life;
  }
}

export type { LifeState };
