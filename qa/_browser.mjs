// Shared by the qa scripts: find a Chrome/Chromium binary (CHROME=... overrides) and launch it.
import { chromium } from "playwright-core";
import fs from "node:fs";
const CANDIDATES = [process.env.CHROME, "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", "/opt/pw-browsers/chromium/chrome-linux64/chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe"].filter(Boolean);
export const executablePath = CANDIDATES.find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } });
export const launch = (opts = {}) => chromium.launch({ executablePath, args: ["--no-sandbox"], ...opts });
