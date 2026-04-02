/**
 * AI Workflow Pipeline Orchestrator
 *
 * Runs a multi-stage AI pipeline: review → test → document → verify.
 * Uses OpenRouter API (free tier) with Llama 4 Maverick.
 *
 * Usage:
 *   bun run orchestrator.ts                    # Run full pipeline
 *   bun run orchestrator.ts --stage review     # Run single stage
 *   bun run orchestrator.ts --scope staged     # Scope to staged changes
 *   bun run orchestrator.ts --scope branch     # Scope to branch changes
 *
 * Environment:
 *   OPENROUTER_API_KEY  — Your OpenRouter API key (free at openrouter.ai)
 *   AI_MODEL            — Model override (default: meta-llama/llama-4-maverick:free)
 */

import { $ } from "bun";

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

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterResponse {
  choices: Array<{
    message: { content: string };
  }>;
  error?: { message: string };
}

// --- Config ---

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.AI_MODEL ?? "meta-llama/llama-4-maverick:free";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

// --- Stage Prompts ---

const STAGE_PROMPTS: Record<string, string> = {
  review: `You are an expert code reviewer. Analyze the provided diff and report findings.

Check for: code quality, security vulnerabilities, performance issues, type safety.
Report as JSON: { "findings": [{ "severity": "critical|warning|suggestion", "file": "path", "issue": "description", "fix": "suggestion" }], "verdict": "pass|fail" }
Only output valid JSON.`,

  test: `You are an expert test engineer. Analyze the source files and suggest tests.

For each file, identify untested code paths and generate test code using bun:test (describe, it, expect).
Report as JSON: { "test_files": [{ "path": "*.test.ts", "code": "test source" }], "coverage_gaps": ["description"], "verdict": "pass|fail" }
Only output valid JSON.`,

  docs: `You are a technical documentation expert. Generate documentation for the provided code.

Add JSDoc/TSDoc for exported functions, interfaces, and types. Document the "why", not the "what".
Report as JSON: { "documentation": [{ "file": "path", "docs": "JSDoc content" }], "verdict": "pass|fail" }
Only output valid JSON.`,

  verify: `You are a CI verification agent. Analyze these check results and determine if quality gates pass.

Report as JSON: { "typecheck": "pass|fail", "format": "pass|fail", "tests": "pass|fail", "verdict": "pass|fail" }
Only output valid JSON.`,
};

// --- API Client ---

async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/ai-workflow-pipeline",
      "X-Title": "AI Workflow Pipeline",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: 4000,
    }),
  });

  const data = (await response.json()) as OpenRouterResponse;

  if (data.error) {
    throw new Error(`OpenRouter API error: ${data.error.message}`);
  }

  return data.choices[0]?.message.content ?? "No response";
}

// --- Git Helpers ---

async function getChangedFiles(scope: string): Promise<string> {
  if (scope === "staged") {
    return (await $`git diff --staged --name-only -- '*.ts' '*.tsx'`.text()).trim();
  }
  if (scope === "branch") {
    return (await $`git diff --name-only main...HEAD -- '*.ts' '*.tsx'`.text()).trim();
  }
  return (await $`find . -name '*.ts' -o -name '*.tsx' | grep -v node_modules | head -30`.text()).trim();
}

async function getDiff(scope: string): Promise<string> {
  if (scope === "staged") {
    return (await $`git diff --staged`.text()).slice(0, 25000);
  }
  if (scope === "branch") {
    return (await $`git diff main...HEAD`.text()).slice(0, 25000);
  }
  return (await $`git diff HEAD~1`.text()).slice(0, 25000);
}

async function readFiles(files: string): Promise<string> {
  const lines = files.split("\n").filter(Boolean).slice(0, 15);
  let content = "";
  for (const file of lines) {
    try {
      const text = await Bun.file(file).text();
      content += `--- ${file} ---\n${text.slice(0, 2000)}\n\n`;
    } catch {
      continue;
    }
  }
  return content.slice(0, 25000);
}

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

// --- Stage Runner ---

async function runStage(stage: string, scope: string): Promise<StageResult> {
  const start = Date.now();

  const prompt = STAGE_PROMPTS[stage];
  if (!prompt) {
    return { stage, status: "skipped", summary: `Unknown stage: ${stage}`, duration: 0 };
  }

  try {
    let userContent: string;

    if (stage === "review") {
      const diff = await getDiff(scope);
      userContent = `Review this diff:\n\n\`\`\`diff\n${diff}\n\`\`\``;
    } else if (stage === "verify") {
      const typecheck = await $`bun run typecheck 2>&1`.text().catch(() => "typecheck not configured");
      const format = await $`bun run format:check 2>&1`.text().catch(() => "format check not configured");
      const tests = await $`bun test 2>&1`.text().catch(() => "no tests found");
      userContent = `Check results:\n\nTypecheck:\n${typecheck.slice(0, 3000)}\n\nFormat:\n${format.slice(0, 3000)}\n\nTests:\n${tests.slice(0, 3000)}`;
    } else {
      const files = await getChangedFiles(scope);
      const contents = await readFiles(files);
      userContent = `Files:\n${files}\n\nSource:\n${contents}`;
    }

    const response = await chatCompletion([
      { role: "system", content: prompt },
      { role: "user", content: userContent },
    ]);

    const duration = Date.now() - start;

    try {
      const parsed = JSON.parse(response);
      return {
        stage,
        status: parsed.verdict === "pass" ? "pass" : "fail",
        summary: `verdict: ${parsed.verdict}`,
        duration,
      };
    } catch {
      return { stage, status: "pass", summary: response.slice(0, 100), duration };
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

// --- Main ---

async function main(): Promise<void> {
  if (!API_KEY) {
    console.error("Error: OPENROUTER_API_KEY environment variable is required.");
    console.error("Get a free key at: https://openrouter.ai/keys");
    process.exit(1);
  }

  const config = parseArgs();
  const results: StageResult[] = [];

  console.log("=== AI Workflow Pipeline ===");
  console.log(`Model:  ${MODEL}`);
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
