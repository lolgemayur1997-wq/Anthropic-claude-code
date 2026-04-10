# Anthropic Claude Code — AI Workflow Pipeline

A **100% free** AI-powered development pipeline that automates code review, issue implementation, testing, and documentation using Google Gemini.

## What This Does

| Workflow | Trigger | Description |
|----------|---------|-------------|
| **AI Code Review** | PR opened | Automatically reviews PRs for quality, security, and performance |
| **AI Issue Implementation** | Issue labeled `ai-implement` | Reads the issue and generates an implementation plan |
| **AI Testing & QA** | PR opened | Generates test suggestions for changed files |
| **AI Documentation** | Push to main | Auto-generates documentation for changed code |

## Setup (Free — No Credit Card)

### Step 1: Get your free Gemini API key

1. Go to **[aistudio.google.com/apikey](https://aistudio.google.com/apikey)**
2. Sign in with your Google account
3. Click **Create API Key**
4. Copy the key

### Step 2: Add it to GitHub

1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `GEMINI_API_KEY`
4. Paste your key → **Add secret**

### Step 3: Done

Open a PR or label an issue with `ai-implement` — Gemini handles the rest.

## Local Commands (Optional)

With [Claude Code](https://claude.ai/code) installed:

```bash
/review              # Review your current changes
/implement <desc>    # Implement a feature or fix
/test changed        # Generate tests for changed files
/docs changed        # Update docs for changed files
/pipeline            # Run full pipeline: review → test → docs → verify
```

## Programmatic Pipeline (Optional)

```bash
cd agents
bun install
export GEMINI_API_KEY="your-key-here"
bun run pipeline
```

## Project Structure

```
├── CLAUDE.md                              # AI assistant instructions
├── README.md                              # This file
├── CHANGELOG.md                           # Version history
├── LICENSE                                # MIT license
├── SECURITY.md                            # Security policy
├── .gitignore                             # Git ignore rules
├── .claude/
│   ├── settings.json                      # Project permissions
│   └── commands/                          # 5 slash commands
│       ├── review.md                      #   /review
│       ├── implement.md                   #   /implement
│       ├── test.md                        #   /test
│       ├── docs.md                        #   /docs
│       └── pipeline.md                    #   /pipeline
├── .github/workflows/                     # 4 CI/CD workflows
│   ├── ai-code-review.yml                #   PR review
│   ├── ai-issue-implementation.yml       #   Issue → code
│   ├── ai-testing-qa.yml                 #   Test generation
│   └── ai-documentation.yml             #   Doc generation
└── agents/                                # Local pipeline runner
    ├── orchestrator.ts                    #   Pipeline runner
    ├── package.json                       #   Dependencies
    ├── tsconfig.json                      #   TypeScript config
    └── README.md                          #   Detailed docs
```

## How It Works

### CI/CD (GitHub Actions)

All workflows call the **Google Gemini 2.0 Flash** API directly via `curl`. Gemini analyzes your diffs, source code, and issues, then posts results as PR/issue comments.

### Local (Slash Commands)

Slash commands in `.claude/commands/` define reusable AI workflows you invoke with `/command-name` in Claude Code.

### Programmatic (Orchestrator)

The orchestrator in `agents/` runs a 4-stage pipeline (review → test → docs → verify) locally using the Gemini API. See [`agents/README.md`](agents/README.md) for details.

## Cost

**$0.** Everything uses Google Gemini 2.0 Flash free tier. No credit card required. 15 requests/minute, 1,500 requests/day — plenty for CI/CD.

## Tech Stack

- **AI**: Google Gemini 2.0 Flash (free tier)
- **CI/CD**: GitHub Actions
- **Runtime**: Bun
- **Language**: TypeScript (strict mode)

## License

MIT License. See [LICENSE](LICENSE).
