import { describe, expect, test } from "bun:test";
import { pickStrikeByDelta, pickVerticalStrikes } from "./strikes.ts";

const baseChain = [95, 100, 105, 110, 115, 120];

describe("pickStrikeByDelta", () => {
  test("ATM call (spot=100) lands near the 100 strike for target 0.5", () => {
    const r = pickStrikeByDelta({
      type: "call",
      spot: 100,
      ivAnnualized: 0.25,
      dteDays: 30,
      riskFreeRate: 0.065,
      availableStrikes: baseChain,
      targetDelta: 0.5,
    });
    expect(r).not.toBeNull();
    // ATM delta is slightly > 0.5; closest strike should be 100 or 105.
    expect([100, 105]).toContain(r!.strike);
  });

  test("low-delta call lands on an OTM strike", () => {
    const r = pickStrikeByDelta({
      type: "call",
      spot: 100,
      ivAnnualized: 0.25,
      dteDays: 30,
      riskFreeRate: 0.065,
      availableStrikes: baseChain,
      targetDelta: 0.3,
    });
    expect(r!.strike).toBeGreaterThan(100);
    expect(Math.abs(r!.delta)).toBeLessThan(0.45);
  });

  test("put delta is negative but |delta| near target", () => {
    const r = pickStrikeByDelta({
      type: "put",
      spot: 100,
      ivAnnualized: 0.25,
      dteDays: 30,
      riskFreeRate: 0.065,
      availableStrikes: baseChain,
      targetDelta: 0.3,
    });
    expect(r!.delta).toBeLessThan(0);
    expect(Math.abs(Math.abs(r!.delta) - 0.3)).toBeLessThan(0.2);
  });

  test("returns null on empty strike list", () => {
    const r = pickStrikeByDelta({
      type: "call",
      spot: 100,
      ivAnnualized: 0.25,
      dteDays: 30,
      riskFreeRate: 0.065,
      availableStrikes: [],
      targetDelta: 0.5,
    });
    expect(r).toBeNull();
  });

  test("returns null on invalid IV (zero)", () => {
    const r = pickStrikeByDelta({
      type: "call",
      spot: 100,
      ivAnnualized: 0,
      dteDays: 30,
      riskFreeRate: 0.065,
      availableStrikes: baseChain,
      targetDelta: 0.5,
    });
    expect(r).toBeNull();
  });

  test("returns null on invalid DTE (zero)", () => {
    const r = pickStrikeByDelta({
      type: "call",
      spot: 100,
      ivAnnualized: 0.25,
      dteDays: 0,
      riskFreeRate: 0.065,
      availableStrikes: baseChain,
      targetDelta: 0.5,
    });
    expect(r).toBeNull();
  });

  test("returns null on out-of-range target delta", () => {
    const r = pickStrikeByDelta({
      type: "call",
      spot: 100,
      ivAnnualized: 0.25,
      dteDays: 30,
      riskFreeRate: 0.065,
      availableStrikes: baseChain,
      targetDelta: 1.5,
    });
    expect(r).toBeNull();
  });
});

describe("pickVerticalStrikes", () => {
  test("long-leg strike differs from short-leg strike", () => {
    const r = pickVerticalStrikes(
      {
        type: "call",
        spot: 100,
        ivAnnualized: 0.25,
        dteDays: 30,
        riskFreeRate: 0.065,
        availableStrikes: baseChain,
      },
      0.5,
      0.3,
    );
    expect(r).not.toBeNull();
    expect(r!.long.strike).not.toBe(r!.short.strike);
  });

  test("long-leg has higher |delta| than short-leg for verticals", () => {
    const r = pickVerticalStrikes(
      {
        type: "call",
        spot: 100,
        ivAnnualized: 0.25,
        dteDays: 30,
        riskFreeRate: 0.065,
        availableStrikes: baseChain,
      },
      0.5,
      0.3,
    );
    expect(Math.abs(r!.long.delta)).toBeGreaterThanOrEqual(Math.abs(r!.short.delta));
  });

  test("returns null when both legs collapse to same strike", () => {
    // Single-strike chain can't form a vertical.
    const r = pickVerticalStrikes(
      {
        type: "call",
        spot: 100,
        ivAnnualized: 0.25,
        dteDays: 30,
        riskFreeRate: 0.065,
        availableStrikes: [100],
      },
      0.5,
      0.3,
    );
    expect(r).toBeNull();
  });
});
