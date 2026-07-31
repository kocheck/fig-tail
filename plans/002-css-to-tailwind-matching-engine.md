# Plan 002: Build the CSS→Tailwind matching engine

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
> **Drift check (run first)**: this revision was written at commit `7932c82`, before
> plan 001's package existed. Confirm plans 000 and 001 are `DONE`, then run
> `git diff --stat 7932c82..HEAD -- packages/theme fixtures/figma/css` and compare the live exports
> with the contracts quoted below. A non-empty diff is expected; a contract
> mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L — the largest plan in the program. It is also the most testable:
  pure functions, no I/O, no Figma.
- **Risk**: MED — the risk is not "does it run" but "does it produce the right
  class". Wrong-but-plausible output is worse than no output, which is why the
  confidence ladder in Step 2 exists.
- **Depends on**: 000, 001
- **Category**: dx
- **Planned at**: commit `7932c82`, 2026-07-31 — dependency contracts are prospective.

## Build sheet

Use Node 20+ and pnpm. Copy the package scripts and strict TypeScript settings
from `packages/theme/package.json` and `packages/theme/tsconfig.json`, changing
only the package name and entry paths. Use named exports, no `any`, no non-null
assertions, and colocated Vitest tests. Before every commit run
`pnpm -r typecheck && pnpm -r lint && pnpm -r build && pnpm -r test`.

Do the tasks below **in order, one at a time**. Each task's *Done when* is a
command; it must produce the stated result before you start the next task.
Commit after each task. Everything after this section is **reference** — read a
section when a task points you at it.

### Files this plan creates

| Path | Purpose | Task |
|---|---|---|
| `packages/match/package.json`, `tsconfig.json`, `tsdown.config.ts`, `vitest.config.ts` | package, build, enforced coverage | 1 |
| `packages/match/src/types.ts` | `MatchResult`, `Confidence`, `MatchOptions`, `VariableHint` | 1 |
| `packages/match/src/types.test.ts` | executable public-contract smoke test | 1 |
| `packages/match/fixtures/css/*.json` | copied verbatim from plan 000's real `getCSSAsync()` captures | 1 |
| `packages/match/scripts/browser-bundle-probe.mjs` | fully bundled browser-size probe | 1 |
| `packages/match/src/normalise.ts` + test | shorthand expansion, colour canonicalisation, collapse rules | 2 |
| `packages/match/src/matchers/color.ts` + test | colour matcher, ΔE, alpha modifier | 3 |
| `packages/match/src/matchers/length.ts` + test | spacing, sizing, radius, border width | 4 |
| `packages/match/src/matchers/typography.ts` + test | font size/weight/family, leading, tracking | 5 |
| `packages/match/src/matchers/layout.ts`, `shadow.ts`, `effects.ts` + tests | static + shadow + effects | 6 |
| `packages/match/src/order.ts` | canonical class ordinal table | 7 |
| `packages/match/src/index.ts` + `integration.test.ts` | `matchDeclarations`, `toClassName` | 7 |
| `packages/match/src/summarise.ts` + test | `summarise`, no-config, namespace, prefix, and availability tests | 8 |

### Dependencies

```bash
pnpm add --filter @fig-tail/match --save-exact culori
pnpm add --filter @fig-tail/match -D --save-exact fast-check @vitest/coverage-v8 esbuild
```

`@fig-tail/theme` is a workspace dependency (`workspace:*`), types only.

### Tasks

| # | Do this | Files it may touch | Done when |
|---|---|---|---|
| 1 | Scaffold the package. Write the public types first, including provenance, hint status, and ambiguity, plus an executable contract test. Copy real CSS captures from plan 000; do not transcribe the prose examples. Configure failing coverage thresholds and the fully bundled browser probe. | package/build/test config, `src/types.ts`, `src/types.test.ts`, `fixtures/css/*`, browser-probe script | typecheck passes; copied fixture hashes equal plan 000 originals; a threshold probe makes coverage fail; the contract test proves an exact result may carry a class while a nearest result must carry `className: null` |
| 2 | Shorthand expansion, colour canonicalisation, reset-utility preservation, and collapse rules (`p-6` not four longhands). | `src/normalise.ts` + test | `test -t expand` → passes, incl. 1/2/3/4-value shorthands, the `border` shorthand, 5 colour notations, reset utilities, and the 3-match-1-miss non-collapse case |
| 3 | Colour matcher: property→utility map, equality-first matching, CIEDE2000 for near misses, alpha modifier, and validated `codeSyntax` token hints. | `src/matchers/color.ts` + test | `test -t color` → passes, incl. all cases named in Step 3 |
| 4 | Length matchers. **v4 divides by `spacing.base`; v3 looks up `spacing.scale`.** Branch on which is populated, not on `source.major`. | `src/matchers/length.ts` + test | `test -t length` → passes against **both** fixture token sets, incl. all 5 cases in Step 4 |
| 5 | Typography. Pair `font-size` with `line-height` when the token defines one. | `src/matchers/typography.ts` + test | `test -t typography` → passes, incl. paired, unpaired, and font-stack cases |
| 6 | Layout (static tables), shadow (normalised whole-string), effects. | `src/matchers/{layout,shadow,effects}.ts` + tests | `test -t layout`, `-t shadow`, `-t effects` → all pass, incl. the colour-notation shadow case |
| 7 | Compose `matchDeclarations`, apply collapse + dedupe + canonical sort, write `toClassName`. Near matches are structurally excluded. Implement duplicate-value precedence and ambiguity reporting. Snapshot the real fixtures. | `src/index.ts`, `src/order.ts`, `src/integration.test.ts` | integration passes with exact order; a near result cannot enter `toClassName`; duplicate values resolve deterministically and expose all tied candidates |
| 8 | `summarise`, plus safety tests for no config, unknown/partial namespace, unknown prefix, and disabled core utilities. | `src/summarise.ts` + tests | named suites pass; Vitest enforces statements/lines/functions ≥90% and branches ≥85%; a fresh fully bundled browser probe is under 61440 bytes |

