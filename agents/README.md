# AI Workflow Pipeline

A **free** AI-powered development pipeline using Google Gemini 2.0 Flash.

## Setup (Free)

1. Get a free API key at **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)**
2. Export it: `export GEMINI_API_KEY="your-key"`

## Usage

```bash
bun install

# Full pipeline (review → test → docs → verify)
bun run pipeline

# Single stage
bun run review
bun run test-gen
bun run docs
bun run verify

# Custom options
bun run orchestrator.ts --stage review --scope branch
bun run orchestrator.ts --scope all --no-stop
```

## Pipeline Stages

| Stage | What it Does |
|-------|-------------|
| **review** | Analyzes diff for quality, security, performance issues |
| **test** | Generates test suggestions for changed files |
| **docs** | Generates JSDoc/TSDoc for exported APIs |
| **verify** | Runs typecheck, format check, and tests |

## Cost

**$0.** Google Gemini 2.0 Flash free tier. No credit card needed.
