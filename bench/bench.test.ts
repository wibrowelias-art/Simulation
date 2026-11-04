import { expect, it } from "vitest";
import { appendFileSync } from "node:fs";
const log = (...a: unknown[]) => { const l = a.join(" "); console.log(l); appendFileSync(process.env.BENCH_OUT ?? "/tmp/bench.txt", l + "\n"); };
import { createWorld } from "../src/lib/sim/world";
import { bootstrap, catchUp, simulate, trending } from "../src/lib/sim/engine";
const T0 = Date.UTC(2026, 10, 4, 12);

/**
 * Performance budgets (node on a dev machine; a mid-range phone is roughly 3x slower, which is what these leave
 * room for). The test fails when one is exceeded.
 */
export const BUDGET = {
  bootstrapMs: 2500,
  catchUp7dMs: 700, // ~2 s on a mid-range phone
  catchUp6hMs: 1200,
  worstChunkMs: 75, // the UI slices catch-up; one slice must never freeze for long (p95 per bucket is <1 ms; GC pauses set the max)
  tickMs: 4, // one live tick (most frames process no bucket at all)
  saveKB: 3500, // the whole world as JSON after a week away
  cloneMs: 60, // IndexedDB structured-clones the world on every save
};

it("bench", () => {
  let t = performance.now();
  const w = bootstrap(createWorld("demo-universe", T0), T0);
  const boot = performance.now() - t;
  log("bootstrap ms", boot.toFixed(0));
  const res: Record<string, number> = { bootstrapMs: boot };
  for (const [lbl, gap] of [["10m", 6e5], ["6h", 216e5], ["7d", 7 * 864e5]] as const) {
    const s = structuredClone(w);
    t = performance.now(); let chunks = 0, worst = 0;
    for (;;) { const c = performance.now(); const r = simulate(s, T0 + gap, { maxBuckets: 12 }); worst = Math.max(worst, performance.now() - c); if (!r.processed) break; chunks++; }
    const ms = performance.now() - t;
    log(lbl, "catchup ms", ms.toFixed(0), "chunks", chunks, "worst chunk ms", worst.toFixed(1));
    res.worstChunkMs = Math.max(res.worstChunkMs ?? 0, worst);
    if (lbl === "6h") {
      res.catchUp6hMs = ms;
      t = performance.now(); for (let i = 0; i < 20; i++) simulate(s, T0 + gap + (i + 1) * 1000); res.tickMs = (performance.now() - t) / 20; log("tick sim avg ms", res.tickMs.toFixed(2));
      t = performance.now(); for (let i = 0; i < 20; i++) trending(s, T0 + gap, 8); log("trending avg ms", ((performance.now() - t) / 20).toFixed(2));
    }
    if (lbl === "7d") {
      res.saveKB = JSON.stringify(s).length / 1024;
      t = performance.now(); for (let i = 0; i < 5; i++) structuredClone(s); res.cloneMs = (performance.now() - t) / 5;
      log("world JSON KB", res.saveKB.toFixed(0), "msgs", s.messages.length, "posts", s.posts.length, "clone ms", res.cloneMs.toFixed(1));
    }
  }
  const s7 = structuredClone(w);
  t = performance.now(); catchUp(s7, T0 + 7 * 864e5); res.catchUp7dMs = performance.now() - t;
  log("7d catchUp (one call) ms", res.catchUp7dMs.toFixed(0));
  for (const [k, max] of Object.entries(BUDGET)) expect(res[k], `${k} = ${res[k]?.toFixed(1)} (budget ${max})`).toBeLessThanOrEqual(max);
}, 180000);
