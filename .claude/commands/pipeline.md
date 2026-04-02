# AI Full Pipeline

Run the complete AI pipeline: review, test, document, and verify.

## Arguments
- `$ARGUMENTS` — Scope: "staged" (default), "branch", or specific file paths

## Instructions

Execute these phases in order. Stop if any phase has critical failures.

### Phase 1: Code Review
1. Identify changed files based on the scope argument
2. Review each file for quality, security, performance, and type safety
3. Report findings. If CRITICAL issues found, stop and report.

### Phase 2: Test Generation & Execution
1. Check test coverage for changed files
2. Generate missing tests for uncovered code paths
3. Run `bun test` — all tests must pass
4. Run `bun run typecheck` — must have zero errors

### Phase 3: Documentation
1. Update JSDoc/TSDoc for changed public APIs
2. Update CLAUDE.md if architecture changed
3. Keep documentation concise and accurate

### Phase 4: Final Verification
1. Run `bun run format:check` — formatting must be clean
2. Run `bun run lint` — no lint errors
3. Run `bun test` one final time
4. Report overall status:
   - Files reviewed
   - Tests added/updated
   - Documentation updated
   - All checks passing: YES/NO

### Output
Provide a final summary table:
| Phase | Status | Details |
|-------|--------|---------|
| Review | PASS/FAIL | N findings |
| Tests | PASS/FAIL | N tests added |
| Docs | PASS/FAIL | N files documented |
| Verify | PASS/FAIL | All checks clean |
