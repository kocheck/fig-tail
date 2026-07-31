# Plan 001: Build the in-plugin Tailwind theme resolver (v3 + v4)

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. If anything in "STOP conditions" occurs,
> stop and report — do not improvise. When done, update the status row for this
> plan in `plans/README.md`.
>
> **Degrade, don't block.** STOP conditions are deliberately narrow. Anything
> *not* listed there has a designed fallback: do the next-best thing, label it
> visibly for the user, note it in your commit message, and keep going. Read
> invariant 2 in `plans/README.md` before deciding something is blocked —
> "partly working and clearly labelled" beats "stopped and waiting" everywhere
> except write-safety and executing user input.
>
> **Drift check (run first)**: `git log --oneline -5`. This plan was written
> against a repository containing only `LICENSE`, `README.md`, and `plans/` at
> commit `e757f32`. If `packages/` already exists, someone has started this
> work — read what is there first, and treat a conflict with this plan as a STOP
> condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED-HIGH. Not because any single piece is hard, but because this
  package decides what every class name downstream is built from, and it must
  run inside a browser sandbox without executing its input. Steps 3 and 6 are
  spikes that exist to de-risk the two uncertain parts before anything is built
  on them.
- **Depends on**: none
- **Category**: dx
- **Grounded at**: `e757f32` (2026-07-31) — greenfield.

## Why this matters

The product requirement is that **a developer installs the fig-tail plugin and
nothing else** — no CLI, no npm package, no generated token file. A designer
provides the team's `tailwind.config.js` (or a v4 `app.css`) once, and from then
on everyone inspecting the file sees real class names.

That requirement puts Tailwind theme resolution *inside the plugin*, running in a
browser sandbox. This package is that resolver, and it is the foundation for
everything else: if it resolves `brand-500` to the wrong colour, every class name
fig-tail ever emits for that token is wrong, on every surface, for every
developer.

The second reason it matters is subtler. Tailwind configs can do things that
cannot be statically evaluated — presets, plugin calls, function-valued theme
keys. The resolver's job is not to handle all of them. It is to handle the common
ones correctly and to be **precisely honest about the rest**. A theme that
silently dropped `theme.extend.spacing` because it was a function would produce
confidently wrong output forever. The unresolved-feature report built in Step 8
is not a nicety; it is what makes this safe to put in front of a developer.

## Context the executor needs

### The repository

Greenfield. `LICENSE` (MIT), a two-line `README.md`, and `plans/`. You are
creating the structure. Establish these conventions:

```
fig-tail/
├── package.json              # pnpm workspace root, "private": true
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
├── packages/
│   └── theme/                # @fig-tail/theme
│       ├── src/
│       ├── data/             # generated default-theme data (checked in)
│       ├── scripts/          # build-time generators for data/
│       └── test/
├── fixtures/
│   └── configs/              # real-world Tailwind configs, v3 and v4
└── plans/
```

- TypeScript, strict, `target: es2020`, `moduleResolution: nodenext`.
- **vitest** for tests, **tsup**/esbuild for the build.
- pnpm workspaces (`corepack enable` if pnpm is absent).

### The hard runtime constraint

`@fig-tail/theme` runs inside a **Figma plugin**. Therefore:

- **No Node built-ins.** No `fs`, `path`, `process`, `Buffer`.
- **No `eval`, no `new Function`, no dynamic `import()`.** This is not merely a
  sandbox limitation — executing arbitrary JavaScript that a user pasted in is a
  security posture this project will not adopt, and it is a plugin-review red
  flag. The resolver **parses**; it never **executes**.
- **Bundle size matters.** Target: the whole package, including bundled default
  themes, under **180 kB minified**.
- Everything is synchronous and deterministic. Same input, same output, always.

### Input: two flavours

**Tailwind v3** — a JavaScript config module:

```js
const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  content: ['./src/**/*.tsx'],
  theme: {
    extend: {
      colors: { brand: { 500: '#3b82f6', 600: '#2563eb' } },
      fontFamily: { sans: ['Inter', ...defaultTheme.fontFamily.sans] },
      spacing: { 18: '4.5rem' },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
```

**Tailwind v4** — CSS-first:

```css
@import "tailwindcss";

@theme {
  --color-brand-500: oklch(0.62 0.19 259);
  --spacing: 0.25rem;
  --radius-lg: 0.5rem;
}
```

