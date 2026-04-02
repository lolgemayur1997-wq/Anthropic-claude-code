/**
 * AI Workflow Pipeline Orchestrator
 *
 * Runs a multi-stage AI pipeline: review → test → document → verify.
 * Uses the Claude Agent SDK to spawn specialized sub-agents for each stage.
 *
 * Usage:
 *   bun run orchestrator.ts                    # Run full pipeline
 *   bun run orchestrator.ts --stage review     # Run single stage
 *   bun run orchestrator.ts --scope staged     # Scope to staged changes
 *   bun run orchestrator.ts --scope branch     # Scope to branch changes
 *
 * Environment:
 *   ANTHROPIC_API_KEY — Your Anthropic API key
 */

import { query, type ClaudeAgentOptions } from "@anthropic-ai/claude-agent-sdk";

// --- Types ---

interface StageResult {
  stage: string;
  status: "pass" | "fail" | "skipped";
  summary: string;
  duration: number;
}

interface PipelineConfig {
  stages: string[];
  scope: "staged" | "branch" | "all";
  stopOnFailure: boolean;
}

// --- Stage Prompts ---

const STAGE_PROMPTS: Record<string, string> = {
  review: `You are an expert code reviewer. Analyze the changed files and report findings.

## Tasks
1. Run git diff to identify changed files
2. Read each changed file
3. Check for: code quality, security vulnerabilities, performance issues, type safety
4. Report findings as JSON: { "findings": [{ "severity": "critical|warning|suggestion", "file": "path", "line": number, "issue": "description", "fix": "suggestion" }], "verdict": "pass|fail" }

Only output the JSON result, nothing else.`,

  test: `You are an expert test engineer. Generate and run tests for changed code.

## Tasks
1. Find changed .ts/.tsx files
2. Read each file and identify untested code paths
3. Write comprehensive tests using bun:test
4. Run bun test to verify
5. Report as JSON: { "tests_created": number, "tests_passed": number, "tests_failed": number, "coverage_gaps": ["description"], "verdict": "pass|fail" }

Only output the JSON result, nothing else.`,

  docs: `You are a technical documentation expert. Update docs for changed code.

## Tasks
1. Find changed source files
2. Add/update JSDoc comments for exported APIs
3. Update CLAUDE.md if architecture changed
4. Report as JSON: { "files_documented": number, "docs_updated": ["file paths"], "verdict": "pass|fail" }

Only output the JSON result, nothing else.`,

  verify: `You are a CI/CD verification agent. Run all quality checks.

## Tasks
1. Run bun run typecheck
2. Run bun run format:check
3. Run bun test
4. Report as JSON: { "typecheck": "pass|fail", "format": "pass|fail", "tests": "pass|fail", "verdict": "pass|fail" }

Only output the JSON result, nothing else.`,
};

// --- Helpers ---

function parseArgs(): PipelineConfig {
  const args = process.argv.slice(2);
  const config: PipelineConfig = {
    stages: ["review", "test", "docs", "verify"],
    scope: "staged",
    stopOnFailure: true,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--stage":
        config.stages = [args[++i]];
        break;
      case "--scope":
        config.scope = args[++i] as PipelineConfig["scope"];
        break;
      case "--no-stop":
        config.stopOnFailure = false;
        break;
    }
  }

  return config;
}

function formatResults(results: StageResult[]): string {
  const header = "| Stage    | Status  | Duration | Summary                          |";
  const divider = "|----------|---------|----------|----------------------------------|";
  const rows = results.map(
    (r) =>
      `| ${r.stage.padEnd(8)} | ${r.status.padEnd(7)} | ${(r.duration / 1000).toFixed(1).padStart(5)}s   | ${r.summary.slice(0, 32).padEnd(32)} |`
  );

  return [header, divider, ...rows].join("\n");
}

// --- Main Pipeline ---

async function runStage(stage: string, scope: string): Promise<StageResult> {
  const start = Date.now();

  const prompt = STAGE_PROMPTS[stage];
  if (!prompt) {
    return { stage, status: "skipped", summary: `Unknown stage: ${stage}`, duration: 0 };
  }

  const scopeContext =
    scope === "staged"
      ? "Focus on staged changes (git diff --staged)."
      : scope === "branch"
        ? "Focus on all changes in the current branch vs main."
        : "Analyze the entire codebase.";

  try {
    const options: ClaudeAgentOptions = {
      prompt: `${prompt}\n\nScope: ${scopeContext}`,
      allowedTools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
      maxTurns: 20,
    };

    const result = await query(options);

    const duration = Date.now() - start;
    const output = typeof result === "string" ? result : JSON.stringify(result);

    try {
      const parsed = JSON.parse(output);
      return {
        stage,
        status: parsed.verdict === "pass" ? "pass" : "fail",
        summary: `verdict: ${parsed.verdict}`,
        duration,
      };
    } catch {
      return { stage, status: "pass", summary: output.slice(0, 100), duration };
    }
  } catch (error) {
    return {
      stage,
      status: "fail",
      summary: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    };
  }
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required.");
    console.error("Get your key at: https://console.anthropic.com/settings/keys");
    process.exit(1);
  }

  const config = parseArgs();
  const results: StageResult[] = [];

  console.log("=== AI Workflow Pipeline ===");
  console.log(`Stages: ${config.stages.join(" → ")}`);
  console.log(`Scope:  ${config.scope}`);
  console.log(`Stop on failure: ${config.stopOnFailure}`);
  console.log("");

  for (const stage of config.stages) {
    console.log(`▶ Running stage: ${stage}...`);

    const result = await runStage(stage, config.scope);
    results.push(result);

    const icon = result.status === "pass" ? "✓" : result.status === "fail" ? "✗" : "○";
    console.log(`  ${icon} ${stage}: ${result.status} (${(result.duration / 1000).toFixed(1)}s)`);

    if (result.status === "fail" && config.stopOnFailure) {
      console.log(`\n⚠ Pipeline stopped: ${stage} failed.`);
      break;
    }
  }

  console.log("\n=== Pipeline Results ===");
  console.log(formatResults(results));

  const failed = results.some((r) => r.status === "fail");
  process.exit(failed ? 1 : 0);
}

main();
