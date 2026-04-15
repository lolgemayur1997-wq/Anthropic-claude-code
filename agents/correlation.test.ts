import { describe, expect, test } from "bun:test";
import {
  concurrentSameSectorCount,
  correlationGateReason,
  sectorOf,
} from "./correlation.ts";

describe("sectorOf", () => {
  test("maps known symbol to sector", () => {
    expect(sectorOf("HDFCBANK")).toBe("BANKS");
    expect(sectorOf("TCS")).toBe("IT");
    expect(sectorOf("RELIANCE")).toBe("ENERGY");
  });
  test("is case-insensitive", () => {
    expect(sectorOf("hdfcbank")).toBe("BANKS");
  });
  test("returns UNKNOWN for unknown symbol", () => {
    expect(sectorOf("ZZZZZ")).toBe("UNKNOWN");
  });
  test("override wins over default", () => {
    expect(sectorOf("RELIANCE", { RELIANCE: "CONGLOMERATE" })).toBe("CONGLOMERATE");
  });
  test("index symbols are tagged INDEX", () => {
    expect(sectorOf("NIFTY")).toBe("INDEX");
    expect(sectorOf("BANKNIFTY")).toBe("INDEX");
  });
});

describe("concurrentSameSectorCount", () => {
  test("counts same-direction same-sector positions only", () => {
    const r = concurrentSameSectorCount(
      { symbol: "AXISBANK", bias: "long" },
      [
        { symbol: "HDFCBANK", bias: "long" },
        { symbol: "ICICIBANK", bias: "long" },
        { symbol: "TCS", bias: "long" },          // different sector
        { symbol: "SBIN", bias: "short" },        // same sector, opposite dir
      ],
    );
    expect(r.sector).toBe("BANKS");
    expect(r.sameDirCount).toBe(2);
  });
  test("returns 0 for INDEX symbols (not gated)", () => {
    const r = concurrentSameSectorCount(
      { symbol: "NIFTY", bias: "long" },
      [{ symbol: "BANKNIFTY", bias: "long" }],
    );
    expect(r.sameDirCount).toBe(0);
  });
  test("returns 0 for UNKNOWN symbols (not gated)", () => {
    const r = concurrentSameSectorCount(
      { symbol: "ZZZZZ", bias: "long" },
      [{ symbol: "YYYYY", bias: "long" }],
    );
    expect(r.sameDirCount).toBe(0);
  });
});

describe("correlationGateReason", () => {
  test("returns null when under cap", () => {
    const open = [{ symbol: "HDFCBANK", bias: "long" as const }];
    const r = correlationGateReason({ symbol: "ICICIBANK", bias: "long" }, open, 2);
    expect(r).toBeNull();
  });
  test("returns reason when at or above cap", () => {
    const open = [
      { symbol: "HDFCBANK", bias: "long" as const },
      { symbol: "ICICIBANK", bias: "long" as const },
    ];
    const r = correlationGateReason({ symbol: "AXISBANK", bias: "long" }, open, 2);
    expect(r).not.toBeNull();
    expect(r!.toLowerCase()).toContain("banks");
  });
  test("never gates INDEX symbols", () => {
    const open = [
      { symbol: "NIFTY", bias: "long" as const },
      { symbol: "BANKNIFTY", bias: "long" as const },
    ];
    expect(correlationGateReason({ symbol: "FINNIFTY", bias: "long" }, open, 1)).toBeNull();
  });
  test("opposite-direction position does not count", () => {
    const open = [{ symbol: "HDFCBANK", bias: "short" as const }];
    expect(
      correlationGateReason({ symbol: "ICICIBANK", bias: "long" }, open, 1),
    ).toBeNull();
  });
});
