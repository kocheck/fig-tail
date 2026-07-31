# Plan 001: Build the in-plugin Tailwind theme resolver (v3 + v4)

> **Executor instructions**: This plan is self-contained. Read it in full, then
> work through its **Build sheet** below, one
> task at a time, confirming each *Done when* before starting the next. Commit
> after each task. When done, update the status row for this plan in
> `plans/README.md`. `plans/EXECUTOR-GUIDE.md` is optional expanded guidance;
> this plan wins if they conflict.
>
> **Structure of this file**: the Build sheet is what you *do*. Everything after
> it is reference — read a section when a task points you there. "Steps" gives
> the detail behind each task; "STOP conditions" and "Done criteria" are
> checklists you must confirm literally before calling this finished.
>
> **Degrade, don't block.** STOP conditions are deliberately narrow. Anything
> *not* listed there has a designed fallback: do the next-best thing, label it
> visibly for the user, note it in your commit message, and keep going. Read
> invariant 2 in `plans/README.md` before deciding something is blocked —
> "partly working and clearly labelled" beats "stopped and waiting" everywhere
> except write-safety and executing user input.
>
> **Drift check (run first)**:
> `git diff --stat 7932c82..HEAD -- package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json eslint.config.js .github/workflows/ci.yml packages/theme fixtures/configs`
> This revision was written against a plan-only repository at commit `7932c82`.
> Expected result before implementation: empty. If any listed path appears,
> someone has started this
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
- **Depends on**: 000 (platform contract preflight)
- **Category**: dx
- **Planned at**: commit `7932c82`, 2026-07-31 — greenfield after platform preflight.

## Build sheet

Use Node 20+ and pnpm. TypeScript is strict; use named exports, no `any`, no
non-null assertions, and colocated Vitest tests. Run
`pnpm -r typecheck && pnpm -r lint && pnpm -r build && pnpm -r test` before every commit. Branch
and commit rules are in "Working approach" below.

Do the tasks below **in order, one at a time**. Each task's *Done when* is a
command; it must produce the stated result before you start the next task.
Commit after each task. Everything after this section is **reference** — read a
section when a task points you at it.

### Files this plan creates

