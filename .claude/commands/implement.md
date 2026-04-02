# AI Issue Implementation

Implement a feature or fix based on a description.

## Arguments
- `$ARGUMENTS` — Description of what to implement (or a GitHub issue URL)

## Instructions

1. **Understand**: Parse the requirement from the arguments. If it's a GitHub issue URL, read the issue details.
2. **Explore**: Search the codebase for relevant files, existing patterns, and utilities to reuse.
3. **Plan**: Design the implementation. Identify:
   - Files to create or modify
   - Dependencies needed
   - Test files to create
4. **Implement**: Write the code following CLAUDE.md conventions:
   - Strict TypeScript, no `any`
   - Functions max 10 lines
   - Use existing patterns
   - ESM imports only
5. **Test**: Write tests and run `bun test` to verify
6. **Verify**: Run `bun run typecheck` and `bun run format`
7. **Summary**: Report what was created/changed and why
