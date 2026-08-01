/**
 * Negative type fixture (plan 003, Step 1).
 *
 * Sandbox code (`tsconfig.sandbox.json`) must never see DOM globals — it runs
 * in Figma's QuickJS-like sandbox, which has no `document`, `window`, or
 * `fetch`. This file exists to prove that boundary is enforced, but it is
 * excluded from BOTH `tsconfig.sandbox.json` and `tsconfig.ui.json` so it
 * never breaks `pnpm typecheck` on a normal run.
 *
 * To verify the isolation still holds:
 *   1. Temporarily remove `"src/negative-ui.ts"` from `tsconfig.sandbox.json`'s
 *      `exclude` array.
 *   2. Run `pnpm --filter @fig-tail/plugin exec tsc -p tsconfig.sandbox.json --noEmit`.
 *   3. Confirm it fails with "Cannot find name 'document'" (no `dom` lib in
 *      that project) — then revert step 1.
 */
export const brokenSandboxAccess = (): string => document.title
