// Perf probe: catch-up duration + main-thread busy time per second while idle on each screen.
import { chromium } from "playwright-core";
import { executablePath } from "./_browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3100";
const THROTTLE = Number(process.env.THROTTLE ?? 4);
const b = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
const out = {};
async function fresh(away) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
  await p.addInitScript(() => {
    window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(e.duration); }).observe({ type: "longtask", buffered: true });
  });
  const t0 = Date.now();
  await p.goto(`${BASE}/?demo${away ? `&away=${away}` : ""}#/lounge`);
  await p.locator("main").waitFor({ timeout: 120000 });
  const ready = Date.now() - t0;
  const lt = await p.evaluate(() => window.__lt);
  return { ctx, p, cdp, ready, maxLong: Math.round(Math.max(0, ...lt)), longOver200: lt.filter((x) => x > 200).length };
}
for (const away of ["", "10m", "6h", "3d"]) {
  const r = await fresh(away);
  out[`load${away ? "+away=" + away : ""}`] = { readyMs: r.ready, maxLongTaskMs: r.maxLong, longTasksOver200ms: r.longOver200 };
  if (away === "6h") {
    const { p, cdp } = r;
    const close = p.getByRole("button", { name: "Catch up" }); if (await close.count()) await close.click();
    await cdp.send("Performance.enable");
    for (const route of ["#/lounge", "#/chirp", "#/news", "#/dashboard", "#/platforms/snapgram"]) {
      await p.evaluate((h) => { location.hash = h; }, route); await p.waitForTimeout(1500);
      await p.evaluate(() => { window.__lt = []; });
      const m0 = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
      await p.waitForTimeout(8000);
      const m1 = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
      const lt = await p.evaluate(() => window.__lt);
      out[`idle ${route}`] = { busyMsPerSec: Math.round(((m1.TaskDuration - m0.TaskDuration) * 1000) / 8), scriptMsPerSec: Math.round(((m1.ScriptDuration - m0.ScriptDuration) * 1000) / 8), longTasks: lt.length, maxLongMs: Math.round(Math.max(0, ...lt)), heapMB: Math.round(m1.JSHeapUsedSize / 1e6) };
    }
  }
  await r.ctx.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
