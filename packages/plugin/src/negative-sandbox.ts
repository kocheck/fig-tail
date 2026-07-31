/**
 * Negative type fixture (plan 003, Step 1).
 *
 * UI/iframe code (`tsconfig.ui.json`) must never see the Figma plugin sandbox
 * globals — `figma`, `__html__` — since the UI runs in a real browser iframe
 * with no plugin API access. This file exists to prove that boundary is
 * enforced, but it is excluded from BOTH `tsconfig.ui.json` and
 * `tsconfig.sandbox.json` so it never breaks `pnpm typecheck` on a normal run.
 *
 * To verify the isolation still holds:
 *   1. Temporarily remove `"src/negative-sandbox.ts"` from `tsconfig.ui.json`'s
 *      `exclude` array.
 *   2. Run `pnpm --filter @fig-tail/plugin exec tsc -p tsconfig.ui.json --noEmit`.
 *   3. Confirm it fails with "Cannot find name 'figma'" (no Figma plugin
 *      typings in that project) — then revert step 1.
 */
export const brokenUiAccess = (): string => figma.root.name
