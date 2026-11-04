// Live checks for pt20u: a 3-message DM conversation, memes in Lounge and Chirp, background-tab continuity.
import { chromium } from "playwright-core";
import { executablePath } from "./_browser.mjs";
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = new URL("../screenshots/", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [], calls = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/api\/chat|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
page.on("response", async (r) => {
  if (!r.url().includes("/api/chat")) return;
  let body = {}; try { body = JSON.parse(r.request().postData() ?? "{}"); } catch {}
  let res = {}; try { res = await r.json(); } catch {}
  calls.push({ status: r.status(), god: body.god, history: (body.history ?? []).length, histText: (body.history ?? []).map((h) => `${h.who}: ${h.text}`), res: { lines: res.lines, code: res.code, model: res.model, usage: res.usage, detail: res.detail } });
});
const report = { base: BASE };

await page.goto(`${BASE}/?demo#/lounge/godhq/godhq-general`, { waitUntil: "networkidle" });
await page.getByPlaceholder("Message #general").waitFor({ timeout: 60000 });
const catchUp = page.getByRole("button", { name: "Catch up" });
if (await catchUp.isVisible().catch(() => false)) { await catchUp.click(); await wait(500); }
await page.evaluate(() => { location.hash = "#/lounge/godhq/godhq-general"; });
await wait(1500);
const rows = () => page.evaluate(() => [...document.querySelectorAll("[data-mid]")].map((r) => ({ id: r.dataset.mid, a: r.dataset.author, meme: !!r.querySelector("[data-meme]"), text: r.innerText.slice(0, 200) })));

// ---- memes: say something and watch
const box = page.getByPlaceholder("Message #general");
await box.fill("i just made it rain cereal over port lumen"); await box.press("Enter");
let memeRow;
for (let i = 0; i < 40 && !memeRow; i++) { await wait(1500); memeRow = (await rows()).find((r) => r.meme); }
report.loungeMeme = memeRow ? memeRow.text.replace(/\n/g, " | ") : null;
if (memeRow) {
  const el = page.locator(`[data-mid="${memeRow.id}"]`);
  await el.scrollIntoViewIfNeeded(); await wait(400);
  await page.screenshot({ path: `${OUT}live-meme-lounge.png` });
  await el.screenshot({ path: `${OUT}live-meme-row.png` });
  await el.locator("[data-meme]").first().click(); await wait(500);
  await page.screenshot({ path: `${OUT}live-meme-lightbox.png` });
  await page.keyboard.press("Escape"); await wait(300);
  report.lightboxClosed = !(await page.locator('[role="dialog"][aria-label="Image"]').count());
}
await page.evaluate(() => { location.hash = "#/chirp"; }); await wait(2000);
const chirpMeme = page.locator("[data-meme]").first();
report.chirpMeme = await chirpMeme.count() > 0;
if (report.chirpMeme) { await chirpMeme.scrollIntoViewIfNeeded(); await wait(400); await page.screenshot({ path: `${OUT}live-meme-chirp.png` }); }

// ---- DM conversation with someone who was just active
await page.evaluate(() => { location.hash = "#/lounge/godhq/godhq-general"; }); await wait(1200);
const active = (await rows()).reverse().find((r) => r.a && r.a !== "god" && r.a.startsWith("c"));
const peer = active.a;
const dm = `dm:${["god", peer].sort().join(":")}`;
await page.evaluate((h) => { location.hash = h; }, `#/lounge/dm/${dm}`); await wait(1500);
const dbox = page.locator("textarea, input").filter({ has: page.locator("xpath=self::*[starts-with(@placeholder,'Message @')]") }).first();
const lines = ["hey, quick one. my dog is called Biscuit and he just ate my sandwich", "what should i do with him lol", "wait what was my dog's name again? and what did he eat"];
report.convo = [];
for (let i = 0; i < lines.length; i++) {
  const before = new Set((await rows()).map((r) => r.id));
  await dbox.fill(lines[i]); await dbox.press("Enter");
  let got = [];
  for (let k = 0; k < 60; k++) {
    await wait(1500);
    got = (await rows()).filter((r) => !before.has(r.id) && r.a === peer);
    if (got.length && k > 6) break;
  }
  report.convo.push({ god: lines[i], replies: got.map((r) => r.text.replace(/\n/g, " | ")) });
  await page.screenshot({ path: `${OUT}live-convo-${i + 1}.png` });
}

// ---- background tab: hide, wait, come back
await page.evaluate(() => { location.hash = "#/lounge/godhq/godhq-general"; }); await wait(1200);
const countWorld = () => page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith("god-sim:world")) ?? "") ?? "null")?.messages?.length ?? -1);
const shown0 = (await rows()).length;
await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
const ids0 = new Set((await rows()).map((r) => r.id));
await wait(45000);
const idsHidden = (await rows()).filter((r) => !ids0.has(r.id)).length;
await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" }); Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
await wait(800);
const idsBack = (await rows()).filter((r) => !ids0.has(r.id)).length;
report.background = { shownBefore: shown0, newWhileHiddenRendered: idsHidden, newRightAfterReturn: idsBack };
await page.screenshot({ path: `${OUT}live-background-return.png` });
void countWorld;

report.apiCalls = calls;
report.errors = errors;
fs.writeFileSync(`${OUT}live-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
