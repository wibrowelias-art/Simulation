"use client";
/**
 * P&L share cards, drawn on a canvas. Every card carries the "fictional" mark in a corner (rule: anything that
 * leaves the app says it is fictional). Shared with the Web Share API when available, else downloaded.
 */
import { exportMark, type AppId } from "@/lib/brand";

export interface CardLine { label: string; value: string }
export interface Card { app: AppId; title: string; big: string; good: boolean; sub: string; lines: CardLine[]; handle: string; when: string }

export function drawCard(c: Card, W = 1080, H = 1350): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d")!;
  const font = (px: number, w = 700) => `${w} ${px}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
  g.fillStyle = "#0b0c0e"; g.fillRect(0, 0, W, H);
  const grad = g.createRadialGradient(W * 0.8, H * 0.1, 10, W * 0.8, H * 0.1, W);
  grad.addColorStop(0, c.good ? "rgba(61,220,132,.28)" : "rgba(255,90,95,.26)"); grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // app mark: a lime kite
  g.fillStyle = "#c6f432"; g.beginPath(); g.moveTo(120, 90); g.lineTo(170, 140); g.lineTo(120, 190); g.lineTo(70, 140); g.closePath(); g.fill();
  g.fillStyle = "#eceef1"; g.font = font(44, 800); g.fillText(c.app === "trade" ? "Kiteline" : "Lanternfish", 200, 156);
  g.fillStyle = "#8b919b"; g.font = font(40, 600); g.fillText(c.title, 80, 330);
  g.fillStyle = c.good ? "#3ddc84" : "#ff5a5f"; g.font = font(150, 800); g.fillText(c.big, 72, 500);
  g.fillStyle = "#eceef1"; g.font = font(48, 600); g.fillText(c.sub, 80, 590);
  let yy = 720;
  for (const l of c.lines.slice(0, 5)) {
    g.fillStyle = "#8b919b"; g.font = font(40, 500); g.fillText(l.label, 80, yy);
    g.fillStyle = "#eceef1"; g.font = font(44, 700); const tw = g.measureText(l.value).width; g.fillText(l.value, W - 80 - tw, yy);
    g.fillStyle = "#2a2d33"; g.fillRect(80, yy + 30, W - 160, 2);
    yy += 100;
  }
  g.fillStyle = "#eceef1"; g.font = font(42, 700); g.fillText(`@${c.handle}`, 80, H - 120);
  g.fillStyle = "#8b919b"; g.font = font(34, 500); g.fillText(c.when, 80, H - 70);
  // the fictional mark, always
  const mark = exportMark(c.app);
  g.font = font(30, 700);
  const mw = g.measureText(mark).width;
  g.fillStyle = "rgba(255,255,255,.08)"; roundRect(g, W - mw - 120, H - 132, mw + 48, 64, 32); g.fill();
  g.fillStyle = "#c6f432"; g.fillText(mark, W - mw - 96, H - 88);
  return cv;
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export async function shareCard(c: Card, name = "pnl.png"): Promise<"shared" | "downloaded" | "failed"> {
  try {
    const cv = drawCard(c);
    const blob: Blob | null = await new Promise((r) => cv.toBlob(r, "image/png"));
    if (!blob) return "failed";
    const file = new File([blob], name, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [file] })) { await nav.share({ files: [file], title: c.title }); return "shared"; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return "downloaded";
  } catch { return "failed"; }
}