Auto-detect the flavour from the source text: `@theme` or `@import "tailwindcss"`
→ v4; `module.exports` / `export default` → v3. A v4 CSS file may contain
`@config "./tailwind.config.js"`, in which case **both** files are needed — so
the API accepts multiple named sources (Step 2).

### v3 resolution semantics — get these exactly right

Confirmed against Tailwind's v3 theme documentation:

- **`theme.<key>`** *replaces* the default value for that key entirely.
- **`theme.extend.<key>`** *merges* with the resolved default value for that key.
- Merging is per-key at the top level of each namespace. `theme.extend.colors`
  merges into the default colour map; a nested object under a colour name
  replaces that colour's whole shade map when the name already exists.
- `presets` resolve first, in order, with later entries winning; the user's own
  config applies last.
- Function-valued theme entries (`spacing: ({ theme }) => …`) are resolved by
  Tailwind at build time with a `theme()` helper. **They cannot be statically
  evaluated** — see "What the evaluator supports".

The **v3 default theme is not in the config file** — it lives in
`tailwindcss/defaultTheme`. The resolver bundles it (Step 4).

### v4 resolution semantics

Every `@theme` entry becomes both a CSS custom property and a utility namespace.
Namespaces are deterministic:

| Prefix | Utilities |
|---|---|
| `--color-*` | `bg-*`, `text-*`, `border-*`, `fill-*`, `stroke-*`, `ring-*`, `outline-*`, `divide-*`, `from/via/to-*` |
| `--spacing` (bare) | the **multiplier** for dynamic spacing: `p-4` = `calc(var(--spacing) * 4)` |
| `--spacing-*` (named) | named spacing utilities (`p-gutter`) |
| `--radius-*` | `rounded-*` |
| `--text-*` | `text-*` (font size; may carry a `--line-height` companion) |
| `--font-*` | `font-*` (family) |
| `--font-weight-*` | `font-*` (weight) |
| `--leading-*`, `--tracking-*` | `leading-*`, `tracking-*` |
| `--shadow-*`, `--inset-shadow-*`, `--drop-shadow-*` | corresponding shadow utilities |
| `--blur-*`, `--breakpoint-*`, `--container-*`, `--aspect-*`, `--ease-*`, `--animate-*`, `--z-index-*`, `--opacity-*` | corresponding utilities |

- **`--color-*: initial;` resets the whole `--color` namespace** before later
  entries apply. A bare `--*: initial;` resets everything. Honour both.
- Theme entries may `var()`-reference other theme entries. Resolve them.
- `@theme inline` and `@theme static` differ in emission behaviour, not in the
  values they declare — treat all three forms alike for token extraction.
- The v4 **default theme** ships as `theme.css` inside the `tailwindcss`
  package. The resolver bundles its values (Step 4).

**Two v4 behaviours that will bite you:**

1. `--spacing` is a multiplier, not a scale. Emit it as a base value; plan 002's
   matcher divides by it. Named `--spacing-*` entries are a separate enumerated
   set.
2. Do **not** resolve the theme by compiling the project's CSS. v4 tree-shakes
   unused theme variables, so a compiled stylesheet contains only what the
   project happens to use. Parse the `@theme` source instead.

### What the static evaluator supports

This is the honest boundary of the v3 path, and it must appear in the code, the
report, and the README.

**Resolvable:**

- Object, array, string, number, boolean and `null` literals, nested arbitrarily
- Template literals with no substitutions
- String concatenation of literals
- Spread of a locally-declared object/array literal
  (`...defaultTheme.fontFamily.sans`)
- Identifiers bound to statically-evaluable values earlier in the same file
- Member access into resolvable values (`defaultTheme.fontFamily.sans`)
- **`require()` / `import` of a known module** — see the table below
- `module.exports = {…}`, `export default {…}`, and
  `const config = {…}; export default config`

**Known-module table** (bundled, so these resolve exactly):

| Specifier | Resolves to |
|---|---|
| `tailwindcss/defaultTheme` | the bundled v3 default theme |
| `tailwindcss/colors` | the bundled v3 default colour palette |
| `tailwindcss/defaultConfig` | the bundled v3 default config |

