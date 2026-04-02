# AI Workflow Pipeline

A complete AI-powered development pipeline using **Claude** via `anthropics/claude-code-action` and the Claude Agent SDK. Combines GitHub Actions, Claude Code slash commands, and a local TypeScript orchestrator.

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
│  │  GitHub     │  │  Claude  │  │  Agent SDK       │ │
│  │  Actions    │  │  /cmds   │  │  Orchestrator    │ │
│  └────────────┘  └──────────┘  └──────────────────┘ │
├─────────────────────────────────────────────────────┤
│           Anthropic API (Claude Sonnet/Opus)         │
└─────────────────────────────────────────────────────┘
```

## Setup

### Step 1: Get your Anthropic API key

1. Go to **[console.anthropic.com](https://console.anthropic.com)**
2. Navigate to **Settings** → **API Keys**
3. Click **Create Key** and copy it

### Step 2: Add the key to GitHub

1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `ANTHROPIC_API_KEY`
4. Paste your key → **Add secret**

### Step 3: For local orchestrator use

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

All workflows are now active.

---

## Quick Start

### 1. GitHub Actions (Automated)

| Trigger | Workflow | What it does |
|---------|----------|-------------|
| PR opened/updated | `ai-code-review.yml` | Reviews code for quality, security, performance |
| Issue labeled `ai-implement` | `ai-issue-implementation.yml` | Implements the issue and opens a PR |
| PR opened/updated | `ai-testing-qa.yml` | Generates tests and runs QA checks |
| Push to main | `ai-documentation.yml` | Updates docs for changed files |

Claude can **read, write, and edit files** directly in the workflow — not just comment suggestions.

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

### 3. Agent SDK Orchestrator (Programmatic)

```bash
cd agents
bun install

# Set your key
export ANTHROPIC_API_KEY="sk-ant-..."

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
- Runs `bun test` to verify all tests pass
- Runs `bun run typecheck` for type safety

### Stage 3: Documentation
- Updates JSDoc/TSDoc for changed public APIs
- Updates CLAUDE.md if architecture changed
- Keeps docs concise and technical

### Stage 4: Verification
- Runs `bun run typecheck` — zero errors required
- Runs `bun run format:check` — clean formatting required
- Runs `bun test` — all tests must pass
- Final go/no-go decision

---

## Configuration

### GitHub Actions Secret Required

| Secret | Description |
|--------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key from [console.anthropic.com](https://console.anthropic.com) |

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
