# Anthropic Claude Code — AI Workflow Pipeline

An AI-powered development pipeline that automates code review, issue implementation, testing, and documentation using Claude.

## What This Does

| Workflow | Trigger | Description |
|----------|---------|-------------|
| **AI Code Review** | PR opened | Automatically reviews PRs for quality, security, and performance |
| **AI Issue Implementation** | Issue labeled `ai-implement` | Reads the issue, writes code, and opens a PR |
| **AI Testing & QA** | PR opened | Generates test suggestions and runs the test suite |
| **AI Documentation** | Push to main | Auto-generates and commits documentation updates |

## Quick Start

### 1. Add your API key

Go to repo **Settings** → **Secrets and variables** → **Actions** → add `ANTHROPIC_API_KEY`.

### 2. That's it

Open a PR or label an issue with `ai-implement` — Claude handles the rest.

### 3. Local commands (optional)

With [Claude Code](https://claude.ai/code) installed:

```bash
/review              # Review your current changes
/implement <desc>    # Implement a feature or fix
/test changed        # Generate tests for changed files
/docs changed        # Update docs for changed files
/pipeline            # Run full pipeline: review → test → docs → verify
```

### 4. Programmatic pipeline (optional)

```bash
cd agents
bun install
export ANTHROPIC_API_KEY="sk-ant-..."
bun run pipeline
```

## Project Structure

```
├── CLAUDE.md                              # AI assistant instructions
├── .claude/commands/                      # 5 slash commands
│   ├── review.md                          #   /review
│   ├── implement.md                       #   /implement
│   ├── test.md                            #   /test
│   ├── docs.md                            #   /docs
│   └── pipeline.md                        #   /pipeline
├── .claude/settings.json                  # Project permissions
├── .github/workflows/                     # 4 CI/CD workflows
│   ├── ai-code-review.yml                #   PR review
│   ├── ai-issue-implementation.yml       #   Issue → code
│   ├── ai-testing-qa.yml                 #   Test generation
│   └── ai-documentation.yml             #   Doc generation
└── agents/                                # SDK orchestrator
    ├── orchestrator.ts                    #   Pipeline runner
    ├── package.json                       #   Dependencies
    ├── tsconfig.json                      #   TypeScript config
    └── README.md                          #   Detailed docs
```

## How It Works

### CI/CD (GitHub Actions)

All workflows use [`anthropics/claude-code-action@v1`](https://github.com/anthropics/claude-code-action) which runs the full Claude Code runtime inside GitHub Actions. Claude can **read, write, and edit files** directly — not just post comments.

### Local (Slash Commands)

Slash commands in `.claude/commands/` define reusable AI workflows you invoke with `/command-name` in Claude Code.

### Programmatic (Agent SDK)

The orchestrator in `agents/` uses the Claude Agent SDK to run a 4-stage pipeline programmatically. See [`agents/README.md`](agents/README.md) for details.

## Tech Stack

- **AI**: Claude (Anthropic API) via `claude-code-action` and Agent SDK
- **CI/CD**: GitHub Actions
- **Runtime**: Bun
- **Language**: TypeScript (strict mode)

## License

MIT License. See [LICENSE](LICENSE).
