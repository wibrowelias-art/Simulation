import { describe, expect, it } from "vitest";
import { HOUR, T0, world } from "./helpers";
import { applyAction, catchUp, godSay, simulate } from "../src/lib/sim/engine";
import { BOTTY } from "../src/lib/live/prompt";

const BAD: [string, RegExp][] = [
  ["unfilled slot", /[{}]/],
  ["template pipes", /\w\|\s|\s\|\w|\|\s*$/],
  ["doubled article", /\b(the|a|an) (the|a|an)\b/i],
  ["god 'did' a storyline he didn't do", /\b(did|does|doing) the [^.!?]{0,40}\b(leak|claim|rumor|clip|comment|ratings|reply|post)\b/i],
  ["purchase joke about something he didn't buy", /after the [^:]{0,40}\b(leak|claim|rumor|clip|comment|ratings|reply|post): 'it was a small purchase'/i],
  ["personal sentence used as a thing", /\b(did anyone see|anyone watching|can we talk about) (just|my|i|im|i'm|we|can't|should|who's|what are)\b/i],
  ["purchase joke about a non-purchase", /\b(buys|bought) "[^"]+"/i],
  ["assistant tone", BOTTY],
];

describe("scripted lines make sense", () => {
  it("a busy day (actions, god talking, storylines) produces no template nonsense", () => {
    const off: string[] = [];
    for (const seed of ["n1", "n2", "n3"]) {
      const s = world(seed);
      let t = T0 + 60_000;
      simulate(s, t);
      applyAction(s, { kind: "island", name: "Sunfall Cay", cost: 400_000_000 }, (t += 60_000));
      godSay(s, "godhq", "godhq-general", "sup guys", (t += 120_000));
      godSay(s, "godhq", "godhq-general", "what are yall doing tonight", (t += 300_000));
      applyAction(s, { kind: "announcement", name: "big things coming", cost: 0 }, (t += 600_000));
      catchUp(s, T0 + 8 * HOUR);
      const texts = [...s.messages.map((m) => m.text), ...s.posts.map((p) => p.text)];
      for (const x of texts) for (const [why, re] of BAD) if (re.test(x)) off.push(`${why}: ${x}`);
    }
    const uniq = [...new Set(off)];
    if (uniq.length) console.log(uniq.length, "\n" + uniq.slice(0, 60).join("\n"));
    expect(uniq.slice(0, 25)).toEqual([]);
  }, 60_000);
});

describe("live lines sound like the person", () => {
  it("young voices lose the tidy capitals and full stops; nobody types em dashes", async () => {
    const { voiceNormalize } = await import("../src/lib/live/prompt");
    expect(voiceNormalize("Honestly That's Wild. @Kai said so.", "zoomer")).toBe("honestly that's wild. @Kai said so");
    expect(voiceNormalize("Not bad — could be worse.", "proper")).toBe("Not bad, could be worse.");
    expect(voiceNormalize("ok...", "lowercase")).toBe("ok...");
    expect(voiceNormalize("x".repeat(30) + " " + "y".repeat(60), "terse").length).toBeLessThanOrEqual(80);
  });
});