These three cover the large majority of `require()` calls in real v3 configs, and
resolving them is what makes the common `[...defaultTheme.fontFamily.sans]`
pattern work.

**Not resolvable — each must produce a precise report entry, never a silent
drop:**

- Function values (`({ theme }) => …`, `theme => …`)
- `require()` / `import` of anything outside the known-module table (plugins,
  presets, local modules)
- `presets: [...]` referencing external modules
- Computed member access, conditionals, arithmetic on identifiers
- Anything the parser cannot handle

### TypeScript configs

`tailwind.config.ts` is common. The parser (Step 3) handles JavaScript, so apply
a **bounded** TypeScript pre-pass before parsing:

- Drop `import type …` statements entirely
- Drop type annotations on the exported binding (`const config: Config = {`)
- Drop trailing `satisfies X` and `as X` on the exported expression

If parsing still fails after the pre-pass, **report it clearly** and point the
user at the CLI escape hatch (plan 009). Do not attempt general TypeScript
support here; that is precisely what plan 009 exists for.

### Colour handling

v4's default palette is **oklch**; Figma reports sRGB hex. Every colour token
must carry a canonical sRGB form so plan 002 never converts colour spaces at
match time:

```json
{ "raw": "oklch(0.623 0.214 259.815)", "hex": "#3b82f6", "rgb": [59,130,246], "alpha": 1 }
```

Use **`culori`**, importing only what you need (`import { parse, formatHex,
converter } from 'culori/fn'`) so the bundle stays small. Precompute `hex`/`rgb`
for the **bundled** default themes at data-generation time (Step 4), so the
plugin never converts 240+ default colours at load.

### Size budget

Bundled default themes plus code, under **180 kB minified**. Emit the generated
data compactly: no pretty-printing, omit `raw` when identical to `hex`, and do
**not** enumerate the utility matrix (every `bg-*` × every colour) — emit the
token set and let consumers compose `namespace + key`.

The resolved output is stored in Figma via `setSharedPluginData`, which caps at
**100 kB per entry**. Plan 003 chunks and gzips, so the output need not fit in
100 kB — but keep it under **120 kB uncompressed** for a full default theme, and
provide a `pruneDefaults` option that drops untouched default tokens as an escape
hatch (off by default; correctness first).

## Inputs & resources

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Typecheck | `pnpm -r typecheck` | exit 0 |
| Lint | `pnpm -r lint` | exit 0 |
| Test | `pnpm -r test` | all pass |
| Generate default data | `pnpm --filter @fig-tail/theme gen:data` | writes `packages/theme/data/*.json` |
| Build | `pnpm --filter @fig-tail/theme build` | `dist/index.js` exists |
| Size probe | `du -b packages/theme/dist/index.js` | under 184320 (180 kB) |

Reference documentation:

- Tailwind v3 theme configuration — https://v3.tailwindcss.com/docs/theme
- Tailwind v4 theme variables — https://tailwindcss.com/docs/theme
- acorn — https://github.com/acornjs/acorn
- culori — https://culorijs.org/

No accounts, credentials, or Figma access needed. This plan is pure TypeScript.

## Suggested toolkit (optional)

- **`acorn`** + `acorn-walk` for JavaScript parsing (~18 kB gzipped).
  `meriyah` or `espree` are acceptable alternatives; do **not** reach for
  `@babel/parser`, which is far too large for a plugin bundle.
- **`postcss`** for the v4 CSS walk — or, if it proves too heavy, a
  purpose-built `@theme`-block scanner. Measure before deciding (Step 6).
- **`culori`** for colour conversion.
- **`zod`** for validating the emitted token set. Keep it a `devDependency` and
  export a plain validator function, so the runtime package stays lean and plan
  003 can reuse it.

## Scope

**In scope**:

- `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`,
  `.gitignore`
- `packages/theme/**` — the resolver, static evaluator, both adapters, bundled
  default-theme data and its generator script, the token-set schema and
  validator, tests
- `fixtures/configs/**` — real-world config fixtures (Step 7)
- A README section describing what the resolver supports and what it does not

**Out of scope**:

- `packages/match/**` — plan 002. The resolver emits tokens; it never decides
  which class fits a value. If you are writing a `bg-` prefix in this package,
  you are out of scope.