**Task 8's unknown-namespace test is the safety-critical one.** If it regresses,
fig-tail emits class names that do not exist in strangers' codebases.

---

## Why this matters

This package answers the only question that matters: given
`background: #3B82F6` on a Figma node, and a codebase whose Tailwind theme
defines `brand-500` as `oklch(0.623 0.214 259.815)`, what should a developer
type? The right answer is `bg-brand-500`. The answer every existing
Figma→Tailwind plugin gives is `bg-[#3b82f6]`, which compiles but silently
routes around the design system.

The second thing it must do is **know when it does not know**. A value that is
*close to but not exactly* a token is the most interesting signal in the whole
system — it means the design and the code have drifted apart. Reporting
`bg-brand-500` for `#3B82F1` would hide that. Reporting "no match; nearest is
`brand-500` (#3B82F6), ΔE 0.4" turns fig-tail from a converter into a
design-system QA tool, and it is what plan 006's linter is built on.

Keeping this as a standalone package with no Figma dependency means it can be
exhaustively tested from the terminal, in milliseconds, without opening Figma.
That is worth the extra package boundary.

## Context the executor needs

### Where this sits

`packages/match` (`@fig-tail/match`) in the existing pnpm workspace created by
plan 001. It depends on `@fig-tail/theme` for types and on nothing else at
runtime except a colour library (see "Colour distance" below). It must be
bundleable into a Figma plugin, so: no Node built-ins, no `fs`, no `process`.

### Input: what Figma actually gives you

Plan 000 called `node.getCSSAsync()` in both supported editor routes and stored
verbatim outputs under `fixtures/figma/css/`. Those captures are the test oracle.
The following are explanatory excerpts only:

```js
// A card frame with auto-layout
{
  "display": "flex",
  "padding": "24px",
  "flex-direction": "column",
  "align-items": "flex-start",
  "gap": "16px",
  "align-self": "stretch",
  "border-radius": "12px",
  "border": "1px solid #E5E7EB",
  "background": "#FFF",
  "box-shadow": "0px 1px 2px 0px rgba(16, 24, 40, 0.05)"
}

// A text node
{
  "color": "#111827",
  "font-family": "Inter",
  "font-size": "14px",
  "font-style": "normal",
  "font-weight": "500",
  "line-height": "20px"
}

// A fixed-size element
{ "width": "320px", "height": "44px" }
```

Things to note, because they are all real and all annoying:

- Figma emits **shorthands** (`padding: 24px`, `padding: 16px 24px`,
  `border: 1px solid #E5E7EB`, `background: #FFF`) that must be expanded before
  matching.
- Colours arrive in mixed notations: `#FFF`, `#E5E7EB`, `rgba(16, 24, 40, 0.05)`,
  and occasionally `linear-gradient(...)`.
- Reset-like declarations can be semantically necessary: `font-style: normal`
  and `text-decoration: none` may override inherited styles. Preserve their
  Tailwind reset utilities unless the declaration set proves them redundant.
- Some CSS has no token dimension whatsoever (`display: flex`,
  `flex-direction: column`, `align-items: flex-start`). These are pure static
  lookups and always resolve exactly.
- Figma will sometimes emit values the design system has no opinion about
  (`align-self: stretch` → `self-stretch`). Handle them; they are free wins.

### The second, better input: bound variables

This is the highest-value path and it must be first-class in the API, not an
afterthought.

When a Figma node has a variable bound to a property, `node.boundVariables`
exposes the variable ID — e.g.
`node.boundVariables.fills[0].id`, `.itemSpacing.id`, `.topLeftRadius.id`,
`.paddingLeft.id`, `.strokes[0].id`. Plan 004 resolves those IDs to `Variable`
objects and can read `variable.codeSyntax.WEB`.

If plan 007 has stamped that variable, `codeSyntax.WEB` is a reusable token key
such as `"brand-500"`, **not** a property-specific class. The engine validates
that the key exists, confirms the variable/CSS value still agrees, then derives
`bg-brand-500`, `text-brand-500`, or another utility from the CSS property. A
single Figma variable can be used for several properties, so treating code
syntax as a literal class would make at least one use wrong. Existing arbitrary
WEB syntax that does not name a live token is ignored with a note and falls back
to value matching.

So the engine's entry point takes an optional per-property hint:

```ts
type VariableHint = {
  /** Stable variable ID; downstream must distinguish no hint from a failed hint. */
  variableId: string
  /** Variable.codeSyntax.WEB if present — a candidate token key, never trusted blindly. */
  codeSyntax?: string
  /** Variable.name, e.g. "brand/500" or "spacing/gutter". */
  name?: string
  /** Where it came from, for the confidence note. */
  collection?: string
}
```

### Output: the confidence ladder

Every match returns a confidence level. The ladder, highest to lowest:

| Confidence | Meaning | Example |
|---|---|---|
| `exact-variable` | A bound variable's WEB code syntax names a token that exists **and** its live value agrees; the property supplies the utility prefix. | `brand-500` + background → `bg-brand-500` |
| `exact-value` | The CSS value equals a theme token's value. | `#3b82f6` → `bg-brand-500` |
| `name-match` | A bound variable's *name* maps cleanly to a token that exists in the theme, and their values also agree. | `brand/500` → `bg-brand-500` |
| `nearest` | No exact match, but a token is within tolerance. **This is the drift signal.** | `#3b82f1` → nearest `brand-500`, ΔE 0.4 |
| `arbitrary` | No token is close. Fall back to Tailwind arbitrary-value syntax. | `bg-[#a1b2c3]` |
| `none` | The property cannot be expressed in Tailwind at all. | an unsupported filter |

### Unknown namespaces — the rule that keeps output safe in someone else's repo

Plan 001 emits `unknownNamespaces: string[]` on the `TokenSet`. A namespace lands
there when the resolver could not read a config key that **replaces** Tailwind's
defaults (`theme.colors` rather than `theme.extend.colors`), when the `prefix`
could not be resolved, when a core plugin is disabled, or when the Tailwind major
is unrecognised.

**Treat an unknown namespace as "no tokens exist here" — never as "use the
defaults".** Every value in it must fall through to an arbitrary value:

```
colors ∈ unknownNamespaces,  background: #3b82f6   →   bg-[#3b82f6]   (arbitrary)
                                                    NOT bg-blue-500
```

The reason is the whole shape of this product's risk. `bg-[#3b82f6]` compiles in
standard, unprefixed projects. `bg-blue-500` compiles to **nothing** in a project that
replaced its palette — the developer pastes it, no styling appears, and there is
no error message anywhere to explain why. fig-tail ships publicly, so the
projects it runs against are ones nobody here can inspect; the only safe
direction of failure is toward the raw value.

Two refinements:

- Attach a `note` to those results ("your config's colours could not be read")
  so plans 004 and 005 can surface it once rather than per class.
- When plan 001 reports a namespace unknown **because its core plugin is
  disabled**, even the arbitrary value does not exist — `bg-[#fff]` requires the
  `backgroundColor` core plugin. Return `none` with a note for those, not
  `arbitrary`. Plan 001's `TokenSet` distinguishes the two cases; honour the
  distinction.

### No-config mode must work

Plan 003 defines a tier-3 state: **no Tailwind config at all**. In that state the
plugin still runs, passing `tokens: null`, and every supported value falls
through to labelled generic `arbitrary` output — `bg-[#3b82f6]`, `p-[24px]`.
That is exactly what every other
Figma→Tailwind plugin produces, so fig-tail is never *worse* than the
alternatives for someone who has just installed it, and the surfaces show a
banner explaining how to get real token names.

So: `matchDeclarations` accepts `TokenSet | null`. Do not invent a schema-valid
empty theme. With `null`, return generic arbitrary results without requiring the
caller to branch. These classes are value-preserving for standard unprefixed
Tailwind, but are **not config-confirmed**: a project may use a prefix or disable
a utility. Put that limitation in the result note so surfaces can label it.
Do not throw and do not return `[]` for non-empty CSS.
Layout utilities (`flex`, `items-center`) are unaffected by an empty theme and
must still resolve exactly. Step 7 tests this.

### Never promote a near-miss

`nearest` **must never be promoted to a class**. Its `className` is always null;
the candidate exists only in `nearest` report data. There is no option, overload,
preference, or internal escape hatch that changes this. Plans 004–006 display
the candidate as drift, never in a copyable class string.

### Exact-value ties and provenance

Several tokens may intentionally share a value. Resolve exact ties in this order:

1. a validated `codeSyntax.WEB` hint;
2. a validated variable-name hint;
3. shortest token key, then bytewise lexicographic order.

The first two are intent evidence. The third is only a deterministic fallback:
populate `ambiguity` with every tied candidate
and add a visible note so the choice is never silent. `provenance.hintStatus`
also states when a hint was absent, stale, unresolvable, or conflicting. Plan 006
consumes this status directly and must not reverse-engineer it from confidence.

### Colour distance

Comparing colours by RGB Euclidean distance is wrong: it does not match human
perception and will pick visually distant tokens over near ones. Use
**CIEDE2000 (ΔE₀₀)**, via `culori`'s `differenceCiede2000()`.

Thresholds, configurable but with these defaults:

- **Exact means canonical RGBA equality**, after both values are converted to
  the same sRGB byte representation. A non-identical colour is never promoted
  to exact merely because its perceptual distance is small.
- 0 < ΔE ≤ **2.0** → `nearest` (a "just noticeable difference" is ~1.0; 2.0 catches
  real drift while excluding genuinely different colours)
- ΔE > 2.0 → `arbitrary`

Alpha is matched separately: Tailwind expresses it as an opacity modifier
(`bg-brand-500/50`). Match the opaque colour first, then map alpha to the
nearest Tailwind opacity step (`/0` through `/100` in steps of 5, plus arbitrary
`/[0.05]`). An alpha within 0.005 of a step is exact.

`culori` is ESM and tree-shakeable — import the specific functions
(`import { parse, differenceCiede2000, formatHex } from 'culori/fn'`) so the
plugin bundle does not swallow the whole library.

### Spacing: two different problems

**Tailwind v4** uses a dynamic multiplier: `p-5` is `calc(var(--spacing) * 5)`.
With `--spacing: 0.25rem` (4px), a Figma padding of `24px` is `24/4 = 6` →
`p-6`. Valid multipliers are non-negative numbers, and Tailwind accepts
fractional steps like `p-0.5` and `p-1.5`. So: divide, and accept the result if
it lands on a multiple of 0.5 (and, for values above 4, an integer). A 25px
padding gives 6.25 → not a step → `nearest` is `p-6` (24px), or `p-[25px]`.

**Tailwind v3** uses an enumerated scale — look up the px value in
`spacing.scale` from the token JSON. No arithmetic.

The token schema from plan 001 carries `spacing.base`/`basePx` (v4, `null` for
v3) and `spacing.scale` (v3, `{}` for v4), so the engine branches on which is
populated, not on `source.major`. Both may additionally carry
`spacing.named` — check those first, since a named token is a deliberate
design-system decision and beats a numeric step.

Tolerance for lengths: **±0.5px** counts as exact (Figma rounds), **±2px**
counts as `nearest`.

### Property coverage

Ship these in Step 3–6. Anything not listed returns `none` with a note, and
gets counted so plan 006 can report coverage.

| Group | CSS properties | Notes |
|---|---|---|
| Colour | `background`/`background-color`, `color`, `border-color`, `fill`, `stroke`, `outline-color` | Alpha modifier support required |
| Spacing | `padding*`, `margin*`, `gap`/`row-gap`/`column-gap`, `top/right/bottom/left`, `inset` | Shorthand expansion required |
| Sizing | `width`, `height`, `min-*`, `max-*` | Match spacing scale, then `w-full`/`w-screen`, else arbitrary |
| Radius | `border-radius` + per-corner | Shorthand expansion; `rounded-full` for ≥9999px |
| Typography | `font-size`, `line-height`, `font-weight`, `font-family`, `letter-spacing`, `text-align`, `text-decoration`, `text-transform` | `font-size` should pair with `line-height` when the token defines one |
| Borders | `border-width` + per-side, `border-style` | |
| Shadow | `box-shadow` | Match the whole normalised string against tokens; do not attempt per-layer matching |
| Layout | `display`, `flex-direction`, `align-items`, `justify-content`, `flex-wrap`, `flex`, `align-self`, `gap` | Static lookup tables, always exact |
| Effects | `opacity`, `overflow`, `mix-blend-mode` | Static or numeric |
| Position | `position`, `z-index` | Static / token lookup |

### Class ordering

Output classes in Tailwind's canonical order (the order
`prettier-plugin-tailwindcss` produces: layout → flexbox/grid → spacing →
sizing → typography → backgrounds → borders → effects). Devs paste this into
codebases that lint class order; emitting sorted output means their formatter
is a no-op instead of a diff. Implement as a static ordinal table keyed by
utility prefix — do not take a dependency on the Prettier plugin.

