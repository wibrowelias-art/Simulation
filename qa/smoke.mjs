// Clicks through every interactive surface on phone + desktop; fails on page errors, horizontal overflow or dead controls.
import { chromium } from "playwright-core";
import { executablePath } from "./_browser.mjs";
const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = new URL("../screenshots/qa-", import.meta.url).pathname;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
const problems = [];
for (const [label, vp] of [["mobile", { width: 390, height: 844 }], ["desktop", { width: 1440, height: 900 }]]) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: label === "mobile" });
  const page = await ctx.newPage(); page.setDefaultTimeout(8000);
  page.on("pageerror", (e) => problems.push(`${label} error: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") problems.push(`${label} console: ${m.text()}`); });
  const step = async (name, fn) => {
    try { await fn(); } catch (e) { problems.push(`${label} ${name}: ${e.message.split("\n")[0]}`); }
    const ov = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 2 && getComputedStyle(el).position !== "fixed" && !el.closest("[data-scroll-x], .overflow-x-auto, .overflow-hidden, .overflow-x-hidden"); }).slice(0, 3).map((el) => `${el.tagName}.${String(el.className).slice(0, 60)}`));
    if (ov.length) problems.push(`${label} ${name}: overflow ${ov.join(" | ")}`);
    const shifted = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((el) => el.scrollTop > 0 && !["auto", "scroll"].includes(getComputedStyle(el).overflowY)).slice(0, 3).map((el) => `${el.tagName}.${String(el.className).slice(0, 60)} st=${el.scrollTop}`));
    if (shifted.length) problems.push(`${label} ${name}: clipped container scrolled ${shifted.join(" | ")}`);
    await page.screenshot({ path: `${OUT}${label}-${name}.png` });
  };
  const go = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await wait(900); };
  await page.goto(`${BASE}/?demo#/lounge/godhq/godhq-general`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("Message #general").waitFor({ timeout: 60000 });
  const cu = page.getByRole("button", { name: "Catch up" }); if (await cu.isVisible().catch(() => false)) await cu.click();
  await go("#/lounge/godhq/godhq-general");
  await step("search", async () => {
    await page.getByRole("button", { name: "Search messages" }).click(); await wait(400);
    await page.getByPlaceholder(/Search/).first().fill("god"); await wait(600);
    const hits = await page.locator("mark").count(); if (!hits) throw new Error("no highlighted search hits");
  });
  await page.keyboard.press("Escape"); await wait(300);
  if (await page.getByRole("button", { name: "Close panel" }).count()) problems.push(`${label}: Escape did not close search`);
  await step("pins", async () => {
    await page.getByRole("button", { name: /^Pinned messages/ }).click(); await wait(500);
    await page.getByRole("button", { name: "Close panel" }).click(); await wait(300);
  });
  await step("send-reply-react-edit", async () => {
    const box = page.getByPlaceholder("Message #general");
    await box.fill("qa check one"); await box.press("Enter"); await wait(800);
    // phones: long-press opens the action sheet; desktop: click selects
    const actions = async (row) => {
      const bb = await row.boundingBox();
      if (label !== "mobile") return row.click({ position: { x: bb.width - 8, y: 12 } });
      const at = { pointerType: "touch", button: 0, isPrimary: true, clientX: bb.x + bb.width - 30, clientY: bb.y + 12 };
      await row.dispatchEvent("pointerdown", at); await wait(600); await row.dispatchEvent("pointerup", at);
    };
    const mine = page.locator('[data-author="god"]').last();
    await actions(mine); await wait(300);
    await page.getByRole("button", { name: "Edit", exact: true }).first().click(); await wait(200);
    await box.fill("qa check edited"); await box.press("Enter"); await wait(800);
    if (!(await page.getByText("qa check edited").count())) throw new Error("edit did not apply");
    const other = page.locator('[data-author^="c"]').last();
    await actions(other); await wait(300);
    await page.getByRole("button", { name: "Reply", exact: true }).first().click(); await wait(200);
    await box.fill("replying in qa"); await box.press("Enter"); await wait(800);
    if (!(await page.locator('[data-author="god"][data-reply-author^="c"]').count())) throw new Error("reply not linked");
  });
  await step("thread", async () => {
    const chip = page.getByRole("button", { name: /in thread/ }).first();
    if (await chip.count()) { await chip.click(); await wait(600); }
  });
  await page.keyboard.press("Escape");
  await step("members-dm", async () => {
    await go("#/lounge/godhq/godhq-general");
    if (label === "mobile") { await page.getByRole("button", { name: "Members", exact: true }).click(); await wait(500); }
    await page.getByRole("button", { name: /^Message (?!actions)/ }).first().click(); await wait(900);
    const h = await page.evaluate(() => location.hash); if (!h.includes("dm")) throw new Error(`DM button went to ${h}`);
    const box = page.getByPlaceholder(/Message @/); await box.fill("hey it's me"); await box.press("Enter"); await wait(4500);
  });
  await step("dm-list", async () => { await go("#/lounge/dm"); });
  await step("chirp-like", async () => {
    await go("#/chirp");
    const like = page.getByRole("button", { name: "Like" }).first(); await like.click(); await wait(400);
    if (!(await page.getByRole("button", { name: "Unlike" }).count())) throw new Error("like didn't toggle");
    await page.getByRole("button", { name: /^Reply,/ }).first().click(); await wait(700);
    const h = await page.evaluate(() => location.hash); if (!h.includes("compose=reply")) throw new Error(`reply went to ${h}`);
  });
  await step("platform-sheet", async () => {
    await go("#/platforms/snapgram");
    await page.locator("[role=button]").first().click(); await wait(700);
    if (!(await page.evaluate(() => location.hash)).includes("?p=")) throw new Error("card didn't open");
  });
  await step("global-search", async () => { await go("#/search?q=god"); });
  await step("alerts", async () => { await go("#/alerts"); });
  await step("profile", async () => { await go("#/u/c1"); });
  await step("settings", async () => { await go("#/settings"); });
  await step("events", async () => { await go("#/events"); });
  if (label === "mobile") await step("more-sheet", async () => { await go("#/lounge"); await page.getByRole("button", { name: "More" }).click(); await wait(500); });
  const txt = await page.evaluate(() => document.body.innerText); if (/SIMULATION/.test(txt)) problems.push(`${label}: SIMULATION marker`);
  await ctx.close();
}
await b.close();
console.log(problems.length ? problems.join("\n") : "SMOKE CLEAN");
