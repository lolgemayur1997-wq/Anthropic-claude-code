# CLAUDE.md — Anthropic Claude Code

This file provides comprehensive context for AI assistants working with the Claude Code codebase. It documents the project structure, development workflows, coding conventions, and architectural patterns.

---

## Project Overview

**Claude Code** is Anthropic's official agentic coding tool — a CLI that lives in your terminal, understands your codebase, and executes tasks through natural language commands. It is available as a terminal CLI, desktop app (Mac/Windows), web app (claude.ai/code), and IDE extensions (VS Code, JetBrains).

- **Repository**: `anthropics/claude-code`
- **Latest Version**: v2.1.90 (April 2026)
- **License**: See `LICENSE.md`

### Core Capabilities

- Codebase understanding and analysis
- Task execution via natural language
- Git workflow automation
- GitHub integration (via `claude-code-action` and `@claude` mentions)
- Plugin system for extensibility
- Multi-model support (Sonnet, Opus, Haiku)

---

## Tech Stack

| Layer            | Technology                                      |
|------------------|------------------------------------------------|
| **Runtime**      | Bun (NOT Node.js — Anthropic acquired Bun)     |
| **Language**     | TypeScript (strict mode)                        |
| **Terminal UI**  | React + Ink                                     |
| **Module System**| ESM with TSX and `react-jsx` transform          |
| **Build**        | Bun build (compiles to ~20MB bundle)            |
| **Monorepo**     | Bun workspaces                                  |
| **Formatting**   | Prettier                                        |
| **Linting**      | ESLint with `@typescript-eslint/strict`         |
| **Git Hooks**    | Husky (pre-commit)                              |

### Language Composition

- Shell: ~47%
- Python: ~29%
- TypeScript: ~18%
- PowerShell: ~4%
- Dockerfile: ~2%

---

## Repository Structure

```
claude-code/
├── src/                    # Main application source code
│   └── main.tsx            # Application entry point (~800KB bootstrap)
├── packages/               # Internal packages (Bun workspaces)
│   └── @ant/*              # Anthropic-specific service stubs
├── plugins/                # Official plugins (13 total)
│   ├── agent-sdk-dev/      # SDK development toolkit
│   ├── code-review/        # Automated PR reviews (5 parallel agents)
│   ├── commit-commands/    # Git workflow automation
│   ├── feature-dev/        # Structured feature development (7-phase workflow)
│   ├── frontend-design/    # Production UI creation
│   ├── hookify/            # Custom hook creation
│   ├── plugin-dev/         # Plugin development toolkit (8-phase workflow)
│   ├── pr-review-toolkit/  # Comprehensive PR reviews (6 agents)
│   ├── security-guidance/  # Security pattern monitoring (9 patterns)
│   ├── ralph-wiggum/       # Autonomous iteration loops
│   ├── explanatory-output-style/  # Educational code insights
│   ├── learning-output-style/     # Interactive learning mode
│   └── claude-opus-4-5-migration/ # Model migration assistance
├── sdk/                    # SDK entrypoints for library usage
├── scripts/                # Build and utility scripts
├── examples/               # Usage examples
├── .claude/                # Claude configuration
│   ├── commands/           # Custom slash commands (*.md)
│   ├── rules/              # Modular instruction files (*.md)
│   └── settings.json       # Project-level permissions & tools
├── .claude-plugin/         # Claude plugin configuration
├── .devcontainer/          # Development container setup
├── .github/                # GitHub Actions workflows and config
├── .vscode/                # VS Code workspace settings
├── Script/                 # Executable scripts
├── CHANGELOG.md            # Version history
├── LICENSE.md              # License information
├── README.md               # Project documentation
└── SECURITY.md             # Security policy
```

---

## Development Commands

> **Important**: Always use `bun`, never `npm`, `yarn`, or `node`.

### Setup

```bash
bun install                 # Install all dependencies
```

### Build

```bash
bun run build               # Build the project (~20MB bundle output)
```

### Testing

```bash
bun test                    # Run all tests
bun test <path>             # Run tests for a specific file
```