## Inputs & resources

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm -r typecheck` | exit 0 |
| Test this package | `pnpm --filter @fig-tail/match test` | all pass |
| Coverage | `pnpm --filter @fig-tail/match coverage` | configured thresholds: statements/lines/functions ≥90%, branches ≥85% |
| Browser bundle probe | `pnpm --filter @fig-tail/match probe:browser` | builds runtime dependencies into one minified file, then asserts under 60 kB |

Reference documentation:

- Tailwind v4 theme namespaces — https://tailwindcss.com/docs/theme
- Tailwind arbitrary values — https://tailwindcss.com/docs/adding-custom-styles
- culori colour difference — https://culorijs.org/api/#difference
- CIEDE2000 background — https://en.wikipedia.org/wiki/Color_difference#CIEDE2000

The `TokenSet` snapshots produced by plan 001 from `fixtures/configs/` (v3 and
v4) are this plan's primary test input.

## Scope

**In scope**:

- `packages/match/**` — the entire package: source, tests, build config
- `packages/match/fixtures/**` — plan 000's captured `getCSSAsync()` outputs used
  as test input; hand-written replacements are forbidden
- The existing `packages/*` workspace glob and recursive root scripts consume
  the new package without a root-file edit

**Out of scope**:

- `packages/plugin/**` — plan 003/004/005. This package must not import
  `@figma/plugin-typings` or reference the `figma` global. If you need a Figma
  type, define the minimal structural type locally (like `VariableHint` above).
- `packages/theme/**` — do not modify it at all. If the `TokenSet` schema is
  genuinely missing something this engine needs, that is a STOP condition, not
  a quiet edit.
- Generating **HTML/JSX structure** from a node tree — that is plan 008. This
  package converts one node's CSS to classes; it does not walk trees.
- Responsive variants, dark mode, hover/focus states. Figma inspect gives you
  one static state; there is nothing to derive variants from. Deferred
  deliberately — see "Handoff".

## Working approach

- Branch as instructed. Commit per step, prefixed `002-N:`.
- Every matcher is a pure function: `(value, tokens, options, hint?) => MatchResult`.
  No shared mutable state, no caching inside matchers (cache at the engine
  boundary in Step 7 if profiling says you need it).
- Write the test alongside the matcher, in the same commit. This package's
  value is entirely in its correctness.

## Steps

### Step 1: Scaffold the package and define the public API

Create `packages/match` with the workspace conventions from plan 001. Define
and export the types before writing any matcher — plans 004, 005, 006 and 008 all
consume these, so they are a contract.

```ts
export type Confidence =
  | 'exact-variable' | 'exact-value' | 'name-match'
  | 'nearest' | 'arbitrary' | 'none'

export type MatchProvenance = {
  source: 'code-syntax' | 'variable-name' | 'token-value' | 'static-lookup'
        | 'near-token' | 'arbitrary' | 'unsupported'
  hintStatus: 'none' | 'valid-code-syntax' | 'valid-name'
            | 'stale-code-syntax' | 'unresolvable' | 'conflict'
  token?: { namespace: string; key: string; value: string }
}

export type MatchAmbiguity = {
  chosen: string
  candidates: string[]
  rule: 'shortest-then-lexicographic'
}

export type MatchResult = {
  /** Copyable class. Always null for `nearest` and `none`. */
  className: string | null
  confidence: Confidence
  /** The CSS property this came from, post-shorthand-expansion. */
  property: string
  /** The CSS value this came from. */
  value: string
  /** Human-readable explanation. Always set for 'nearest' and 'none'. */
  note?: string
  /** For 'nearest': what it nearly matched, and how far off. */
  nearest?: { token: string; tokenValue: string; distance: number; unit: 'deltaE' | 'px' | 'ratio' }
  /** Why this result exists; downstream code never infers it from confidence. */
  provenance: MatchProvenance
  /** Present when several live tokens remain tied after intent precedence. */
  ambiguity?: MatchAmbiguity
}

