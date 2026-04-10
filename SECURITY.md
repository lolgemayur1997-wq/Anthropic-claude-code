# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email the maintainer directly or use GitHub's private vulnerability reporting feature
3. Include a description of the vulnerability and steps to reproduce it

## Secrets Management

- **Never** commit API keys, tokens, or credentials to the repository
- Store all secrets in GitHub Actions secrets (Settings → Secrets → Actions)
- Use environment variables for local development
- The `.gitignore` file excludes `.env` files by default

## Required Secrets

| Secret | Purpose | Where to Get |
|--------|---------|--------------|
| `ANTHROPIC_API_KEY` | Powers all AI workflows | [console.anthropic.com](https://console.anthropic.com) |

## Workflow Permissions

All GitHub Actions workflows follow the principle of least privilege:

- **Code Review**: `contents: read`, `pull-requests: write`
- **Issue Implementation**: `contents: write`, `pull-requests: write`, `issues: write`
- **Testing & QA**: `contents: write`, `pull-requests: write`, `checks: write`
- **Documentation**: `contents: write`, `pull-requests: write`
