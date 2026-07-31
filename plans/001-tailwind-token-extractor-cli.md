# Plan 001: Build the `fig-tail export` token extractor CLI (Tailwind v3 + v4)

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. If anything in "STOP conditions" occurs,
> stop and report — do not improvise. When done, update the status row for this
> plan in `plans/README.md`.
>
> **Drift check (run first)**: `git log --oneline -5` in the repo root. This
> plan was written against a repository containing only `LICENSE` and
> `README.md` at commit `e757f32`. If `packages/` already exists, someone has
> started this work — read what is there before writing anything, and treat a
> conflict with this plan as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — the Tailwind v4 extraction approach in Step 4 is the one part
  of this plan that has not been executed against a real project. Step 3 is a
  spike that exists to de-risk it before you write the adapter.
- **Depends on**: none
- **Category**: dx
- **Grounded at**: `e757f32` (2026-07-31) — greenfield; the repo contains only
  `LICENSE` and `README.md`.

## Why this matters

Developers inspecting a Figma design today read `#3B82F6` and `24px` and
convert to Tailwind classes in their heads — or they use one of the existing
Figma→Tailwind plugins, which emit `bg-[#3b82f6]` arbitrary values because they
have no idea what tokens the team's config actually defines. Both outcomes are
wrong: the first is slow and error-prone, the second produces code that bypasses
the design system entirely.

This CLI is the fix's foundation. It runs inside the real codebase, where
Tailwind's own packages are installed, resolves the *actual* theme, and emits a
small portable JSON file. Everything else in fig-tail consumes that file. If
this file is wrong, every class name the plugin produces is wrong — so this is
also the plan with the least room for approximation.

Getting Tailwind resolution out of the browser sandbox and into Node is the
whole architectural bet: the plugin never needs to understand Tailwind, only
this JSON.

## Context the executor needs

### The repository

Greenfield. `LICENSE` (MIT) and a two-line `README.md` are the only files. You
are creating the entire structure. There are no existing conventions to match,
so establish these:

```
fig-tail/
├── package.json              # pnpm workspace root, "private": true
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
├── packages/
│   ├── tokens/               # @fig-tail/tokens — schema + types, zero deps
│   └── cli/                  # @fig-tail/cli   — the export command
├── fixtures/
│   ├── tw3-app/              # a minimal Tailwind v3 project
│   └── tw4-app/              # a minimal Tailwind v4 project
└── plans/
```

- TypeScript, `"module": "nodenext"`, targeting Node 20+.
- **vitest** for tests. **tsup** (or esbuild) to build the CLI to `dist/`.
- pnpm workspaces. If pnpm is not installed, use `corepack enable`.

### What Tailwind v3 and v4 each look like

These differ enough that they need separate adapters behind one output schema.

**Tailwind v3** — a JavaScript/TypeScript config object:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: { brand: { 500: '#3b82f6', 600: '#2563eb' } },
      spacing: { 18: '4.5rem' },
    },
  },
}
```

Resolution is a solved problem: `tailwindcss/resolveConfig` merges the user
config over the default theme and returns the complete resolved object.
Presets and plugin-contributed theme values are handled for you. Note the
config may be `.ts` — you will need `jiti` or `tsx` to load it.

**Tailwind v4** — CSS-first, using the `@theme` at-rule:

```css
/* app.css */
@import "tailwindcss";

