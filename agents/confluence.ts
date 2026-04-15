/**
 * Multi-timeframe confluence scorer.
 *
 * A professional never acts on one timeframe. This module scores how well
 * 5m, 15m, and 1h agree on: trend direction, position vs VWAP, RSI regime,
 * EMA stack.
 *
 * Returns a score in [0, 1] where:
 *   1.0 = full alignment across all three TFs
 *   0.5 = mixed signals
 *   0.0 = TFs actively disagree
 *
 * Also returns the specific alignments and conflicts as human-readable
 * observations the senior-trader can quote.
 */

import type { Candle } from "./indicators.ts";
import { ema, emaStack, rsi, vwap, type EmaStack } from "./indicators.ts";

export type Direction = "up" | "down" | "neutral";

export interface ConfluenceInputs {
  candles5m: Candle[];
  candles15m: Candle[];
  candles1h: Candle[];
  ltp: number;
}

export interface ConfluenceResult {
  score: number;              // 0..1
  trend5m: Direction;
  trend15m: Direction;
  trend1h: Direction;
  aligned: string[];          // things that agreed across TFs
  conflicts: string[];        // things that disagreed
}

export function scoreConfluence(i: ConfluenceInputs): ConfluenceResult | null {
  if (
    i.candles5m.length < 20 ||
    i.candles15m.length < 20 ||
    i.candles1h.length < 10 ||
    i.ltp <= 0
  ) {
    return null;
  }

  const trend5m = trendFromEmas(i.candles5m);
  const trend15m = trendFromEmas(i.candles15m);
  const trend1h = trendFromEmas(i.candles1h);

  const vwap5m = vwap(i.candles5m);
  const vwap15m = vwap(i.candles15m);
  const vwap1h = vwap(i.candles1h);

  const rsi5m = rsi(i.candles5m.map((c) => c.close), 14);
  const rsi15m = rsi(i.candles15m.map((c) => c.close), 14);
  const rsi1h = rsi(i.candles1h.map((c) => c.close), 14);

  const aligned: string[] = [];
  const conflicts: string[] = [];
  let score = 0;
  let maxScore = 0;

  // Trend agreement (weight: 3 of 10)
  maxScore += 3;
  const trendVotes = [trend5m, trend15m, trend1h];
  const ups = trendVotes.filter((t) => t === "up").length;
  const downs = trendVotes.filter((t) => t === "down").length;
  if (ups === 3) {
    score += 3;
    aligned.push("all TFs trending up");
  } else if (downs === 3) {
    score += 3;
    aligned.push("all TFs trending down");
  } else if (ups === 2 && downs === 0) {
    score += 2;
    aligned.push("2 of 3 TFs up, none down");
  } else if (downs === 2 && ups === 0) {
    score += 2;
    aligned.push("2 of 3 TFs down, none up");
  } else if (ups > 0 && downs > 0) {
    conflicts.push(`trend conflict: 5m=${trend5m}, 15m=${trend15m}, 1h=${trend1h}`);
  }

  // VWAP-side agreement (weight: 3 of 10)
  maxScore += 3;
  const vwapVotes = [
    vwap5m !== null && i.ltp > vwap5m ? "up" : vwap5m !== null && i.ltp < vwap5m ? "down" : "neutral",
    vwap15m !== null && i.ltp > vwap15m ? "up" : vwap15m !== null && i.ltp < vwap15m ? "down" : "neutral",
    vwap1h !== null && i.ltp > vwap1h ? "up" : vwap1h !== null && i.ltp < vwap1h ? "down" : "neutral",
  ];
  const vUps = vwapVotes.filter((v) => v === "up").length;
  const vDowns = vwapVotes.filter((v) => v === "down").length;
  if (vUps === 3) {
    score += 3;
    aligned.push("price above VWAP on all TFs");
  } else if (vDowns === 3) {
    score += 3;
    aligned.push("price below VWAP on all TFs");
  } else if (vUps === 2 && vDowns === 0) {
    score += 1.5;
  } else if (vDowns === 2 && vUps === 0) {
    score += 1.5;
  } else if (vUps > 0 && vDowns > 0) {
    conflicts.push("VWAP-side conflict across TFs");
  }

  // RSI regime agreement (weight: 2 of 10)
  maxScore += 2;
  const rsiRegimes = [rsi5m, rsi15m, rsi1h].map((r) => {
    if (r === null) return "neutral" as const;
    if (r > 55) return "up" as const;
    if (r < 45) return "down" as const;
    return "neutral" as const;
  });
  const rUps = rsiRegimes.filter((r) => r === "up").length;
  const rDowns = rsiRegimes.filter((r) => r === "down").length;
  if (rUps === 3) {
    score += 2;
    aligned.push("RSI > 55 on all TFs");
  } else if (rDowns === 3) {
    score += 2;
    aligned.push("RSI < 45 on all TFs");
  } else if (rUps > 0 && rDowns > 0) {
    conflicts.push("RSI regime conflict across TFs");
  }

  // EMA stack alignment (weight: 2 of 10)
  maxScore += 2;
  const stacks: EmaStack[] = [
    emaStack(i.candles5m.map((c) => c.close)) ?? "tangled",
    emaStack(i.candles15m.map((c) => c.close)) ?? "tangled",
    emaStack(i.candles1h.map((c) => c.close)) ?? "tangled",
  ];
  const sUp = stacks.filter((s) => s === "up").length;
  const sDown = stacks.filter((s) => s === "down").length;
  if (sUp === 3) {
    score += 2;
    aligned.push("EMA stack up on all TFs");
  } else if (sDown === 3) {
    score += 2;
    aligned.push("EMA stack down on all TFs");
  } else if (sUp > 0 && sDown > 0) {
    conflicts.push("EMA stack conflict (up on one TF, down on another)");
  }

  return {
    score: maxScore === 0 ? 0 : Math.min(1, Math.max(0, score / maxScore)),
    trend5m,
    trend15m,
    trend1h,
    aligned,
    conflicts,
  };
}

/** Simple trend classifier from EMA(9) vs EMA(20) on a candle series. */
function trendFromEmas(candles: Candle[]): Direction {
  const closes = candles.map((c) => c.close);
  const fast = ema(closes, 9);
  const slow = ema(closes, 20);
  if (fast === null || slow === null) return "neutral";
  const diff = (fast - slow) / slow;
  if (diff > 0.001) return "up";
  if (diff < -0.001) return "down";
  return "neutral";
}
