// Tap-target audit at 390x844: every visible control must offer at least a 44x44 px hit area.
// Inline links inside message text are exempt (WCAG 2.5.8 inline exception); `.hit` expands the hit area.
import { launch } from "./_browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3100";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/?demo#/lounge/godhq/godhq-general`, { waitUntil: "load" });
await page.getByPlaceholder("Message #general").waitFor({ timeout: 60000 });
const cu = page.getByRole("button", { name: "Catch up" });
if (await cu.isVisible().catch(() => false)) { await cu.click(); await wait(400); }
await wait(1500);

const audit = () => page.evaluate(() => {
  const out = [];
  const vw = innerWidth, vh = innerHeight;
  for (const el of document.querySelectorAll("button, a[href], input, select, textarea, [role=button], [role=tab]")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.pointerEvents === "none" || el.closest("[aria-hidden=true]")) continue;
    // is it actually on top (not behind a drawer or sheet)?
    const top = document.elementFromPoint(Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), Math.min(vh - 1, Math.max(0, r.top + r.height / 2)));
    if (!top || !(el === top || el.contains(top))) continue;
    if (el.closest(".msg-text, .rich-inline")) continue; // inline links in text
    const hit = el.classList.contains("hit") ? 16 : el.classList.contains("hit-lg") ? 24 : 0;
    const w = r.width + (hit === 24 ? 16 : hit ? 4 : 0), h = r.height + hit; // matches .hit / .hit-lg in globals.css
    if (w < 43.5 || h < 43.5) out.push({ label: (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40), w: Math.round(w), h: Math.round(h) });
  }
  return out;
});

const R = {};
R.chat = await audit();
const row = page.locator("[data-mid]").last();
const box = await row.boundingBox();
await row.dispatchEvent("pointerdown", { pointerType: "touch", button: 0, clientX: box.x + 30, clientY: box.y + 10, isPrimary: true });
await wait(600);
await row.dispatchEvent("pointerup", { pointerType: "touch", button: 0, clientX: box.x + 30, clientY: box.y + 10 });
await wait(400);
R.sheet = await audit();
await page.keyboard.press("Escape"); await wait(300);
// the composer's emoji/sticker tray
await page.getByRole("button", { name: "Emoji and stickers" }).click(); await wait(400);
R.tray = await audit();
await page.getByRole("button", { name: "Emoji and stickers" }).click(); await wait(300);
// members (swipe-left panel), then back to the server list (chat slides away, Lounge tabs appear)
await page.getByRole("button", { name: "Members" }).first().click(); await wait(500);
R.members = await audit();
await page.getByRole("button", { name: "Close members" }).first().click(); await wait(400);
await page.getByRole("button", { name: "Open channels" }).first().click(); await wait(500);
R.servers = await audit();
await page.getByRole("button", { name: "Apps", exact: true }).click(); await wait(400);
R.apps = await audit();
await page.keyboard.press("Escape"); await wait(300);
for (const [k, tab] of [["messages", /^Messages/], ["notifications", /^Notifications/], ["you", /^You/]]) {
  await page.getByRole("navigation", { name: "Lounge tabs" }).getByRole("button", { name: tab }).click(); await wait(500);
  R[k] = await audit();
}
// the other apps
for (const [k, h] of [["home", "#/"], ["feed", "#/feed"], ["feedExplore", "#/feed/explore"], ["feedYou", "#/feed/you"], ["trade", "#/trade"], ["portfolio", "#/trade/portfolio"], ["wallet", "#/wallet"], ["activity", "#/wallet/activity"], ["settings", "#/settings"]]) {
  await page.evaluate((x) => { location.hash = x; }, h); await wait(1200);
  R[k] = await audit();
}
await page.evaluate(() => { location.hash = "#/feed"; }); await wait(800);
await page.getByRole("button", { name: "New post" }).click(); await wait(600);
R.compose = await audit();
await b.close();

const total = Object.values(R).reduce((a, x) => a + x.length, 0);
console.log(JSON.stringify({ ...R, errors }, null, 2));
console.log(total === 0 && !errors.length ? "TARGETS PASS" : `TARGETS FAIL: ${total} small controls`);
process.exit(total === 0 && !errors.length ? 0 : 1);
