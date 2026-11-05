/** How the rest of the world hears about the player's trades. Filled in by the shared-world phase. */
import type { TradeFill, WorldState } from "@/lib/sim/types";

export function tradeRipple(_s: WorldState, _f: TradeFill, _now: number) {
  void _s; void _f; void _now;
}

export function transferRipple(_s: WorldState, _x: import("@/lib/sim/types").Transfer, _now: number) {
  void _s; void _x; void _now;
}
