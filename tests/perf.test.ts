import { expect, it } from "vitest";
import { world, T0 } from "./helpers";
import { catchUp } from "../src/lib/sim/engine";

// a coarse guard in the normal suite (generous, so slow CI doesn't flake); bench/ has the real budgets
it("a week away catches up fast and keeps the save small", () => {
  const s = world("perf");
  const t = performance.now();
  const sum = catchUp(s, T0 + 7 * 864e5);
  expect(performance.now() - t).toBeLessThan(3000);
  expect(sum.compressed).toBe(true);
  expect(sum.messages).toBeGreaterThan(500); // still a lively week to read about
  expect(JSON.stringify(s).length / 1024).toBeLessThan(3500);
}, 30000);
