/** Money and number formatting for the wallet and trading apps. */
const SUB = "₀₁₂₃₄₅₆₇₈₉";
const n = (v: number | string) => (typeof v === "string" ? Number(v) : v);

export function fmtUsd(v: number | string, opts: { sign?: boolean } = {}): string {
  const x = n(v);
  const s = x < 0 ? "−" : opts.sign && x > 0 ? "+" : "";
  return `${s}$${Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
/** prices of tiny memecoins: $0.0₅2995 (count of zeros as a subscript), like trading apps show them */
export function fmtPrice(v: number | string): string {
  const x = n(v);
  if (!isFinite(x) || x <= 0) return "$0";
  if (x >= 1000) return `$${x.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (x >= 1) return `$${x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  if (x >= 0.0001) return `$${x.toPrecision(4).replace(/0+$/, "").replace(/\.$/, "")}`;
  const str = x.toFixed(20);
  const zeros = str.slice(2).match(/^0*/)![0].length;
  const digits = str.slice(2 + zeros, 2 + zeros + 4).replace(/0+$/, "");
  return `$0.0${String(zeros).split("").map((d) => SUB[Number(d)]).join("")}${digits}`;
}
export function fmtCompactUsd(v: number | string): string {
  const x = n(v);
  if (!x) return "—";
  const a = Math.abs(x);
  const f = (d: number, u: string) => `$${(x / d).toFixed(a / d >= 100 ? 0 : 1)}${u}`;
  return a >= 1e9 ? f(1e9, "B") : a >= 1e6 ? f(1e6, "M") : a >= 1e3 ? f(1e3, "K") : `$${x.toFixed(0)}`;
}
export function fmtAmount(v: number | string): string {
  const x = n(v);
  const a = Math.abs(x);
  if (a >= 1e9) return `${(x / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(x / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(x / 1e3).toFixed(2)}K`;
  if (a >= 1) return x.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return x.toPrecision(4);
}
export const fmtPct = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}%`;
export function fmtAge(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}
