import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendEvent,
  circuitBreakerGateReasons,
  circuitBreakerState,
  readToday,
  summarize,
  type JournalEvent,
} from "./journal.ts";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "journal-"));
}

describe("appendEvent + readToday", () => {
  test("round-trips a single event", () => {
    const dir = tmp();
    try {
      appendEvent(dir, {
        kind: "PLAN_EMITTED",
        symbol: "RELIANCE",
        segment: "equity",
        bias: "long",
        entry: 2500,
        stop: 2485,
        target: 2530,
      });
      const events = readToday(dir);
      expect(events.length).toBe(1);
      expect(events[0]!.symbol).toBe("RELIANCE");
      expect(events[0]!.kind).toBe("PLAN_EMITTED");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("appends multiple events preserving order", () => {
    const dir = tmp();
    try {
      appendEvent(dir, { kind: "PLAN_EMITTED", symbol: "A", segment: "equity" });
      appendEvent(dir, { kind: "TRADE_TAKEN", symbol: "A", segment: "equity" });
      appendEvent(dir, { kind: "TRADE_CLOSED", symbol: "A", segment: "equity", pnl: 1200 });
      const events = readToday(dir);
      expect(events.map((e) => e.kind)).toEqual([
        "PLAN_EMITTED",
        "TRADE_TAKEN",
        "TRADE_CLOSED",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("circuitBreakerState", () => {
  const base = {
    accountEquityInr: 500000,
    dailyLossCapPct: 2,          // -10000 cap
    maxTradesPerDay: 3,
    cooldownAfterStopMins: 30,
  };

  test("fresh day: no breakers tripped", () => {
    const s = circuitBreakerState([], base);
    expect(s.dailyLossCapBreached).toBe(false);
    expect(s.maxTradesReached).toBe(false);
    expect(s.cooldownActive).toBe(false);
  });

  test("daily loss cap trips when pnl ≤ -cap", () => {
    const events: JournalEvent[] = [
      {
        ts: "2026-04-15T04:00:00.000Z",
        date: "2026-04-15",
        kind: "TRADE_CLOSED",
        symbol: "X",
        segment: "options",
        pnl: -12000,
      },
    ];
    const s = circuitBreakerState(events, base);
    expect(s.dailyLossCapBreached).toBe(true);
    expect(circuitBreakerGateReasons(s).some((r) => r.includes("daily loss cap"))).toBe(true);
  });

  test("max trades reached at configured cap", () => {
    const ev = (kind: JournalEvent["kind"]): JournalEvent => ({
      ts: "2026-04-15T04:00:00.000Z",
      date: "2026-04-15",
      kind,
      symbol: "X",
      segment: "options",
    });
    const events = [ev("TRADE_TAKEN"), ev("TRADE_TAKEN"), ev("TRADE_TAKEN")];
    const s = circuitBreakerState(events, base);
    expect(s.maxTradesReached).toBe(true);
  });

  test("cooldown active within N mins of last STOP_HIT", () => {
    const stopTime = new Date("2026-04-15T04:00:00.000Z");
    const now = new Date(stopTime.getTime() + 10 * 60 * 1000); // 10m later
    const events: JournalEvent[] = [
      {
        ts: stopTime.toISOString(),
        date: "2026-04-15",
        kind: "STOP_HIT",
        symbol: "X",
        segment: "options",
        pnl: -2000,
      },
    ];
    const s = circuitBreakerState(events, { ...base, now });
    expect(s.cooldownActive).toBe(true);
    expect(s.cooldownRemainingMins).toBeGreaterThan(15);
    expect(s.cooldownRemainingMins).toBeLessThanOrEqual(20);
  });

  test("cooldown clears after window", () => {
    const stopTime = new Date("2026-04-15T04:00:00.000Z");
    const now = new Date(stopTime.getTime() + 45 * 60 * 1000);
    const events: JournalEvent[] = [
      {
        ts: stopTime.toISOString(),
        date: "2026-04-15",
        kind: "STOP_HIT",
        symbol: "X",
        segment: "options",
        pnl: -2000,
      },
    ];
    const s = circuitBreakerState(events, { ...base, now });
    expect(s.cooldownActive).toBe(false);
  });
});

describe("summarize", () => {
  test("computes hit rate and top gates", () => {
    const events: JournalEvent[] = [
      { ts: "t1", date: "d", kind: "PLAN_EMITTED", symbol: "A", segment: "equity" },
      { ts: "t2", date: "d", kind: "TRADE_TAKEN", symbol: "A", segment: "equity" },
      { ts: "t3", date: "d", kind: "TRADE_CLOSED", symbol: "A", segment: "equity", pnl: 500 },
      { ts: "t4", date: "d", kind: "TRADE_TAKEN", symbol: "B", segment: "options" },
      { ts: "t5", date: "d", kind: "STOP_HIT", symbol: "B", segment: "options", pnl: -1000 },
      {
        ts: "t6",
        date: "d",
        kind: "GATE_BLOCKED",
        symbol: "C",
        segment: "options",
        gateReasons: ["VIX ceiling", "F&O ban list"],
      },
      {
        ts: "t7",
        date: "d",
        kind: "GATE_BLOCKED",
        symbol: "D",
        segment: "options",
        gateReasons: ["F&O ban list"],
      },
    ];
    const s = summarize(events);
    expect(s.tradesTaken).toBe(2);
    expect(s.winners).toBe(1);
    expect(s.losers).toBe(1);
    expect(s.hitRatePct).toBeCloseTo(50, 5);
    expect(s.grossPnlInr).toBe(-500);
    const top = s.topGateReasons.map((r) => r.reason);
    expect(top[0]).toBe("F&O ban list");
  });
});