@theme {
  --color-brand-500: oklch(0.62 0.19 259);
  --spacing: 0.25rem;
  --radius-lg: 0.5rem;
}
```

There is no `resolveConfig` in v4. Every `@theme` entry becomes both a CSS
custom property and a utility namespace. The namespaces are deterministic:

| Theme variable prefix | Utilities it generates |
|---|---|
| `--color-*` | `bg-*`, `text-*`, `border-*`, `fill-*`, `stroke-*`, `ring-*`, `shadow-*` (color), `outline-*`, `decoration-*`, `accent-*`, `caret-*`, `divide-*`, `from-*`/`via-*`/`to-*` |
| `--spacing` (single value) | the base unit for *dynamic* spacing: `p-4` = `calc(var(--spacing) * 4)` |
| `--spacing-*` (named) | named spacing utilities, e.g. `--spacing-gutter` → `p-gutter` |
| `--radius-*` | `rounded-*` |
| `--text-*` | `text-*` (font size; may carry a `--line-height` companion) |
| `--font-*` | `font-*` (family) |
| `--font-weight-*` | `font-*` (weight) |
| `--leading-*` | `leading-*` |
| `--tracking-*` | `tracking-*` |
| `--shadow-*` | `shadow-*` |
| `--inset-shadow-*` | `inset-shadow-*` |
| `--drop-shadow-*` | `drop-shadow-*` |
| `--blur-*` | `blur-*` |
| `--breakpoint-*` | `sm:`, `md:` … responsive variants |
| `--container-*` | `@sm:` … container query variants, and `max-w-*` |
| `--aspect-*` | `aspect-*` |
| `--ease-*` | `ease-*` |
| `--animate-*` | `animate-*` |
| `--z-index-*`, `--opacity-*`, `--perspective-*` | corresponding utilities |

**Two v4 behaviours that will bite you if you ignore them:**

1. **`--spacing` is a multiplier, not a scale.** In v4, `p-5` is not looked up
   in a table — it is `calc(var(--spacing) * 5)`. Your extractor must emit
   `spacingBase` as a value, not enumerate every step. (Plan 002's matcher then
   divides a measured px value by the base and checks the result is a valid
   step.) Named `--spacing-*` entries, if present, are a *separate* enumerated
   set and must be emitted as such.
2. **Tree-shaking.** By default v4 only emits CSS custom properties for theme
   values actually used in the project's source. Compiling the project's CSS and
   reading `:root` therefore gives you an **incomplete** theme. This is the
   central hazard of Step 4 — see Step 3.

### The v4 extraction strategy (to be validated in Step 3)

The recommended approach is **static CSS analysis, not compilation**:

1. Locate the project's Tailwind CSS entry point (the file containing
   `@import "tailwindcss"`).
2. Read the default theme from the installed package —
   `node_modules/tailwindcss/theme.css` — which contains the full default
   `@theme` block. Resolve it from the *project's* `node_modules`, not the
   CLI's, so you get the version the project actually uses.
3. Parse the project's CSS with PostCSS, following `@import` chains, and collect
   every `@theme` block (including `@theme inline` and `@theme static`).
4. Merge: defaults first, then project blocks in source order. Honour the reset
   convention — `--color-*: initial;` clears the entire `--color` namespace
   before later entries are applied. A bare `--*: initial;` clears everything.
5. Resolve `var()` references between theme entries (one variable aliasing
   another) to concrete values.
6. Handle `@config "./tailwind.config.js"` — v4's escape hatch for a legacy JS
   config. If present, run the v3 adapter on that file and merge its output
   *under* the CSS theme.

This gives the complete theme regardless of usage, and requires no build.

An existing package, `tailwind-resolver`, claims to do much of this. Step 3
includes a build-vs-buy evaluation. Do not adopt it without running the Step 3
checks — a wrong theme here is silently wrong everywhere downstream.

### Colour spaces

Tailwind v4's default palette is in **oklch**. Figma reports colours as sRGB
hex. The token JSON must therefore store a **canonical sRGB form alongside the
authored form**, so the matching engine in plan 002 can compare against Figma
values without re-implementing colour conversion in the plugin sandbox:

```json
{ "raw": "oklch(0.623 0.214 259.815)", "hex": "#3b82f6", "rgb": [59, 130, 246], "alpha": 1 }
```

Use **`culori`** for conversion — it handles oklch, lch, hsl, color-mix, and
named colours, and it is small. Keep it a dependency of `@fig-tail/cli` only;
`@fig-tail/tokens` must stay dependency-free.

### Size budget — this is a hard constraint

The output JSON is stored in Figma using `setSharedPluginData`, which enforces a
**100 kB limit per entry**. Plan 003 implements gzip + chunking, so the JSON is
not required to fit in 100 kB — but every kilobyte costs chunks and read
latency inside a 15-second codegen timeout.

**Budget: the gzipped output for a Tailwind v4 project with the full default
theme must be under 120 kB uncompressed.** Emit compactly:

- No pretty-printing (`JSON.stringify(obj)`, no indent argument).
- Omit `rgb` when it is derivable — actually, *keep* `rgb`; plan 002 needs it
  hot and re-parsing hex in the plugin is wasteful. Instead omit `raw` when it
  is byte-identical to `hex`.
- Do **not** emit the utility class matrix (every `bg-*` × every colour). Emit
  the token set; the plugin composes class names from namespace + token key.
- Provide `--prune-defaults`, which drops default-theme tokens the project has
  not overridden or referenced. Off by default (correctness first), documented
  as the escape hatch if a theme exceeds budget.

## Inputs & resources

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Typecheck | `pnpm -r typecheck` | exit 0 |
| Test | `pnpm -r test` | all pass |
| Lint | `pnpm -r lint` | exit 0 |
| Build CLI | `pnpm --filter @fig-tail/cli build` | `packages/cli/dist/index.js` exists |
| Run on a fixture | `pnpm --filter @fig-tail/cli exec fig-tail export --cwd ../../fixtures/tw4-app` | writes `figtail.tokens.json`, exit 0 |

Reference documentation:

- Tailwind v4 theme variables — https://tailwindcss.com/docs/theme
- Tailwind v3 configuration — https://v3.tailwindcss.com/docs/configuration
- `tailwind-resolver` discussion — https://github.com/tailwindlabs/tailwindcss/discussions/19151
- culori — https://culorijs.org/

No accounts, credentials, or Figma access are needed for this plan. It is pure
Node.

## Suggested toolkit (optional)

- `postcss` + `postcss-import` for the v4 CSS walk.
- `jiti` for loading `tailwind.config.ts`.
- `culori` for colour conversion.
- `commander` or `cac` for CLI argument parsing — either is fine; pick one and
  be consistent.
- `zod` for validating the emitted schema in tests (and re-used by plan 003 to
  validate pasted JSON — put the schema in `@fig-tail/tokens` so both can use
  it, but keep zod a `peerDependency`/`devDependency` there so the tokens
  package stays runtime-dependency-free for the plugin bundle).

## Scope

**In scope** (create these):

- `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`
- `packages/tokens/**` — the schema, TypeScript types, and a validator
- `packages/cli/**` — the `fig-tail export` command with v3 and v4 adapters
- `fixtures/tw3-app/**` and `fixtures/tw4-app/**` — minimal real projects
- `.gitignore`, and a `README.md` section describing CLI usage
- Tests for all of the above

**Out of scope** (do NOT create or touch, even though they look related):

- `packages/match/**` — the matching engine is plan 002. Do not start it, and
  do not put "helpful" matching logic in the CLI. The CLI emits tokens; it
  does not decide which class fits a value.
- `packages/plugin/**` — plan 003. No Figma dependencies belong in this plan.
  If you find yourself typing `@figma/plugin-typings`, you are out of scope.
- Any CI workflow, publishing config, or npm release setup — plan 009.
- Tailwind **v2 or earlier**. Not supported, not planned.
- A watch mode / dev server for the CLI. The export is a one-shot command;
  re-running it is cheap.

## Working approach

- Work on the branch you were given. Do not push or open a pull request unless
  explicitly asked.
- Commit per step, with the step number in the message
  (e.g. `001-3: spike v4 theme extraction against fixture`).
- Keep `@fig-tail/tokens` free of runtime dependencies — the plugin bundle in
  plan 003 imports it and every byte counts inside Figma.

## Steps

### Step 1: Scaffold the workspace

Create the pnpm workspace root, `tsconfig.base.json` (strict: true,
`moduleResolution: "nodenext"`, `target: "es2022"`), a flat ESLint config, and
the two package directories with their `package.json` files.

`@fig-tail/tokens` and `@fig-tail/cli` should both have `typecheck`, `test`,
`lint`, and (for cli) `build` scripts, so the root `pnpm -r <script>` commands
in the table above work.

**Check**: `pnpm install && pnpm -r typecheck && pnpm -r lint` → exit 0.
(`pnpm -r test` will report no tests; that is expected at this step.)

### Step 2: Define the token JSON schema in `@fig-tail/tokens`

This schema is the contract between this plan and plans 002 and 003. Get it
right before writing either adapter. Write it as TypeScript types plus a zod
validator, and export both.

Target shape:

```jsonc
{
  "$schema": "https://fig-tail.dev/schema/v1.json",
  "schemaVersion": 1,
  "generatedAt": "2026-07-31T00:00:00.000Z",
  "source": {
    "tailwindVersion": "4.1.13",     // resolved from the project's node_modules
    "major": 4,                      // 3 | 4 — adapters set this
    "entry": "src/app.css",          // relative to project root
    "prefix": null                   // e.g. "tw" if the project uses a prefix
  },
  "colors": {
    // key = token key as it appears in a utility: bg-<key>
    "brand-500": { "hex": "#3b82f6", "rgb": [59,130,246], "alpha": 1,
                   "raw": "oklch(0.623 0.214 259.815)" },
    "white":     { "hex": "#ffffff", "rgb": [255,255,255], "alpha": 1 }
  },
  "spacing": {
    "base": "0.25rem",               // v4 dynamic multiplier; null for v3
    "basePx": 4,
    "named": { "gutter": { "raw": "1.5rem", "px": 24 } },
    "scale":  { "4": { "raw": "1rem", "px": 16 } }   // v3 enumerated scale; {} for v4
  },
  "radius":      { "lg": { "raw": "0.5rem", "px": 8 } },
  "fontSize":    { "sm": { "raw": "0.875rem", "px": 14, "lineHeight": { "raw": "1.25rem", "px": 20 } } },
  "fontFamily":  { "sans": { "stack": ["Inter","ui-sans-serif","system-ui"], "primary": "Inter" } },
  "fontWeight":  { "medium": 500 },
  "lineHeight":  { "tight": { "raw": "1.25", "px": null } },
  "letterSpacing": { "tight": { "raw": "-0.025em", "px": null } },
  "boxShadow":   { "md": { "raw": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)" } },
  "borderWidth": { "2": { "raw": "2px", "px": 2 } },
  "opacity":     { "50": 0.5 },
  "breakpoints": { "md": { "raw": "48rem", "px": 768 } },
  "zIndex":      { "10": "10" }
}
```

Rules that must hold and must be enforced by the validator:

- Every length carries **both** `raw` (as authored) and `px` (resolved number,
  or `null` when unresolvable — e.g. a unitless `line-height`). Assume
  `1rem = 16px`; record that assumption as `source.remBasePx: 16` so plan 002
  never has to guess.
- Colour `rgb` is always `[0-255, 0-255, 0-255]` sRGB integers, and `alpha` is
  always present (default `1`).
- Token keys are stored **as they appear in a class name**: `brand-500`, not
  `brand.500` and not `brand/500`. Nested v3 configs are flattened with `-`.
- `raw` is omitted when identical to `hex` (size budget).
- Unknown/unsupported theme namespaces are collected into a top-level
  `unsupported: { "<namespace>": count }` map rather than dropped silently, so
  the linter in plan 005 can tell a designer what fig-tail is ignoring.

**Check**: `pnpm --filter @fig-tail/tokens test` → passes, including a test
that a hand-written fixture matching the shape above validates, and that four
deliberately malformed variants (missing `alpha`, `px` as a string, a
`brand.500` dotted key, a missing `schemaVersion`) each fail with a
distinguishable error.

### Step 3: Spike the Tailwind v4 extraction, and decide build-vs-buy

**This step produces a decision and a throwaway script, not shipped code.** Do
not skip it — Step 4 depends on its answer.

1. Build `fixtures/tw4-app`: a real project with `tailwindcss@^4` installed, an
   `src/app.css` containing `@import "tailwindcss"` plus an `@theme` block that
   exercises the hard cases — a custom colour in oklch, a `--color-*: initial`
   reset, a named `--spacing-gutter`, a redefined `--spacing`, a `--text-*` with
   a line-height companion, and one theme entry that `var()`-references another.
   Include a source file (`src/index.html`) that uses only *two* utilities, so
   tree-shaking is observable.
2. Write `packages/cli/spike/v4.ts` implementing the static-analysis strategy
   from "Context" above.
3. Write down, in `packages/cli/spike/FINDINGS.md`, the answers to:
   - Does `node_modules/tailwindcss/theme.css` exist in v4.x and contain the
     full default `@theme`? If it has moved, where is it?
   - Does static analysis recover **all** theme tokens, including ones no source
     file uses? Compare against compiling the fixture with
     `npx @tailwindcss/cli -i src/app.css -o out.css` and diffing the `:root`
     custom properties. The static result should be a strict superset.
   - Does `--color-*: initial` behave as a namespace reset in your parser?
   - Does `tailwind-resolver` (or any current equivalent) produce the same
     token set? Record its version, its output, and where it differs.
4. **Decide**: build the adapter, or depend on the package. Record the decision
   and the reason in `FINDINGS.md`. Bias toward building — this is ~300 lines of
   PostCSS walking, and an unmaintained dependency at the root of the
   correctness chain is a bad trade.

**Check**: `packages/cli/spike/FINDINGS.md` exists and answers all four
questions with concrete evidence (pasted output, not assertions), and states a
decision with a reason. A reviewer reading only that file can tell what Step 4
is going to do and why.

**STOP and report** if static analysis cannot recover the full theme — that
invalidates the strategy and the alternative (forcing `@theme static` into a
temp CSS entry, or requiring the project to opt in) is a decision for the repo
owner, not for you.

### Step 4: Implement the v4 adapter

Implement `packages/cli/src/adapters/v4.ts` per the Step 3 decision. It takes a
project root and returns a validated token JSON object.

Must handle, each with a test: `@import` chains, multiple `@theme` blocks,
`@theme inline` and `@theme static`, namespace resets, `var()` aliasing between
theme entries, `@config` delegation to a v3 config, oklch→sRGB conversion, the
`--spacing` multiplier vs named `--spacing-*`, and `--text-*` with a
`--line-height` companion.

**Check**: `pnpm --filter @fig-tail/cli test -t v4` → all pass, including a
snapshot test asserting the exact token JSON for `fixtures/tw4-app`. Manually
verify three values in that snapshot against the fixture CSS by eye and note
them in the commit message — a green snapshot of wrong output is the failure
mode this plan most needs to avoid.

### Step 5: Implement the v3 adapter

Implement `packages/cli/src/adapters/v3.ts` using `resolveConfig` from the
*project's* installed `tailwindcss`, resolved relative to the project root (not
bundled with the CLI — the project's version is the source of truth).

Must handle: `.js`, `.cjs`, `.mjs` and `.ts` configs (use `jiti` for TS),
presets, `theme.extend` merging, nested colour objects flattened to `brand-500`,
function-valued theme entries (`({ theme }) => …`), the `prefix` option, and
`corePlugins` disabling a namespace.

Build `fixtures/tw3-app` to exercise these: a preset, a nested colour object, a
`spacing` extension, a `.ts` config, and a prefix.

**Check**: `pnpm --filter @fig-tail/cli test -t v3` → all pass, including a
snapshot for `fixtures/tw3-app`. Same manual spot-check discipline as Step 4.

### Step 6: Wire the `export` command

`fig-tail export [--cwd <dir>] [--out <file>] [--prune-defaults] [--stdout]`

Behaviour:

1. Resolve the project root (default: `process.cwd()`).
2. Detect the Tailwind major version by resolving `tailwindcss/package.json`
   from the project root and reading its `version`. Detection is by installed
   version, **not** by which files are present — a v4 project may still have a
   `tailwind.config.js` via `@config`.
3. Dispatch to the adapter, validate the result against the schema, and write
   `figtail.tokens.json` (default) to the project root, or stdout with
   `--stdout`.
4. Print a summary to stderr: Tailwind version, entry file, token counts per
   category, and the **uncompressed byte size with a warning above 120 kB**
   naming `--prune-defaults` as the remedy.
5. Exit non-zero with an actionable message when: no `tailwindcss` in the
   project, an unsupported major version, no CSS entry found (v4), no config
   found (v3), or schema validation of the adapter's own output fails.

**Check**: all five of these produce the stated result —
```
pnpm --filter @fig-tail/cli exec fig-tail export --cwd ../../fixtures/tw4-app   # exit 0, writes file
pnpm --filter @fig-tail/cli exec fig-tail export --cwd ../../fixtures/tw3-app   # exit 0, writes file
pnpm --filter @fig-tail/cli exec fig-tail export --cwd /tmp                     # exit != 0, message names the missing tailwindcss
pnpm --filter @fig-tail/cli exec fig-tail export --cwd ../../fixtures/tw4-app --stdout | head -c 200   # valid JSON on stdout, summary on stderr
node -e "const t=require('./fixtures/tw4-app/figtail.tokens.json'); console.log(JSON.stringify(t).length)"  # under 122880
```

### Step 7: Document CLI usage in the README

Add a "Getting the tokens out of your codebase" section to the root
`README.md`: install, run, what the file is, that it is safe to commit (it
contains only design tokens, no secrets), and that it must be re-run when the
theme changes. Keep it to about 30 lines — plan 009 writes the full docs.

**Check**: a reader who has never seen this repo can follow the README section
and produce a `figtail.tokens.json` from one of the fixtures without reading
any other file. Confirm by doing exactly that, from the README only.

## Validation plan

- **Unit tests** (vitest, colocated `*.test.ts`): schema validation, colour
  conversion (assert `oklch(0.623 0.214 259.815)` → `#3b82f6` within ±1 per
  channel), rem→px, key flattening, namespace resets, `var()` aliasing.
- **Snapshot tests**: the complete token JSON for each fixture. Review these
  diffs by eye on every change; they are the real regression net.
- **Cross-adapter consistency test**: build a v3 fixture and a v4 fixture that
  express the *same* design intent (same brand colour, same spacing, same
  radius) and assert both adapters emit the same values for those tokens. This
  is what proves plan 002 can consume either without branching.
- **Size test**: assert the v4 fixture output is under 120 kB uncompressed, and
  print the gzipped size so the trend is visible.
- Run everything with `pnpm -r test`.

## Done criteria

ALL must hold.

- [ ] `pnpm install && pnpm -r typecheck && pnpm -r lint && pnpm -r test` → exit 0
- [ ] `pnpm --filter @fig-tail/cli build` produces a runnable `dist/index.js`
- [ ] `fig-tail export` succeeds on both fixtures and fails with an actionable
      message on a non-Tailwind directory
- [ ] The emitted JSON validates against the `@fig-tail/tokens` zod schema
- [ ] The v4 fixture's output is under 120 kB uncompressed
- [ ] `packages/cli/spike/FINDINGS.md` records the Step 3 build-vs-buy decision
      and its evidence
- [ ] The cross-adapter consistency test passes
- [ ] `@fig-tail/tokens` has zero runtime dependencies
      (`pnpm --filter @fig-tail/tokens ls --prod --depth 0` shows none)
- [ ] No files outside the in-scope list were created or changed
- [ ] `plans/README.md` status row for 001 updated

## STOP conditions

Stop and report back — do not improvise — if:

- **Step 3's spike shows static analysis cannot recover the full v4 theme.** The
  fallback options each have real costs and the choice is the owner's.
- `node_modules/tailwindcss/theme.css` does not exist or does not contain the
  default `@theme` in the current Tailwind v4 release. The whole v4 strategy
  rests on it.
- The v4 fixture's token JSON exceeds **200 kB** even with `--prune-defaults`.
  That breaks plan 003's storage assumptions and needs a schema rethink, not a
  bigger chunk count.
- Supporting both v3 and v4 forces the two adapters to emit structurally
  different schemas. One schema is the point; if it cannot hold, the split
  needs designing rather than papering over.
- Tailwind v5 exists and the owner has not said which versions to target.
- A step's check fails twice after a reasonable attempt.

## Handoff / after it lands

- **Plan 002** consumes this schema directly. Any change to it after 002 starts
  is a breaking change — bump `schemaVersion` and say so in the commit.
- **Plan 003** stores this JSON in Figma and validates pasted input with the
  same zod schema from `@fig-tail/tokens`. That is why the validator lives in
  the shared package rather than in the CLI.
- **What a reviewer should scrutinise most**: the two snapshot files. Everything
  downstream inherits their errors, and a snapshot test will happily lock in a
  wrong value forever. Spot-check real values against the fixture source.
- **Deliberately deferred**: Tailwind plugin-contributed utilities
  (`@tailwindcss/typography`, `forms`) are not extracted. They mostly generate
  component classes (`prose`, `form-input`) that do not correspond to inspectable
  Figma values, so the cost/benefit is poor until someone asks. `unsupported`
  in the schema exists to make their absence visible rather than silent.
- **Also deferred**: watch mode, and any CI job that fails when
  `figtail.tokens.json` drifts from the config. Both are good ideas for plan 009
  or later; neither blocks a working plugin.
