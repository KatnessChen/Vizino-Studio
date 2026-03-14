# TypeCheck & ESLint Auto-Fix Prompt

Copilot Local Task (run locally, not CI):

- Purpose: Allow Copilot to run a fully automated local fix routine to resolve ESLint and TypeScript issues when possible. This is NOT tied to GitHub Actions or CI.

- Expected behavior for Copilot when asked to "Run type-check & eslint and fix issues":
  1. Ensure dependencies are installed: `pnpm install`.
  2. Run ESLint auto-fix: `pnpm run lint -- --fix`.
     - If files are modified by `--fix`, present a concise diff to the user and ask whether to commit the fixes. **Do NOT commit automatically.**
     - If many files are changed (>100 or the change touches unrelated areas), recommend creating a draft PR and ask the user whether to open it instead of committing directly.
  3. Run TypeScript check: `pnpm run type-check`.
     - If `tsc` reports no errors, finish and report success.
     - If there are type errors, attempt automatic repairs in the following order:
       a. Apply simple, safe fixes (e.g., missing imports, minor type widening/narrowing, adding `unknown` to external values) using editor/code-actions or programmatic AST transforms.
       b. Prefer non-invasive edits (e.g., add explicit types, fix incorrect property access, import renamed symbols).
       c. Avoid broad `any` placements unless accompanied by a TODO comment referencing the failing area and the minimal refactor required.
     - After each automatic change, re-run `pnpm run type-check` and repeat until either all errors are fixed or no further safe automated fixes are possible.
  4. If automated fixes cannot resolve all type errors, prepare a concise report showing remaining errors and suggested manual changes. Ask the user whether to apply any proposed non-trivial fixes.
  5. Run `pnpm run lint` (no `--fix`) and `pnpm test` if present to ensure changes pass linting and tests.

- Commit conventions for Copilot local fixes (use **only with user approval**):
  - ESLint auto-fixes: `chore(lint): apply ESLint --fix`
  - Type-only automated fixes (small safe changes): `fix(types): auto-fix <short description>` and include brief rationale in the body.
  - If changes are large or risky, create a draft PR titled: `chore(auto-fixes): ESLint & type-check auto-fixes` and include a summary of automated changes and remaining work.

- Safety rules:
  - Never update `package.json` or lockfiles automatically as part of fixing lint/type issues.
  - Prefer opening a draft PR for large changes requiring human review.
  - For ambiguous type fixes, add a `// TODO` or `// FIXME` comment linking to the relevant error in the CI output.

- Interaction model:
  - Copilot should **never** commit changes without explicit user approval. If Copilot can fully fix issues automatically, present a concise diff and ask the user whether to commit; only commit after approval.
  - If manual decisions are needed, present diffs and ask the user to approve the suggested fixes before committing.

Use this prompt when the user says something like: "Copilot, run type-check and eslint and fix everything you can locally".
