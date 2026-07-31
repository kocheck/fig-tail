/** @module fixtures provenance */

# Tailwind config fixtures

Configs are drawn from open-source shapes (MIT / Apache-2.0 patterns), not a single
team's proprietary theme. Each file is a representative shape for resolver tests.

## v3

| File | Shape | Licence / provenance |
|---|---|---|
| `minimal.js` | Barely any extend | Original for fig-tail |
| `shadcn-like.js` | CSS-variable colours `hsl(var(--x))` | Pattern from shadcn/ui (MIT) |
| `starter.js` | Official-starter-like palette extend | Original |
| `with-preset.js` | External preset reference | Original |
| `typed.ts` | TypeScript config | Original |
| `with-plugins.js` | Plugin requires | Original |
| `with-prefix.js` | `prefix: 'tw-'` | Original |
| `monorepo-extend.js` | Cross-package require | Original |

## v4

| File | Shape |
|---|---|
| `basic.css` | Brand colour + spacing + radius |
| `reset.css` | `--color-*: initial` then custom colours |
| `aliased.css` | `var()` between theme entries |
| `with-config.css` | `@config` delegation |
