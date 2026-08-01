# Plugin bundle sizes

Measured after `pnpm --filter @fig-tail/plugin build` (esbuild `minify: true`).

| Artifact | Budget | Unminified baseline | After minify | After 006–008 |
|---|---|---|---|---|
| `dist/main.js` | 400 kB | ~513 kB | ~248 kB | **~265 kB** |
| `dist/ui.html` | 500 kB | ~494 kB | ~247 kB | **~250 kB** |

Both budgets met. See also `linter-performance.md`, `stamping-verification.md`,
`subtree-performance.md` for feature-specific notes.
