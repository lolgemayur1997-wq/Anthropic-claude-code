/**
 * Delta-targeted strike picker.
 *
 * "Trade ATM ± 2 strikes" is heuristic; a real trader picks a strike by
 * target delta (e.g. 0.50 for ATM, 0.30 for a credit-spread short leg,
 * 0.70 for a directional long leg). This module finds the available strike
 * closest to a target delta using Black-Scholes.
 *
 * Returns null if the required inputs (spot, IV, DTE, rate) aren't all
 * present — never guesses.
 */

import { bsPrice, daysToYears, greeks, type OptionType } from "./greeks.ts";

export interface StrikePickerInputs {
  type: OptionType;
  spot: number;
  ivAnnualized: number; // ATM IV as a decimal
  dteDays: number;
  riskFreeRate: number; // annualized, continuous
  availableStrikes: number[];
  targetDelta: number; // absolute value for puts (e.g. 0.30 for a 30-delta put)
  dividendYield?: number;
}

export interface StrikePick {
  strike: number;
  delta: number; // signed for puts
  premium: number;
  deltaError: number; // |target - |delta||
}

export function pickStrikeByDelta(i: StrikePickerInputs): StrikePick | null {
  if (
    !Number.isFinite(i.spot) ||
    i.spot <= 0 ||
    !Number.isFinite(i.ivAnnualized) ||
    i.ivAnnualized <= 0 ||
    i.dteDays <= 0 ||
    i.availableStrikes.length === 0 ||
    i.targetDelta <= 0 ||
    i.targetDelta >= 1
  ) {
    return null;
  }

  const t = daysToYears(i.dteDays);
  const target = i.targetDelta;

  let best: StrikePick | null = null;
  for (const k of i.availableStrikes) {
    const inp = { s: i.spot, k, t, r: i.riskFreeRate, sigma: i.ivAnnualized, q: i.dividendYield };
    const g = greeks(i.type, inp);
    const price = bsPrice(i.type, inp);
    if (g === null || price === null) continue;
    const absDelta = Math.abs(g.delta);
    const err = Math.abs(target - absDelta);
    if (best === null || err < best.deltaError) {
      best = { strike: k, delta: g.delta, premium: price, deltaError: err };
    }
  }
  return best;
}

/** Pick two strikes for a vertical spread at target deltas (long leg, short leg). */
export function pickVerticalStrikes(
  i: Omit<StrikePickerInputs, "targetDelta">,
  longDelta: number,
  shortDelta: number,
): { long: StrikePick; short: StrikePick } | null {
  const long = pickStrikeByDelta({ ...i, targetDelta: longDelta });
  const short = pickStrikeByDelta({ ...i, targetDelta: shortDelta });
  if (!long || !short) return null;
  if (long.strike === short.strike) return null;
  return { long, short };
}
