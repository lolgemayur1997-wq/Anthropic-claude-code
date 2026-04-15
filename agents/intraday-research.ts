/**
 * Intraday Research Runner
 *
 * Calls a broker / data adapter for each symbol on the configured watchlist,
 * scores it against the intraday-research checklist, and emits:
 *   - out/intraday-research-<YYYY-MM-DD>.md
 *   - out/intraday-research-<YYYY-MM-DD>.json
 *   - out/intraday-research-<YYYY-MM-DD>.log
 *
 * This runner does NOT place orders and does NOT hallucinate data. Any field
 * the adapter does not return is marked UNKNOWN and the symbol is gated to
 * NO-TRADE.
 *
 * Usage:
 *   bun run agents/intraday-research.ts --adapter kite
 *   bun run agents/intraday-research.ts --adapter upstox --watchlist custom.json
 */

import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Adapter, AdapterName, SymbolSnapshot } from "./adapters/types.ts";
import { loadAdapter } from "./adapters/index.ts";
import { roundTripCharges } from "./charges.ts";
import {
  appendEvent,
  circuitBreakerGateReasons,
  circuitBreakerState,
  readToday,
} from "./journal.ts";
import { correlationGateReason, type OpenPosition } from "./correlation.ts";

// --- Types ---

interface Watchlist {
  symbols: Array<{ symbol: string; segment: "equity" | "futures" | "options" }>;
}

interface Thresholds {
  weights: Record<string, number>;
  gates: {
    vix_ceiling: number;
    spread_ceiling_pct: number;
    min_rvol_for_breakout: number;
    score_threshold: number;
    skip_on_result_within_days: number;
    // NSE F&O pre-trade gates (see .claude/rules/nse-fno-pre-trade.md)
    max_mwpl_pct: number;                 // §3 ban threshold (default 95)
    skip_corp_action_within_days: number; // §4 (default 2)
    max_atm_spread_pct: number;           // §5 (default 0.5)
    min_oi_lot_multiple: number;          // §5 (default 5)
    min_dte_for_short_premium: number;    // §1 (default 2)
    gate_extra_elm_for_short: boolean;    // §3 (default true)
    gate_asm: boolean;                    // §3 (default true)
    require_in_fno_universe_for_options: boolean; // §2 (default true)
    max_margin_utilisation_pct: number;   // §7 (default 25)
    // Tilt protection / concentration (see agents/journal.ts, agents/correlation.ts)
    daily_loss_cap_pct: number;           // halt for the day once breached
    max_trades_per_day: number;
    cooldown_after_stop_mins: number;     // NO_TRADE window after a stop-out
    max_same_sector_same_dir_positions: number; // correlation cap
    bake_charges_into_targets: boolean;   // subtract round-trip charges from gross targets
    // Day-context gates (see agents/regime.ts, agents/confluence.ts)
    veto_on_choppy_day: boolean;          // default true — NO_TRADE on CHOPPY regime
    min_confluence_score: number;         // default 0.5 — multi-TF agreement floor
  };
  sizing: {
    account_equity_inr: number;
    account_risk_pct: number;
    notional_cap_pct: number;
  };
}

interface CliArgs {
  adapter: AdapterName;
  watchlist: string;
  thresholds: string;
  outDir: string;
  dryRun: boolean;
}

interface ChecklistResult {
  symbol: string;
  segment: "equity" | "futures" | "options";
  score: number;
  verdict: "PASS" | "GATED" | "NO_TRADE";
  gateReasons: string[];
  unknownFields: string[];
  setup: string | null;
  plan: TradePlan | null;
  snapshot: SymbolSnapshot;
}

interface TradePlan {
  bias: "long" | "short";
  entryTrigger: string;
  entryZone: [number, number];
  stopLevel: number;
  stopAtrMultiple: number;
  t1: { level: number; r: number };
  t2: { level: number; r: number };
  qty: number;
  riskInr: number;
  notionalInr: number;
  invalidation: number;
  // Charges-aware economics (rule: gross R-multiples are fiction)
  roundTripChargesInr: number | null;
  netT1RMultiple: number | null;
  netT2RMultiple: number | null;
}