- `packages/plugin/**` — plan 003. No Figma types, no `figma` global, no
  `@figma/plugin-typings`.
- `packages/cli/**` — plan 009. No Node-only code anywhere in this package.
- Tailwind **v2 or earlier**. Not supported, not planned.
- Executing user input by any means. See "The hard runtime constraint".
- Any CI, publishing, or release config — plan 010.

## Working approach

- Work on the branch you were given. Do not push or open a pull request unless
  asked.
- Commit per step, prefixed `001-N:`.
- Keep `packages/theme` browser-clean from the first commit — add the ESLint rule
  banning Node built-ins in this package in Step 1, not later.

## Steps

### Step 1: Scaffold the workspace

Create the pnpm workspace root, `tsconfig.base.json` (strict), a flat ESLint
config including a `no-restricted-imports` rule banning Node built-ins in
`packages/theme/**`, and the `@fig-tail/theme` package with `typecheck`, `lint`,
`test`, `build`, and `gen:data` scripts.

**Check**: `pnpm install && pnpm -r typecheck && pnpm -r lint` → exit 0. Adding
`import fs from 'fs'` to a file in `packages/theme/src` fails lint; removing it
passes.

### Step 2: Define the token-set schema and the public API

This schema is the contract with plans 002, 003 and 009. Settle it before writing
either adapter.

```ts
export type ResolveInput = {
  /** One or more named sources. Names matter for @config resolution and errors. */
  sources: Array<{ name: string; text: string }>
  /** Override auto-detection when the caller knows the flavour. */
  flavour?: 'v3' | 'v4'
  options?: { pruneDefaults?: boolean; remBasePx?: number }
}

export type Unresolved = {
  /** Dotted path into the config, e.g. "theme.extend.spacing". */
  path: string
  reason: 'function-value' | 'unknown-module' | 'preset' | 'dynamic-expression'
        | 'parse-error' | 'missing-import' | 'unsupported-syntax'
  /** The offending source snippet, truncated to 120 chars. Never executed. */
  snippet: string
  source: string          // which input file
  line?: number
  /** Plain-language explanation for a user, and what to do about it. */
  message: string
}

export type ResolveResult = {
  ok: boolean                 // false only when nothing usable was produced
  tokens: TokenSet | null
  unresolved: Unresolved[]    // ALWAYS populated when anything was skipped
  warnings: string[]
}

export function resolveTheme(input: ResolveInput): ResolveResult
export function validateTokenSet(value: unknown):
  | { ok: true; value: TokenSet }
  | { ok: false; errors: string[] }
```

`TokenSet` shape:

```jsonc
{
  "schemaVersion": 1,
  "generatedAt": "2026-07-31T00:00:00.000Z",
  "source": {
    "major": 3,                    // 3 | 4
    "entry": "tailwind.config.js",
    "prefix": null,                // e.g. "tw"
    "remBasePx": 16                // the assumed rem base; never guess downstream
  },
  "colors": {
    "brand-500": { "hex": "#3b82f6", "rgb": [59,130,246], "alpha": 1,
                   "raw": "oklch(0.623 0.214 259.815)" }
  },
  "spacing": {
    "base": "0.25rem", "basePx": 4,                  // v4 multiplier; null for v3
    "named": { "gutter": { "raw": "1.5rem", "px": 24 } },
    "scale":  { "4": { "raw": "1rem", "px": 16 } }   // v3 scale; {} for v4
  },
  "radius":        { "lg": { "raw": "0.5rem", "px": 8 } },
  "fontSize":      { "sm": { "raw": "0.875rem", "px": 14,
                             "lineHeight": { "raw": "1.25rem", "px": 20 } } },
  "fontFamily":    { "sans": { "stack": ["Inter","ui-sans-serif"], "primary": "Inter" } },
  "fontWeight":    { "medium": 500 },
  "lineHeight":    { "tight": { "raw": "1.25", "px": null } },
  "letterSpacing": { "tight": { "raw": "-0.025em", "px": null } },
  "boxShadow":     { "md": { "raw": "0 4px 6px -1px rgb(0 0 0 / 0.1)" } },
  "borderWidth":   { "2": { "raw": "2px", "px": 2 } },
  "opacity":       { "50": 0.5 },
  "breakpoints":   { "md": { "raw": "48rem", "px": 768 } },
  "zIndex":        { "10": "10" },
  "unsupported":   { "<namespace>": 3 }      // recognised but not modelled
}
```

