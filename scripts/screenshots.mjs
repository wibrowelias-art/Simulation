import { chromium } from "playwright-core";
import { executablePath } from "../qa/_browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = new URL("../screenshots/", import.meta.url).pathname;
const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
const errors = [];
const PREFIX = process.env.PREFIX; // e.g. "live" to name files live-*
const ONLY = process.env.ONLY; // "mobile" or "desktop"
const markerHits = [];
const checkMarker = async (page, name) => { const t = await page.evaluate(() => document.body.innerText); if (/SIMULATION/.test(t)) markerHits.push(name); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [label, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  if (ONLY && ONLY !== label) continue;
  const tag = PREFIX ?? label;
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: label === "mobile" ? 2 : 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${label} console: ${m.text()}`); });
  await page.goto(`${BASE}/?demo&away=6h#/lounge`, { waitUntil: "networkidle" });
  await page.getByText(/while you were away/i).first().waitFor({ timeout: 60000 });
  await wait(800);
  await page.screenshot({ path: `${OUT}${tag}-away-summary.png` }); await checkMarker(page, `${tag}-away-summary`);
  await page.getByRole("button", { name: "Catch up" }).click();
  await wait(800);
  const shot = async (hash, name, extra) => {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await wait(1200);
    if (extra) await extra();
    await page.screenshot({ path: `${OUT}${tag}-${name}.png` }); await checkMarker(page, `${tag}-${name}`);
  };
  await shot("#/lounge", "lounge");
  if (label === "mobile") {
    await page.getByRole("button", { name: "Open channels" }).click(); await wait(600);
    await page.screenshot({ path: `${OUT}${tag}-lounge-drawer.png` }); await checkMarker(page, `${tag}-lounge-drawer`);
    await page.mouse.click(370, 400); await wait(500);
    await page.getByRole("button", { name: "Members", exact: true }).click(); await wait(600);
    await page.screenshot({ path: `${OUT}${tag}-lounge-members.png` }); await checkMarker(page, `${tag}-lounge-members`);
    await page.getByRole("button", { name: "Close members" }).click(); await wait(500);
    const msgs = page.locator("section .msg-in, section div.group");
    await msgs.nth(Math.max(0, (await msgs.count()) - 2)).click({ position: { x: 200, y: 20 } }); await wait(500);
    await page.screenshot({ path: `${OUT}${tag}-lounge-actions.png` }); await checkMarker(page, `${tag}-lounge-actions`);
  }
  await shot("#/chirp", "chirp");
  if (label === "desktop") await shot("#/platforms/snapgram", "snapgram");
  await shot("#/dashboard", "dashboard");
  await shot("#/news", "news");
  // open the most recent article
  await page.locator("main button h2, main button h3").first().click();
  await wait(1000);
  await page.screenshot({ path: `${OUT}${tag}-news-article.png` }); await checkMarker(page, `${tag}-news-article`);
  // breaking point
  await shot("#/god", "godmode");
  await page.getByRole("button", { name: /Buy an island/ }).click();
  await page.locator('input[type="range"]').fill("1");
  await page.getByRole("button", { name: "Do it" }).click();
  await page.getByText("BREAKING POINT").first().waitFor({ timeout: 10000 });
  await wait(900);
  await page.screenshot({ path: `${OUT}${tag}-breaking-point.png` }); await checkMarker(page, `${tag}-breaking-point`);
  await page.getByRole("button", { name: "See the reaction" }).click();
  await wait(9000);
  await page.screenshot({ path: `${OUT}${tag}-breaking-chirp.png` }); await checkMarker(page, `${tag}-breaking-chirp`);
  await page.evaluate(() => { location.hash = "#/lounge"; });
  await wait(2500);
  await page.screenshot({ path: `${OUT}${tag}-breaking-lounge.png` }); await checkMarker(page, `${tag}-breaking-lounge`);
  await ctx.close();
}
await browser.close();
console.log(markerHits.length ? `MARKER FOUND in: ${markerHits.join(", ")}` : "no SIMULATION marker on any screen");
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no page errors");