### Type Checking

```bash
bun run typecheck           # TypeScript type checking (strict mode)
```

### Formatting

```bash
bun run format              # Auto-format with Prettier
bun run format:check        # Check formatting without modifying
```

### Linting

```bash
bun run lint                # Run ESLint
bun run lint:fix            # Auto-fix lint issues
```

---

## Code Conventions

### TypeScript Rules

- **Strict mode** is enabled (`noUnusedLocals`, `noUnusedParameters`)
- **Never use `any`** — use `unknown` for truly unknown types, then narrow
- **Functions**: max 10 lines, cyclomatic complexity max 10
- **Module system**: ESM only — no CommonJS (`require()`, `module.exports`)
- **React JSX transform**: Use `react-jsx` (no manual `import React`)

### Style Rules

- **Prettier** handles all formatting — do not override with manual formatting
- **ESLint** with `@typescript-eslint/strict` — all rules enforced
- **Husky pre-commit hooks** run linting automatically on commit
- **Naming conventions**:
  - `camelCase` for variables and functions
  - `PascalCase` for types, interfaces, classes, and React components
  - `UPPER_SNAKE_CASE` for constants
  - Prefix interfaces with descriptive names (not `I` prefix)

### Code Quality Guidelines

- Keep functions small and focused (single responsibility)
- Prefer composition over inheritance
- Use explicit return types on exported functions
- Handle errors at system boundaries, trust internal code
- No speculative abstractions — write what the task requires
- Three similar lines are better than a premature abstraction

---

## Architecture

### Core Modules

| Module             | Purpose                                         |
|--------------------|------------------------------------------------|
| `QueryEngine`      | Conversation management & API orchestration     |
| `query.ts`         | Query execution logic                           |
| `Tool.ts`          | Tool registry and base tool definitions         |
| `commands.ts`      | Slash command registry (100+ commands)           |
| `context.ts`       | System/user context builder                     |
| `CostTracker`      | Per-model token usage tracking                  |
| `History`          | Session history management                      |

### Tool System

Claude Code exposes **40+ built-in tools** that AI assistants can use:

| Category          | Tools                                            |
|-------------------|--------------------------------------------------|
| **File Ops**      | Read, Write, Edit, Glob                          |
| **Code Search**   | Grep                                              |
| **Execution**     | Bash, PowerShell                                  |
| **Web**           | WebSearch, WebFetch                                |
| **User Input**    | AskUserQuestion                                   |
| **Task Mgmt**     | TodoWrite                                         |
| **Notebooks**     | NotebookEdit                                      |
| **Agents**        | Agent (subagent spawning)                         |

### Plugin System

Plugins extend Claude Code's capabilities. Each plugin lives in `plugins/<name>/` and follows a structured development workflow:

- **code-review**: Runs 5 parallel agents for automated PR reviews
- **feature-dev**: 7-phase structured feature development workflow
- **plugin-dev**: 8-phase plugin development toolkit
- **security-guidance**: Monitors 9 security patterns
- **pr-review-toolkit**: Comprehensive PR reviews with 6 agents

### Configuration Hierarchy

Settings are resolved in order of increasing priority:

1. **Plugin defaults** — Baseline from installed plugins
2. **User settings** — `~/.claude/settings.json` (global)
3. **Project settings** — `.claude/settings.json` (version-controlled)
4. **Local settings** — `.claude/settings.local.json` (gitignored, personal)
5. **Managed/policy settings** — Organization-level overrides

### Configuration Files

| File                          | Purpose                                     |
|-------------------------------|---------------------------------------------|
| `CLAUDE.md`                   | Project context for AI assistants (40k char limit) |
| `.claude/settings.json`       | Permissions, tools, hooks, MCP servers      |
| `.claude/settings.local.json` | Personal project tweaks (gitignored)        |
| `.claude/commands/*.md`       | Custom slash commands                       |
| `.claude/rules/*.md`          | Modular instruction files                   |
| `.claude/skills/*/SKILL.md`   | Specialized capability definitions          |
| `~/.claude/CLAUDE.md`         | Global AI assistant instructions            |
| `~/.claude/settings.json`     | Global user settings                        |