Rules the validator must enforce:

- Every length carries **both** `raw` and `px` (`px` is `null` when unresolvable,
  e.g. a unitless line-height). `source.remBasePx` records the rem assumption so
  nothing downstream has to guess.
- Colour `rgb` is always three sRGB integers; `alpha` is always present.
- Token keys are stored **as they appear in a class name**: `brand-500`, never
  `brand.500` or `brand/500`. Nested v3 colour objects flatten with `-`, and a
  `DEFAULT` key flattens to the bare parent name (`brand.DEFAULT` → `brand`).
- `raw` is omitted when identical to `hex`.
- Recognised-but-unmodelled namespaces go into `unsupported` with a count, never
  dropped silently.

**Check**: `pnpm --filter @fig-tail/theme test -t schema` → passes, including a
hand-written valid fixture and five malformed variants (missing `alpha`, `px` as
a string, a dotted key, a missing `schemaVersion`, a colour with two rgb
channels) each failing with a distinguishable error.

### Step 3: Spike the static evaluator against real configs

**Produces findings and a decision, not shipped code.** Do not skip.

1. Collect **eight real-world v3 configs** into `fixtures/configs/v3/`. Sources:
   popular open-source projects, Tailwind UI starters, shadcn/ui's config, and at
   least one `tailwind.config.ts`. Record the provenance of each.
2. Prototype the acorn-based evaluator in `packages/theme/spike/eval.ts`.
3. In `packages/theme/spike/FINDINGS.md`, record with pasted evidence:
   - For each of the eight: fully resolved, partially resolved (listing exactly
     what was not), or failed to parse.
   - Which unresolvable constructs actually appear in the wild, and how often.
   - Whether the known-module table covers the `require()` calls observed.
   - Whether the TypeScript pre-pass handled the `.ts` config, and what it could
     not handle.
   - acorn's real minified+gzipped contribution to the bundle.
4. **Measure against the coverage bar and write down the result.**
   Recommendation: **at least 6 of 8 fully resolved, and 8 of 8 either resolved
   or reported with an accurate, actionable message.**

**This bar is a reporting threshold, not a gate.** The fallback ladder is already
designed and does not depend on hitting it: whatever cannot be evaluated is
reported (Step 8), the resolvable parts still produce a usable `TokenSet`, and
plan 009's CLI covers the rest. So if coverage comes in under the bar:

- **Keep building.** Continue to Steps 4–8 as written.
- **Report the number and the specific constructs that missed**, with examples,
  so the owner can decide whether any of them is worth adding support for before
  launch. Frame it as "these config patterns will need the CLI", not "this
  approach failed".
- Record the shortfall in `plans/README.md` alongside the 001 status row, so it
  is visible when plan 010 writes the docs — the README has to be honest about
  which configs work out of the box.

The only genuinely blocking outcome here is being unable to parse *anything*.

**Check**: `FINDINGS.md` answers all five points with pasted output and states
the measured coverage against the bar. A reviewer reading only that file knows
what will and will not resolve in the browser.

### Step 4: Generate and bundle the default themes

Write `packages/theme/scripts/gen-data.ts` — a **Node** script that runs at
development time, never in the plugin — producing checked-in JSON in
`packages/theme/data/`:

- `v3-default-theme.json` — from `tailwindcss@3`'s `defaultTheme` and `colors`,
  every colour pre-converted to `hex`/`rgb`.
- `v4-default-theme.json` — from `tailwindcss@4`'s `theme.css`, parsed into the
  same token shape, colours pre-converted from oklch.

Record the exact Tailwind versions the data came from, inside each JSON file and
in the README. Add a test that fails when the checked-in data lacks its version
field — stale bundled defaults are a silent-wrongness risk, and the version must
always be visible.

**Check**: `pnpm --filter @fig-tail/theme gen:data` is reproducible — run it
twice, `git diff` is empty. Spot-check five values by hand against Tailwind's
published defaults (`blue-500`, `gray-200`, `spacing.4`, `text-sm`'s line-height,
`rounded-lg`) and record them in the commit message.

### Step 5: Implement the v3 adapter

