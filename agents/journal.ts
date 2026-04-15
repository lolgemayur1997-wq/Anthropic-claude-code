/**
 * Append-only JSONL trade journal + tilt-protection queries.
 *
 * Writes one JSON object per line to `journal/intraday-YYYY-MM-DD.jsonl`.
 * Events:
 *   - PLAN_EMITTED   — agent proposed a trade plan
 *   - TRADE_TAKEN    — operator says they entered
 *   - TRADE_CLOSED   — exit recorded with P&L
 *   - STOP_HIT       — stop level triggered
 *   - GATE_BLOCKED   — a NO_TRADE gate fired (for edge calibration)
 *
 * The journal is also the source of truth for circuit breakers:
 *   - Daily loss cap: sum of TRADE_CLOSED.pnl today vs. cap.
 *   - Max trades/day: count of TRADE_TAKEN today.
 *   - Cooldown: minutes since last STOP_HIT.
 */

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export type EventKind =
  | "PLAN_EMITTED"
  | "TRADE_TAKEN"
  | "TRADE_CLOSED"
  | "STOP_HIT"
  | "GATE_BLOCKED";

export interface JournalEvent {
  ts: string;                    // ISO IST
  date: string;                  // YYYY-MM-DD IST
  kind: EventKind;
  symbol: string;
  segment: "equity" | "futures" | "options";
  bias?: "long" | "short";
  entry?: number;
  stop?: number;
  target?: number;
  qty?: number;
  pnl?: number;                  // net P&L in ₹ (TRADE_CLOSED / STOP_HIT only)
  gateReasons?: string[];        // GATE_BLOCKED only
  note?: string;
}

function istDate(): string {
  const utc = new Date();
  const ist = new Date(utc.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function istNowIso(): string {
  const utc = new Date();
  const ist = new Date(utc.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString();
}

function journalPath(dir: string, date: string): string {
  return join(dir, `intraday-${date}.jsonl`);
}

export function appendEvent(dir: string, ev: Omit<JournalEvent, "ts" | "date">): JournalEvent {
  mkdirSync(dir, { recursive: true });
  const full: JournalEvent = { ts: istNowIso(), date: istDate(), ...ev };
  appendFileSync(journalPath(dir, full.date), JSON.stringify(full) + "\n", "utf8");
  return full;
}

export function readToday(dir: string, date = istDate()): JournalEvent[] {
  const p = journalPath(dir, date);
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as JournalEvent);
}

// --- Circuit-breaker queries ---

export interface CircuitBreakerInputs {
  accountEquityInr: number;
  dailyLossCapPct: number;        // e.g. 2 → halt if -2% hit
  maxTradesPerDay: number;        // hard cap
  cooldownAfterStopMins: number;  // NO_TRADE within N mins of last stop-out
  now?: Date;                     // for testing
}

export interface CircuitBreakerState {
  dailyPnlInr: number;
  tradesTaken: number;
  lastStopAt: string | null;
  dailyLossCapBreached: boolean;
  maxTradesReached: boolean;
  cooldownActive: boolean;
  cooldownRemainingMins: number;
}

export function circuitBreakerState(
  events: JournalEvent[],
  inp: CircuitBreakerInputs,
): CircuitBreakerState {
  const dailyPnlInr = events
    .filter((e) => e.kind === "TRADE_CLOSED" || e.kind === "STOP_HIT")
    .reduce((acc, e) => acc + (e.pnl ?? 0), 0);
  const tradesTaken = events.filter((e) => e.kind === "TRADE_TAKEN").length;
  const stops = events.filter((e) => e.kind === "STOP_HIT");
  const lastStop = stops.length ? stops[stops.length - 1]! : null;
  const capInr = -Math.abs(inp.accountEquityInr * (inp.dailyLossCapPct / 100));
  const dailyLossCapBreached = dailyPnlInr <= capInr;
  const maxTradesReached = tradesTaken >= inp.maxTradesPerDay;

  const now = inp.now ?? new Date();
  let cooldownRemainingMins = 0;
  let cooldownActive = false;
  if (lastStop) {
    const lastStopTime = new Date(lastStop.ts).getTime();
    const elapsedMins = (now.getTime() - lastStopTime) / 60000;
    cooldownRemainingMins = Math.max(0, inp.cooldownAfterStopMins - elapsedMins);
    cooldownActive = cooldownRemainingMins > 0;
  }

  return {
    dailyPnlInr,
    tradesTaken,
    lastStopAt: lastStop?.ts ?? null,
    dailyLossCapBreached,
    maxTradesReached,
    cooldownActive,
    cooldownRemainingMins,
  };
}

/** Convert circuit-breaker state to human-readable gate reasons. Empty array
 *  means no circuit breaker is tripped. */
export function circuitBreakerGateReasons(s: CircuitBreakerState): string[] {
  const reasons: string[] = [];
  if (s.dailyLossCapBreached) reasons.push(`daily loss cap breached (pnl ${Math.round(s.dailyPnlInr)})`);
  if (s.maxTradesReached) reasons.push(`max trades/day reached (${s.tradesTaken})`);
  if (s.cooldownActive) {
    reasons.push(`cooldown after stop-out (${s.cooldownRemainingMins.toFixed(1)}m remaining)`);
  }
  return reasons;
}

// --- Summary helpers for /journal and /post-mortem ---

export interface DailySummary {
  date: string;
  plansEmitted: number;
  tradesTaken: number;
  winners: number;
  losers: number;
  hitRatePct: number | null;
  grossPnlInr: number;
  gatesBlockedCount: number;
  topGateReasons: Array<{ reason: string; count: number }>;
  symbols: string[];
}

export function summarize(events: JournalEvent[]): DailySummary {
  const date = events[0]?.date ?? istDate();
  const plansEmitted = events.filter((e) => e.kind === "PLAN_EMITTED").length;
  const taken = events.filter((e) => e.kind === "TRADE_TAKEN");
  const closed = events.filter((e) => e.kind === "TRADE_CLOSED" || e.kind === "STOP_HIT");
  const winners = closed.filter((e) => (e.pnl ?? 0) > 0).length;
  const losers = closed.filter((e) => (e.pnl ?? 0) <= 0).length;
  const grossPnlInr = closed.reduce((a, e) => a + (e.pnl ?? 0), 0);
  const gatesBlocked = events.filter((e) => e.kind === "GATE_BLOCKED");
  const gateCounts = new Map<string, number>();
  for (const g of gatesBlocked) {
    for (const r of g.gateReasons ?? []) {
      gateCounts.set(r, (gateCounts.get(r) ?? 0) + 1);
    }
  }
  const top = [...gateCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));
  return {
    date,
    plansEmitted,
    tradesTaken: taken.length,
    winners,
    losers,
    hitRatePct: closed.length === 0 ? null : (winners / closed.length) * 100,
    grossPnlInr,
    gatesBlockedCount: gatesBlocked.length,
    topGateReasons: top,
    symbols: Array.from(new Set(events.map((e) => e.symbol))),
  };
}
