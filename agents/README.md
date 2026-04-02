# AI Workflow Pipeline

A complete **free** AI-powered development pipeline using OpenRouter + Llama 4 Maverick. Combines GitHub Actions, Claude Code slash commands, and a local TypeScript orchestrator.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  AI Workflow Pipeline                 │
├──────────────┬──────────────┬───────────┬───────────┤
│  Code Review │   Testing    │   Docs    │  Verify   │
│              │    & QA      │ Generator │           │
├──────────────┴──────────────┴───────────┴───────────┤
│              Trigger Layer                           │
│  ┌────────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  GitHub     │  │  Claude  │  │  Local            │ │
│  │  Actions    │  │  /cmds   │  │  Orchestrator    │ │
│  └────────────┘  └──────────┘  └──────────────────┘ │
├─────────────────────────────────────────────────────┤
│  OpenRouter API (free tier) — Llama 4 Maverick      │
└─────────────────────────────────────────────────────┘
```

## Setup (Free — No Credit Card)

### Step 1: Get your free OpenRouter API key

1. Go to **[openrouter.ai](https://openrouter.ai)**
2. Sign up (free, no credit card)
3. Go to **Keys** → **Create Key**
4. Copy the key (starts with `sk-or-...`)

### Step 2: Add the key to GitHub

1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `OPENROUTER_API_KEY`
4. Value: paste your key
5. Click **Add secret**

### Step 3: For local use, export the key

```bash
export OPENROUTER_API_KEY="sk-or-..."
```

Or add it to your `.env` file (already gitignored).

That's it — all workflows are now active.

---

## Quick Start

### 1. GitHub Actions (Automated)

| Trigger | Workflow | What it does |
|---------|----------|-------------|
| PR opened/updated | `ai-code-review.yml` | Reviews code for quality, security, performance |
| Issue labeled `ai-implement` | `ai-issue-implementation.yml` | Generates implementation plan for the issue |
| PR opened/updated | `ai-testing-qa.yml` | Suggests tests and runs existing test suite |
| Push to main | `ai-documentation.yml` | Generates documentation for changed files |

### 2. Claude Code Slash Commands (Local)

Use these commands directly in Claude Code:

```bash
/review              # Review staged/unstaged changes
/implement <desc>    # Implement a feature or fix
/test changed        # Generate tests for changed files
/test src/module.ts  # Generate tests for a specific file
/docs changed        # Update docs for changed files
/pipeline            # Run the full pipeline (review → test → docs → verify)
```

### 3. Local Orchestrator (Programmatic)

```bash
cd agents
bun install

# Set your key
export OPENROUTER_API_KEY="sk-or-..."

# Full pipeline
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

---

## Pipeline Stages

### Stage 1: Code Review
- Analyzes changed files for quality issues
- Checks security (OWASP top 10), performance, type safety
- Reports findings by severity: critical → warning → suggestion
- **Blocks pipeline** on critical findings

### Stage 2: Test Generation & QA
- Identifies untested code paths in changed files
- Generates comprehensive tests (happy path, edge cases, errors)
- Runs `bun test` to verify all tests pass (verify stage)

### Stage 3: Documentation
- Generates JSDoc/TSDoc for exported APIs
- Suggests README and CLAUDE.md updates
- Keeps docs concise and technical

### Stage 4: Verification
- Runs `bun run typecheck` — zero errors required
- Runs `bun run format:check` — clean formatting required
- Runs `bun test` — all tests must pass
- Final go/no-go decision

---

## Configuration

### GitHub Actions Secret Required

| Secret | Description | How to Get |
|--------|-------------|------------|
| `OPENROUTER_API_KEY` | OpenRouter API key | Free at [openrouter.ai/keys](https://openrouter.ai/keys) |

### Environment Variables (Local Orchestrator)

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key | *required* |
| `AI_MODEL` | Model to use | `meta-llama/llama-4-maverick:free` |

### Free Models Available on OpenRouter

| Model | ID |
|-------|----|
| **Llama 4 Maverick** (default) | `meta-llama/llama-4-maverick:free` |
| Llama 4 Scout | `meta-llama/llama-4-scout:free` |
| Gemma 3 27B | `google/gemma-3-27b-it:free` |
| Mistral Small | `mistralai/mistral-small-3.1-24b-instruct:free` |
| Qwen 2.5 72B | `qwen/qwen-2.5-72b-instruct:free` |

To switch models, set `AI_MODEL` in your environment or update the workflow files.

---

## Customization

### Adding a New Stage

1. Add a prompt to `STAGE_PROMPTS` in `orchestrator.ts`
2. Add the stage name to the default `stages` array in `parseArgs()`
3. Optionally create a matching GitHub Actions workflow in `.github/workflows/`
4. Optionally create a Claude slash command in `.claude/commands/`

### Modifying Review Rules

Edit the prompt in:
- `.github/workflows/ai-code-review.yml` (CI)
- `.claude/commands/review.md` (local)
- `agents/orchestrator.ts` → `STAGE_PROMPTS.review` (SDK)

---

## Cost

**$0.** All workflows use OpenRouter's free tier models. No credit card required. Free tier has rate limits (~20 requests/minute) which is sufficient for CI/CD usage.
