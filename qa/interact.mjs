// Phone acceptance for the interactivity pass + gh0st storyline: typing presence, reaction cascade,
// voice lounge, @mention + soft command, and a leak that spreads across Lounge, Chirp, news and events.
import { chromium } from "playwright-core";
import { executablePath } from "./_browser.mjs";
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3100";
const P = process.env.PREFIX ?? "local";
const OUT = new URL("../screenshots/", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error" && !/api\/chat|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
const R = { base: BASE };
const shot = (n) => page.screenshot({ path: `${OUT}${P}-${n}.png` });
const hash = async (h) => { await page.evaluate((x) => { location.hash = x; }, h); await wait(1300); };
const rows = () => page.evaluate(() => [...document.querySelectorAll("[data-mid]")].map((r) => ({ id: r.dataset.mid, a: r.dataset.author, ra: r.dataset.replyAuthor, meme: !!r.querySelector("[data-meme]"), text: r.innerText.slice(0, 240).replace(/\n/g, " | ") })));
const worldJson = () => page.evaluate(() => new Promise((res) => {
  const r = indexedDB.open("god-sim", 1);
  r.onsuccess = () => {
    const st = r.result.transaction("kv", "readonly").objectStore("kv");
    const k = st.getAllKeys();
    k.onsuccess = () => { const key = k.result.find((x) => String(x).includes("world")); if (!key) return res(null); const g = st.get(key); g.onsuccess = () => res(g.result ?? null); };
  };
  r.onerror = () => res(null);
}));
const t0 = Date.now(), ms = () => Date.now() - t0;

await page.goto(`${BASE}/?demo#/lounge/godhq/godhq-general`, { waitUntil: "networkidle" });
await page.getByPlaceholder("Message #general").waitFor({ timeout: 60000 });
const cu = page.getByRole("button", { name: "Catch up" });
if (await cu.isVisible().catch(() => false)) { await cu.click(); await wait(500); }
await hash("#/lounge/godhq/godhq-general");
const box = page.getByPlaceholder("Message #general");

// 1. typing without sending
let before = new Set((await rows()).map((r) => r.id));
await box.click(); await box.type("hmm", { delay: 60 });
const typedAt = ms();
let typingSeen = null;
for (let i = 0; i < 20 && !typingSeen; i++) { await wait(250); typingSeen = await page.getByText(/is typing…|are typing…/).first().textContent().catch(() => null); }
R.typing = { indicator: typingSeen, afterMs: ms() - typedAt };
await shot("typing-1");
await wait(3500);
const tReacts = (await rows()).filter((r) => !before.has(r.id) && r.a !== "god");
R.typing.reactions = tReacts.map((r) => r.text).slice(0, 6);
await shot("typing-2");
await box.fill(""); await wait(400);

// 2. react to a character message
const target = (await rows()).reverse().find((r) => r.a && r.a.startsWith("c") && !r.meme);
before = new Set((await rows()).map((r) => r.id));
const el = page.locator(`[data-mid="${target.id}"]`);
await el.scrollIntoViewIfNeeded(); await el.click(); await wait(300); await shot("react-target");
await page.getByRole("button", { name: "React 🔥" }).first().click();
const reactedAt = ms();
let authorReply;
for (let i = 0; i < 24 && !authorReply; i++) { await wait(250); authorReply = (await rows()).find((r) => !before.has(r.id) && r.a === target.a); }
R.react = { target: target.text, authorReplyMs: authorReply ? ms() - reactedAt : null, authorReply: authorReply?.text };
await wait(4000);
R.react.pileOn = (await rows()).filter((r) => !before.has(r.id) && r.a !== target.a && r.a !== "god").map((r) => r.text).slice(0, 5);
R.react.chip = await page.locator(`[data-mid="${target.id}"] button[aria-label^="🔥"]`).first().getAttribute("aria-label").catch(() => null);
await shot("react-1");
await page.evaluate((id) => document.querySelector(`[data-mid="${id}"]`)?.scrollIntoView({ block: "center" }), target.id); await wait(300);
await shot("react-2");

// 3. join voice
await page.getByRole("button", { name: "Open channels" }).first().click(); await wait(600);
await page.getByTestId("voice-list").scrollIntoViewIfNeeded();
await shot("voice-1");
await page.getByRole("button", { name: "Join voice" }).first().click(); await wait(1200);
await shot("voice-2");
const closeBtn = page.getByRole("button", { name: "Close" }).first();
if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
await hash("#/lounge/godhq/godhq-general");
await wait(4500);
R.voice = {
  bar: await page.getByTestId("voice-bar").innerText().catch(() => null),
  banner: await page.getByTestId("voice-banner").last().innerText().catch(() => null),
  hype: (await rows()).slice(-5).map((r) => r.text),
};
await shot("voice-3");
await wait(9000);
R.voice.barLater = await page.getByTestId("voice-bar").innerText().catch(() => null);
await shot("voice-4");

// 4. mention + soft commands
const w = await worldJson();
const srv = w.servers.find((x) => x.id === "godhq");
const talker = [...w.messages].reverse().find((m) => m.channelId === "godhq-general" && m.authorId.startsWith("c") && srv.members.includes(m.authorId));
const ch = w.characters.find((c) => c.id === talker.authorId);
R.command = [];
for (const [i, text] of [`@${ch.username} tell a joke`, `@${ch.username} drop a meme`].entries()) {
  before = new Set((await rows()).map((r) => r.id));
  await box.fill(text); await box.press("Enter");
  const sent = ms();
  let rep;
  for (let k = 0; k < 40 && !rep; k++) { await wait(200); rep = (await rows()).find((r) => !before.has(r.id) && r.a === ch.id); }
  await wait(rep?.meme || i === 0 ? 1200 : 3000);
  const again = (await rows()).filter((r) => !before.has(r.id) && r.a === ch.id);
  R.command.push({ said: text, replyMs: rep ? ms() - sent : null, reply: again.map((r) => r.text), meme: again.some((r) => r.meme) });
  await shot(`command-${i + 1}`);
}

// 5. hacker storyline: dare gh0st in DMs, then watch the leak spread
const g = w.characters.find((c) => c.username === "gh0st_");
const dm = `dm:${["god", g.id].sort().join(":")}`;
await hash(`#/lounge/dm/${dm}`);
const dbox = page.getByPlaceholder(/^Message @/);
before = new Set((await rows()).map((r) => r.id));
await dbox.fill("go on then. leak it"); await dbox.press("Enter");
const dared = ms();
let ghReply;
for (let k = 0; k < 40 && !ghReply; k++) { await wait(250); ghReply = (await rows()).find((r) => !before.has(r.id) && r.a === g.id); }
R.hacker = { dmReplyMs: ghReply ? ms() - dared : null, dmReply: ghReply?.text };
await wait(1500);
await shot("hacker-dm");
let leak;
before = new Set();
await hash("#/lounge/undernet/undernet-leaks");
let dropRow;
for (let k = 0; k < 75 && !dropRow; k++) { await wait(2000); dropRow = (await rows()).find((r) => !before.has(r.id) && r.a === g.id && r.meme); }
R.hacker.leakAfterMs = dropRow ? ms() - dared : null;
R.hacker.drop = dropRow?.text;
leak = dropRow && ((await worldJson())?.topics ?? []).filter((t) => t.category === "leak").sort((a, b) => b.startedAt - a.startedAt)[0];
R.hacker.tag = leak?.tag;
if (leak) {
  await page.evaluate((id) => document.querySelector(`[data-mid="${id}"]`)?.scrollIntoView({ block: "center" }), dropRow.id); await wait(800);
  await shot("hacker-drop");
  await wait(25000);
  await hash("#/lounge/undernet/undernet-leaks"); await wait(800);
  R.hacker.undernet = (await rows()).slice(-4).map((r) => r.text);
  const doc = (await rows()).reverse().find((r) => r.meme);
  if (doc) await page.evaluate((id) => document.querySelector(`[data-mid="${id}"]`)?.scrollIntoView({ block: "center" }), doc.id); await wait(600);
  await shot("hacker-undernet");
  await hash("#/chirp"); await wait(800);
  const post = page.getByText(`#${leak.tag}`).first();
  R.hacker.chirp = await post.count() > 0;
  if (R.hacker.chirp) await post.evaluate((e) => e.scrollIntoView({ block: "center" })); await wait(600);
  await shot("hacker-chirp");
  await hash("#/events"); await wait(800);
  R.hacker.choices = await page.getByRole("button", { name: /pay|deny|counter|white hat|hire/i }).allTextContents().catch(() => []);
  await shot("hacker-event");
  await wait(Math.max(0, 200000 - (ms() - dared)));
  await hash("#/news"); await wait(800);
  R.hacker.news = await page.getByText(/GODWATCH/i).first().count() > 0;
  await shot("hacker-news");
  await hash("#/lounge/godhq/godhq-general"); await wait(800);
  const wl = await worldJson();
  R.hacker.loungeReactions = wl.messages.filter((m) => m.topicId === leak.id && m.serverId !== "undernet" && m.serverId !== "dm").slice(0, 4).map((m) => m.text);
  await shot("hacker-lounge");
}
R.errors = errors;
fs.writeFileSync(`${OUT}${P}-interact-report.json`, JSON.stringify(R, null, 2));
console.log(JSON.stringify(R, null, 2));
await browser.close();