`src/v3/`: the static evaluator from Step 3, the known-module table, the
TypeScript pre-pass, preset ordering, and the `theme` vs `theme.extend` merge
semantics from "Context".

Every unresolvable construct produces an `Unresolved` entry with an accurate
`path`, `reason`, `snippet`, and a `message` written for a designer rather than a
compiler author:

> `theme.extend.spacing` is a function, which fig-tail cannot evaluate. Your
> spacing tokens will fall back to Tailwind's defaults. To fix: replace the
> function with plain values, or use the fig-tail CLI (see docs).

**Check**: `pnpm --filter @fig-tail/theme test -t v3` → passes, with a snapshot
per fixture config. Tests must cover: `theme.colors` replacing defaults;
`theme.extend.colors` merging; nested colour flattening including `DEFAULT`;
`...defaultTheme.fontFamily.sans` spreading correctly; a function value reported
rather than dropped; an unknown `require()` reported; a `.ts` config resolved; a
preset reported. Spot-check three values per snapshot by eye and note them in the
commit message — **a green snapshot of wrong output is this plan's worst failure
mode.**

### Step 6: Spike, then implement the v4 adapter

First measure: does `postcss` fit the bundle budget, or is a purpose-built
`@theme` scanner needed? Record the measurement in the commit message, then
implement `src/v4/` accordingly.

Must handle, each with a test: multiple `@theme` blocks; `@theme inline` and
`@theme static`; `--color-*: initial` namespace reset and bare `--*: initial`;
`var()` aliasing between theme entries; the `--spacing` multiplier vs named
`--spacing-*`; `--text-*` with a `--line-height` companion; oklch→sRGB; and
`@config "./tailwind.config.js"` delegating to the v3 adapter with the CSS theme
layered on top.

`@import` of another provided source resolves; `@import` of a source that was
**not** provided produces a `missing-import` entry naming the file, so the setup
UI can ask for it.

**Check**: `pnpm --filter @fig-tail/theme test -t v4` → passes, with a snapshot
per v4 fixture and the same manual spot-check discipline as Step 5.

### Step 7: Build the fixture corpus and a cross-flavour consistency test

`fixtures/configs/` holds the eight v3 configs from Step 3 plus **four v4
configs** exercising resets, aliasing, named spacing, and `@config`.

Then add the test that proves the adapters agree: write a v3 config and a v4
config expressing the *same* design intent (same brand colour, same spacing base,
same radius scale) and assert both produce the same values for those tokens. This
is what lets plan 002 consume either flavour without branching.

**Check**: `pnpm --filter @fig-tail/theme test -t consistency` → passes. Each
fixture's provenance is recorded in `fixtures/configs/README.md`.

### Step 8: Wire `resolveTheme` and the unresolved report

Compose detection → adapter → validation. Four guarantees must hold, each with a
test:

1. **`resolveTheme` never throws.** Any internal failure becomes
   `{ ok: false, tokens: null, unresolved: [...] }` with a `parse-error` entry.
   Plan 003 calls this from a UI and plan 004 from inside a 15-second codegen
   budget; neither can handle an exception.
2. **Nothing is skipped silently.** For every fixture, the count of config keys
   the adapter ignored equals the number of `Unresolved` entries.
3. **Partial results are still useful.** A config with one unresolvable key
   returns a valid `TokenSet` for everything else, plus the report.
4. **No execution.** A config containing
   `module.exports = (() => { throw new Error('executed') })()` must return a
   report entry and never throw that error. Add a second test asserting the built
   bundle contains no `eval(` and no `new Function`.

**Check**: `pnpm --filter @fig-tail/theme test -t resolve` → passes, all four
guarantees covered. `pnpm --filter @fig-tail/theme build && du -b
packages/theme/dist/index.js` → under 180 kB.

### Step 9: Document what is and is not supported

Add a "What fig-tail can read from your Tailwind config" section to the root
`README.md`: the supported constructs, the unsupported ones, what happens when
something is unsupported (it is reported, not dropped), and which Tailwind
versions the bundled defaults came from. Factual, about 40 lines — plan 010
writes the full docs.

**Check**: a developer reading only this section can correctly predict whether
their own config will resolve. Test it: pick two fixture configs, read the
section, predict the outcome, then run the resolver and compare.

## Validation plan

