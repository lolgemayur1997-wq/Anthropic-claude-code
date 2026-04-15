import { describe, expect, test } from "bun:test";
import {
  atr,
  bollinger,
  ema,
  emaStack,
  macd,
  rsi,
  sma,
  supertrend,
  vwap,
  type Candle,
} from "./indicators.ts";

const approx = (a: number, b: number, tol = 1e-6): boolean => Math.abs(a - b) < tol;

function candles(values: number[], vol = 100): Candle[] {
  return values.map((v, i) => ({
    time: i,
    open: v,
    high: v + 0.5,
    low: v - 0.5,
    close: v,
    volume: vol,
  }));
}

describe("sma", () => {
  test("returns null when input shorter than period", () => {
    expect(sma([1, 2], 5)).toBeNull();
  });
  test("computes mean of last period values", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toBe(4);
  });
});

describe("ema", () => {
  test("null on insufficient data", () => {
    expect(ema([1, 2], 5)).toBeNull();
  });
  test("converges toward monotonic series", () => {
    const v = ema([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 3)!;
    // Must sit between the last value and the SMA — i.e. weighted toward recent.
    expect(v).toBeGreaterThan(80);
    expect(v).toBeLessThan(100);
  });
});

describe("rsi", () => {
  test("null on insufficient data", () => {
    expect(rsi([1, 2, 3], 14)).toBeNull();
  });
  test("strictly rising series yields RSI == 100", () => {
    const v = rsi(Array.from({ length: 30 }, (_, i) => i + 1), 14)!;
    expect(v).toBe(100);
  });
  test("strictly falling series yields RSI near 0", () => {
    const v = rsi(Array.from({ length: 30 }, (_, i) => 30 - i), 14)!;
    expect(v).toBeLessThan(1);
  });
});

describe("macd", () => {
  test("null inputs when data insufficient", () => {
    const r = macd([1, 2, 3, 4, 5]);
    expect(r.macd).toBeNull();
    expect(r.signal).toBeNull();
    expect(r.hist).toBeNull();
  });
  test("rising series produces positive macd line", () => {
    // Fast EMA tracks recent (higher) values, slow EMA lags — macd > 0.
    // Histogram can converge to 0 on perfectly linear series; testing macd.
    const r = macd(Array.from({ length: 60 }, (_, i) => 100 + i));
    expect(r.macd).not.toBeNull();
    expect(r.macd!).toBeGreaterThan(0);
  });
  test("falling series produces negative macd line", () => {
    const r = macd(Array.from({ length: 60 }, (_, i) => 200 - i));
    expect(r.macd).not.toBeNull();
    expect(r.macd!).toBeLessThan(0);
  });
});

describe("vwap", () => {
  test("returns null when no volume", () => {
    expect(vwap([{ time: 0, open: 10, high: 11, low: 9, close: 10, volume: 0 }])).toBeNull();
  });
  test("matches simple weighted average", () => {
    const c: Candle[] = [
      { time: 1, open: 10, high: 10, low: 10, close: 10, volume: 100 },
      { time: 2, open: 20, high: 20, low: 20, close: 20, volume: 100 },
    ];
    // TP = close for flat candles. VWAP = (10*100 + 20*100) / 200 = 15
    expect(approx(vwap(c)!, 15)).toBeTrue();
  });
});

describe("atr", () => {
  test("null on insufficient data", () => {
    expect(atr(candles([1, 2, 3]), 14)).toBeNull();
  });
  test("flat candles yield positive ATR equal to H-L", () => {
    // Each candle has H-L = 1. Wilder ATR stabilises at 1.
    const c = candles(Array.from({ length: 30 }, () => 100));
    const a = atr(c, 14)!;
    expect(approx(a, 1, 1e-6)).toBeTrue();
  });
});

describe("supertrend", () => {
  test("null on insufficient data", () => {
    expect(supertrend(candles([1, 2, 3]), 10, 3)).toBeNull();
  });
  test("rising series resolves to up trend", () => {
    const c = candles(Array.from({ length: 40 }, (_, i) => 100 + i * 2));
    const r = supertrend(c, 10, 3)!;
    expect(r.trend).toBe("up");
  });
  test("falling series resolves to down trend", () => {
    const c = candles(Array.from({ length: 40 }, (_, i) => 200 - i * 2));
    const r = supertrend(c, 10, 3)!;
    expect(r.trend).toBe("down");
  });
});

describe("bollinger", () => {
  test("null on insufficient data", () => {
    expect(bollinger([1, 2, 3], 20)).toBeNull();
  });
  test("flat series collapses bands to mid", () => {
    const b = bollinger(Array.from({ length: 25 }, () => 50), 20, 2)!;
    expect(b.mid).toBe(50);
    expect(b.upper).toBe(50);
    expect(b.lower).toBe(50);
    expect(b.widthPct).toBe(0);
  });
});

describe("emaStack", () => {
  test("null on insufficient data", () => {
    expect(emaStack([1, 2, 3])).toBeNull();
  });
  test("rising series resolves to up stack", () => {
    expect(emaStack(Array.from({ length: 60 }, (_, i) => 100 + i))).toBe("up");
  });
  test("falling series resolves to down stack", () => {
    expect(emaStack(Array.from({ length: 60 }, (_, i) => 200 - i))).toBe("down");
  });
});
