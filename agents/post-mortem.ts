/**
 * End-of-day post-mortem runner.
 *
 * Reads the day's journal, loads the morning scan JSON, and writes a review
 * to out/post-mortem-<YYYY-MM-DD>.md. Answers:
 *   - hit rate of today's plans
 *   - gate calibration (true-positive vs false-positive counts by reason)
 *   - daily P&L summary
 *   - threshold-tuning suggestions (never auto-applied)
 *
 * Invoked by scripts/run-post-mortem.sh (cron at 15:45 IST).
 */

import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readToday, summarize } from "./journal.ts";

interface CliArgs {
  date: string;
  outDir: string;
}

function istDate(): string {
  const utc = new Date();
  const ist = new Date(utc.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let date = istDate();
  let outDir = "out";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--date") date = args[++i]!;
    else if (args[i] === "--out") outDir = args[++i]!;
  }
  return { date, outDir };
}

interface MorningScan {
  date: string;
  results: Array<{
    symbol: string;
    segment: "equity" | "futures" | "options";
    score: number;
    verdict: "PASS" | "GATED" | "NO_TRADE";
    gateReasons: string[];
    plan: { stopLevel: number; t1: { level: number }; t2: { level: number } } | null;
  }>;
}

function loadMorning(outDir: string, date: string): MorningScan | null {
  const p = join(outDir, `intraday-research-${date}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as MorningScan;
}

function render(
  date: string,
  summary: ReturnType<typeof summarize>,
  morning: MorningScan | null,
): string {
  const lines: string[] = [];
  lines.push(`# Post-Mortem — ${date}`);
  lines.push("");
  lines.push(
    "> Automated review. Use findings to calibrate thresholds manually; the agent never auto-tunes.",
  );
  lines.push("");
  lines.push("## Daily summary");
  lines.push(`- Plans emitted: ${summary.plansEmitted}`);
  lines.push(`- Trades taken:  ${summary.tradesTaken}`);
  lines.push(`- Winners:       ${summary.winners}`);
  lines.push(`- Losers:        ${summary.losers}`);
  lines.push(
    `- Hit rate:      ${summary.hitRatePct === null ? "n/a" : summary.hitRatePct.toFixed(1) + "%"}`,
  );
  lines.push(`- Gross P&L:     ₹${Math.round(summary.grossPnlInr)}`);
  lines.push(`- Gates blocked: ${summary.gatesBlockedCount}`);
  lines.push("");
  lines.push("## Morning scan recap");
  if (!morning) {
    lines.push(`_No morning scan found for ${date}._`);
  } else {
    const passed = morning.results.filter((r) => r.verdict === "PASS").length;
    const gated = morning.results.filter((r) => r.verdict === "GATED").length;
    const noTrade = morning.results.filter((r) => r.verdict === "NO_TRADE").length;
    lines.push(`- Scanned:  ${morning.results.length}`);
    lines.push(`- PASS:     ${passed}`);
    lines.push(`- GATED:    ${gated}`);
    lines.push(`- NO_TRADE: ${noTrade}`);
  }
  lines.push("");
  lines.push("## Top gate reasons today");
  if (summary.topGateReasons.length === 0) {
    lines.push("_None._");
  } else {
    lines.push("| # | Reason | Count |");
    lines.push("|---|--------|-------|");
    summary.topGateReasons.forEach((g, i) => {
      lines.push(`| ${i + 1} | ${g.reason} | ${g.count} |`);
    });
  }
  lines.push("");
  lines.push("## Manual reconciliation (operator fills in)");
  lines.push("");
  lines.push(
    "Gate calibration requires ground-truth outcomes. Use the operator's\n" +
      "`/journal` entries + closing data to fill the table below. This template\n" +
      "leaves blanks rather than fabricating outcome data.",
  );
  lines.push("");
  lines.push("| Gate reason | Fired | TP (prevented loss) | FP (missed winner) | FPR |");
  lines.push("|-------------|-------|---------------------|--------------------|-----|");
  for (const g of summary.topGateReasons) {
    lines.push(`| ${g.reason} | ${g.count} | ? | ? | ? |`);
  }
  lines.push("");
  lines.push("## Threshold-tuning suggestions");
  lines.push(
    "Suggestions are emitted only after ≥ 20 sessions of journal history are\n" +
      "available. For now, collect data. Never auto-apply threshold changes.",
  );
  lines.push("");
  lines.push("## Footer");
  lines.push(`Run: \`${new Date().toISOString()}\` | Events parsed: ${summary.plansEmitted + summary.tradesTaken + summary.gatesBlockedCount}`);
  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs();
  const journalDir = join(args.outDir, "journal");
  const events = readToday(journalDir, args.date);
  const summary = summarize(events);
  const morning = loadMorning(args.outDir, args.date);
  const report = render(args.date, summary, morning);

  await mkdir(args.outDir, { recursive: true });
  const path = join(args.outDir, `post-mortem-${args.date}.md`);
  await writeFile(path, report, "utf8");
  console.log(`[post-mortem] ${path}`);
  console.log(
    `[post-mortem] plans=${summary.plansEmitted} trades=${summary.tradesTaken} pnl=${Math.round(summary.grossPnlInr)}`,
  );
}

main().catch((e) => {
  console.error(`[post-mortem] fatal: ${String(e)}`);
  process.exit(1);
});
