import { it } from "vitest";
import { appendFileSync } from "node:fs";
const log = (...a: unknown[]) => appendFileSync(process.env.BENCH_OUT ?? "/tmp/bench.txt", a.join(" ") + "\n");
import { createWorld } from "../src/lib/sim/world";
import { bootstrap, simulate, trending } from "../src/lib/sim/engine";
const T0 = Date.UTC(2026, 10, 4, 12);
it("bench", () => {
  let t = performance.now();
  const w = bootstrap(createWorld("demo-universe", T0), T0);
  log("bootstrap ms", (performance.now() - t).toFixed(0));
  for (const [lbl, gap] of [["10m", 6e5], ["6h", 216e5], ["3d", 2592e5]] as const) {
    const s = JSON.parse(JSON.stringify(w));
    t = performance.now(); let chunks = 0, worst = 0;
    for (;;) { const c = performance.now(); const r = simulate(s, T0 + gap, { maxBuckets: 240 }); worst = Math.max(worst, performance.now() - c); if (!r.processed) break; chunks++; }
    log(lbl, "catchup ms", (performance.now() - t).toFixed(0), "chunks", chunks, "worst chunk ms", worst.toFixed(1));
    if (lbl === "6h") {
      const json = JSON.stringify(s); log("world JSON KB", (json.length / 1024).toFixed(0), "msgs", s.messages.length, "pending", s.pending.length, "posts", s.posts.length, "chars", s.characters.length);
      t = performance.now(); for (let i = 0; i < 20; i++) simulate(s, T0 + gap + (i + 1) * 1000); log("tick sim avg ms", ((performance.now() - t) / 20).toFixed(2));
      t = performance.now(); for (let i = 0; i < 20; i++) trending(s, T0 + gap, 8); log("trending avg ms", ((performance.now() - t) / 20).toFixed(2));
      t = performance.now(); for (let i = 0; i < 5; i++) structuredClone(s); log("structuredClone avg ms", ((performance.now() - t) / 5).toFixed(1));
    }
  }
}, 120000);