---

## Testing Conventions

- **Test runner**: Bun's built-in test runner (`bun test`)
- **Test files**: Colocated with source or in `__tests__/` directories
- **Naming**: `*.test.ts` or `*.test.tsx`
- **Type checking**: `bun run typecheck` is part of CI — all code must pass strict TypeScript checks
- **Pre-commit**: Husky hooks run linting before every commit

### Running Tests

```bash
# Run all tests
bun test

# Run a specific test file
bun test src/tools/Read.test.ts

# Run tests matching a pattern
bun test --grep "QueryEngine"

# Type check (no emit)
bun run typecheck
```

---

## Integration Points

### GitHub Actions

The official **`anthropics/claude-code-action`** enables Claude Code in CI/CD:

- Runs full Claude Code runtime in GitHub Actions
- Intelligent mode detection (`@claude` mentions vs. direct prompts)
- Supports multiple authentication methods
- Use cases: PR reviews, issue implementation, code quality checks

### IDE Extensions

- **VS Code**: Official extension available
- **JetBrains**: Official plugin available
- Integration provides inline suggestions, terminal access, and code actions

### Agent SDK

Available in both TypeScript and Python for programmatic use:

- **TypeScript**: `@anthropic-ai/claude-agent-sdk`
- **Python**: `claude-agent-sdk`
- Key APIs: `query()`, `ClaudeAgentOptions`, tool definitions, hooks, subagents
- Supports MCP (Model Context Protocol) for tool extensibility

### Cloud Providers

Claude Code supports multiple authentication backends:

- **Direct**: Anthropic API key (`ANTHROPIC_API_KEY`)
- **AWS Bedrock**: `CLAUDE_CODE_USE_BEDROCK=1`
- **Google Vertex AI**: `CLAUDE_CODE_USE_VERTEX=1`
- **Azure**: Azure OpenAI integration

---

## Common Pitfalls

### Use Bun, Not Node/npm

```bash
# WRONG
npm install
npm test
node src/main.tsx

# CORRECT
bun install
bun test
bun src/main.tsx
```

### ESM Only

- No `require()` — use `import`/`export`
- No `module.exports` — use `export default` or named exports
- File extensions matter in imports

### CLAUDE.md Character Limit

- Maximum **40,000 characters** per CLAUDE.md file
- Parsed on every query iteration (not just startup)
- Use `.claude/rules/*.md` for modular overflow content

### TypeScript Strictness

- `noUnusedLocals` and `noUnusedParameters` are enforced
- Prefix intentionally unused parameters with `_`
- Never suppress TypeScript errors with `@ts-ignore` — fix the type

### React + Ink Specifics

- Terminal UI uses React with Ink — not DOM React
- No browser APIs (`document`, `window`, etc.)
- Use Ink components (`Box`, `Text`) instead of HTML elements

---

## Git Workflow

### Commit Messages

- Use conventional commit style when possible
- Keep messages concise and descriptive
- Focus on the "why" rather than the "what"

### Branch Strategy

- `main` — stable release branch
- Feature branches for development
- PR-based workflow with code review

### Pre-commit Hooks

Husky runs the following on every commit:
- ESLint checks
- Prettier formatting verification
- TypeScript type checking

---

## For AI Assistants

When working in this codebase, follow these guidelines:

1. **Read before editing** — Always read a file before modifying it
2. **Use dedicated tools** — Use Read/Edit/Write/Glob/Grep instead of shell equivalents
3. **Respect the type system** — No `any`, use proper type narrowing
4. **Keep functions small** — Max 10 lines, single responsibility
5. **Don't over-engineer** — No speculative abstractions or premature optimization
6. **Use Bun** — Never fall back to npm/node commands
7. **Test your changes** — Run `bun test` and `bun run typecheck` after modifications
8. **Format code** — Run `bun run format` before committing
9. **Follow existing patterns** — Match the style of surrounding code
10. **Don't add unnecessary comments** — Code should be self-documenting; only comment non-obvious logic
