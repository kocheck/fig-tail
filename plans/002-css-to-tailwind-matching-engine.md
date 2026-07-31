# Plan 002: Build the CSS→Tailwind matching engine

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
> **Drift check (run first)**:
> `git diff --stat <the SHA at which plan 001 completed>..HEAD -- packages/theme`
> If the token schema in `packages/theme` has changed since plan 001 landed,
> re-read it before starting; the shapes quoted in this plan may be stale.

## Status

- **Priority**: P1
- **Effort**: L — the largest plan in the program. It is also the most testable:
  pure functions, no I/O, no Figma.
- **Risk**: MED — the risk is not "does it run" but "does it produce the right
  class". Wrong-but-plausible output is worse than no output, which is why the
  confidence ladder in Step 2 exists.
- **Depends on**: 001
- **Category**: dx
- **Grounded at**: the commit at which plan 001 landed.

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

Plan 004 will call `node.getCSSAsync()`, which returns the same CSS the Dev Mode
Inspect panel displays, as a flat string→string object. Real examples:

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
- `font-style: normal` and similar no-op declarations should produce **no class
  at all**, not `not-italic`. Emitting defaults is noise.
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

If plan 007 has stamped that variable, `codeSyntax.WEB` is literally
`"bg-brand-500"` — the exact class the codebase uses, with **zero inference**.
If it has not been stamped, the variable's *name* (`brand/500`) is still a much
better matching key than a hex value.

So the engine's entry point takes an optional per-property hint:

