# AI Test Generator

Generate comprehensive tests for specified files or recent changes.

## Arguments
- `$ARGUMENTS` — File path(s) to test, or "changed" for recently modified files

## Instructions

1. **Identify targets**: If arguments say "changed", run `git diff --name-only` to find modified `.ts`/`.tsx` files. Otherwise, use the specified paths.
2. **Read source**: Read each target file to understand its exports, logic, and edge cases.
3. **Check existing tests**: Search for existing `*.test.ts` files for these modules.
4. **Generate tests**: For each target, write tests covering:
   - All exported functions and classes
   - Happy path scenarios
   - Edge cases (empty input, null, boundary values)
   - Error handling paths
   - Type narrowing correctness
5. **Run tests**: Execute `bun test` to verify all tests pass
6. **Run typecheck**: Execute `bun run typecheck` to ensure type safety
7. **Report**: Summarize what was tested and coverage gaps remaining

## Test Standards
- Use `bun:test` (`describe`, `it`, `expect`)
- Descriptive names: `it("should return empty array when input is null")`
- Mock external deps, not internal modules
- Test behavior, not implementation