- **Unit tests**: schema validation; static evaluation of every supported
  construct and rejection of every unsupported one; v3 merge semantics; key
  flattening including `DEFAULT`; v4 namespace resets and `var()` aliasing;
  colour conversion (assert `oklch(0.623 0.214 259.815)` → `#3b82f6` within ±1
  per channel); rem→px.
- **Snapshot tests**: the full `TokenSet` for each of the twelve fixture configs.
  Review these diffs by eye on every change; they are the real regression net.
- **Cross-flavour consistency test**: Step 7.
- **Safety tests**: no execution of input; no `eval`/`new Function` in the
  bundle; no Node built-ins imported.
- **Report-completeness test**: Step 8 guarantee 2, across every fixture.
- **Size test**: under 180 kB minified; token output under 120 kB uncompressed
  for a full default theme.

## Done criteria

ALL must hold.

- [ ] `pnpm install && pnpm -r typecheck && pnpm -r lint && pnpm -r test` → exit 0
- [ ] `packages/theme/spike/FINDINGS.md` records the Step 3 coverage measurement
      against the stated bar
- [ ] All 8 real-world v3 fixtures either fully resolve or produce an accurate,
      actionable report — and the fully-resolved count is recorded in
      `FINDINGS.md` and in `plans/README.md` (6+ is the target; a lower number is
      a documented limitation, not a failure)
- [ ] All 4 v4 fixtures resolve, including resets, aliasing, and `@config`
- [ ] `resolveTheme` never throws, for any input, including deliberately hostile
      ones
- [ ] Nothing is skipped without a corresponding `Unresolved` entry, tested
      across every fixture
- [ ] The built bundle contains no `eval(`, no `new Function`, and no Node
      built-in imports
- [ ] Bundled default themes record the Tailwind versions they came from, and
      `gen:data` is reproducible (`git diff` empty after two runs)
- [ ] The cross-flavour consistency test passes
- [ ] `dist/index.js` under 180 kB minified; full-default token output under
      120 kB uncompressed
- [ ] No files outside the in-scope list were created or changed
- [ ] `plans/README.md` status row for 001 updated

## STOP conditions

Stop and report back — do not improvise — if:

- **No real-world config parses at all** (Step 3) — as distinct from partial
  coverage, which is expected and handled by the report plus plan 009's CLI.
- Any approach seems to require `eval`, `new Function`, or dynamic `import()`.
  This is a hard line, not a tradeoff.
- The bundle cannot fit under **250 kB** minified even after trimming. That
  threatens plan 003's plugin bundle and needs a decision about dropping a
  dependency (probably postcss, possibly acorn), not a raised budget.
- Tailwind's v3 `defaultTheme` or v4 `theme.css` is not extractable in the shape
  Step 4 assumes.
- The two adapters cannot produce a structurally identical `TokenSet`. One schema
  is the point; if it cannot hold, the split needs designing rather than papering
  over.
- Tailwind v5 exists and the owner has not said which versions to target.
- A step's check fails twice after a reasonable attempt.

## Handoff / after it lands

- **Plan 002** consumes `TokenSet` directly. Any change after 002 starts is
  breaking — bump `schemaVersion` and say so in the commit.
- **Plan 003** calls `resolveTheme` from the setup UI, stores the resulting
  `TokenSet`, and **must display the `unresolved` report to the user**. That
  display is the whole payoff of Step 8; do not let 003 discard it.
- **Plan 009** wraps the same resolver in a Node CLI that *can* execute a config
  properly, for the cases this one reports as unresolvable. It reuses this
  package's schema and validator — keep both exported.
- **What a reviewer should scrutinise most**: the snapshot files and the
  report-completeness test. Everything downstream inherits snapshot errors, and a
  snapshot test will happily lock in a wrong value forever. Ask to see the
  hand-verified spot-checks from Steps 4, 5 and 6.
- **Deliberately deferred**:
  - *Tailwind plugin-contributed utilities* (`@tailwindcss/typography`, `forms`).
    They mostly generate component classes (`prose`, `form-input`) with no
    inspectable Figma equivalent. `unsupported` makes their absence visible
    rather than silent.
  - *`@utility` and `@variant` custom definitions in v4.* Same reasoning.
  - *Full TypeScript config support.* The bounded pre-pass covers common cases;
    plan 009 covers the rest properly.