| Path | Purpose | Task |
|---|---|---|
| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.gitignore` | reproducible workspace root | 1 |
| `.github/workflows/ci.yml` | first-commit CI baseline | 1 |
| `packages/theme/package.json`, `tsconfig.json`, `tsdown.config.ts`, `vitest.config.ts` | package setup, build, coverage | 1 |
| `packages/theme/src/index.ts`, `bootstrap.test.ts` | real build entry and first meaningful schema-version smoke test; expanded in task 8 | 1, 8 |
| `packages/theme/scripts/browser-bundle-probe.mjs` | fresh, fully bundled browser-runtime and size probe | 1 |
| `packages/theme/src/types.ts` | `TokenSet`, resolver types, and shared config-provenance contract | 2 |
| `packages/theme/src/validate.ts` | `validateTokenSet`, `validateConfigProvenance` | 2 |
| `packages/theme/src/validate.test.ts` | schema tests | 2 |
| `packages/theme/spike/eval.ts`, `packages/theme/spike/FINDINGS.md` | throwaway spike + findings | 3 |
| `fixtures/configs/v3/*.js|.ts` (8 files), `fixtures/configs/README.md` | v3 corpus + provenance | 3 |
| `packages/theme/scripts/gen-data.ts` | Node generator for bundled defaults | 4 |
| `packages/theme/data/v3-default-theme.json`, `v4-default-theme.json` | bundled defaults (checked in) | 4 |
| `packages/theme/src/v3/index.ts`, `evaluate.ts`, `merge.ts`, `ts-prepass.ts` + tests | v3 adapter | 5 |
| `packages/theme/src/v4/index.ts`, `parse-theme.ts` + tests | v4 adapter | 6 |
| `fixtures/configs/v4/*.css` (4 files) | v4 corpus | 6 |
| `packages/theme/src/consistency.test.ts` | cross-flavour agreement | 7 |
| `packages/theme/src/resolve.test.ts` | the four guarantees | 8 |
| `README.md` (section only) | what the resolver can read | 9 |

### Dependencies

```bash
pnpm add -w -D --save-exact typescript vitest @vitest/coverage-v8 tsdown esbuild eslint @eslint/js typescript-eslint
pnpm add --filter @fig-tail/theme --save-exact culori acorn acorn-walk
pnpm add --filter @fig-tail/theme -D @types/culori tailwindcss-v3@npm:tailwindcss@3.4.19 tailwindcss-v4@npm:tailwindcss@4.3.1 --save-exact
```

The aliased Tailwind packages are **dev-only**, used solely by
`scripts/gen-data.ts`
to produce the bundled default themes. They must never appear in the runtime
bundle — task 8's size check will catch it if they do.

### Tasks

| # | Do this | Files it may touch | Done when |
|---|---|---|---|
| 1 | Scaffold a reproducible workspace and `@fig-tail/theme`: exact `packageManager`, committed lockfile, a real schema-version entry + smoke test, tsdown build, active Vitest coverage config, CI, the browser-bundle probe, and the Node-built-in lint ban. See Step 1. | workspace root, `.github/workflows/ci.yml`, package/build/test config, `src/index.ts`, `src/bootstrap.test.ts`, browser-probe script | `pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm -r lint && pnpm -r build && pnpm -r test && pnpm --filter @fig-tail/theme probe:browser` → exit 0. The smoke test asserts schema version 1; a lockfile change makes frozen install fail; a temporary `import fs from 'fs'` fails lint; remove both probes |
| 2 | Write `TokenSet` + the other types, shared `ConfigProvenance`, and both runtime validators. Copy Step 2 exactly, including version/default status, unknown, and partial namespaces. | `src/types.ts`, `src/validate.ts`, `src/validate.test.ts` | schema tests pass with confirmed/unconfirmed fixtures plus malformed-state failures; `validateConfigProvenance` accepts both exact shapes and rejects aliases/absolute paths |
| 3 | **Spike.** Gather the 8-config corpus (8 distinct shapes — see Step 3), prototype the acorn evaluator, write `FINDINGS.md`. Produces findings, not shipped code. | `spike/**`, `fixtures/configs/v3/**`, `fixtures/configs/README.md` | `spike/FINDINGS.md` answers all 5 questions with **pasted output**, states the resolved count, and states a build-vs-buy decision |
| 4 | Write `scripts/gen-data.ts` and generate both bundled default themes. Record exact source versions and enforce the exact-version merge gate. | `scripts/gen-data.ts`, `data/*.json` | `pnpm --filter @fig-tail/theme gen:data` twice → `git diff` empty; 5 values hand-checked; tests prove missing, minor-skewed, and patch-skewed versions never merge bundled defaults |
| 5 | Implement the v3 adapter: evaluator, known-module table, TS pre-pass, presets, Tailwind-compatible recursive merge semantics, **and the replace-vs-extend safe-fallback rule**. | `src/v3/**` | `pnpm --filter @fig-tail/theme test -t v3` → passes, incl. the cases in Step 5, recursive-merge conformance, and both directions of the safe-fallback rule |
| 6 | Measure postcss vs a hand-rolled scanner, then implement the v4 adapter. Build the 4 v4 fixtures. | `src/v4/**`, `fixtures/configs/v4/**` | `pnpm --filter @fig-tail/theme test -t v4` → passes; the postcss measurement is in the commit message |
| 7 | Add the cross-flavour consistency test (same design intent, v3 and v4, identical token values). | `src/consistency.test.ts`, `fixtures/configs/**` | `pnpm --filter @fig-tail/theme test -t consistency` → passes |
| 8 | Expand the task-1 entry to wire `resolveTheme`, flavour/version detection, unknown-version degradation, and the unresolved report. Enforce the four guarantees in Step 8. | `src/index.ts`, `src/resolve.test.ts`, browser-probe script | tests pass; the fresh fully bundled browser probe includes every runtime dependency, contains no execution primitive or Node built-in, and is under 184320 bytes |
| 9 | Add the "What fig-tail can read from your Tailwind config" README section (~40 lines). | `README.md` | You read only that section, predicted the outcome for 2 fixture configs, then ran the resolver and matched |

**Task 3 is the one that can change the plan.** If it reports fewer than 6 of 8
configs fully resolving, that is **not** a stop — continue to task 4 and record
the shortfall (see Step 3). Stop only if *nothing* parses.

---

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

- TypeScript, strict, `target: es2020`, `moduleResolution: bundler`.
- **vitest** for tests, **tsdown** for publishable-library builds.
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

**When detection is ambiguous or the version is unknown**, degrade rather than
guess. This ships publicly and will meet configs from Tailwind versions that did
not exist when it was written:

- **Neither marker present** → return `ok: false` with a `parse-error` entry
  saying which two file types fig-tail accepts. Do not assume a flavour.
- **Both markers present** (a v4 CSS entry alongside a v3 config, without
  `@config`) → resolve as v4 and add a warning naming the other file, since v4 is
  the one that actually drives the build in that setup.
- **A recognised major without an exact supported version** → parse explicit
  project tokens, but do **not** merge bundled defaults. Defaults change within a
  major (Tailwind v4.1 added default-theme tokens), so same-major compatibility
  is not evidence. Record default coverage as unconfirmed and list affected
  namespaces in `partialNamespaces`.
- **An exact version matching a bundled dataset** → merge that dataset and record
  the same exact version as confirmed. If the project version differs by minor
  or patch, no bundled defaults are merged until a dataset for that exact version
  exists.
- **An unrecognised major** (a future v5, say) → **do not apply v4 semantics to
  it.** Return `{ ok: false, tokens: null }` plus a warning naming the version.
  The plugin may show clearly-labelled generic arbitrary syntax, but must not
  claim that any emitted class is confirmed for the unknown major.

### v3 resolution semantics — get these exactly right

Confirmed against Tailwind's v3 theme documentation:

- **`theme.<key>`** *replaces* the default value for that key entirely.
- **`theme.extend.<key>`** *merges* with the resolved default value for that key.
- `theme.extend` uses Tailwind's recursive object merge semantics. Extending
  `colors.blue.950` retains the other default `blue` shades; arrays such as font
  families and box shadows follow Tailwind's special array rules. Do not invent
  a simplified merge: add conformance tests that compare this adapter with the
  pinned `tailwindcss-v3` `resolveConfig` output for plain-object fixtures.
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
- A v4 prefix is declared on the import, for example
  `@import "tailwindcss" prefix(tw)`, and produces variant-style classes such as
  `tw:bg-red-500`. This differs from v3's string prefix (`tw-bg-red-500`) and
  must be represented explicitly in `TokenSet.source.prefix`.

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

#### The safe-fallback rule — replace vs extend

**This is the most consequential correctness rule in the package.** Get it wrong
and fig-tail emits class names that do not exist in the user's build.

When a theme key cannot be evaluated, what happens next depends on *which kind*
of key it was:

| Unresolvable key | Safe fallback | Why |
|---|---|---|
| `theme.extend.<ns>` with exact default-version evidence | Keep the matching bundled defaults for `<ns>` | The project adds to the defaults and the exact default dataset is confirmed. |
| `theme.extend.<ns>` without exact version evidence | Keep only statically resolved explicit additions; mark `<ns>` partial | Same-major defaults are not safe to guess. Missing values fall to labelled raw output. |
| `theme.<ns>` (replacing) | Mark `<ns>` **unknown** — emit **no** tokens for it | The project's config *replaces* the defaults, so Tailwind's defaults are **not in their build**. Emitting them would produce `bg-blue-500` for a project that has no `blue-500`. |
| A whole config that fails to parse | Mark **every** namespace unknown | Same reasoning, applied to everything. |

An **unknown** namespace is not the same as an empty one and must be
representable in `TokenSet` — add `unknownNamespaces: string[]`. Plan 002 treats
an unknown namespace as "no tokens available", so every value in it falls
through to labelled generic arbitrary syntax when prefix/core availability is
known safe; otherwise it returns none. Plans 004 and 005 surface
it: "fig-tail could not read your colours; showing raw values for them."

The instinct is to fall back to defaults because it produces prettier output.
Resist it. `bg-[#3b82f6]` preserves the value in standard unprefixed Tailwind;
`bg-blue-500` works only where
`blue-500` exists, and where it does not, the developer pastes a class that
silently does nothing and has no way to tell why. See invariant 2 in
`plans/README.md`.

The same rule governs three related cases:

- **`prefix` unresolvable** → preserve the resolved tokens but record prefix
  status as `unknown`. Plan 002 then emits no classes at all for that config;
  even arbitrary utilities would be dead if emitted with the wrong prefix.
- **`corePlugins`** is utility-specific, not namespace-specific: disabling
  `backgroundColor` must not disable `textColor` over the same color tokens.
  Record the resolved allow/deny mode and core-plugin names in `source`.
  Unresolvable availability becomes `mode: "unknown"`; plan 002 suppresses
  affected named and arbitrary utilities rather than guessing.
- **`important: true` or a `important: '#app'` selector** → does not change class
  names; record it in `source` for the record and carry on.

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

If parsing still fails after the pre-pass, **report it clearly** and explain how
to replace the dynamic construct with plain values. Core resolver copy must not
mention a CLI that may never ship. Plan 009 conditionally adds an escape-hatch
action and docs only when that package is present.

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

The resolved output is stored in Figma via private `setPluginData`, which caps at
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
| Browser bundle probe | `pnpm --filter @fig-tail/theme probe:browser` | freshly bundles the public entry and all runtime dependencies for the browser; under 184320 (180 kB) |

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
- Implement `validateTokenSet` as a small explicit runtime validator. Do not
  import a dev-only schema library into the published bundle; plan 003 calls
  this validator at runtime.

## Scope

**In scope**:

- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.base.json`,
  `eslint.config.js`, `.gitignore`, and `.github/workflows/ci.yml`
- `packages/theme/**` — the resolver, static evaluator, both adapters, bundled
  default-theme data and its generator script, the token-set schema and
  validator, tests
- `fixtures/configs/**` — real-world config fixtures (Step 7)
- Root `README.md` — a section describing what the resolver supports and what it does not

**Out of scope**:

- `packages/match/**` — plan 002. The resolver emits tokens; it never decides
  which class fits a value. If you are writing a `bg-` prefix in this package,
  you are out of scope.
- `packages/plugin/**` — plan 003. No Figma types, no `figma` global, no
  `@figma/plugin-typings`.
- `packages/cli/**` — plan 009. No Node-only code anywhere in this package.
- Tailwind **v2 or earlier**. Not supported, not planned.
- Executing user input by any means. See "The hard runtime constraint".
- Release and publishing config — plan 010. Initial CI belongs to Step 1 here.

## Working approach

- Work on the branch you were given. Do not push or open a pull request unless
  asked.
- Commit per step, prefixed `001-N:`.
- Keep `packages/theme` browser-clean from the first commit — add the ESLint rule
  banning Node built-ins in this package in Step 1, not later.

## Steps

### Step 1: Scaffold the workspace

Create the pnpm workspace root and set root `packageManager` to the exact pnpm
release used for the scaffold. Commit the generated `pnpm-lock.yaml`; dependency
commands use `--save-exact`. Create strict `tsconfig.base.json`, flat ESLint with
a `no-restricted-imports` rule banning Node built-ins in `packages/theme/**`,
and the `@fig-tail/theme` package with `typecheck`, `lint`, `test`, `coverage`,
`build`, and `gen:data` scripts. Build with a checked-in `tsdown.config.ts`, not
tsup; tsup's own repository says it is no longer actively maintained.

Create `.github/workflows/ci.yml` now. On pull requests and pushes it enables
Corepack, installs with `pnpm install --frozen-lockfile`, then runs root `check`
(`typecheck`, `lint`, `build`, `test` in that order). Plan 010 extends this workflow for
release; it does not introduce the first CI safety net.

Create a real Vitest config with `passWithNoTests: false`. Coverage includes
`src/**/*.ts` and excludes tests, generated declarations, and data. Plan 002 adds
its package-specific numeric threshold when matchers exist; a command-line
coverage report with no configured include is not an enforcement mechanism.

Do not leave the scaffold with an empty build or test suite. Create the public
entry now with `TOKEN_SET_SCHEMA_VERSION = 1 as const`, and a bootstrap test that
imports it and asserts `1`. Task 2 uses that version in the schema and task 8
expands the same entry with the resolver exports. Also add `probe:browser`: an
esbuild script that creates a temporary minified browser bundle from the public
entry with **all runtime dependencies bundled**, rejects Node built-ins,
`eval(`, and `new Function`, enforces the current 180 kB ceiling, and removes its
temporary output. A publish build whose dependencies are external is not size
evidence.

**Check**: `pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm -r lint &&
pnpm -r build && pnpm -r test && pnpm --filter @fig-tail/theme probe:browser` →
exit 0. The bootstrap test is collected and passes. Temporarily desynchronise a
dependency from the lockfile and confirm frozen install fails, then restore it.
Adding `import fs from 'fs'` under `packages/theme/src` fails lint; removing it
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
  /** Exact version evidence. A package.json range/tag is not exact evidence. */
  tailwindVersion?: { exact: string; source: 'package-json' | 'cli-export' }
  options?: { pruneDefaults?: boolean; remBasePx?: number }
}

export type SourceMetadata = {
  name: string
  sha256: string
  byteLength: number
}

export type ConfigProvenance =
  | { kind: 'browser'; sources: SourceMetadata[]; resolvedAt: string;
      inputSha256: string }
  | { kind: 'cli'; sources: SourceMetadata[]; resolvedAt: string;
      inputSha256: string; cliVersion: string; targetTailwindVersion: string;
      projectName: string; entry: string }

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
export function validateConfigProvenance(value: unknown):
  | { ok: true; value: ConfigProvenance }
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
    "prefix": { "status": "none" },
    // or { "status": "known", "style": "v3-string", "value": "tw-" }
    // or { "status": "known", "style": "v4-variant", "value": "tw" }
    // or { "status": "unknown" }
    "corePlugins": { "mode": "all", "names": [] },
    // mode: "all" | "denylist" | "allowlist" | "unknown"
    "remBasePx": 16,               // the assumed rem base; never guess downstream
    "tailwindVersionEvidence": { "exact": "3.4.19", "source": "package-json" },
    // or null when no exact evidence was supplied
    "defaults": { "status": "confirmed", "version": "3.4.19" }
    // or { "status": "unconfirmed", "reason": "missing-exact-version" }
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
  "unsupported":   { "<namespace>": 3 },     // recognised but not modelled
  "unknownNamespaces": ["colors"],           // could NOT be read — emit raw values,
                                             // never Tailwind defaults. See the
                                             // safe-fallback rule above.
  "partialNamespaces": ["spacing"]           // explicit tokens are confirmed,
                                             // but bundled defaults were withheld
}
```

`ConfigProvenance` is the one transport/storage provenance vocabulary used by
plans 003 and 009. `inputSha256` is singular everywhere; the Tailwind field is
`targetTailwindVersion`; no `inputsSha256`, `tailwindVersion`, or separate
`importProvenance` aliases may be introduced. `projectName` is only the target
root basename and `entry` is target-relative; neither may contain an absolute
path. This provenance stays outside `TokenSet` because it describes how the
token set was produced, not its semantic contents.

`validateConfigProvenance` enforces the discriminated shape, SHA-256 encoding,
ISO timestamp, exact semantic versions, basename-only `projectName`, relative
`entry`/source names, and rejection of unknown aliases. Plans 003 and 009 call
this validator rather than reconstructing the contract.

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
- Prefix status and core-plugin availability are required. The validator rejects
  a `known` v3 prefix without its exact configured string (including its dash),
  a `known` v4 prefix containing `:`, and an availability mode with malformed
  core-plugin names.
- **A namespace listed in `unknownNamespaces` must be empty in the token maps.**
  Carrying both tokens and an unknown marker for the same namespace is a
  contradiction, and the validator must reject it — this is the invariant that
  stops a default value from leaking into a namespace the project replaced.
- `source.defaults.status === 'confirmed'` requires exact equality between the
  supplied version evidence and the bundled dataset version. When unconfirmed,
  no token from the bundled default dataset may appear. Affected namespaces are
  listed in `partialNamespaces`; explicit project tokens remain usable.

**Check**: `pnpm --filter @fig-tail/theme test -t schema` → passes, including a
hand-written valid fixture and five malformed variants (missing `alpha`, `px` as
a string, a dotted key, a missing `schemaVersion`, a colour with two rgb
channels) each failing with a distinguishable error.

### Step 3: Spike the static evaluator against real configs

**Produces findings and a decision, not shipped code.** Do not skip.

1. Collect **eight real-world v3 configs** into `fixtures/configs/v3/`.

   **Draw them from the wild, not from any one team's codebase.** fig-tail ships
   to the Figma Community and will meet configs nobody here has seen; a corpus
   tuned to a single project optimises for a sample of one. Aim for eight
   deliberately *different* shapes:

   - a minimal config (barely any `extend`)
   - shadcn/ui's config (CSS-variable colours, `hsl(var(--x))` patterns)
   - a Tailwind UI / official starter config
   - one using a shared **preset**
   - one written in TypeScript (`tailwind.config.ts`)
   - one with several **plugins** contributing theme values
   - one with a `prefix` set
   - one from a monorepo, extending a config in another package

   Record the provenance and licence of each in `fixtures/configs/README.md`. If
   the repo owner's own config is available, add it as a **ninth**, clearly
   marked as a smoke test — a useful data point, never the target.
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
reported (Step 8), and the resolvable parts still produce a usable `TokenSet`.
Plan 009 may later add an optional advanced route, but this plan does not depend
on it. So if coverage comes in under the bar:

- **Keep building.** Continue to Steps 4–8 as written.
- **Report the number and the specific constructs that missed**, with examples,
  so the owner can decide whether any of them is worth adding support for before
  launch. Frame it as "these config patterns are reported but not evaluated by
  the in-plugin resolver", not "this approach failed". Mention an advanced route
  only in builds where plan 009 is DONE.
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

- `v3-default-theme.json` — from the `tailwindcss-v3` alias's `defaultTheme` and `colors`,
  every colour pre-converted to `hex`/`rgb`.
- `v4-default-theme.json` — from the `tailwindcss-v4` alias's `theme.css`, parsed into the
  same token shape, colours pre-converted from oklch.

Record the exact Tailwind versions the data came from, inside each JSON file and
in the README. Add tests that fail when the checked-in data lacks its version,
when supplied evidence differs by even one patch, or when unconfirmed output
contains any bundled-default token. Tailwind adds defaults within a major, so a
major-only or semver-range check is forbidden.

**Check**: `pnpm --filter @fig-tail/theme gen:data` is reproducible — run it
twice, `git diff` is empty. Spot-check five values by hand against Tailwind's
published defaults (`blue-500`, `gray-200`, `spacing.4`, `text-sm`'s line-height,
`rounded-lg`) and record them in the commit message.

### Step 5: Implement the v3 adapter

`src/v3/`: the static evaluator from Step 3, the known-module table, the
TypeScript pre-pass, preset ordering, and the `theme` vs `theme.extend` merge
semantics from "Context".

For fixtures made only of plain values, run the same input through the pinned
`tailwindcss-v3` `resolveConfig` in a test-only Node path and compare the
resulting theme projection. Include nested color-shade extension and an array
case; these are the two places a hand-written merge most often diverges.

Every unresolvable construct produces an `Unresolved` entry with an accurate
`path`, `reason`, `snippet`, and a `message` written for a designer rather than a
compiler author:

> `theme.extend.spacing` is a function, which fig-tail cannot evaluate. Your
> spacing tokens will fall back to Tailwind's defaults. To fix: replace the
> function with plain values. This build does not execute configuration code.

**Check**: `pnpm --filter @fig-tail/theme test -t v3` → passes, with a snapshot
per fixture config. Tests must cover: `theme.colors` replacing defaults;
`theme.extend.colors` merging; nested colour flattening including `DEFAULT`;
`...defaultTheme.fontFamily.sans` spreading correctly; nested color extension
retaining untouched shades; a function value reported
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
   Plan 003 calls this from a UI and plan 004 may consume its stored output
   inside a conservative 3-second Codegen budget; neither can handle an
   exception.
2. **Nothing is skipped silently.** For every fixture, the count of config keys
   the adapter ignored equals the number of `Unresolved` entries.
3. **Partial results are still useful.** A config with one unresolvable key
   returns a valid `TokenSet` for everything else, plus the report.
4. **No execution.** A config containing
   `module.exports = (() => { throw new Error('executed') })()` must return a
   report entry and never throw that error. Add a second test asserting the built
   freshly built bundle contains no `eval(` and no `new Function`.

**Check**: `pnpm --filter @fig-tail/theme test -t resolve` → passes, all four
guarantees covered. Then rebuild the publish artifact and run the independent
fully bundled probe before every bundle assertion:
`pnpm --filter @fig-tail/theme build && pnpm --filter @fig-tail/theme probe:browser`
→ under 180 kB with no forbidden primitive or Node built-in.

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
- **Size test**: the fresh browser probe bundles all runtime dependencies and is
  under 180 kB minified; token output is under 120 kB uncompressed for a full
  default theme.

## Done criteria

ALL must hold.

- [ ] Root `packageManager` pins an exact pnpm release, `pnpm-lock.yaml` is
      committed, and `pnpm install --frozen-lockfile` succeeds
- [ ] Initial CI runs frozen install, typecheck, lint, build, and test on pull
      requests and pushes
- [ ] `pnpm -r typecheck && pnpm -r lint && pnpm -r build && pnpm -r test` → exit 0
- [ ] `packages/theme/spike/FINDINGS.md` records the Step 3 coverage measurement
      against the stated bar
- [ ] All 8 real-world v3 fixtures either fully resolve or produce an accurate,
      actionable report — and the fully-resolved count is recorded in
      `FINDINGS.md` and in `plans/README.md` (6+ is the target; a lower number is
      a documented limitation, not a failure)
- [ ] The fixture corpus covers all eight shapes listed in Step 3, with
      provenance recorded
- [ ] **The safe-fallback rule holds**: an unresolvable replacing key marks its
      namespace unknown; an extending key keeps bundled defaults only with exact
      version evidence, otherwise keeps explicit additions and marks the
      namespace partial. All three directions are tested.
- [ ] An unresolvable `prefix` records `status: "unknown"`; an owned resolver
      contract test proves that state survives validation. Plan 001 completion
      does not depend on plan 002 existing
- [ ] An unrecognised Tailwind major returns `tokens: null` rather than applying
      another major's semantics
- [ ] The validator rejects a `TokenSet` carrying both tokens and an unknown
      marker for the same namespace
- [ ] All 4 v4 fixtures resolve, including resets, aliasing, and `@config`
- [ ] `resolveTheme` never throws, for any input, including deliberately hostile
      ones
- [ ] Nothing is skipped without a corresponding `Unresolved` entry, tested
      across every fixture
- [ ] The built bundle contains no `eval(`, no `new Function`, and no Node
      built-in imports
- [ ] Bundled default themes record the Tailwind versions they came from, and
      `gen:data` is reproducible (`git diff` empty after two runs)
- [ ] Missing, range-only, major-only, minor-skewed, and patch-skewed version
      evidence never merges bundled defaults; exact matching evidence does
- [ ] The cross-flavour consistency test passes
- [ ] The fresh browser probe bundles the public entry plus all runtime
      dependencies, contains no forbidden runtime primitive or Node built-in,
      and is under 180 kB minified; full-default token output is under 120 kB
      uncompressed
- [ ] No files outside the in-scope list were created or changed
- [ ] `plans/README.md` status row for 001 updated

## STOP conditions

Stop and report back — do not improvise — if:

- **No real-world config parses at all** (Step 3) — as distinct from partial
  coverage, which is expected and handled by the unresolved report.
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
- Tailwind v5 exists **and** the owner wants it supported. Merely *encountering*
  an unknown major is not a stop — the safe fallback marks every namespace
  unknown and the plugin emits arbitrary values, which is correct in any
  version. Adding real v5 support is a scoping decision.
- A step's check fails twice after a reasonable attempt.

## Handoff / after it lands

- **Plan 002** consumes `TokenSet` directly, including `unknownNamespaces` —
  which it must treat as "no tokens here, emit an arbitrary value", never as
  "use the defaults". Any schema change after 002 starts is breaking; bump
  `schemaVersion` and say so in the commit.
- **Plan 003** calls `resolveTheme` from the setup UI, stores the resulting
  `TokenSet`, and **must display the `unresolved` report to the user**. That
  display is the whole payoff of Step 8; do not let 003 discard it.
- **Plan 009**, if built, wraps the same resolver in a Node CLI that *can* execute a config
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
