# AI Code Review

Review the current changes for quality, security, and conventions.

## Instructions

1. Run `git diff --staged` to see staged changes, or `git diff` for unstaged changes
2. For each changed file, analyze:
   - **Code quality**: Clean code, naming, SOLID principles, function size (<10 lines)
   - **Security**: Injection, XSS, auth issues, exposed secrets, OWASP top 10
   - **Performance**: N+1 queries, memory leaks, blocking ops, unnecessary computation
   - **Type safety**: No `any`, proper narrowing, correct generics
   - **Tests**: Are new code paths covered?
3. Report findings grouped by severity: critical > warning > suggestion > praise
4. For each finding, provide the file, line, issue, and a concrete fix

Provide an overall verdict at the end: PASS, NEEDS_WORK, or CRITICAL_ISSUES.
