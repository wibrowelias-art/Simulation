// Old-save check: strip The Undernet from a saved world (pretend it is an early v5 save), reload,
// and confirm the server shows up in the rail plus the one-time tip.
import { chromium } from "playwright-core";
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://localhost:3100";
const P = process.env.PREFIX ?? "local";
const OUT = new URL("../screenshots/", import.meta.url).pathname;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const R = { base: BASE };
const ready = async () => {
  await page.getByPlaceholder(/^Message #/).first().waitFor({ timeout: 90000 });
  const cu = page.getByRole("button", { name: "Catch up" });
  if (await cu.isVisible().catch(() => false)) { await cu.click(); await wait(500); }
};
await page.goto(`${BASE}/?demo#/lounge/godhq/godhq-general`, { waitUntil: "networkidle" });
await ready(); await wait(3000);
// leave the app, then rewrite the save from a same-origin non-app page
await page.route("**/__blank", (r) => r.fulfill({ contentType: "text/html", body: "<html><body>blank</body></html>" }));
await page.goto(`${BASE}/__blank`); await wait(500);
R.stripped = await page.evaluate(() => new Promise((res) => {
  const r = indexedDB.open("god-sim", 1);
  r.onerror = () => res({ err: String(r.error) });
  r.onblocked = () => res({ err: "blocked" });
  r.onsuccess = () => {
    const st = r.result.transaction("kv", "readwrite").objectStore("kv");
    const k = st.getAllKeys();
    k.onsuccess = () => {
      const key = k.result.find((x) => String(x).includes("world"));
      const g = st.get(key);
      g.onsuccess = () => {
        const w = g.result;
        const had = w.servers.some((x) => x.id === "undernet");
        w.servers = w.servers.filter((x) => x.id !== "undernet");
        for (const c of w.characters) c.servers = c.servers.filter((x) => x !== "undernet");
        delete w.undernet; w.version = 5;
        const p = st.put(w, key); p.onsuccess = () => res({ key, had, servers: w.servers.length });
      };
    };
  };
}));
await page.goto(`${BASE}/?demo#/lounge/godhq/godhq-general`, { waitUntil: "networkidle" });
await ready();
let tip = null;
for (let i = 0; i < 20 && !tip; i++) { await wait(250); tip = await page.getByText(/New: The Undernet/).first().textContent().catch(() => null); }
R.tip = tip;
await page.screenshot({ path: `${OUT}${P}-undernet-tip.png` });
await page.getByRole("button", { name: "Open channels" }).first().click(); await wait(700);
const btn = page.locator('nav button[title="The Undernet"]');
R.railButtons = await page.locator("nav button[title]").evaluateAll((b) => b.map((x) => x.title));
await btn.evaluate((e) => e.scrollIntoView({ block: "center" })); await wait(400);
R.undernetInRail = await btn.isVisible();
await page.screenshot({ path: `${OUT}${P}-undernet-rail.png` });
await btn.click(); await wait(900);
await page.screenshot({ path: `${OUT}${P}-undernet-channels.png` });
R.channels = await page.locator("nav").innerText().then((t) => t.split("\n").filter((l) => /lobby|leaks|rumors|ransom|trophy|Undernet/.test(l)));
R.errors = errors;
fs.writeFileSync(`${OUT}${P}-undernet-rail.json`, JSON.stringify(R, null, 2));
console.log(JSON.stringify(R, null, 2));
await browser.close();
console.log(R.undernetInRail && R.tip && !errors.length ? "RAIL PASS" : "RAIL FAIL");
