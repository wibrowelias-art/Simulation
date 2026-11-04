// Quick live check: DM memory (3 turns), "sup guys" in #general, and The Undernet in the server rail.
import { chromium } from "playwright-core";
import { executablePath } from "./_browser.mjs";
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3100";
const P = process.env.PREFIX ?? "local";
const OUT = new URL("../screenshots/", import.meta.url).pathname;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [], api = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", async (r) => { if (r.url().includes("/api/chat")) { const j = await r.json().catch(() => ({})); api.push({ status: r.status(), model: j.model, code: j.code, remember: j.remember }); } });
const R = { base: BASE };
const rows = () => page.evaluate(() => [...document.querySelectorAll("[data-mid]")].map((r) => ({ id: r.dataset.mid, a: r.dataset.author, text: r.innerText.slice(0, 240).replace(/\n/g, " | ") })));
const hash = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await wait(1300); };
await page.goto(`${BASE}/?demo#/lounge/godhq/godhq-general`, { waitUntil: "networkidle" });
await page.getByPlaceholder("Message #general").waitFor({ timeout: 90000 });
const cu = page.getByRole("button", { name: "Catch up" });
if (await cu.isVisible().catch(() => false)) { await cu.click(); await wait(500); }
await hash("#/lounge/godhq/godhq-general");
// rail
await page.getByRole("button", { name: "Open channels" }).first().click(); await wait(700);
const ub = page.locator('nav button[title="The Undernet"]');
R.undernetInRail = (await ub.count()) > 0;
if (R.undernetInRail) { await ub.evaluate((e) => e.scrollIntoView({ block: "center" })); await wait(300); }
await page.screenshot({ path: `${OUT}${P}-undernet-rail.png` });
await page.keyboard.press("Escape"); await hash("#/lounge/godhq/godhq-general");
await page.mouse.click(380, 400).catch(() => {}); await wait(400);
// sup guys
const box = page.getByPlaceholder("Message #general");
let before = new Set((await rows()).map((r) => r.id));
await box.fill("sup guys"); await box.press("Enter");
await wait(14000);
R.supReplies = (await rows()).filter((r) => !before.has(r.id) && r.a !== "god").map((r) => r.text).slice(0, 8);
await page.screenshot({ path: `${OUT}${P}-ai-general.png` });
// DM memory
const active = (await rows()).reverse().find((r) => r.a && r.a.startsWith("c"));
const peer = active.a;
await hash(`#/lounge/dm/dm:${["god", peer].sort().join(":")}`);
const dbox = page.locator("textarea[placeholder^='Message @'], input[placeholder^='Message @']").first();
R.convo = [];
for (const [i, said] of ["my dog is called Biscuit btw", "should i get him a second dog or is that too much?", "wait what's my dog's name again"].entries()) {
  before = new Set((await rows()).map((r) => r.id));
  await dbox.fill(said); await dbox.press("Enter");
  let got = [];
  for (let k = 0; k < 14; k++) { await wait(1000); got = (await rows()).filter((r) => !before.has(r.id) && r.a === peer); if (got.length && k > 4) break; }
  R.convo.push({ god: said, replies: got.map((r) => r.text) });
  await page.screenshot({ path: `${OUT}${P}-ai-dm-${i + 1}.png` });
  await wait(1500);
}
R.api = api; R.errors = errors;
fs.writeFileSync(`${OUT}${P}-ai-report.json`, JSON.stringify(R, null, 2));
console.log(JSON.stringify(R, null, 2));
await browser.close();