// --- CLI ---

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const cfg: CliArgs = {
    adapter: "mock",
    watchlist: "config/watchlist.json",
    thresholds: "config/thresholds.json",
    outDir: "out",
    dryRun: false,
  };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--adapter") cfg.adapter = args[++i] as AdapterName;
    else if (flag === "--watchlist") cfg.watchlist = args[++i]!;
    else if (flag === "--thresholds") cfg.thresholds = args[++i]!;
    else if (flag === "--out") cfg.outDir = args[++i]!;
    else if (flag === "--dry-run") cfg.dryRun = true;
  }
  return cfg;
}

// --- Config loaders ---

function loadJson<T>(path: string): T {
  if (!existsSync(path)) {
    throw new Error(
      `Missing config file: ${path}. Create it using the samples in config/ before running.`,
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function configHash(obj: unknown): string {
  return createHash("sha256").update(JSON.stringify(obj)).digest("hex").slice(0, 12);
}

// --- Time / market window ---

function istNow(): Date {
  const utc = new Date();
  return new Date(utc.getTime() + 5.5 * 60 * 60 * 1000);
}

function marketWindow(now: Date): "pre" | "open" | "research" | "session" | "closed" | "off" {
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return "off";
  const hh = now.getUTCHours();
  const mm = now.getUTCMinutes();
  const mins = hh * 60 + mm;
  if (mins < 9 * 60 + 15) return "pre";
  if (mins < 9 * 60 + 30) return "open";
  if (mins < 9 * 60 + 45) return "research";
  if (mins < 15 * 60 + 30) return "session";
  return "closed";
}

// --- Checklist ---

function collectUnknowns(s: SymbolSnapshot): string[] {
  const required: Array<[string, unknown]> = [
    ["ltp", s.ltp],
    ["prev_close", s.prevClose],
    ["day_high", s.dayHigh],
    ["day_low", s.dayLow],
    ["atr_5m", s.atr5m],
    ["rvol", s.rvol],
    ["vwap_5m", s.vwap5m],
    ["orb_high", s.orbHigh],
    ["orb_low", s.orbLow],
  ];
  if (s.segment === "options") {
    // NSE F&O pre-trade fields. Any one null → UNKNOWN → NO_TRADE, per ruleset.
    required.push(
      ["in_fno_universe", s.inOfficialFnoUniverse],
      ["lot_size", s.lotSize],
      ["dte_days", s.dteDays],
      ["mwpl_pct", s.mwplPct],
      ["atm_spread_pct", s.atmSpreadPct],
      ["atm_oi", s.atmOi],
    );
  }
  return required.filter(([, v]) => v === null || v === undefined).map(([k]) => k);
}

function evaluateGates(
  s: SymbolSnapshot,
  t: Thresholds,
  vix: number | null,
): string[] {
  const reasons: string[] = [];
  // --- General gates ---
  if (vix !== null && vix > t.gates.vix_ceiling) reasons.push(`VIX ${vix} > ceiling ${t.gates.vix_ceiling}`);
  if (s.inFnoBan) reasons.push("F&O ban list");
  if (s.resultWithinDays !== null && s.resultWithinDays <= t.gates.skip_on_result_within_days) {
    reasons.push(`result within ${s.resultWithinDays} day(s)`);
  }
  if (s.spreadPct !== null && s.spreadPct > t.gates.spread_ceiling_pct) {
    reasons.push(`spread ${s.spreadPct.toFixed(2)}% > ${t.gates.spread_ceiling_pct}%`);
  }
  if (s.macroEventWithinMins !== null && s.macroEventWithinMins <= 60) {
    reasons.push(`macro event in ${s.macroEventWithinMins}m`);
  }

  // --- NSE F&O pre-trade gates (rule §2–§7) ---
  // §2: options require the symbol to be CONFIRMED in the official F&O
  // universe. Unconfirmed (null) treats as NOT in the universe — never assume.
  if (
    s.segment === "options" &&
    t.gates.require_in_fno_universe_for_options &&
    s.inOfficialFnoUniverse !== true
  ) {
    reasons.push("F&O universe not confirmed");
  }
  // §3: MWPL ban threshold
  if (s.mwplPct !== null && s.mwplPct >= t.gates.max_mwpl_pct) {
    reasons.push(`MWPL ${s.mwplPct.toFixed(1)}% >= ${t.gates.max_mwpl_pct}% (ban)`);
  }
  // §3: ASM always gated
  if (t.gates.gate_asm && s.inAsm) reasons.push("under ASM");
  // §3: Extra ELM gated for short-premium structures
  if (t.gates.gate_extra_elm_for_short && s.inExtraElm && s.bias === "short") {
    reasons.push("extra ELM + short bias");
  }
  // §4: corporate action horizon
  if (
    s.corpActionWithinDays !== null &&
    s.corpActionWithinDays <= t.gates.skip_corp_action_within_days
  ) {
    reasons.push(`corp action in ${s.corpActionWithinDays}d`);
  }
  // §5: ATM spread & OI quality for options
  if (s.segment === "options") {
    if (s.atmSpreadPct !== null && s.atmSpreadPct > t.gates.max_atm_spread_pct) {
      reasons.push(`ATM spread ${s.atmSpreadPct.toFixed(2)}% > ${t.gates.max_atm_spread_pct}%`);
    }
    if (s.atmOi !== null && s.lotSize !== null) {
      if (s.atmOi < s.lotSize * t.gates.min_oi_lot_multiple) {
        reasons.push(`ATM OI ${s.atmOi} < ${t.gates.min_oi_lot_multiple}× lot`);
      }
    }
    // §1: never hold short stock options near expiry
    if (
      s.bias === "short" &&
      s.dteDays !== null &&
      s.dteDays < t.gates.min_dte_for_short_premium
    ) {
      reasons.push(`DTE ${s.dteDays} < ${t.gates.min_dte_for_short_premium} for short-premium`);
    }
  }
  // §7: margin utilisation cap
  if (
    s.marginUtilisationPct !== null &&
    s.marginUtilisationPct > t.gates.max_margin_utilisation_pct
  ) {
    reasons.push(`margin util ${s.marginUtilisationPct.toFixed(1)}% > ${t.gates.max_margin_utilisation_pct}%`);
  }
  // Day-context gates: CHOPPY day vetoes; gap-bias conflict flagged.
  if (s.regime === "CHOPPY" && t.gates.veto_on_choppy_day) {
    reasons.push(`CHOPPY regime (confidence ${(s.regimeConfidence ?? 0).toFixed(2)})`);
  }
  // Low multi-TF confluence → gate. 0.5 default threshold.
  if (
    s.confluenceScore !== null &&
    s.confluenceScore < t.gates.min_confluence_score
  ) {
    reasons.push(`confluence ${s.confluenceScore.toFixed(2)} < ${t.gates.min_confluence_score}`);
  }
  return reasons;
}

function scoreSymbol(s: SymbolSnapshot, t: Thresholds): number {
  const w = t.weights;
  let total = 0;
  total += (s.structureScore ?? 0) * (w.structure ?? 0.2);
  total += (s.patternScore ?? 0) * (w.pattern ?? 0.15);
  total += (s.indicatorScore ?? 0) * (w.indicators ?? 0.15);
  total += (s.volumeScore ?? 0) * (w.volume ?? 0.15);
  total += (s.orderBlockScore ?? 0) * (w.orderBlocks ?? 0.1);
  total += (s.optionsScore ?? 0) * (w.options ?? 0.15);
  total += (s.newsScore ?? 0) * (w.news ?? 0.05);
  const eventPenalty = (s.eventRiskFlags ?? 0) * (w.eventPenalty ?? 0.1);
  return Math.round(Math.max(0, total - eventPenalty) * 100);
}

function buildPlan(s: SymbolSnapshot, t: Thresholds): TradePlan | null {
  if (s.ltp === null || s.atr5m === null || s.bias === null) return null;
  const risk = t.sizing.account_equity_inr * (t.sizing.account_risk_pct / 100);
  const stopDistance = s.atr5m * 1.25;
  const long = s.bias === "long";
  const entry = s.ltp;
  const stop = long ? entry - stopDistance : entry + stopDistance;
  const t1 = long ? entry + stopDistance : entry - stopDistance;
  const t2 = long ? entry + stopDistance * 2 : entry - stopDistance * 2;
  const qty = Math.floor(risk / stopDistance);
  const notional = qty * entry;
  const notionalCap = t.sizing.account_equity_inr * (t.sizing.notional_cap_pct / 100);
  const cappedQty = notional > notionalCap ? Math.floor(notionalCap / entry) : qty;

  // Charges-aware: compute round-trip charges at T1 exit and derive net R.
  let roundTripChargesInr: number | null = null;
  let netT1R: number | null = null;
  let netT2R: number | null = null;
  if (t.gates.bake_charges_into_targets && cappedQty > 0) {
    // charges.ts Segment now covers equity | futures | options.
    const chargesT1 = roundTripCharges(s.segment, cappedQty, entry, t1);
    roundTripChargesInr = Math.round(chargesT1.total_inr);
    const riskInr = cappedQty * stopDistance;
    const grossT1 = (t1 - entry) * (long ? cappedQty : -cappedQty);
    const grossT2 = (t2 - entry) * (long ? cappedQty : -cappedQty);
    netT1R = riskInr === 0 ? 0 : (grossT1 - chargesT1.total_inr) / riskInr;
    const chargesT2 = roundTripCharges(s.segment, cappedQty, entry, t2);
    netT2R = riskInr === 0 ? 0 : (grossT2 - chargesT2.total_inr) / riskInr;
  }

  return {
    bias: s.bias,
    entryTrigger: `5m close ${long ? ">" : "<"} ${round(entry)}`,
    entryZone: long ? [round(entry), round(entry * 1.002)] : [round(entry * 0.998), round(entry)],
    stopLevel: round(stop),
    stopAtrMultiple: 1.25,
    t1: { level: round(t1), r: 1.0 },
    t2: { level: round(t2), r: 2.0 },
    qty: cappedQty,
    riskInr: Math.round(cappedQty * stopDistance),
    notionalInr: Math.round(cappedQty * entry),
    invalidation: round(stop),
    roundTripChargesInr,
    netT1RMultiple: netT1R === null ? null : round(netT1R),
    netT2RMultiple: netT2R === null ? null : round(netT2R),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function uniqueNonNull<T>(xs: Array<T | null>): T[] {
  return Array.from(new Set(xs.filter((x): x is T => x !== null)));
}

function averageNonNull(xs: Array<number | null>): number | null {
  const valid = xs.filter((x): x is number => x !== null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function checklistForSymbol(
  s: SymbolSnapshot,
  t: Thresholds,
  vix: number | null,
  sessionGates: string[],
  openPositions: OpenPosition[],
): ChecklistResult {
  const unknowns = collectUnknowns(s);
  const perSymbolGates = evaluateGates(s, t, vix);
  // Correlation gate is per-candidate but depends on concurrent book.
  if (s.bias !== null) {
    const corrReason = correlationGateReason(
      { symbol: s.symbol, bias: s.bias },
      openPositions,
      t.gates.max_same_sector_same_dir_positions,
    );
    if (corrReason) perSymbolGates.push(corrReason);
  }
  const gates = [...sessionGates, ...perSymbolGates];
  const score = scoreSymbol(s, t);
  const gated = gates.length > 0;
  const hasAllData = unknowns.length === 0;
  const meetsThreshold = score >= t.gates.score_threshold;
  let verdict: ChecklistResult["verdict"] = "NO_TRADE";
  if (gated) verdict = "GATED";
  else if (hasAllData && meetsThreshold) verdict = "PASS";
  const plan = verdict === "PASS" ? buildPlan(s, t) : null;
  return {
    symbol: s.symbol,
    segment: s.segment,
    score,
    verdict,
    gateReasons: gates,
    unknownFields: unknowns,
    setup: s.setupLabel,
    plan,
    snapshot: s,
  };
}

// --- Report rendering ---

const DISCLAIMER = `> **Not investment advice.** Automated research output. The operator is solely responsible for any trade placed. Options trading carries high risk; confirm every level on your broker terminal. Do not act on non-public information.`;

function renderReport(
  date: string,
  window: string,
  adapter: AdapterName,
  vix: number | null,
  results: ChecklistResult[],
  thresholdsHash: string,
  cbState: ReturnType<typeof circuitBreakerState>,
): string {
  const parts: string[] = [];
  parts.push(`# Intraday Research — ${date} (${window} window, IST)`);
  parts.push("");
  parts.push(DISCLAIMER);
  parts.push("");
  parts.push("## Market context");
  parts.push(`- Adapter: \`${adapter}\``);
  parts.push(`- India VIX: ${vix ?? "UNKNOWN"}`);
  parts.push("");
  parts.push("## Day context");
  const regimes = uniqueNonNull(results.map((r) => r.snapshot.regime));
  const gaps = uniqueNonNull(results.map((r) => r.snapshot.gapClass));
  parts.push(`- Regimes observed: ${regimes.length ? regimes.join(", ") : "UNKNOWN"}`);
  parts.push(`- Gap classes:     ${gaps.length ? gaps.join(", ") : "UNKNOWN"}`);
  const avgConfluence = averageNonNull(results.map((r) => r.snapshot.confluenceScore));
  parts.push(`- Avg confluence:  ${avgConfluence === null ? "UNKNOWN" : avgConfluence.toFixed(2)}`);
  parts.push("");
  parts.push("## Tilt protection (today)");
  parts.push(`- Daily P&L so far: ₹${Math.round(cbState.dailyPnlInr)}`);
  parts.push(`- Trades taken: ${cbState.tradesTaken}`);
  parts.push(`- Cooldown active: ${cbState.cooldownActive ? `yes (${cbState.cooldownRemainingMins.toFixed(1)}m)` : "no"}`);
  parts.push(`- Daily loss cap breached: ${cbState.dailyLossCapBreached ? "**YES (session halt)**" : "no"}`);
  parts.push("");
  parts.push("## Watchlist results");
  parts.push("");
  parts.push("| Symbol | Seg | Score | Verdict | Setup | Gates / Unknowns |");
  parts.push("|--------|-----|-------|---------|-------|-------------------|");
  for (const r of results) {
    const notes = [...r.gateReasons, ...r.unknownFields.map((f) => `unknown:${f}`)].join("; ");
    parts.push(
      `| ${r.symbol} | ${r.segment} | ${r.score} | ${r.verdict} | ${r.setup ?? "-"} | ${notes || "-"} |`,
    );
  }
  parts.push("");
  parts.push("## Qualifying trade plans");
  const passing = results.filter((r) => r.verdict === "PASS" && r.plan);
  if (passing.length === 0) {
    parts.push("");
    parts.push("_No symbols qualify this pass. NO-TRADE._");
  } else {
    for (const r of passing) parts.push(renderPlan(r));
  }
  parts.push("");
  parts.push("## Footer");
  parts.push(
    `Adapter: \`${adapter}\` | Run: \`${new Date().toISOString()}\` | Thresholds hash: \`${thresholdsHash}\``,
  );
  return parts.join("\n");
}

function renderPlan(r: ChecklistResult): string {
  const p = r.plan!;
  return [
    "",
    "```yaml",
    `symbol: ${r.symbol}`,
    `segment: ${r.segment}`,
    `bias: ${p.bias}`,
    `score: ${r.score}`,
    `setup: ${r.setup ?? "unspecified"}`,
    `invalidation: ${p.invalidation}`,
    `entry:`,
    `  trigger: "${p.entryTrigger}"`,
    `  zone: [${p.entryZone[0]}, ${p.entryZone[1]}]`,
    `stop_loss:`,
    `  level: ${p.stopLevel}`,
    `  distance_atr: ${p.stopAtrMultiple}`,
    `targets:`,
    `  t1: { level: ${p.t1.level}, r_multiple_gross: ${p.t1.r}, r_multiple_net: ${p.netT1RMultiple ?? "n/a"} }`,
    `  t2: { level: ${p.t2.level}, r_multiple_gross: ${p.t2.r}, r_multiple_net: ${p.netT2RMultiple ?? "n/a"} }`,
    `position_sizing:`,
    `  qty: ${p.qty}`,
    `  risk_inr: ${p.riskInr}`,
    `  notional_inr: ${p.notionalInr}`,
    `  round_trip_charges_inr: ${p.roundTripChargesInr ?? "n/a"}`,
    "```",
    "",
  ].join("\n");
}

// --- Main ---

async function main(): Promise<void> {
  const args = parseArgs();
  const now = istNow();
  const window = marketWindow(now);
  const dateStr = now.toISOString().slice(0, 10);

  if (window === "off") {
    console.log(`[intraday-research] market closed (weekend). Skipping.`);
    return;
  }

  const watchlist = loadJson<Watchlist>(args.watchlist);
  const thresholds = loadJson<Thresholds>(args.thresholds);
  const thresholdsHash = configHash(thresholds);

  await mkdir(args.outDir, { recursive: true });

  const adapter: Adapter = await loadAdapter(args.adapter);
  const logPath = join(args.outDir, `intraday-research-${dateStr}.log`);
  const logLines: string[] = [];

  const vix = await adapter.getIndiaVix().catch((e) => {
    logLines.push(`vix error: ${String(e)}`);
    return null;
  });

  const snapshots: SymbolSnapshot[] = [];
  for (const w of watchlist.symbols) {
    try {
      const snap = await adapter.getSymbolSnapshot(w.symbol, w.segment);
      snapshots.push(snap);
      logLines.push(`ok ${w.symbol}: ltp=${snap.ltp}`);
    } catch (e) {
      logLines.push(`err ${w.symbol}: ${String(e)}`);
      snapshots.push(adapter.emptySnapshot(w.symbol, w.segment));
    }
  }

  // Session-wide circuit breakers from today's journal (tilt protection).
  const journalDir = join(args.outDir, "journal");
  const todaysEvents = readToday(journalDir);
  const cbState = circuitBreakerState(todaysEvents, {
    accountEquityInr: thresholds.sizing.account_equity_inr,
    dailyLossCapPct: thresholds.gates.daily_loss_cap_pct,
    maxTradesPerDay: thresholds.gates.max_trades_per_day,
    cooldownAfterStopMins: thresholds.gates.cooldown_after_stop_mins,
  });
  const sessionGates = circuitBreakerGateReasons(cbState);
  // Open positions (marked as TRADE_TAKEN but not closed) feed correlation cap.
  const openPositions: OpenPosition[] = openFromJournal(todaysEvents);

  const results = snapshots.map((s) =>
    checklistForSymbol(s, thresholds, vix, sessionGates, openPositions),
  );

  // Journal every PLAN_EMITTED / GATE_BLOCKED for audit + edge calibration.
  if (!args.dryRun) {
    for (const r of results) {
      if (r.verdict === "PASS" && r.plan) {
        appendEvent(journalDir, {
          kind: "PLAN_EMITTED",
          symbol: r.symbol,
          segment: r.segment,
          bias: r.plan.bias,
          entry: r.snapshot.ltp ?? undefined,
          stop: r.plan.stopLevel,
          target: r.plan.t1.level,
          qty: r.plan.qty,
        });
      } else if (r.verdict === "GATED") {
        appendEvent(journalDir, {
          kind: "GATE_BLOCKED",
          symbol: r.symbol,
          segment: r.segment,
          gateReasons: r.gateReasons,
        });
      }
    }
  }

  const report = renderReport(
    dateStr,
    window,
    args.adapter,
    vix,
    results,
    thresholdsHash,
    cbState,
  );

  if (args.dryRun) {
    console.log(report);
    return;
  }

  const mdPath = join(args.outDir, `intraday-research-${dateStr}.md`);
  const jsonPath = join(args.outDir, `intraday-research-${dateStr}.json`);
  await writeFile(mdPath, report, "utf8");
  await writeFile(
    jsonPath,
    JSON.stringify(
      {
        date: dateStr,
        window,
        adapter: args.adapter,
        vix,
        thresholdsHash,
        circuitBreaker: cbState,
        results,
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(logPath, logLines.join("\n"), "utf8");

  const summary = `${results.length} scanned, ${results.filter((r) => r.verdict === "PASS").length} PASS, ${results.filter((r) => r.verdict === "GATED").length} GATED`;
  console.log(`[intraday-research] ${summary}`);
  console.log(`[intraday-research] ${mdPath}`);
  console.log(`[intraday-research] ${jsonPath}`);
}

function openFromJournal(events: ReturnType<typeof readToday>): OpenPosition[] {
  // A position is "open" if it has TRADE_TAKEN today without a matching
  // TRADE_CLOSED / STOP_HIT for the same symbol.
  const open = new Map<string, OpenPosition>();
  for (const e of events) {
    if (e.kind === "TRADE_TAKEN" && e.bias) {
      open.set(e.symbol, { symbol: e.symbol, bias: e.bias });
    } else if (e.kind === "TRADE_CLOSED" || e.kind === "STOP_HIT") {
      open.delete(e.symbol);
    }
  }
  return [...open.values()];
}

main().catch((e) => {
  console.error(`[intraday-research] fatal: ${String(e)}`);
  process.exit(1);
});
