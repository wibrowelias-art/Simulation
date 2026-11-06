"use client";
/** Original app marks (simple SVGs). No third-party logos or icon files. */
import type { AppId } from "@/lib/brand";

const LIME = "var(--accent)";

export function AppMark({ app, size = 60 }: { app: AppId; size?: number }) {
  const r = size * 0.24;
  const common = { width: size, height: size, viewBox: "0 0 64 64", "aria-hidden": true } as const;
  switch (app) {
    case "wallet": // a lantern-lure over a dark sea
      return (
        <svg {...common} style={{ borderRadius: r }}>
          <defs><linearGradient id="lf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22344a" /><stop offset="1" stopColor="#0a0e14" /></linearGradient></defs>
          <rect width="64" height="64" fill="url(#lf)" />
          <rect x=".5" y=".5" width="63" height="63" rx="15" fill="none" stroke="#fff" strokeOpacity=".1" />
          <path d="M18 40c6-9 18-12 28-6-4 1-6 3-6 6s2 5 6 6c-10 6-22 3-28-6Z" fill="#e8edf2" />
          <circle cx="26" cy="38" r="1.8" fill="#07090c" />
          <path d="M30 31c-1-6 1-11 6-14" stroke="#e8edf2" strokeWidth="2" fill="none" strokeLinecap="round" />
          <circle cx="37" cy="16" r="4.5" fill={LIME} />
          <circle cx="37" cy="16" r="9" fill={LIME} opacity=".18" />
        </svg>
      );
    case "trade": // a kite on a line
      return (
        <svg {...common} style={{ borderRadius: r }}>
          <rect width="64" height="64" fill={LIME} />
          <path d="M38 10 52 24 38 38 24 24Z" fill="#0b0c0e" />
          <path d="M38 10v28M24 24h28" stroke={LIME} strokeWidth="1.6" />
          <path d="M38 38c-4 6-12 6-15 11s-8 6-11 4" stroke="#0b0c0e" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        </svg>
      );
    case "lounge": // two speech bubbles
      return (
        <svg {...common} style={{ borderRadius: r }}>
          <rect width="64" height="64" fill="#1b1d21" />
          <rect x="12" y="15" width="30" height="21" rx="9" fill={LIME} />
          <path d="M18 36l-2 7 8-7Z" fill={LIME} />
          <rect x="24" y="27" width="28" height="20" rx="9" fill="#eceef1" />
          <path d="M46 47l2 6-8-6Z" fill="#eceef1" />
          <circle cx="32" cy="37" r="1.8" fill="#1b1d21" /><circle cx="38" cy="37" r="1.8" fill="#1b1d21" /><circle cx="44" cy="37" r="1.8" fill="#1b1d21" />
        </svg>
      );
    case "feed": // ripples rising from a point
      return (
        <svg {...common} style={{ borderRadius: r }}>
          <rect width="64" height="64" fill="#eceef1" />
          <circle cx="22" cy="44" r="4" fill="#0b0c0e" />
          {[12, 21, 30].map((rr, i) => <path key={rr} d={`M${22 + rr} 44a${rr} ${rr} 0 0 0 -${rr} -${rr}`} stroke={i === 1 ? "#5d8a00" : "#0b0c0e"} strokeWidth="4" fill="none" strokeLinecap="round" />)}
        </svg>
      );
  }
}
