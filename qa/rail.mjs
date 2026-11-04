// Old-save check: strip The Undernet from a saved world (pretend it is an early v5 save), reload,
// and confirm migration restores the server in the rail plus the one-time tip.
// Deterministic: every wait has a timeout, the save is flushed before we touch IndexedDB, and the whole run is
// capped at 60 s. Exits 0 on pass, 1 with a reason on failure (never hangs).
import fs from "node:fs";
import { launch } from "./_browser.mjs";

const BASE = process.env.BASE ?? "http://localhost:3100";
const P = process.env.PREFIX ?? "local";
const OUT = new URL("../screenshots/", import.meta.url).pathname;
const LIMIT = Number(process.env.RAIL_TIMEOUT ?? 60_000);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const R = { base: BASE, steps: [] };
let browser;

function fail(reason) {
  R.fail = reason;
  console.log(JSON.stringify(R, null, 2));
  console.log(`RAIL FAIL: ${reason}`);
  browser?.close().catch(() => {});
  process.exit(1);
}
const watchdog = setTimeout(() => fail(`timed out after ${LIMIT / 1000}s (last step: ${R.steps.at(-1) ?? "start"})`), LIMIT);
watchdog.unref?.();
/** run a step with its own deadline so one stuck wait can't eat the whole budget */
async function step(name, ms, fn) {
  R.steps.push(name);
  let t;
  try {
    return await Promise.race([fn(), new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`step "${name}" took longer than ${ms / 1000}s`)), ms); })]);
  } catch (e) { fail(e.message ?? String(e)); } finally { clearTimeout(t); }
}

browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.setDefaultTimeout(15_000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const ready = async () => {
  await page.getByPlaceholder(/^Message #/).first().waitFor({ timeout: 25_000 });
  const cu = page.getByRole("button", { name: "Catch up" });
  if (await cu.isVisible().catch(() => false)) { await cu.click(); await wait(300); }
};

/** read (or rewrite) the save from inside a page, with a hard in-page timeout */
const idb = (fn) => page.evaluate(([src]) => new Promise((res) => {
  const timer = setTimeout(() => res({ err: "indexedDB timeout" }), 8000);
  const done = (v) => { clearTimeout(timer); res(v); };
  const r = indexedDB.open("god-sim", 1);
  r.onerror = () => done({ err: String(r.error) });
  r.onblocked = () => done({ err: "blocked: another connection is upgrading" });
  r.onsuccess = () => {
    const db = r.result;
    db.onversionchange = () => db.close();
    new Function("db", "done", src)(db, (v) => { db.close(); done(v); });
  };
}), [fn]);

const FIND_WORLD = `
  const st = db.transaction("kv", "readonly").objectStore("kv");
  const k = st.getAllKeys();
  k.onerror = () => done({ err: String(k.error) });
  k.onsuccess = () => { const key = k.result.find((x) => String(x).startsWith("world:")); done({ key: key ?? null, keys: k.result.map(String) }); };`;

const STRIP = `
  const st = db.transaction("kv", "readwrite").objectStore("kv");
  const k = st.getAllKeys();
  k.onerror = () => done({ err: String(k.error) });
  k.onsuccess = () => {
    const key = k.result.find((x) => String(x).startsWith("world:"));
    if (!key) return done({ err: "no saved world", keys: k.result.map(String) });
    const g = st.get(key);
    g.onerror = () => done({ err: String(g.error) });
    g.onsuccess = () => {
      const w = g.result;
      const had = w.servers.some((x) => x.id === "undernet");
      w.servers = w.servers.filter((x) => x.id !== "undernet");
      for (const c of w.characters) c.servers = c.servers.filter((x) => x !== "undernet");
      delete w.undernet; w.version = 5;
      const p = st.put(w, key);
      p.onerror = () => done({ err: String(p.error) });
      p.onsuccess = () => done({ key, had, servers: w.servers.length });
    };
  };`;

await step("open app", 40_000, async () => {
  await page.goto(`${BASE}/?demo#/lounge/godhq/godhq-general`, { waitUntil: "load" });
  await ready();
});

// the app saves on an idle timer; make it save now (it flushes when the tab is hidden) and wait until it has
R.saved = await step("wait for save", 25_000, async () => {
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  for (let i = 0; i < 40; i++) {
    const r = await idb(FIND_WORLD);
    if (r.err) throw new Error(r.err);
    if (r.key) return r;
    await wait(500);
  }
  throw new Error("the app never saved a world");
});

// leave the app (its connection closes with the page), then rewrite the save from a same-origin blank page
await step("rewrite save", 15_000, async () => {
  await page.route("**/__blank", (r) => r.fulfill({ contentType: "text/html", body: "<html><body>blank</body></html>" }));
  await page.goto(`${BASE}/__blank`, { waitUntil: "load" });
  R.stripped = await idb(STRIP);
  if (R.stripped.err) throw new Error(`could not rewrite the save: ${R.stripped.err}`);
  if (!R.stripped.had) throw new Error("the saved world had no Undernet to strip");
});

await step("reload app", 40_000, async () => {
  await page.goto(`${BASE}/?demo#/lounge/godhq/godhq-general`, { waitUntil: "load" });
  await ready();
});

R.tip = await step("tip", 10_000, async () => {
  for (let i = 0; i < 30; i++) {
    const t = await page.getByText(/New: The Undernet/).first().textContent({ timeout: 300 }).catch(() => null);
    if (t) return t;
    await wait(250);
  }
  return null;
});
await page.screenshot({ path: `${OUT}${P}-undernet-tip.png` }).catch(() => {});

await step("rail", 15_000, async () => {
  await page.getByRole("button", { name: "Open channels" }).first().click();
  await wait(500);
  const nav = page.getByRole("navigation", { name: "Servers and channels" });
  const btn = nav.locator('button[title="The Undernet"]');
  R.railButtons = await nav.locator("button[title]").evaluateAll((b) => b.map((x) => x.title));
  await btn.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await wait(300);
  R.undernetInRail = await btn.isVisible();
  await page.screenshot({ path: `${OUT}${P}-undernet-rail.png` }).catch(() => {});
  await btn.click();
  await wait(600);
  R.channels = (await nav.innerText()).split("\n").filter((l) => /lobby|leaks|rumors|ransom|trophy|Undernet/.test(l));
});

R.errors = errors;
clearTimeout(watchdog);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}${P}-undernet-rail.json`, JSON.stringify(R, null, 2));
await browser.close();
const pass = R.undernetInRail && R.tip && !errors.length;
console.log(JSON.stringify({ tip: R.tip, undernetInRail: R.undernetInRail, channels: R.channels, errors }, null, 2));
console.log(pass ? "RAIL PASS" : `RAIL FAIL: ${!R.undernetInRail ? "Undernet missing from the rail" : !R.tip ? "no one-time tip" : `page errors: ${errors.join("; ")}`}`);
process.exit(pass ? 0 : 1);
