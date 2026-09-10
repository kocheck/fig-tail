# Plan 012: Make the class string safe to paste without checking it

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. If anything in "STOP conditions" occurs,
> stop and report — do not improvise. When done, update the status row for this
> plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat abb2c1b..HEAD -- packages/match/src packages/plugin/src/codegen packages/plugin/src/mode-dev.ts`
> If those paths changed since `abb2c1b`, re-read "Current state" and confirm the
> line citations still point where this plan says before editing.

## Status

- **Priority**: P0
- **Effort**: M
- **Risk**: MED — changes the primary output of the product
- **Depends on**: plan 011 Step 9 (the in-product observation), but see "If 011 has not run"
- **Category**: bug
- **Grounded at**: `abb2c1b` — 2026-09-10
- **Serves**: [GOAL-developer-adoption.md](GOAL-developer-adoption.md) condition 3 —
  developers paste class strings without hand-checking them

## Why this matters

When a design value is *close to* a token but not exact, fig-tail currently emits
**nothing at all** for that property. Not the token, not the raw value — the
property vanishes from the copyable class string. A card whose fill is 0.8 ΔE
from `brand-500` produces a string with no background utility in it.

The developer pastes it, gets an unstyled box, and learns that fig-tail's output
must be checked by hand every time. At that point the plugin is slower than
reading Figma's CSS panel directly, and the goal — paste without hand-checking —
is unreachable. This is the single behaviour most likely to end the pilot.

It also violates the program's own invariant. `plans/README.md:54-56`:

> **Fallbacks fail toward raw values**, never toward a guessed token name — see
> invariant 2. A wrong class name in someone else's codebase is a silent no-op
> they cannot debug.

Failing toward *nothing* is not failing toward a raw value. The invariant was
written to prevent exactly this class of silent no-op, and the near-miss path
walks into it from the other side.

**Intent, for judgment calls**: the developer must never receive a class string
that is quietly incomplete. Either the property is in the string, or the panel
tells them it was left out. Never neither.

## Context the executor needs

### Current state — the three places this behaviour lives

**1. The matchers null the class name.** Five production sites return
`confidence: 'nearest'` with `className: null`:

- `packages/match/src/matchers/length.ts:190, 216, 231, 260`
- `packages/match/src/matchers/color.ts:259`

Each is an early `return`, taken *before* the arbitrary-value fallback further
down the same function. So no raw value is ever produced. For comparison,
`color.ts:205-212` shows the shape of an arbitrary return that the near-miss path
never reaches.

**2. The joiner filters them out.** `packages/match/src/index.ts:183-189`:

```ts
/** Join copyable classes; nearest results are structurally excluded. */
export const toClassName = (results: MatchResult[]): string => {
  const classes = results
    .filter((result) => result.confidence !== 'nearest' && result.className)
```

**3. The preference can hide the only remaining signal.**
`packages/plugin/src/mode-dev.ts:78`:

```ts
const result = options.outputNotes ? sections : sections.slice(0, 1)
```

`outputNotes` is false when the **Output** codegen preference is set to
`Classes` (`mode-dev.ts:25`). So with that preference, the drift section — the
one place a near-miss is mentioned — is dropped entirely, and the developer gets
an incomplete string with no signal whatsoever.

### The pattern this fix should follow

`applyCodegenFilters` (`packages/plugin/src/mode-dev.ts:47-57`) already solves
this exact problem for two other cases. Its own comment:

> when `includeLayout` is off, layout utilities are dropped from the copyable
> string (but kept, with their original confidence, for the drift/notes section);
> when `allowArbitrary` is off, arbitrary-value classes are dropped from the
> copyable string but still reported as drift.

It does that by setting `className: null` **at the codegen layer**, leaving the
matcher's result intact. That is the right seam: policy about what a *user
prefers to copy* belongs to the preference layer, not to the matcher, which
should report what it found.

The near-miss case is the one that nulls at the matcher layer, where no
preference can reach it.

### Constraints that bound the fix

- **`applyPrefix` can return null.** `packages/match/src/availability.ts:15`:
  `(tokens: TokenSet | null, className: string) => string | null`. Existing code
  handles this — `length.ts:158` does `confidence: className ? 'arbitrary' : 'none'`.
  The new arbitrary values must handle it the same way.
- **The `nearest` metadata must survive.** `result.nearest` (tokenKey, className,
  delta, deltaUnit) is what `formatAttentionLine` renders
  (`packages/plugin/src/codegen/render.ts:10-18`) and what the drift linter
  consumes. This plan changes `className`, never `nearest`.
- **A near token must still never be emitted as if it were exact.** That rule is
  not being relaxed. `nearest.className` (e.g. `bg-brand-500`) stays report-only;
  what enters the copyable string is the **raw value** (`bg-[#3B82F1]`), which is
  what the design actually specifies.
- **The primary section must stay clean.** `renderCodegenPrimary`
  (`render.ts:21`) returns the bare class string. Do not add comments or markers
  to it — a developer may copy the whole body, and a CSS comment inside a
  `className` is a silent no-op. Signal about omissions belongs in the second
  section, which Step 6 makes unsuppressable.

### If 011 has not run

Plan 011 Step 9 asks for an in-product observation of exactly this behaviour on
the `Colour / near` and `Spacing / near` nodes. That observation confirms the
reading above. **If 011 is blocked**, this plan may still proceed on the code
evidence, which is unambiguous — but record in the PR that the fix shipped
without in-product confirmation of the original defect, and run the Step 9
observation against the *fixed* build instead.

## Inputs & resources

| Purpose | Command | Expected on success |
|---|---|---|
| Full gate | `pnpm check` | exit 0 |
| Match tests only | `pnpm --filter @fig-tail/match test` | all pass |
| Plugin tests only | `pnpm --filter @fig-tail/plugin test` | all pass |
| Plugin build | `pnpm --filter @fig-tail/plugin build` | `dist/main.js` + `dist/ui.html` |

Existing tests that already cover `nearest` and will need review:
`packages/match/src/index.test.ts`, `integration.test.ts`, `normalise.test.ts`,
`summarise.test.ts`, `types.test.ts`, `matchers/color.test.ts`,
`matchers/length.test.ts`, `matchers/length.edge.test.ts`.

## Scope

**In scope**:

- `packages/match/src/matchers/length.ts`, `matchers/color.ts` — the five near-miss returns.
- `packages/match/src/index.ts` — `toClassName`.
- `packages/plugin/src/mode-dev.ts` — `applyCodegenFilters` and the section slice.
- `packages/plugin/src/codegen/render.ts` — the omission signal (Step 6 only).
- Tests alongside each of the above.
- `README.md` and `docs/troubleshooting.md` — the confidence table, which
  currently describes the old behaviour.
- `docs/release/ux-findings-2026-09-10.md` — mark V1 resolved.

**Out of scope** (do NOT touch, even though they look related):

- **The confidence ladder itself** (`packages/match/src/types.ts`). No new
  confidence values. `nearest` keeps its meaning; only what it emits changes.
- **`nearest.className`** — the near token stays report-only. Emitting it is the
  one thing the program has consistently refused to do (`REVIEW-DISPOSITIONS-2026-07-31.md`
  finding F01: "Remove every `acceptNearest` path"). Do not reintroduce it.
- **The Inspect panel's badges and result rows** (`packages/plugin/src/ui/main.tsx`).
  Legibility is plan 015; this plan is about the class string only.
- **The drift linter** (`packages/plugin/src/lint/`). It consumes `nearest` and is
  unaffected — confirm that with tests rather than editing it.
- **`@fig-tail/theme`.** Nothing here touches theme resolution.

## Working approach

Branch `fix/near-miss-raw-values`. One commit per step. `pnpm check` must pass
before each commit (per `plans/EXECUTOR-GUIDE.md:198-204`) — except Step 1, which
deliberately commits failing tests and must say so in the commit message.

## Steps

### Step 1: Write the failing tests first

Encode the intended behaviour before changing any production code, so the fix is
verified by tests that were red for the right reason.

Add to `packages/match/src/matchers/color.test.ts` and `matchers/length.test.ts`:

- A near-miss colour produces `confidence: 'nearest'`, `nearest.className`
  pointing at the near token, **and** a `className` holding the raw value
  (`bg-[#3B82F1]` shape, prefix applied when the config has one).
- A near-miss length does the same for spacing and for radius.
- When `applyPrefix` returns null, the result is `confidence: 'none'` with
  `className: null` — matching the existing pattern at `length.ts:155-160`.

Add to `packages/match/src/index.test.ts`:

- `toClassName` includes a `nearest` result's raw-value class in the joined string.

Add to `packages/plugin/src/codegen/render.test.ts` (or a new
`mode-dev.test.ts` if filters are not covered there):

- With `allowArbitrary: false`, `applyCodegenFilters` nulls a `nearest` className
  while leaving `confidence` and `nearest` intact.
- A `nearest` result still appears in the drift section either way.

**Check**: `pnpm --filter @fig-tail/match test` and
`pnpm --filter @fig-tail/plugin test` both fail, and every failure names one of
the new tests. No pre-existing test fails yet. Commit the red tests.

### Step 2: Emit the raw value from the colour matcher

At `packages/match/src/matchers/color.ts:259`, replace `className: null` with the
prefixed arbitrary value for the design's own colour — the same shape the
`!tokens` branch builds at `color.ts:205-212`, but keeping
`confidence: 'nearest'` and the whole `nearest` object. Handle a null
`applyPrefix` result as described in Step 1.

Leave the `note` intact; it is what tells the developer a near token exists.

**Check**: `pnpm --filter @fig-tail/match test` — the colour tests from Step 1
pass; no other test regresses.

### Step 3: Emit the raw value from the length matcher

Same change at all four sites: `length.ts:190, 216, 231, 260`. These cover named
spacing, the spacing scale, named radius and the radius scale — confirm you have
all four by re-running
`grep -n "confidence: 'nearest'" packages/match/src/matchers/length.ts` and seeing
no remaining `className: null` beside one.

**Check**: `pnpm --filter @fig-tail/match test` — the length tests from Step 1
pass; no other test regresses.

### Step 4: Stop filtering `nearest` out of the joined string

`packages/match/src/index.ts:184` — drop the `result.confidence !== 'nearest'`
condition, leaving the `result.className` truthiness check. Update the doc
comment above it, which currently reads "nearest results are structurally
excluded" and will now be false.

**Check**: `pnpm --filter @fig-tail/match test` passes in full. Any pre-existing
test that asserted the *old* exclusion now fails — treat each one as a decision:
if it encoded "no token name for a near miss" it should still pass; if it encoded
"nothing at all for a near miss" it is asserting the bug and should be updated,
with the reason in the commit message.

### Step 5: Let the preference layer decide

`packages/plugin/src/mode-dev.ts:53-55` — extend the `allowArbitrary` branch so it
also nulls `className` for `confidence === 'nearest'`. A developer who has turned
arbitrary values off does not want `bg-[#3B82F1]` either.

Do not touch `includeLayout`; a near-miss on a layout property is already handled
by the property-name check above it.

**Check**: `pnpm --filter @fig-tail/plugin test` — the filter tests from Step 1
pass. With `allowArbitrary: true` a near-miss class survives; with `false` it is
nulled and still present in the results array.

### Step 6: Never hide an omission

`packages/plugin/src/mode-dev.ts:78` currently drops the second section whenever
the **Output** preference is `Classes`. That is right for routine notes and wrong
when the string the developer is about to copy is incomplete.

Change it so the second section is kept, regardless of the preference, whenever
any result was omitted from the copyable string — that is, any result with a
non-null matcher `className` that the filters nulled, plus any result whose
confidence is `nearest` or `none` with no class to emit. When the section is
retained for this reason and the preference asked for classes only, title it so
the reason is obvious (for example `Omitted`), and list only the omitted
properties rather than the full drift report.

Do **not** put a marker in the primary section — see "Constraints".

**Check**: `pnpm --filter @fig-tail/plugin test` — with
`{ outputNotes: false, allowArbitrary: false }` and a near-miss result, two
sections are returned and the second names the omitted property. With
`{ outputNotes: false }` and no omissions, one section is returned, exactly as
before.

### Step 7: Make the documentation true

`README.md:66-71` describes the confidence outcomes. The `Nearest` row currently
reads "Close to a token — reported as a note, **not** emitted as that token",
which was true and is now incomplete: it never said the property disappeared, and
after this change it must say that the raw value is emitted instead. Update it,
and the parallel table in `docs/troubleshooting.md:36-39`.

While here, `README.md:68` says an exact match is "safe to paste" — that claim is
now defensible for the whole string, which is the point of this plan. Leave it.

**Check**: `grep -n "Nearest" README.md docs/troubleshooting.md` shows wording
that matches the new behaviour, and no remaining sentence claims a near-miss is
reported *only* as a note.

### Step 8: Close out the finding

In `docs/release/ux-findings-2026-09-10.md`, mark V1 resolved with the commit SHA.
If plan 011 Step 9 recorded an in-product observation, note whether it matched
this plan's reading of the code.

**Check**: the V1 section states resolved, names the commit, and either cites the
011 observation or says it had not run.

## Validation plan

- **Unit**: the tests from Step 1, which were red before the fix and green after.
  Follow the existing conventions in `matchers/color.test.ts` and
  `matchers/length.test.ts`.
- **Integration**: `packages/match/src/integration.test.ts` already exercises the
  `colour-near.json` and `spacing-near.json` fixtures — the two fixtures built for
  exactly this case. Assert that their joined class strings now contain a raw
  value for the near-miss property.
- **Whole gate**: `pnpm check` → exit 0.
- **In-product** (after 011, or as part of it): select `Colour / near` in Dev
  Mode. The primary section contains a `bg-[…]` utility. Switch **Output** to
  `Classes`: the string is unchanged and a second section still names what was
  omitted, if anything was.
- **Acceptance**: a developer reading the primary section can tell, without
  opening the config, whether they are getting everything. Confirmed by the owner.

## Done criteria

- [ ] All five near-miss sites emit a prefixed raw value, or `none` when the
      prefix cannot be applied.
- [ ] `toClassName` no longer filters on `confidence === 'nearest'`, and its doc
      comment no longer claims it does.
- [ ] `applyCodegenFilters` nulls `nearest` classes when `allowArbitrary` is off.
- [ ] The second section is never dropped when a property was omitted from the
      copyable string.
- [ ] `nearest.className` is still never emitted into the copyable string —
      verified by a test that asserts the token name is absent from the output.
- [ ] `pnpm check` exits 0.
- [ ] `README.md` and `docs/troubleshooting.md` describe the new behaviour.
- [ ] V1 marked resolved in `docs/release/ux-findings-2026-09-10.md`.
- [ ] Nothing outside the in-scope list was changed.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back — do not improvise — if:

- **A pre-existing test asserts that a near-miss emits the near token's name.**
  That would contradict finding F01 and this plan's out-of-scope list, and means
  someone's understanding is wrong. Do not change it either way; report it.
- **The fix would require a new confidence value** to express. It should not; if
  it seems to, the design has drifted and needs a second look.
- **`applyPrefix` behaviour turns out to differ** from the null-handling pattern
  at `length.ts:155-160`.
- **Step 6 cannot distinguish "omitted" from "nothing to say"** without changing
  the `MatchResult` shape. Changing that shape affects plans 015 and the linter,
  so it is a decision, not an implementation detail.
- **`pnpm check` fails for a reason unrelated to this change.** Report it rather
  than fixing it here — a green baseline is what makes this plan's own result
  meaningful.

## Handoff / after it lands

- **Plan 015** consumes this. Once a near-miss carries a real class, the Inspect
  panel's badges have something to label, and the current inverted colour scheme
  (arbitrary rendered in danger-red) becomes actively misleading rather than
  merely odd.
- **Plan 016** (the pilot) depends on this shipping. Condition 3 of the goal is
  not testable while a near-miss silently drops a property.
- **A reviewer should scrutinise** the Step 4 test decisions hardest: which
  pre-existing assertions were updated, and whether each was asserting the bug or
  asserting the invariant. That is where a wrong call is easiest to hide.
- **Deliberately deferred**: the drift linter's treatment of near-misses. It
  reads `nearest`, which is unchanged, so it should be unaffected — but nobody has
  run it against the new output at scale. Plan 011 Step 7's measurement should be
  repeated after this lands.
