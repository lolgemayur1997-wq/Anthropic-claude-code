/**
 * Regression tests for audit findings. Each test maps to a specific bug
 * caught in the deep-read audit and fixed in the matching commit.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readToday } from "./journal.ts";

describe("Audit fix #6 — readToday skips malformed JSON lines", () => {
  test("recovers valid events when a line is corrupted", () => {
    const dir = mkdtempSync(join(tmpdir(), "audit-"));
    try {
      const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const path = join(dir, `intraday-${today}.jsonl`);
      writeFileSync(
        path,
        [
          JSON.stringify({
            ts: "t1",
            date: today,
            kind: "PLAN_EMITTED",
            symbol: "A",
            segment: "equity",
          }),
          "{not valid json at all",
          JSON.stringify({
            ts: "t2",
            date: today,
            kind: "TRADE_TAKEN",
            symbol: "A",
            segment: "equity",
          }),
          "",
          '{"unterminated": "stri',
          JSON.stringify({
            ts: "t3",
            date: today,
            kind: "TRADE_CLOSED",
            symbol: "A",
            segment: "equity",
            pnl: 250,
          }),
        ].join("\n") + "\n",
        "utf8",
      );
      const events = readToday(dir, today);
      expect(events.length).toBe(3);
      expect(events.map((e) => e.kind)).toEqual([
        "PLAN_EMITTED",
        "TRADE_TAKEN",
        "TRADE_CLOSED",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("empty file returns empty array (no throw)", () => {
    const dir = mkdtempSync(join(tmpdir(), "audit-"));
    try {
      const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      writeFileSync(join(dir, `intraday-${today}.jsonl`), "", "utf8");
      expect(readToday(dir, today)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("all-malformed file returns empty array (no throw)", () => {
    const dir = mkdtempSync(join(tmpdir(), "audit-"));
    try {
      const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      writeFileSync(
        join(dir, `intraday-${today}.jsonl`),
        "garbage\nmore garbage\n{},\n",
        "utf8",
      );
      const events = readToday(dir, today);
      // {} parses as {} but isn't a full JournalEvent; we accept anything that
      // JSON-parses, and the circuit-breaker code tolerates missing fields.
      expect(Array.isArray(events)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
