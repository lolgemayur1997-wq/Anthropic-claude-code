# AI Documentation Generator

Generate or update documentation for specified files or recent changes.

## Arguments
- `$ARGUMENTS` — File path(s) to document, or "changed" for recently modified files

## Instructions

1. **Identify targets**: If arguments say "changed", use `git diff --name-only` to find modified source files. Otherwise, use specified paths.
2. **Read source**: Read each target file to understand its public API surface.
3. **Update inline docs**: Add or update JSDoc/TSDoc comments for:
   - Exported functions (params, returns, throws, examples)
   - Exported interfaces and types
   - Complex internal logic that needs explanation
4. **Update CLAUDE.md**: If architecture or patterns changed, update the relevant section.
5. **Don't over-document**: Skip obvious things (getters, trivial functions). Document the "why".
6. **Keep it concise**: Technical, clear, no fluff.

## Documentation Format
```typescript
/**
 * Brief description of what the function does.
 *
 * @param name - Description of the parameter
 * @returns Description of the return value
 * @throws {ErrorType} When this condition occurs
 *
 * @example
 * ```ts
 * const result = myFunction("input");
 * ```
 */
```
