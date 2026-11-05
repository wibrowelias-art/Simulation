import { Rng } from "./rng";
import type { PfpStyle } from "./types";

/** Original, stylised SVG avatars per pfp convention (docs/research.md §7). No photos, no existing characters. */
const PASTEL = ["#fbcfe8", "#c7d2fe", "#bae6fd", "#bbf7d0", "#fde68a", "#fecaca", "#ddd6fe", "#a5f3fc", "#fed7aa"];
const BOLD = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];
const HAIR = ["#1f1b2e", "#f5d0a9", "#ff7eb6", "#7dd3fc", "#a78bfa", "#fde047", "#f87171", "#e5e7eb", "#4ade80", "#3b2a20", "#c084fc"];
const SKIN = ["#ffe4d1", "#f9d3b4", "#eab28f", "#c98c66", "#9a6446", "#6e4530"];
const FUR = ["#f4a259", "#3d3d3d", "#e8e1d5", "#a47148", "#d9d9d9", "#f2c57c", "#5b4636"];

const wrap = (bg: string, inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${bg}"/>${inner}</svg>`;

function anime(r: Rng) {
  const bg = r.pick(PASTEL), hair = r.pick(HAIR), skin = r.pick(SKIN.slice(0, 4)), eye = r.pick(BOLD);
  const long = r.chance(0.5);
  const bangs = r.int(0, 2);
  const bangPath = bangs === 0 ? "M14 30 Q18 12 32 12 Q46 12 50 30 Q44 22 38 26 Q34 18 28 25 Q22 20 14 30Z"
    : bangs === 1 ? "M13 32 Q14 10 32 10 Q50 10 51 32 L46 24 L40 30 L36 21 L30 29 L25 21 L20 29Z"
    : "M14 30 Q16 11 34 11 Q50 13 50 30 Q40 16 14 30Z";
  return wrap(bg, `${long ? `<path d="M12 30 Q10 56 18 64 L46 64 Q54 56 52 30Z" fill="${hair}"/>` : ""}
<ellipse cx="32" cy="34" rx="16" ry="17" fill="${skin}"/>
<path d="${bangPath}" fill="${hair}"/>
<ellipse cx="25" cy="36" rx="3.6" ry="4.8" fill="${eye}"/><ellipse cx="39" cy="36" rx="3.6" ry="4.8" fill="${eye}"/>
<circle cx="26.2" cy="34.2" r="1.4" fill="#fff"/><circle cx="40.2" cy="34.2" r="1.4" fill="#fff"/>
<path d="M21 30 l7 -1 M36 29 l7 1" stroke="${hair}" stroke-width="1.4" stroke-linecap="round"/>
${r.chance(0.6) ? `<ellipse cx="21" cy="42" rx="3" ry="1.6" fill="#fb7185" opacity=".45"/><ellipse cx="43" cy="42" rx="3" ry="1.6" fill="#fb7185" opacity=".45"/>` : ""}
<path d="M29 44 Q32 ${r.chance(0.5) ? 47 : 45} 35 44" stroke="#7a3b3b" stroke-width="1.3" fill="none" stroke-linecap="round"/>
${r.chance(0.25) ? `<path d="M44 14 l3 -6 l3 6 l-3 3z" fill="#fff" opacity=".8"/>` : ""}`);
}

function defaultPfp(r: Rng) {
  const bg = r.pick(["#5865f2", "#737c89", "#3ba55c", "#faa61a", "#ed4245", "#eb459f"].map((c) => c));
  return wrap(bg, `<circle cx="32" cy="26" r="10" fill="#fff" opacity=".92"/><path d="M14 54 Q16 38 32 38 Q48 38 50 54Z" fill="#fff" opacity=".92"/>`);
}

function pet(r: Rng) {
  const bg = r.pick(PASTEL), fur = r.pick(FUR), cat = r.chance(0.55);
  const ears = cat
    ? `<path d="M14 26 L18 8 L28 20Z M50 26 L46 8 L36 20Z" fill="${fur}"/><path d="M17 22 L19 12 L25 20Z M47 22 L45 12 L39 20Z" fill="#f9a8d4"/>`
    : `<ellipse cx="14" cy="32" rx="6" ry="13" fill="${fur}" transform="rotate(15 14 32)"/><ellipse cx="50" cy="32" rx="6" ry="13" fill="${fur}" transform="rotate(-15 50 32)"/>`;
  const patch = r.chance(0.4) ? `<ellipse cx="${r.chance(0.5) ? 24 : 40}" cy="30" rx="7" ry="6" fill="#fff" opacity=".5"/>` : "";
  return wrap(bg, `${ears}<ellipse cx="32" cy="36" rx="19" ry="17" fill="${fur}"/>${patch}
<ellipse cx="25" cy="33" rx="2.6" ry="3.2" fill="#111"/><ellipse cx="39" cy="33" rx="2.6" ry="3.2" fill="#111"/>
<circle cx="25.8" cy="32" r=".9" fill="#fff"/><circle cx="39.8" cy="32" r=".9" fill="#fff"/>
<ellipse cx="32" cy="41" rx="${cat ? 2 : 3.5}" ry="${cat ? 1.5 : 2.5}" fill="#3b2626"/>
<path d="M32 43 Q29 47 26 45 M32 43 Q35 47 38 45" stroke="#3b2626" stroke-width="1.1" fill="none"/>
${cat ? `<path d="M18 40 h-8 M18 43 l-7 2 M46 40 h8 M46 43 l7 2" stroke="#3b2626" stroke-width=".8"/>` : ""}
${!cat && r.chance(0.5) ? `<path d="M30 46 q2 6 4 0z" fill="#fb7185"/>` : ""}`);
}

function aesthetic(r: Rng) {
  const a = r.pick(["#f472b6", "#fb923c", "#a78bfa", "#38bdf8", "#facc15"]), b = r.pick(["#1e1b4b", "#312e81", "#0f172a", "#4c1d95", "#164e63"]);
  const id = `g${r.int(0, 1e6)}`;
  const mode = r.int(0, 2);
  const scene = mode === 0
    ? `<circle cx="32" cy="38" r="14" fill="#fde68a"/>${[40, 44, 48, 52].map((y, i) => `<rect x="0" y="${y}" width="64" height="${1.4 + i * 0.3}" fill="${b}"/>`).join("")}<rect x="0" y="54" width="64" height="10" fill="${b}"/>`
    : mode === 1
    ? `<circle cx="40" cy="22" r="9" fill="#f8fafc"/><circle cx="44" cy="19" r="8" fill="url(#${id})"/>${Array.from({ length: 9 }, () => `<circle cx="${r.int(2, 62)}" cy="${r.int(2, 40)}" r="${r.range(0.4, 1.1).toFixed(1)}" fill="#fff"/>`).join("")}<path d="M0 50 Q16 40 32 48 Q48 56 64 44 L64 64 L0 64Z" fill="${b}"/>`
    : `<path d="M0 64 L20 30 L32 44 L44 24 L64 64Z" fill="${b}" opacity=".85"/><path d="M14 40 l6 -10 l6 8z" fill="#fff" opacity=".6"/><circle cx="50" cy="14" r="5" fill="#fff" opacity=".85"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient></defs><rect width="64" height="64" fill="url(#${id})"/>${scene}</svg>`;
}

function pixel(r: Rng) {
  const bg = r.pick(["#638596", "#95554f", "#76a37d", "#c9a227", "#8e6fb3", "#5b7db1"]);
  const skin = r.pick(["#dbb180", "#ae8b61", "#713f1d", "#e8d0ff", "#9be070", "#c8fbfb"]);
  const hairC = r.pick(HAIR);
  const cells: string[] = [];
  const s = 4; // 16x16 grid at 4px
  const px = (x: number, y: number, c: string) => cells.push(`<rect x="${x * s}" y="${y * s}" width="${s}" height="${s}" fill="${c}"/>`);
  for (let y = 4; y < 16; y++) for (let x = 5; x < 12; x++) if (!(y > 12 && (x < 6 || x > 10))) px(x, y, skin);
  const hairStyle = r.int(0, 3);
  for (let x = 4; x < 13; x++) {
    if (hairStyle === 0) { px(x, 3, hairC); px(x, 4, hairC); }
    if (hairStyle === 1 && x % 2 === 0) { px(x, 2, hairC); px(x, 3, hairC); }
    if (hairStyle === 2) { px(x, 3, hairC); if (x < 6 || x > 10) for (let y = 4; y < 12; y++) px(x, y, hairC); }
  }
  if (hairStyle === 3) for (let x = 5; x < 12; x++) px(x, 3, "#222");
  if (r.chance(0.35)) { for (let x = 5; x < 12; x++) px(x, 7, "#111"); px(6, 8, "#111"); px(9, 8, "#111"); }
  else { px(7, 8, "#111"); px(10, 8, "#111"); }
  px(8, 10, "rgba(0,0,0,.25)");
  px(7, 12, "#5a2e2e"); px(8, 12, "#5a2e2e"); px(9, 12, "#5a2e2e");
  if (r.chance(0.3)) { px(12, 12, "#bbb"); px(13, 12, "#bbb"); px(14, 11, "#ddd"); }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" shape-rendering="crispEdges"><rect width="64" height="64" fill="${bg}"/>${cells.join("")}</svg>`;
}

function meme(r: Rng) {
  const bg = r.pick(["#fef08a", "#e2e8f0", "#fca5a5", "#a7f3d0", "#ffffff"]);
  const face = r.pick(["#facc15", "#f5d0a9", "#a3e635", "#fda4af"]);
  const v = r.int(0, 3);
  const eyes = v === 0 ? `<rect x="14" y="26" width="16" height="7" rx="2" fill="#111"/><rect x="34" y="26" width="16" height="7" rx="2" fill="#111"/><rect x="29" y="28" width="6" height="2" fill="#111"/>`
    : v === 1 ? `<circle cx="22" cy="28" r="7" fill="#fff" stroke="#111"/><circle cx="44" cy="30" r="4" fill="#fff" stroke="#111"/><circle cx="24" cy="30" r="2.4" fill="#111"/><circle cx="43" cy="31" r="1.6" fill="#111"/>`
    : v === 2 ? `<path d="M16 28 q6 -6 12 0 M36 28 q6 -6 12 0" stroke="#111" stroke-width="2.4" fill="none"/><path d="M18 31 q-2 8 -4 12 M46 31 q2 8 4 12" stroke="#60a5fa" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : `<circle cx="24" cy="29" r="3" fill="#111"/><circle cx="40" cy="29" r="3" fill="#111"/>`;
  const mouth = v === 2 ? `<path d="M20 40 Q32 54 44 40Z" fill="#7f1d1d"/>` : v === 3 ? `<rect x="22" y="40" width="20" height="3" rx="1.5" fill="#111"/>` : `<path d="M22 42 Q32 ${r.chance(0.5) ? 48 : 38} 42 42" stroke="#111" stroke-width="2.4" fill="none"/>`;
  return wrap(bg, `<circle cx="32" cy="34" r="22" fill="${face}" stroke="#111" stroke-width="1.5"/>${eyes}${mouth}${r.chance(0.3) ? `<text x="32" y="62" font-size="7" font-family="Impact,Arial Black,sans-serif" text-anchor="middle" fill="#111">${r.pick(["OK", "BRUH", "LOL", "NO", "W", "L"])}</text>` : ""}`);
}

function game(r: Rng) {
  const bg = r.pick(["#0f172a", "#111827", "#1e1b4b", "#052e16", "#3f0d12"]);
  const armor = r.pick(["#22d3ee", "#a3e635", "#f97316", "#e11d48", "#a78bfa", "#facc15", "#94a3b8"]);
  const visor = r.pick(["#fde047", "#67e8f9", "#f472b6", "#4ade80", "#f87171"]);
  const horns = r.chance(0.3) ? `<path d="M14 22 L8 6 L22 18Z M50 22 L56 6 L42 18Z" fill="${armor}" opacity=".9"/>` : "";
  return wrap(bg, `${horns}<path d="M12 34 Q12 12 32 12 Q52 12 52 34 L48 52 L16 52Z" fill="${armor}"/>
<path d="M18 30 Q32 ${r.chance(0.5) ? 24 : 28} 46 30 L44 38 Q32 42 20 38Z" fill="${visor}"/><path d="M22 31 l6 -2" stroke="#fff" stroke-width="1.5" opacity=".7"/>
<rect x="26" y="44" width="12" height="3" rx="1" fill="${bg}" opacity=".5"/>
${Array.from({ length: 6 }, (_, i) => `<circle cx="${8 + i * 10}" cy="${58 + (i % 2)}" r=".8" fill="${visor}"/>`).join("")}`);
}

function monogram(r: Rng, letter: string) {
  const bg = r.pick(BOLD);
  return wrap(bg, `<text x="32" y="43" font-size="30" font-weight="700" font-family="Georgia,serif" text-anchor="middle" fill="#fff">${letter.toUpperCase()}</text>`);
}

function abstract(r: Rng) {
  const bg = r.pick(["#0b1020", "#fafaf9", "#1c1917", "#172554"]);
  const shapes = Array.from({ length: r.int(3, 6) }, () => {
    const c = r.pick(BOLD), x = r.int(4, 60), y = r.int(4, 60), s = r.int(8, 26);
    return r.chance(0.5) ? `<circle cx="${x}" cy="${y}" r="${s / 2}" fill="${c}" opacity=".85"/>` : `<rect x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" fill="${c}" opacity=".8" transform="rotate(${r.int(0, 90)} ${x} ${y})"/>`;
  });
  return wrap(bg, shapes.join(""));
}

