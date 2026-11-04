import { describe, expect, it } from "vitest";
import { simulate } from "../src/lib/sim/engine";
import { relAgo } from "../src/lib/sim/format";
import { STRICT_BEATS } from "../src/lib/sim/servers";
import { HOUR, T0, world } from "./helpers";

describe("polish", () => {
  it("relative times never read 'now ago'", () => {
    expect(relAgo(T0, T0)).toBe("just now");
    expect(relAgo(T0 - 5 * 60_000, T0)).toBe("5m ago");
  });
  it("Global Wealth Report only covers finance topics", () => {
    const s = world();
    simulate(s, T0 + 48 * HOUR);
    const gwr = s.articles.filter((a) => a.outletId === "gwr");
    expect(gwr.length).toBeGreaterThan(0);
    for (const a of gwr) {
      const t = s.topics.find((x) => x.id === a.topicId);
      if (t) expect(STRICT_BEATS.gwr).toContain(t.category);
    }
  });
});