```ts
type VariableHint = {
  /** Variable.codeSyntax.WEB if present — an exact, authored answer. */
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
| `exact-variable` | A bound Figma variable carried a `codeSyntax.WEB` value. Authored by a human, not inferred. | `bg-brand-500` |
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
every project on earth. `bg-blue-500` compiles to **nothing** in a project that
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

### The empty token set must work

Plan 003 defines a tier-3 state: **no Tailwind config at all**. In that state the
plugin still runs, with an empty `TokenSet`, and every value falls through to
`arbitrary` — `bg-[#3b82f6]`, `p-[24px]`. That is exactly what every other
Figma→Tailwind plugin produces, so fig-tail is never *worse* than the
alternatives for someone who has just installed it, and the surfaces show a
banner explaining how to get real token names.

So: `matchDeclarations` must accept a `TokenSet` with empty token maps and
return sensible `arbitrary` results without special-casing at the call site. Do
not throw, do not return `[]`, and do not require the caller to check first.
Layout utilities (`flex`, `items-center`) are unaffected by an empty theme and
must still resolve exactly. Step 7 tests this.

### Never promote a near-miss

`nearest` **must never be silently promoted to a class**. The result carries
both the suggested class *and* the fact that it is not an exact match; it is
plan 004's, 005's and 006's job to display that difference. A caller that ignores
confidence gets a correct-looking wrong answer, so make the type force the
issue — return the class and the confidence together, never a bare string.

### Colour distance

Comparing colours by RGB Euclidean distance is wrong: it does not match human
perception and will pick visually distant tokens over near ones. Use
**CIEDE2000 (ΔE₀₀)**, via `culori`'s `differenceCiede2000()`.

Thresholds, configurable but with these defaults:

- ΔE ≤ **0.5** → treat as `exact-value` (absorbs rounding and 8-bit truncation)
- ΔE ≤ **2.0** → `nearest` (a "just noticeable difference" is ~1.0; 2.0 catches
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
| Coverage | `pnpm --filter @fig-tail/match test -- --coverage` | ≥90% statements in `src/matchers` |
| Bundle size probe | `pnpm --filter @fig-tail/match build && du -b packages/match/dist/index.js` | under 60 kB minified |

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
- `packages/match/fixtures/**` — captured `getCSSAsync()` outputs used as test
  input (hand-written JSON is fine; see Step 1)
- Adding `@fig-tail/match` to the workspace and root scripts

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

export type MatchResult = {
  /** The Tailwind class, e.g. "bg-brand-500". Null when confidence is 'none'. */
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
}

export type MatchOptions = {
  /** Emit bg-[#a1b2c3] when nothing matches. Default true. */
  allowArbitrary: boolean
  /** Emit classes for layout props (flex, items-center…). Default true. */
  includeLayout: boolean
  /** Treat 'nearest' as a match and emit the class. Default FALSE. */
  acceptNearest: boolean
  /** Class prefix from the theme, e.g. "tw" → "tw:bg-brand-500". When plan 001
   *  could not resolve the prefix it marks every namespace unknown, so this
   *  being null never results in silently unprefixed output. */
  prefix: string | null
  /** ΔE and px tolerances; defaults per "Context". */
  tolerance: { colorExact: number; colorNearest: number; lengthExactPx: number; lengthNearestPx: number }
}

/** The main entry point. */
export function matchDeclarations(
  css: Record<string, string>,
  tokens: TokenSet,
  options?: Partial<MatchOptions>,
  hints?: Record<string, VariableHint>,   // keyed by CSS property
): MatchResult[]

/** Convenience: sorted, deduped class string from results. */
export function toClassName(results: MatchResult[]): string
```

Also create `packages/match/fixtures/css/*.json` — start with the three real
`getCSSAsync()` outputs quoted in "Context" above, saved verbatim.

**Check**: `pnpm --filter @fig-tail/match typecheck` → exit 0, and a placeholder
test asserting `matchDeclarations({}, tokens)` returns `[]` passes.

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
- Drop no-op declarations (`font-style: normal`, `text-decoration: none`,
  `border-style: solid` when there is no width) — return nothing, not a class.

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
`codeSyntax: "bg-brand-500"` short-circuits to `exact-variable` without any
colour maths; `#3b82f1` → `nearest` with a populated `nearest` field and a ΔE
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
ordinal table. `toClassName` joins with single spaces and applies the prefix.

Then run the whole thing against the three captured fixtures from Step 1 and
snapshot the results.

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

Also add the **empty-token-set test** here: run `matchDeclarations` over all
three captured fixtures with a `TokenSet` whose token maps are empty, and assert
that every value produces an `arbitrary` result with a valid class, that layout
utilities still resolve `exact-value`, and that nothing throws.

And the **unknown-namespace test**, which is the safety-critical one: build a
`TokenSet` that *has* a full colour palette but lists `colors` in
`unknownNamespaces`, and assert that `background: #3b82f6` returns
`bg-[#3b82f6]` and **never** a token name — even though a matching token is
sitting right there in the map. Add the disabled-core-plugin variant too, which
must return `none` rather than an arbitrary value. If either of these regresses,
fig-tail starts emitting dead classes into other people's codebases. This is plan
003's tier 3, and it is the difference between "the plugin works with no setup"
and "the plugin crashes with no setup".

**Check**: `pnpm --filter @fig-tail/match test -t summarise` and
`-t empty-tokens` → pass, and `pnpm --filter @fig-tail/match test -- --coverage`
reports ≥90% statement coverage in `src/matchers`.

## Validation plan

- **Unit tests per matcher**, as each step's Check describes. Table-driven —
  a `cases.ts` array of `{input, tokens, expected}` per matcher keeps them
  dense and readable.
- **Integration snapshots** against the three captured `getCSSAsync()` fixtures,
  run against both the v3 and the v4 token set.
- **Property-based test** (fast-check, dev dependency): for any colour in the
  token set, feeding its own hex back in must produce `exact-value` and the
  correct class. Same for every length token. This catches whole classes of
  rounding and key-flattening bugs that hand-written cases miss.
- **Bundle size probe**: `du -b packages/match/dist/index.js` under 60 kB
  minified. If culori pulls in too much, switch to importing from `culori/fn`
  and re-measure.
- **No-Figma assertion**: a test that greps the built bundle for the strings
  `figma.` and `@figma/` and fails if either appears. This package must stay
  runnable in plain Node.

## Done criteria

ALL must hold.

- [ ] `pnpm -r typecheck && pnpm -r lint && pnpm -r test` → exit 0
- [ ] Every property group in the "Property coverage" table is implemented, or
      explicitly returns `none` with a note explaining why
- [ ] All six confidence levels are reachable and each has at least one test
- [ ] An empty `TokenSet` produces `arbitrary` results for every value, still
      resolves layout utilities exactly, and never throws
- [ ] A namespace in `unknownNamespaces` yields arbitrary values **even when
      matching tokens are present in the map** — tested explicitly
- [ ] A namespace unknown because its core plugin is disabled yields `none`, not
      an arbitrary value
- [ ] An unresolved `prefix` never produces unprefixed class names
- [ ] `nearest` results always populate the `nearest` field, and never emit a
      class unless `acceptNearest: true`
- [ ] The integration snapshot for the card fixture matches the exact expected
      class string, in canonical order
- [ ] Statement coverage in `src/matchers` ≥90%
- [ ] `packages/match/dist/index.js` is under 60 kB minified
- [ ] The bundle contains no reference to `figma.` or `@figma/`
- [ ] `packages/theme` is unchanged
      (`git diff --stat <base> -- packages/theme` → empty)
- [ ] `plans/README.md` status row for 002 updated

## STOP conditions

Stop and report back — do not improvise — if:

- **The token schema from plan 001 is missing something a matcher needs.**
  Changing it is a breaking change for plan 003, which stores and validates it.
  Report what is missing and what you would add; do not edit `packages/theme`.
- The ΔE thresholds produce obviously wrong matches against the real fixture
  theme — e.g. two palette steps in the same family fall within ΔE 0.5 of each
  other, making `exact-value` ambiguous. That means the thresholds need
  redesigning (probably: prefer exact hex equality first, and only fall back to
  ΔE), which is a design decision to surface, not to guess at.
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