/** original hooded figure with a glowing visor; seed picks glow color, mask and glitch bars */
function hacker(r: Rng) {
  const glow = r.pick(["#39ff88", "#22d3ee", "#e8b84a", "#f43f5e", "#a78bfa"]);
  const bg = r.pick(["#07090d", "#0b1010", "#0d0a14", "#101014"]);
  const mask = r.int(0, 2);
  const face = mask === 0
    ? `<rect x="22" y="31" width="20" height="5" rx="2.5" fill="${glow}"/><rect x="22" y="31" width="20" height="5" rx="2.5" fill="${glow}" opacity=".35" filter="url(#hb)"/>`
    : mask === 1
      ? `<circle cx="27" cy="34" r="2.6" fill="${glow}"/><circle cx="37" cy="34" r="2.6" fill="${glow}"/><path d="M26 42 h12" stroke="${glow}" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>`
      : `<path d="M23 33 l5 -2 l0 4z M41 33 l-5 -2 l0 4z" fill="${glow}"/><path d="M27 41 q5 3 10 0" stroke="${glow}" stroke-width="1.4" fill="none"/>`;
  const bars = Array.from({ length: r.int(2, 4) }, () => `<rect x="${r.int(0, 40)}" y="${r.int(6, 58)}" width="${r.int(8, 24)}" height="${r.int(1, 3)}" fill="${glow}" opacity="${r.pick([0.25, 0.4, 0.55])}"/>`).join("");
  return wrap(bg, `<defs><filter id="hb"><feGaussianBlur stdDeviation="2"/></filter></defs>
<path d="M10 64 Q10 40 18 26 Q24 12 32 12 Q40 12 46 26 Q54 40 54 64Z" fill="#161a22"/>
<path d="M18 46 Q18 26 32 24 Q46 26 46 46 Q40 52 32 52 Q24 52 18 46Z" fill="#050608"/>
${face}${bars}`);
}

