# Design system

One visual language for the whole suite, so the four apps feel like they belong to the same small phone OS. All names, marks and colours are original.

## Apps

| App | What it is | Mark | Route |
|---|---|---|---|
| **Lanternfish** | wallet | a lime lure on a dark circle | `#/wallet` |
| **Kiteline** | paper trading on real prices | a kite on a line | `#/trade` |
| **Lounge** | group chat | speech bubbles | `#/lounge` |
| **Murmur** | social feed | three rising ripples | `#/feed` |

Names live in `src/lib/brand.ts`, so renaming is a one-line change.

## Colour tokens (dark first)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0b0c0e` | app background, tab bars |
| `--surface` | `#141518` | cards, sheets, lists |
| `--surface-2` | `#1b1d21` | pressed / hover |
| `--surface-3` | `#23262b` | inputs, chips |
| `--border` | `#2a2d33` | hairlines (1 px) |
| `--text` | `#eceef1` | primary text |
| `--muted` | `#8b919b` | secondary text |
| `--header` | `#ffffff` | titles |
| `--accent` | `#c6f432` | electric lime: primary actions, active tab, focus |
| `--accent-ink` | `#0b0c0e` | text on lime |
| `--up` | `#3ddc84` | gains |
| `--down` | `#ff5a5f` | losses, destructive |
| `--warn` | `#ffb020` | stale data, idle |

Lime is for action and selection only. Gains and losses are always green and red with an arrow and a sign (+/−), so they never rely on colour alone. Contrast is AA or better for text on `--bg` and `--surface`.

## Type

Geist (open licence, already bundled), with tabular numbers for money.

| Style | Size / line | Weight |
|---|---|---|
| Display (balances) | 40/44 | 700, tabular |
| Title | 24/30 | 800 |
| Headline | 17/22 | 700 |
| Body | 16/22 | 400 |
| Callout | 15/20 | 500 |
| Caption | 13/18 | 500 |
| Micro | 11/14 | 600, uppercase labels only |

## Spacing, size, shape

- 4 px grid; screen gutter 16 px; list row height 64 px (tokens) or 56 px (settings).
- Hit areas at least 44 × 44 px.
- Radii: 12 (cards, rows), 16 (sheets), 999 (pills, avatars).
- Elevation: sheets use a 1 px top hairline plus `0 -12px 40px rgb(0 0 0 / .45)`; no other shadows.

## Motion

| Motion | Curve | Duration |
|---|---|---|
| Push / pop screen | `cubic-bezier(.2,.8,.2,1)` | 300 ms |
| Sheet open | spring: overshoot 1.5 % | 360 ms |
| Sheet drag dismiss | follows finger; release past 30 % or fast flick | — |
| Tap feedback | scale .96 | 90 ms |
| Number change | digits roll | 450 ms |
| Skeleton shimmer | linear | 1.2 s loop |

Reduced motion turns all of these into instant changes. Haptics (`navigator.vibrate`): 6 ms on tab change, 10 ms on confirm, 14 ms on long-press.

## Patterns

- **Home**: status row (time, network), a balance widget (from Lanternfish), a market widget (from Kiteline), then the four app icons. A slim home indicator at the bottom of every app returns here.
- **Tab bars**: icon + label, active in white with a lime dot; badges red.
- **Sheets**: grab handle, title, content, one primary lime button at the bottom.
- **Lists**: avatar/icon 40 px, title + subtitle on the left, value + change on the right.
- **Loading**: skeletons in the final layout; never spinners in content. Data age is shown as "updated 12s ago"; stale data turns the label amber.
- **Empty states**: one sentence and one action.
- **Exports**: every image that leaves the app carries a small "fictional · <app>" mark in a corner.
