import { createWorld } from "../src/lib/sim/world";
import { bootstrap } from "../src/lib/sim/engine";
export const T0 = Date.UTC(2026, 10, 4, 12, 0, 0);
export const HOUR = 3600_000;
const cache = new Map<string, string>();
/** A bootstrapped world (cached as JSON so each test gets a fresh copy). */
export function world(seed = "test-seed", now = T0) {
  const k = `${seed}:${now}`;
  if (!cache.has(k)) cache.set(k, JSON.stringify(bootstrap(createWorld(seed, now), now)));
  return JSON.parse(cache.get(k)!) as ReturnType<typeof createWorld>;
}