export type MatchOptions = {
  /** Emit bg-[#a1b2c3] when nothing matches. Default true. */
  allowArbitrary: boolean
  /** Emit classes for layout props (flex, items-center…). Default true. */
  includeLayout: boolean
  /** ΔE and px tolerances; defaults per "Context". */
  tolerance: { colorNearest: number; lengthExactPx: number; lengthNearestPx: number }
}

/** The main entry point. */
export function matchDeclarations(
  css: Record<string, string>,
  tokens: TokenSet | null,
  options?: Partial<MatchOptions>,
  hints?: Record<string, VariableHint>,   // keyed by CSS property
): MatchResult[]

/** Sorted, deduped class string. `nearest` is structurally ineligible. */
export function toClassName(results: MatchResult[]): string
```

Prefixing and core-plugin availability come from `tokens.source`, never from a
separate caller option. Apply a known v3 string prefix exactly as configured
(`tw-` + `bg-red-500` → `tw-bg-red-500`); apply a known v4 variant prefix as
`tw:bg-red-500`. If prefix status is `unknown`, return `none` for every utility.
Before returning either a named or arbitrary class, map the CSS property to its
v3 core-plugin name and honor `source.corePlugins`; a disabled/unknown utility
returns `none` without suppressing other utilities that share the token map.

Copy `packages/match/fixtures/css/*.json` from plan 000's recorded Dev Mode
captures and retain source hashes in a fixture manifest. Prose examples are not
an acceptable substitute.

Create `src/types.test.ts` rather than pretending the task-7 engine exists. It
constructs fully populated exact and nearest `MatchResult` values, asserts the
exact result may carry a class, and asserts the nearest result has
`className: null` plus distance and provenance. This gives Vitest a meaningful
first test while leaving implementation ownership with tasks 2–7.

**Check**: `pnpm --filter @fig-tail/match typecheck` and the contract test pass;
temporarily giving the nearest fixture a class makes the contract test fail.

### Step 2: Implement shorthand expansion and the confidence plumbing

Before any matching: normalise the input.

- `padding: 24px` → four longhands; `padding: 16px 24px` → the four-value
  expansion; same for `margin`, `border-radius`, `inset`.
- `border: 1px solid #E5E7EB` → `border-width`, `border-style`, `border-color`.
- `background: #FFF` → `background-color` when the value is a plain colour;
  leave gradients as `background` and let the matcher return `none` for now.
- Normalise colours to a canonical form (lowercase 8-digit hex or an
  `{r,g,b,a}` record) before comparison; `#FFF`, `#ffffff`, `rgb(255 255 255)`
  and `white` must all compare equal.
- Do not drop reset declarations just because they resemble defaults.
  `font-style: normal` and `text-decoration: none` can override inherited
  styling and map to `not-italic` / `no-underline`. Emit them when a Tailwind
  utility is required to reproduce the reported CSS. Drop only declarations
  proven redundant within the same normalized declaration set (for example a
  border style with no border width and no visible border).

Then implement the **collapse rules**: four equal longhands collapse back to
`p-6`, not `pt-6 pr-6 pb-6 pl-6`. Vertical/horizontal pairs collapse to
`px-6 py-4`. Do this after matching, on the results, so partial matches still
collapse correctly.

**Check**: `pnpm --filter @fig-tail/match test -t expand` → passes, with cases
for 1/2/3/4-value shorthands, the `border` shorthand, five colour notations
comparing equal, and each collapse rule (including the case where three sides
match a token and one does not, which must **not** collapse).

### Step 3: Implement the colour matcher

Per "Colour distance" above. Handles the property→prefix mapping
(`background-color`→`bg`, `color`→`text`, `border-color`→`border`,
`fill`→`fill`, `stroke`→`stroke`, `outline-color`→`outline`), the alpha
modifier, and the full confidence ladder including `exact-variable` from a hint.

**Check**: `pnpm --filter @fig-tail/match test -t color` → passes, including:
`#3b82f6` → `bg-brand-500` (`exact-value`); a hint with
  `codeSyntax: "brand-500"` becomes `exact-variable` only when that token exists
  and its value equals the CSS value; an unrelated or stale WEB syntax falls
  back to value matching with a note; `#3b82f1` → `nearest` with a populated
  `nearest` field and a ΔE
under 2.0; `#a1b2c3` → `arbitrary` `bg-[#a1b2c3]`; `rgba(59,130,246,0.5)` →
`bg-brand-500/50`; `allowArbitrary: false` turns the `#a1b2c3` case into `none`.

### Step 4: Implement the length matchers (spacing, sizing, radius, border width)

Per "Spacing: two different problems". One shared numeric core, several
property→prefix maps. Include the special cases: `rounded-full` for radii
≥9999px, `w-full` for `100%`, `w-px`/`p-px` for 1px, `0` → `p-0`.

**Check**: `pnpm --filter @fig-tail/match test -t length` → passes, run against
**both** fixture token sets (v3 and v4), including: 24px → `p-6` under both;
25px → `nearest` `p-6` with `distance: 1, unit: 'px'`; 2px → `p-0.5` under v4;
a named `spacing.gutter` token beating the numeric step; and a v3 fixture where
the enumerated scale has a gap the v4 multiplier would have filled (assert
they differ, and that the difference is correct rather than a bug).

### Step 5: Implement the typography matcher

`font-size` (paired with `line-height` when the token carries one — emit
`text-sm` alone rather than `text-sm leading-5` when the token's line-height
already matches), `font-weight` (numeric → named token), `font-family` (match
against the token's `primary` family, not the whole stack), `letter-spacing`,
plus the static ones (`text-align`, `text-transform`, `text-decoration`).

**Check**: `pnpm --filter @fig-tail/match test -t typography` → passes,
including the paired case (14px/20px against a `text-sm` token defining both →
one class), the unpaired case (14px/24px → `text-sm leading-6`), and
`font-family: Inter` matching a token whose stack is
`["Inter","ui-sans-serif","system-ui"]`.

### Step 6: Implement the layout, shadow, and effects matchers

- **Layout**: static lookup tables. `display: flex` → `flex`;
  `flex-direction: column` → `flex-col`; `align-items: flex-start` →
  `items-start`; `justify-content: space-between` → `justify-between`;
  `align-self: stretch` → `self-stretch`. Always `exact-value`.
- **Shadow**: normalise whitespace and colour notation in the `box-shadow`
  string, then compare against normalised token values. Exact or arbitrary —
  no nearest, because "nearly the same shadow" is not a useful signal and the
  distance metric would be arbitrary.
- **Effects**: `opacity` → nearest step, `overflow`, `mix-blend-mode`,
  `position`, `z-index`.

**Check**: `pnpm --filter @fig-tail/match test -t layout`,
`-t shadow`, `-t effects` → all pass. Include a shadow case where the token and
the Figma value differ only in colour notation
(`rgba(16,24,40,0.05)` vs `rgb(16 24 40 / 0.05)`) and must still match exactly.

### Step 7: Wire `matchDeclarations` and `toClassName`, and sort output

Compose the matchers, apply collapse rules, dedupe, and sort by the canonical
ordinal table. `toClassName` joins with single spaces, always excludes `nearest`,
and applies the major-specific prefix exactly once. Implement the documented tie
precedence and preserve ambiguity/provenance in the result list.

Then run the whole thing against every copied plan-000 CSS fixture and snapshot
the results; the three prose excerpts remain the named smoke cases.

**Check**: `pnpm --filter @fig-tail/match test -t integration` → passes. The card
fixture from "Context" must produce exactly:

```
flex flex-col items-start gap-4 self-stretch rounded-xl border border-gray-200 bg-white p-6 shadow-xs
```

(adjust token names to whatever the v4 fixture theme actually defines — but
assert the *exact* string, and assert the ordering, not just set membership).

### Step 8: Add a coverage report helper

Export `summarise(results: MatchResult[]): MatchSummary` returning counts per
confidence level and the list of unmatched properties. Plan 006's linter is
built on this; plans 004 and 005 use it to decide whether to show a warning banner.

Also add the **no-config test** here: run `matchDeclarations` over all three
captured fixtures with `tokens: null`, and assert that supported values produce
generic `arbitrary` results with a note saying they are not config-confirmed,
layout utilities still resolve, and nothing throws.

Add the **unknown-namespace test**, which is safety-critical: build a
`TokenSet` that *has* a full colour palette but lists `colors` in
`unknownNamespaces`, and assert that `background: #3b82f6` returns
`bg-[#3b82f6]` and **never** a token name — even though a matching token is
sitting right there in the map. Add the disabled-core-plugin variant too, which
must return `none` rather than an arbitrary value. If either of these regresses,
fig-tail starts emitting dead classes into other people's codebases. This is plan
003's tier 3, and it is the difference between "the plugin works with no setup"
and "the plugin crashes with no setup".

Add a **partial-namespace test** from plan 001's exact-version gate: explicit
project tokens in that namespace may match, but absent bundled defaults must fall
to arbitrary output with a note that defaults were withheld.

**Check**: `pnpm --filter @fig-tail/match test -t summarise` and
`-t no-config`, `-t unknown-namespace`, and `-t availability` → pass. The
availability suite covers known v3 and v4 prefixes, unknown prefix, a disabled
`backgroundColor` with an enabled `textColor`, and `corePlugins.mode: unknown`.
Then `pnpm --filter @fig-tail/match coverage` enforces statements, lines, and
functions ≥90% plus branches ≥85% over `src/**/*.ts` (excluding tests).

## Validation plan

- **Unit tests per matcher**, as each step's Check describes. Table-driven —
  a `cases.ts` array of `{input, tokens, expected}` per matcher keeps them
  dense and readable.
- **Integration snapshots** against every copied plan-000 `getCSSAsync()` fixture,
  run against both the v3 and the v4 token set.
- **Property-based test** (fast-check, dev dependency): for any colour in the
  token set, feeding its own hex back in must produce `exact-value` and the
  correct class. Same for every length token. This catches whole classes of
  rounding and key-flattening bugs that hand-written cases miss.
- **Bundle size probe**: run `probe:browser`, which freshly bundles all runtime
  dependencies into one minified browser artifact, then asserts under 60 kB.
  The publishable library output may externalize dependencies and is not a valid
  plugin-cost measurement.
- **No-Figma assertion**: a test that greps the built bundle for the strings
  `figma.` and `@figma/` and fails if either appears. This package must stay
  runnable in plain Node.

## Done criteria

ALL must hold.

- [ ] `pnpm -r typecheck && pnpm -r lint && pnpm -r build && pnpm -r test` → exit 0
- [ ] Every property group in the "Property coverage" table is implemented, or
      explicitly returns `none` with a note explaining why
- [ ] All six confidence levels are reachable and each has at least one test
- [ ] `tokens: null` produces labelled generic arbitrary results for supported
      values, still resolves layout utilities, and never throws
- [ ] A namespace in `unknownNamespaces` yields arbitrary values **even when
      matching tokens are present in the map** — tested explicitly
- [ ] A partial namespace matches explicit project tokens but never an absent
      bundled default, and labels that reduced coverage
- [ ] A namespace unknown because its core plugin is disabled yields `none`, not
      an arbitrary value
- [ ] An unresolved `prefix` never produces unprefixed class names
- [ ] v3 and v4 prefixes render with their distinct documented syntax, and a
      disabled core plugin suppresses only its own utility family
- [ ] `nearest` results populate report data, always have `className: null`, and
      cannot enter `toClassName` through any public or internal option
- [ ] Every result carries typed provenance/hint status; duplicate exact values
      follow the documented precedence and expose ambiguity after fallback ties
- [ ] The integration snapshot for the card fixture matches the exact expected
      class string, in canonical order
- [ ] Vitest fails below statements/lines/functions 90% or branches 85%
- [ ] The fresh fully bundled browser probe, including runtime dependencies, is
      under 60 kB minified
- [ ] The bundle contains no reference to `figma.` or `@figma/`
- [ ] `packages/theme` is unchanged
      (`git diff --exit-code "$(git merge-base HEAD main)"..HEAD -- packages/theme`
      → exit 0 on the plan branch)
- [ ] `plans/README.md` status row for 002 updated

## STOP conditions

Stop and report back — do not improvise — if:

- **The token schema from plan 001 is missing something a matcher needs.**
  Changing it is a breaking change for plan 003, which stores and validates it.
  Report what is missing and what you would add; do not edit `packages/theme`.
- Canonical RGBA equality cannot be made stable across the v3/v4 fixture corpus,
  or a non-identical color reaches `exact-value`. Exact matching must remain
  equality-based; do not loosen it to a ΔE threshold to make tests pass.
- The bundle exceeds **100 kB** minified even after tree-shaking culori. The
  fallback is a cheaper colour metric (weighted RGB distance) at the cost of
  perceptual accuracy — implement it behind a flag so the measurement is real,
  then report both numbers and let the owner choose. Do not silently downgrade
  the metric; the ΔE thresholds in "Context" are calibrated for CIEDE2000 and
  would need recalibrating.
- Implementing the shadow matcher requires per-layer decomposition to be useful
  at all. Scope it out and report rather than growing the plan.
- A step's check fails twice after a reasonable attempt.

## Handoff / after it lands

- **Plan 004** wires this to `getCSSAsync()` and `node.boundVariables`. The
  `hints` parameter is the seam — 004 is responsible for resolving variable IDs
  to `VariableHint` objects.
- **Plan 005** (the Inspect-panel surface) and **plan 006** (the linter) both
  build on `summarise()` and the `nearest` field. Do not remove or rename
  either without checking both.
- **Plan 008** calls `matchDeclarations` per node while walking a tree. It needs
  this to stay fast — see the caching note below.
- **What a reviewer should scrutinise most**: the boundary between `exact-value`
  and `nearest`. Everything about this system's trustworthiness lives in that
  threshold. Too loose and it lies; too tight and every design reads as drifted.
  Ask to see the ΔE values for adjacent steps in the real palette.
- **Deliberately deferred**:
  - *Responsive variants and state variants* (`md:`, `hover:`). Figma inspect
    exposes one static state per node; there is no signal to derive them from.
    Revisit only if Figma exposes variant/breakpoint metadata.
  - *Gradient matching.* `linear-gradient` returns `none` for now. Tailwind's
    gradient utilities need from/via/to decomposition, which is a plan of its
    own if anyone asks for it.
  - *Per-layer shadow matching.* See STOP conditions.
  - *Result caching.* Matchers are pure, so memoising on
    `(property, value, tokensHash)` is safe and easy. Do not add it until plan
    008 shows it is needed — premature caching here would obscure correctness
    bugs during the phase when they are cheapest to find.
