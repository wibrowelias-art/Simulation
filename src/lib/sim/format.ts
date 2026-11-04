export function fmtMoney(n: number, opts: { sign?: boolean } = {}): string {
  const a = Math.abs(n);
  const s = n < 0 ? "-" : opts.sign ? "+" : "";
  if (a >= 1e12) return `${s}$${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(a >= 1e11 ? 0 : a >= 1e10 ? 1 : 2)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${a.toFixed(0)}`;
}
export function fmtCount(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(0)}K`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}
export function relTime(t: number, now: number): string {
  const d = Math.max(0, now - t) / 1000;
  if (d < 45) return "now";
  if (d < 3600) return `${Math.round(d / 60)}m`;
  if (d < 86400) return `${Math.round(d / 3600)}h`;
  return `${Math.round(d / 86400)}d`;
}
/** "just now" / "5m ago" — never "now ago". */
export function relAgo(t: number, now: number): string {
  const r = relTime(t, now);
  return r === "now" ? "just now" : `${r} ago`;
}
export function clockTime(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
export function dayLabel(t: number, now: number): string {
  const a = new Date(t), b = new Date(now);
  if (a.toDateString() === b.toDateString()) return `Today at ${clockTime(t)}`;
  const y = new Date(now - 86400000);
  if (a.toDateString() === y.toDateString()) return `Yesterday at ${clockTime(t)}`;
  return `${a.toLocaleDateString([], { month: "short", day: "numeric" })} ${clockTime(t)}`;
}
export function dayOnly(t: number, now: number): string {
  const a = new Date(t), b = new Date(now);
  if (a.toDateString() === b.toDateString()) return "Today";
  if (a.toDateString() === new Date(now - 86400000).toDateString()) return "Yesterday";
  return a.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}
