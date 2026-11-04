// Acceptance: @god speaks in GOD HQ #general on a phone viewport and the world reacts.
import { chromium } from "playwright-core";
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3100";
const PREFIX = process.env.PREFIX ?? "local";
const OUT = new URL("../screenshots/", import.meta.url).pathname;
const VID = `${OUT}video-tmp/`;
fs.mkdirSync(VID, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, recordVideo: { dir: VID, size: { width: 390, height: 844 } } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });

await page.goto(`${BASE}/?demo#/lounge/godhq/godhq-general`, { waitUntil: "networkidle" });
const box = page.getByPlaceholder("Message #general");
await box.waitFor({ timeout: 60000 });
const catchUp = page.getByRole("button", { name: "Catch up" });
if (await catchUp.isVisible().catch(() => false)) { await catchUp.click(); await wait(500); }
await page.evaluate(() => { location.hash = "#/lounge/godhq/godhq-general"; });
await wait(1500);

const snap = () => page.evaluate(() => {
  const rows = [...document.querySelectorAll("[data-mid]")];
  const sec = document.querySelector("section")?.innerText ?? document.body.innerText;
  const godRows = rows.filter((r) => r.dataset.author === "god");
  const g = godRows[godRows.length - 1];
  const rx = g ? [...g.querySelectorAll("button[aria-pressed]")].reduce((a, b) => a + (parseInt(b.innerText.replace(/\D+/g, " ").trim().split(" ").pop()) || 0), 0) : 0;
  const badge = (id) => parseInt(document.querySelector(`[data-badge="${id}"]`)?.textContent ?? "0") || 0;
  return {
    mids: rows.map((r) => r.dataset.mid),
    authors: Object.fromEntries(rows.map((r) => [r.dataset.mid, [r.dataset.author, r.dataset.replyAuthor ?? ""]])),
    typing: /typing…/.test(document.body.innerText) ? (document.body.innerText.match(/[^\n]*typing…/) ?? [""])[0] : "",
    godRx: rx, more: badge("more"), lounge: badge("lounge"), hasText: sec.includes("sup guys"),
  };
});
const before = await snap();
const seen = new Set(before.mids);
const badgeBefore = before.more + before.lounge;

await box.fill("sup guys");
await box.press("Enter");
const t0 = Date.now();
const first = {};
const mark = (k) => { if (first[k] == null) first[k] = Date.now() - t0; };
let last, shots = 0;
while (Date.now() - t0 < 15000) {
  last = await snap();
  if (last.typing) mark("typing");
  const fresh = last.mids.filter((id) => !seen.has(id)).map((id) => last.authors[id]);
  if (fresh.some(([a]) => a?.startsWith("c"))) mark("firstCharacterMessage");
  if (fresh.some(([a, ra]) => a?.startsWith("c") && ra === "god")) mark("replyToGod");
  if (fresh.some(([a, ra]) => a?.startsWith("c") && ra.startsWith("c"))) mark("characterToCharacter");
  if (last.godRx > 0) mark("reactionsOnGod");
  if (last.more + last.lounge > badgeBefore) mark("notificationBadge");
  const el = Date.now() - t0;
  if (shots === 0 && (last.typing || el > 2200)) { await page.screenshot({ path: `${OUT}${PREFIX}-godspeaks-1.png` }); shots = 1; }
  if (shots === 1 && el > 3200) { await page.screenshot({ path: `${OUT}${PREFIX}-godspeaks-2.png` }); shots = 2; }
  await wait(200);
}
await page.screenshot({ path: `${OUT}${PREFIX}-godspeaks-3.png` });
const freshCount = last.mids.filter((id) => !seen.has(id)).length;

// other servers echo it later (shared event bus) — find their messages through global search
let echoes = [], tEcho = null;
while (Date.now() - t0 < 300000) {
  await wait(10000);
  await page.evaluate(() => { location.hash = "#/search?q=sup%20guys"; });
  await wait(1200);
  echoes = await page.$$eval("[data-testid=search-msg]", (b) => b.map((x) => x.innerText.replace(/\s+/g, " ")).filter((t) => !t.includes("GOD HQ #")));
  if (echoes.length) { tEcho = Date.now() - t0; break; }
}
await page.screenshot({ path: `${OUT}${PREFIX}-godspeaks-4.png` });
const video = page.video();
await ctx.close();
const vp = await video.path();
fs.renameSync(vp, `${OUT}${PREFIX}-godspeaks.webm`);
fs.rmSync(VID, { recursive: true, force: true });
await browser.close();

const report = { base: BASE, firstSeenMs: first, newMessagesIn15s: freshCount, godReactionsAt15s: last.godRx, badge: { before: badgeBefore, after: last.more + last.lounge }, echoAfterMs: tEcho, echoes: echoes.slice(0, 5), errors };
console.log(JSON.stringify(report, null, 2));
const ok = first.typing <= 3000 && first.replyToGod <= 4000 && first.characterToCharacter != null && first.reactionsOnGod != null && first.notificationBadge != null && echoes.length > 0 && !errors.length;
console.log(ok ? "ACCEPTANCE PASS" : "ACCEPTANCE FAIL");
