import { describe, expect, test } from "bun:test";
import type { Candle } from "./indicators.ts";
import { classifyRegime, regimeStructureConflict } from "./regime.ts";

function linearCandles(startPrice: number, step: number, n: number): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const base = startPrice + step * i;
    return {
      time: i * 900, // 15-min bars in seconds
      open: base,
      high: base + Math.abs(step) * 0.4,
      low: base - Math.abs(step) * 0.4,
      close: base + step * 0.6,
      volume: 1000,
    };
  });
}

function flatCandles(price: number, jitter: number, n: number): Candle[] {
  return Array.from({ length: n }, (_, i) => ({
    time: i * 900,
    open: price + (i % 2 === 0 ? jitter : -jitter) * 0.5,
    high: price + jitter,
    low: price - jitter,
    close: price + (i % 2 === 0 ? -jitter : jitter) * 0.3,
    volume: 1000,
  }));
}

const priorCloses = Array.from({ length: 20 }, (_, i) => 100 + i * 0.5);

describe("classifyRegime", () => {
  test("null on insufficient candles", () => {
    const r = classifyRegime({
      candles15m: linearCandles(100, 1, 3),
      prevCloses: priorCloses,
      vix: 15,
    });
    expect(r).toBeNull();
  });

  test("strong uptrend → TREND", () => {
    const r = classifyRegime({
      candles15m: linearCandles(100, 1.5, 20),
      prevCloses: priorCloses,
      vix: 15,
    })!;
    expect(r.regime).toBe("TREND");
    expect(r.confidence).toBeGreaterThan(0.5);
  });

  test("strong downtrend → TREND", () => {
    const r = classifyRegime({
      candles15m: linearCandles(120, -1.5, 20),
      prevCloses: priorCloses,
      vix: 15,
    })!;
    expect(r.regime).toBe("TREND");
  });

  test("flat oscillation → RANGE", () => {
    const r = classifyRegime({
      candles15m: flatCandles(100, 0.3, 20),
      prevCloses: priorCloses,
      vix: 14,
    })!;
    // RANGE or CHOPPY are both defensible here; assert it's NOT TREND and
    // NOT REVERSAL.
    expect(["RANGE", "CHOPPY"]).toContain(r.regime);
  });

  test("first-half up then second-half down → REVERSAL", () => {
    const up = linearCandles(100, 1.2, 10);
    const down = linearCandles(112, -1.2, 10).map((c, i) => ({
      ...c,
      time: (10 + i) * 900,
    }));
    const r = classifyRegime({
      candles15m: [...up, ...down],
      prevCloses: priorCloses,
      vix: 16,
    })!;
    expect(r.regime).toBe("REVERSAL");
  });

  test("high VIX + no clean pattern → CHOPPY", () => {
    // Mixed-up noisy series with alternating directions, no clear trend.
    const c: Candle[] = Array.from({ length: 20 }, (_, i) => ({
      time: i * 900,
      open: 100 + (i % 3 === 0 ? 1 : -1),
      high: 101,
      low: 99,
      close: 100 + (i % 2 === 0 ? 0.2 : -0.2),
      volume: 1000,
    }));
    const r = classifyRegime({
      candles15m: c,
      prevCloses: priorCloses,
      vix: 26,
    })!;
    expect(r.regime).toBe("CHOPPY");
  });
});

describe("regimeStructureConflict", () => {
  test("TREND + iron-fly is a conflict", () => {
    expect(regimeStructureConflict("TREND", "iron-fly")).not.toBeNull();
  });
  test("TREND + call-debit-spread is fine", () => {
    expect(regimeStructureConflict("TREND", "call-debit-spread")).toBeNull();
  });
  test("RANGE + long-call is a conflict (theta)", () => {
    expect(regimeStructureConflict("RANGE", "long-call")).not.toBeNull();
  });
  test("RANGE + iron-fly is fine", () => {
    expect(regimeStructureConflict("RANGE", "iron-fly")).toBeNull();
  });
  test("CHOPPY flags any structure", () => {
    expect(regimeStructureConflict("CHOPPY", "long-call")).not.toBeNull();
    expect(regimeStructureConflict("CHOPPY", "iron-fly")).not.toBeNull();
  });
  test("REVERSAL + iron-fly is a conflict", () => {
    expect(regimeStructureConflict("REVERSAL", "iron-fly")).not.toBeNull();
  });
});
