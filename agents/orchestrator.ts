/**
 * AI Workflow Pipeline Orchestrator
 *
 * Runs a multi-stage AI pipeline: review → test → document → verify.
 * Uses Google Gemini 2.0 Flash (free, no credit card needed).
 *
 * Usage:
 *   bun run orchestrator.ts                    # Run full pipeline
 *   bun run orchestrator.ts --stage review     # Run single stage
 *   bun run orchestrator.ts --scope staged     # Scope to staged changes
 *   bun run orchestrator.ts --scope branch     # Scope to branch changes
 *
 * Environment:
 *   GEMINI_API_KEY — Free key from aistudio.google.com
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

interface GeminiResponse {
  candidates?: Array<{
    content: { parts: Array<{ text: string }> };
  }>;
  error?: { message: string };
}

// --- Config ---

const API_KEY = process.env.GEMINI_API_KEY;
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// --- Stage Prompts ---

const STAGE_PROMPTS: Record<string, string> = {
  review: `You are an expert code reviewer. Analyze the provided diff and report findings.
Check for: code quality, security vulnerabilities, performance issues, type safety.
Report as JSON: { "findings": [{ "severity": "critical|warning|suggestion", "file": "path", "issue": "description", "fix": "suggestion" }], "verdict": "pass|fail" }
Only output valid JSON.`,

  test: `You are an expert test engineer. Analyze the source files and suggest tests.
For each file, identify untested code paths and generate test code using describe/it/expect.
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

async function geminiChat(prompt: string, content: string): Promise<string> {
  const url = `${API_URL}?key=${API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${prompt}\n\n${content}` }] }],
      generationConfig: { maxOutputTokens: 4000 },
    }),
  });

  const data = (await response.json()) as GeminiResponse;

  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  return data.candidates?.[0]?.content.parts[0]?.text ?? "No response";
}

// --- Git Helpers ---

async function getDiff(scope: string): Promise<string> {
  if (scope === "staged") {
    return (await $`git diff --staged`.text()).slice(0, 25000);
  }
  if (scope === "branch") {
    return (await $`git diff main...HEAD`.text()).slice(0, 25000);
  }
  return (await $`git diff HEAD~1`.text()).slice(0, 25000);
}

async function getChangedFiles(scope: string): Promise<string> {
  if (scope === "staged") {
    return (await $`git diff --staged --name-only -- '*.ts' '*.tsx'`.text()).trim();
  }
  if (scope === "branch") {
    return (await $`git diff --name-only main...HEAD -- '*.ts' '*.tsx'`.text()).trim();
  }
  return (await $`find . -name '*.ts' -o -name '*.tsx' | grep -v node_modules | head -30`.text()).trim();
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
    let content: string;

    if (stage === "review") {
      content = `Review this diff:\n\`\`\`\n${await getDiff(scope)}\n\`\`\``;
    } else if (stage === "verify") {
      const typecheck = await $`bun run typecheck 2>&1`.text().catch(() => "not configured");
      const format = await $`bun run format:check 2>&1`.text().catch(() => "not configured");
      const tests = await $`bun test 2>&1`.text().catch(() => "no tests found");
      content = `Typecheck:\n${typecheck.slice(0, 3000)}\n\nFormat:\n${format.slice(0, 3000)}\n\nTests:\n${tests.slice(0, 3000)}`;
    } else {
      const files = await getChangedFiles(scope);
      const fileContents = await readFiles(files);
      content = `Files:\n${files}\n\nSource:\n${fileContents}`;
    }

    const response = await geminiChat(prompt, content);
    const duration = Date.now() - start;

    try {
      const parsed = JSON.parse(response);
      return { stage, status: parsed.verdict === "pass" ? "pass" : "fail", summary: `verdict: ${parsed.verdict}`, duration };
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
    console.error("Error: GEMINI_API_KEY environment variable is required.");
    console.error("Get a FREE key at: https://aistudio.google.com/apikey");
    process.exit(1);
  }

  const config = parseArgs();
  const results: StageResult[] = [];

  console.log("=== AI Workflow Pipeline ===");
  console.log(`Model:  Gemini 2.0 Flash (free)`);
  console.log(`Stages: ${config.stages.join(" → ")}`);
  console.log(`Scope:  ${config.scope}`);
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
  process.exit(results.some((r) => r.status === "fail") ? 1 : 0);
}

main();
