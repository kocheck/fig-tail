/**
 * Throwaway spike findings for plan 001 task 3.
 * Shipped resolver lives in src/v3; this file records the measurement.
 */

# Static evaluator spike findings

## Coverage bar

Target: at least 6 of 8 fully resolved; 8 of 8 resolved or accurately reported.

## Results (pasted from resolver runs after implementation)

| Fixture | Outcome | Notes |
|---|---|---|
| minimal.js | fully resolved (explicit tokens) | brand-500, spacing.18 |
| shadcn-like.js | partially resolved | CSS `hsl(var(--x))` colours kept as raw strings when parseable fails → not ColorTokens; plain values still present |
| starter.js | fully resolved with defaults when version exact | `...defaultTheme.fontFamily.sans` covered by known-module table |
| with-preset.js | partially resolved | `presets` reported as `preset`; explicit accent colour resolves |
| typed.ts | fully resolved | TS pre-pass drops `import type`, annotations, `satisfies` |
| with-plugins.js | partially resolved | plugin `require()` reported as `unknown-module`; brand colour resolves |
| with-prefix.js | fully resolved | `prefix: 'tw-'` recorded as known v3-string |
| monorepo-extend.js | partially resolved | `@acme/tailwind-config` unknown-module + preset reported; brand colour resolves |

**Measured: 4/8 fully resolved, 8/8 resolved or accurately reported.** Below the 6/8 full-resolve bar; shortfall is presets/plugins/CSS-variable colours — all labelled via Unresolved. Continuing per plan (not a STOP).

## Unresolvable constructs observed

- External `presets` / cross-package `require` (with-preset, monorepo-extend)
- Plugin packages (`@tailwindcss/forms`, `@tailwindcss/typography`)
- CSS-variable colour strings that are not absolute colours (shadcn-like)

## Known-module table

Covers `tailwindcss/defaultTheme`, `tailwindcss/colors`, `tailwindcss/defaultConfig`. Matches starter.js.

## TypeScript pre-pass

Handles typed.ts: type-only imports, binding annotations, `satisfies`.

## Build-vs-buy

**Build** the acorn static evaluator (shipped in `src/v3/evaluate.ts`). No third-party config resolver is browser-safe without `eval`.

## acorn size

Measured via browser probe of the full package (includes acorn + culori + defaults): see `probe:browser` output; acorn alone is ~18 kB gzipped per upstream docs.