const cache = new Map<string, string>();

export function avatarSvg(style: PfpStyle, seed: number, name = "?"): string {
  const key = `${style}|${seed}|${name[0]}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = new Rng(seed);
  const svg = style === "anime" ? anime(r) : style === "default" ? defaultPfp(r) : style === "pet" ? pet(r) : style === "aesthetic" ? aesthetic(r)
    : style === "pixel" ? pixel(r) : style === "meme" ? meme(r) : style === "game" ? game(r) : style === "monogram" ? monogram(r, name.replace(/[^a-z]/gi, "")[0] ?? "?") : style === "hacker" ? hacker(r) : abstract(r);
  cache.set(key, svg);
  return svg;
}

export const avatarUri = (style: PfpStyle, seed: number, name?: string) => `data:image/svg+xml;utf8,${encodeURIComponent(avatarSvg(style, seed, name))}`;

/** @god's avatar: gold crown sigil. */
/** the player's avatar: initials on the suite's lime (no crown: the player is a person, not a brand) */
export const GOD_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#c6f432"/><circle cx="32" cy="25" r="11" fill="#0b0c0e"/><path d="M12 58c3-12 11-17 20-17s17 5 20 17Z" fill="#0b0c0e"/></svg>`)}`;
const playerCache = new Map<string, string>();
export function playerAvatar(name: string): string {
  const k = name.trim() || "?";
  let u = playerCache.get(k);
  if (!u) {
    const ini = k.split(/\s+/).map((w) => w[0]).join("").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase() || "?";
    u = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#c6f432"/><text x="32" y="41" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-weight="800" font-size="26" fill="#0b0c0e">${ini.replace(/[<&>"]/g, "")}</text></svg>`)}`;
    playerCache.set(k, u);
  }
  return u;
}
