/**
 * Opening-gap classifier.
 *
 * The first-hour setup depends more on HOW the gap resolves than on the
 * gap size itself. Seven named classes:
 *
 *   none                     gap ≤ noise threshold
 *   gap-up-continuation      gap-up + price holds above open, extends up
 *   gap-up-reverse           gap-up + fills into prior-day-close + fails
 *   gap-down-continuation    gap-down + price stays below open, extends down
 *   gap-down-reverse         gap-down + reclaims prior-day-close + extends up
 *   gap-fill                 price returns to prior-day-close; direction unclear
 *   inside-day               current high<pdh AND low>pdl (rare intraday)
 *
 * Pure function. Returns null when inputs are missing. Never throws.
 */

import type { Candle } from "./indicators.ts";

export type GapClass =
  | "none"
  | "gap-up-continuation"
  | "gap-up-reverse"
  | "gap-down-continuation"
  | "gap-down-reverse"
  | "gap-fill"
  | "inside-day";

export interface GapInputs {
  prevClose: number;
  prevHigh: number;
  prevLow: number;
  todayOpen: number;
  candles5m: Candle[];      // today's candles so far
  gapNoisePct?: number;     // default 0.2% — gap below this is "none"
}

export interface GapResult {
  gapClass: GapClass;
  gapPct: number;            // signed: + up, - down
  notes: string[];
}

export function classifyGap(i: GapInputs): GapResult | null {
  if (i.prevClose <= 0 || i.todayOpen <= 0) return null;
  if (i.candles5m.length === 0) return null;

  const noise = i.gapNoisePct ?? 0.2;
  const gapPct = ((i.todayOpen - i.prevClose) / i.prevClose) * 100;
  const closes = i.candles5m.map((c) => c.close);
  const highs = i.candles5m.map((c) => c.high);
  const lows = i.candles5m.map((c) => c.low);
  const lastClose = closes[closes.length - 1]!;
  const dayHigh = Math.max(...highs);
  const dayLow = Math.min(...lows);

  // 1. No meaningful gap — this wins over inside-day, since a tiny-gap
  //    inside-range day is really "no gap happening" in any useful sense.
  if (Math.abs(gapPct) < noise) {
    return { gapClass: "none", gapPct, notes: [`gap ${gapPct.toFixed(2)}% below noise threshold ${noise}%`] };
  }

  // 2. Inside-day: meaningful gap but today's whole range sits inside
  //    yesterday's range. Direction unclear until a break occurs.
  if (dayHigh < i.prevHigh && dayLow > i.prevLow) {
    return {
      gapClass: "inside-day",
      gapPct,
      notes: [`today's range [${fmt(dayLow)}, ${fmt(dayHigh)}] inside prior [${fmt(i.prevLow)}, ${fmt(i.prevHigh)}]`],
    };
  }

  // 3. Has gap been filled? (price crossed back through prevClose)
  const gapUp = gapPct > 0;
  const gapFilled = gapUp
    ? dayLow <= i.prevClose
    : dayHigh >= i.prevClose;

  // 4. Continuation vs reverse logic
  if (gapUp) {
    // Still above prior close AND making new highs → continuation
    if (!gapFilled && lastClose > i.todayOpen) {
      return {
        gapClass: "gap-up-continuation",
        gapPct,
        notes: [
          `gap +${gapPct.toFixed(2)}% held; last close > open by ${fmt(lastClose - i.todayOpen)}`,
        ],
      };
    }
    // Gap filled AND price below prior close → reversal
    if (gapFilled && lastClose < i.prevClose) {
      return {
        gapClass: "gap-up-reverse",
        gapPct,
        notes: [
          `gap +${gapPct.toFixed(2)}% filled; price now ${fmt(lastClose - i.prevClose)} below prev close`,
        ],
      };
    }
    // Filled but hovering near prev close → gap-fill
    if (gapFilled) {
      return {
        gapClass: "gap-fill",
        gapPct,
        notes: [`gap +${gapPct.toFixed(2)}% filled; price near prev close`],
      };
    }
    // Not filled but below open — mid-state, call it gap-up-reverse (bias)
    return {
      gapClass: "gap-up-reverse",
      gapPct,
      notes: [`gap +${gapPct.toFixed(2)}%; price below open, momentum weak`],
    };
  }

  // gapDown
  if (!gapFilled && lastClose < i.todayOpen) {
    return {
      gapClass: "gap-down-continuation",
      gapPct,
      notes: [
        `gap ${gapPct.toFixed(2)}% held; last close < open by ${fmt(lastClose - i.todayOpen)}`,
      ],
    };
  }
  if (gapFilled && lastClose > i.prevClose) {
    return {
      gapClass: "gap-down-reverse",
      gapPct,
      notes: [
        `gap ${gapPct.toFixed(2)}% filled; price now ${fmt(lastClose - i.prevClose)} above prev close`,
      ],
    };
  }
  if (gapFilled) {
    return {
      gapClass: "gap-fill",
      gapPct,
      notes: [`gap ${gapPct.toFixed(2)}% filled; price near prev close`],
    };
  }
  return {
    gapClass: "gap-down-reverse",
    gapPct,
    notes: [`gap ${gapPct.toFixed(2)}%; price above open, bouncing`],
  };
}

function fmt(n: number): string {
  return n.toFixed(2);
}

/** Is the intended bias compatible with the gap class? Returns a human
 *  reason if conflict, null if compatible. */
export function gapBiasConflict(
  gapClass: GapClass,
  bias: "long" | "short",
): string | null {
  const map: Record<GapClass, Array<"long" | "short">> = {
    "gap-up-continuation": ["long"],
    "gap-up-reverse": ["short"],
    "gap-down-continuation": ["short"],
    "gap-down-reverse": ["long"],
    "gap-fill": [],          // both sides possible
    "inside-day": [],        // both sides possible (wait for break)
    "none": [],              // no gap signal
  };
  const allowed = map[gapClass];
  if (allowed.length === 0) return null; // neutral — no conflict
  if (allowed.includes(bias)) return null;
  return `${bias} bias fights ${gapClass}`;
}
