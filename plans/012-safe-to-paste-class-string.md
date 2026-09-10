# Plan 012: Make the class string safe to paste without checking it

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. If anything in "STOP conditions" occurs,
> stop and report — do not improvise.
>
> **Drift check (run first)**:
> `git diff --stat abb2c1b..HEAD -- packages/match/src packages/plugin/src`
> If those paths changed since `abb2c1b`, re-verify every line citation below
> before editing. Citations are to `abb2c1b`.

## Status

- **Priority**: P0
- **Effort**: M
- **Risk**: MED — changes the primary output of the product
- **Depends on**: **013** (GO). Plan 011's Steps 2–10 depend on this, not the
  reverse — see "Ordering against plan 011".
- **Category**: bug
- **Grounded at**: `abb2c1b` — 2026-09-10
- **Serves**: [GOAL-developer-adoption.md](GOAL-developer-adoption.md) condition 3

## Why this matters

When a design value is *close to* a token but not exact, fig-tail emits
**nothing at all** for that property. Not the token, not the raw value — the
property vanishes from the copyable class string. A card whose fill is 0.8 ΔE
from `brand-500` produces a string with no background utility in it.

The developer pastes it, gets an unstyled box, fixes it in devtools, and learns
that fig-tail's output needs checking every time. At that point the plugin is
slower than reading Figma's CSS panel directly, and the goal — paste without
hand-checking — is unreachable.

It also cuts against the program's own invariant, `plans/README.md:54-56`:

> **Fallbacks fail toward raw values**, never toward a guessed token name — see
> invariant 2. A wrong class name in someone else's codebase is a silent no-op
> they cannot debug.

Failing toward *nothing* is not failing toward a raw value.

**Intent, for judgment calls**: the developer must never receive a class string
that is quietly incomplete. Either the property is in the string, or the panel
says it was left out. Never neither.

## DECISION REQUIRED — this plan contradicts accepted disposition F01

`plans/REVIEW-DISPOSITIONS-2026-07-31.md:12`, in full:

> | F01 | ACCEPT | Remove every `acceptNearest` path. **Near matches are
> report-only data and never enter copyable class output.** |

Step 4 makes a `nearest`-confidence result carry a class into copyable output.
Under the literal wording of F01's second sentence, that is a reversal of an
accepted review disposition, and no executor should quietly decide it.

**The argument for superseding it**: F01's live concern was `acceptNearest` —
emitting `bg-brand-500` when the fill is not `brand-500`, which puts a *wrong
token name* into someone's codebase, where it compiles and silently renders the
wrong colour. This plan does not do that. `nearest.className` stays report-only
and is never emitted; what enters the string is `bg-[#3b82f1]`, the design's own
value, which is what invariant 2 prescribes. (Lower-case: `canonicalColour`
  at `normalise.ts:139-152` lowercases 6-digit hex before matching, so anything
  through `matchDeclarations` emits `#3b82f1`. A test written with upper-case hex
  goes red for the wrong reason.) F01 and invariant 2 are in tension
only because F01's wording bundles two things — the token name and the property's
presence — that this plan separates.

**The argument against**: F01 was accepted as written, and "never enter copyable
class output" is not ambiguous. If the owner reads it as binding, this plan
cannot proceed in this shape, and the alternative is Step 6 alone — signal the
omission, emit nothing — which leaves the developer hand-editing every near miss.

**Status: UNDECIDED.** Do not start Step 2 until the owner records a decision
here. If F01 is upheld, execute Steps 1, 6, 7 and 8 only, and re-scope.

## DECISION 2 — `className` vs a new `rawClassName` field

An independent review argued for a different shape, strongly enough that the
owner should choose rather than the executor.

**This plan's approach**: set `className` to the raw value at the five sites, keep
`confidence: 'nearest'`, remove both filters.

**The alternative**: add an optional `rawClassName` to `MatchResult`, set it at the
five sites, leave `className: null`, and have the join sites do
`r.className ?? r.rawClassName`.

The alternative is additive and dissolves four problems this plan must otherwise
solve: `types.test.ts:5`'s codified contract stays true; `collapseSides`' bail on
`nearest` (Step 4a) can collapse on `rawClassName` without misstating confidence;
`classifyResult` is untouched; and `ui/main.tsx:148`'s `className ?? note` can show
the raw class *and* keep the near-token note instead of losing it (Step 5b). It
also puts the decision at the join — one place — which states this plan's own
layering argument better than nulling in two places does.

Its cost: a change to `MatchResult`, a published type in `@fig-tail/match@0.1.0`.
Additive optional fields are low-risk but it is still a public shape change.

**Status: UNDECIDED.** Steps below assume this plan's approach. If the alternative
wins, Steps 2–4 change shape and Steps 4a and 5b largely disappear.

## Ordering against plan 011

Plan 011 verifies the current build and forbids `src` changes so that what it
measures does not move. That discipline is right, and it argues for running
**this plan first**: 011 is L-effort and human-only, and its Step 9 records the
exact class strings this plan changes. Verifying a build already slated to change
means measuring an archaeological record and then measuring again.

Recommended: land 012, then run 011 against the build that will actually ship.
011 Step 9's near-miss observation then confirms the *fix* rather than the defect.
If 011 has already run, re-run its Steps 7 and 9 after this lands.

Under the series order (`plans/README.md`), this plan runs **before** 011's Steps
2–10 and after 011's Step 0.

## Context the executor needs

### The behaviour lives in four places, not three

**1. The matchers null the class name.** Five production sites return
`confidence: 'nearest'` (line cited) with `className: null` on the line *above*:

| File | `className: null` | `confidence: 'nearest'` | Case |
|---|---|---|---|
| `packages/match/src/matchers/length.ts` | 189 | 190 | v4 spacing multiplier (`matchV4Multiplier`) |
| `packages/match/src/matchers/length.ts` | 215 | 216 | spacing **scale** (`tokens.spacing.scale`) |
| `packages/match/src/matchers/length.ts` | 230 | 231 | **named** spacing (`tokens.spacing.named`) |
| `packages/match/src/matchers/length.ts` | 259 | 260 | radius (`tokens.radius`) — the only radius site |
| `packages/match/src/matchers/color.ts` | 258 | 259 | colour within ΔE tolerance |

Each is an early `return`, taken *before* the arbitrary-value fallback further
down the same function. So no raw value is ever produced.

**2. `toClassName` filters them out.** `packages/match/src/index.ts:183-189`.
The function opens at line 184; **the filter is line 186**:

```ts
    .filter((result) => result.confidence !== 'nearest' && result.className)
```

**3. `summarise` has a second, identical filter.**
`packages/match/src/summarise.ts:12` — same predicate, different code path:

```ts
        .filter((result) => result.confidence !== 'nearest' && result.className)
```

This is the one that feeds the **Inspect panel**. Fixing only `toClassName`
fixes codegen and leaves Inspect broken. Both must change together.

**4. The preference can hide the only remaining signal.**
`packages/plugin/src/mode-dev.ts:78`:

```ts
const result = options.outputNotes ? sections : sections.slice(0, 1)
```

`outputNotes` is false when the **Output** preference is `Classes`
(`mode-dev.ts:26`). So with that preference the drift section — the one place a
near-miss is mentioned — is dropped, and the string is incomplete with no signal.

### The two surfaces do not filter the same way

- **Codegen** applies `applyCodegenFilters` then calls `toClassName`
  (`mode-dev.ts:75-76`).
- **Inspect** calls `toClassName` and `summarise` on **unfiltered** results
  (`packages/plugin/src/pipeline.ts:39`).

So preference-based filtering already only affects codegen. Step 5 widens that
divergence and Step 5a addresses it. `packages/plugin/src/pipeline.consistency.test.ts`
asserts the two paths agree; read its doc comment before touching either.

### The pattern to follow

`applyCodegenFilters` (`packages/plugin/src/mode-dev.ts:48-57`) already solves
this for two other cases, by setting `className: null` **at the plugin layer**
and leaving the matcher's result intact — so the value still appears in drift.
That is the right seam: "what a user prefers to copy" is a preference concern,
not a matcher concern. The near-miss case is the one that nulls at the matcher
layer, where no preference can reach it.

### Constraints

- **`applyPrefix` returns `string | null`** (`packages/match/src/availability.ts:15`).
  The model to copy is **`color.ts:275-282`**, which calls `applyPrefix` and does
  `confidence: className ? 'arbitrary' : 'none'`. Do **not** copy `color.ts:205-212`
  — that is the `!tokens` branch, it never calls `applyPrefix`, and it is
  unreachable from the near-miss site.
- **When `applyPrefix` returns null, keep `confidence: 'nearest'` and
  `className: null`.** Do not degrade to `'none'`: the drift linter gates on
  `result.confidence === 'nearest' && result.nearest`
  (`packages/plugin/src/lint/types.ts:65`), and degrading would silently delete a
  high-severity finding.
- **`result.nearest` must survive untouched** — it is what `formatAttentionLine`
  renders (`packages/plugin/src/codegen/render.ts:10-18`) and what the linter reads.
- **The primary section stays clean.** `renderCodegenPrimary` (`render.ts:21`)
  returns the bare string. No comments or markers — a developer may copy the whole
  body, and a CSS comment inside a `className` is a silent no-op.

## Inputs & resources

| Purpose | Command | Expected |
|---|---|---|
| Full gate | `pnpm check` | exit 0 |
| Match tests | `pnpm --filter @fig-tail/match test` | all pass |
| Plugin tests | `pnpm --filter @fig-tail/plugin test` | all pass |

**Tests that will fail and must be triaged** (Step 4):
`packages/match/src/summarise.test.ts:30-38` — `'excludes nearest results from
className'`, asserting `toClassName(results)).toBe('')`. That test asserts the
bug. Also review `packages/match/src/types.test.ts:5`, whose name
(`'allows exact results to carry a class while nearest must be null'`) becomes
false even though it still passes — it asserts on a hand-built literal.

**`applyCodegenFilters` currently has no test at all** —
`grep -rn "applyCodegenFilters" --include=*.test.ts packages/` returns nothing.

## Scope

**In scope**:

- `packages/match/src/matchers/length.ts`, `matchers/color.ts` — the five sites.
- `packages/match/src/index.ts` — `toClassName`.
- `packages/match/src/summarise.ts` — the duplicate filter.
- `packages/plugin/src/mode-dev.ts` — `applyCodegenFilters`, and extracting the
  section-selection logic so it can be tested (Step 6).
- `packages/plugin/src/codegen/render.ts` — the omission section (Step 6).
- Tests for all of the above, including `summarise.test.ts` and `types.test.ts`
  where this change makes an assertion or a test name false.
- `README.md` (the table at lines 43–51) and `docs/troubleshooting.md` (lines 36–39).
- `packages/match/README.md:14` — "Near matches are reported, never silently
  promoted to named classes." The published npm README for a package whose
  observable behaviour changes.
- `fixtures/figma/README.md:25-26` — the expectations table says `Colour / near` →
  "(empty primary)" and `Spacing / near` → "(empty for padding)". Plan 011 Step 9
  reads that table, so leaving it stale misdirects the verification run.
- `CHANGELOG.md` — `toClassName`'s contract changes and `@fig-tail/match` publishes
  from a tag-triggered workflow.
- `packages/plugin/notes/` and `docs/release/` evidence rows — **Step 0 only**, to
  mark superseded measurements STALE.
- `docs/release/ux-findings-2026-09-10.md` — mark V1 resolved.
- `plans/README.md` — this plan's status row.

**Out of scope**:

- **New confidence values** (`packages/match/src/types.ts`). `nearest` keeps its
  meaning; only what it emits changes.
- **`nearest.className`** — the near token stays report-only. This is the part of
  F01 that is *not* superseded.
- **The Inspect panel's badges and result rows** (`ui/main.tsx`) — plan 015.
- **The drift linter's logic** (`packages/plugin/src/lint/`). It reads
  `confidence` and `nearest`, both preserved. Confirm with a test; do not edit.
- **`@fig-tail/theme`.**

## Working approach

Branch `fix/near-miss-raw-values`. `pnpm check` green before each commit
(`plans/EXECUTOR-GUIDE.md:198-204`), **except Steps 1 and 4**, which commit known
red states and must say so in the commit message.

## Steps

### Step 0: Mark plan 011's affected evidence STALE

If plan 011 has already recorded rows, this change invalidates some of them and
**011 forbids itself from noticing** — its drift check does not cover
`packages/match/src`, and its evidence rows carry no build SHA.

Grep `packages/plugin/notes/` and `docs/release/` for recorded evidence whose
subject this plan changes — at minimum `docs/release/feature-audit.md` rows for
the confidence ladder, codegen classes/preferences, and Inspect parity. Mark each
`STALE — re-measure per plan 011 step N (superseded by 012)`.

If 011 has not run, note that here and skip.

**Check**: no evidence row describing class-string output still reads as current
without a SHA that is an ancestor of this branch.

### Step 1: Write the failing tests first

Add to `matchers/color.test.ts` and `matchers/length.test.ts`:

- A near-miss colour returns `confidence: 'nearest'`, `nearest.className` naming
  the near token, and `className` holding the prefixed raw value.
- The same for each of the four length cases in the table above.
- When `applyPrefix` returns null: `confidence: 'nearest'`, `className: null`,
  `nearest` intact.

Add to `index.test.ts` and `summarise.test.ts`:

- `toClassName` and `summarise().className` both include a near-miss raw value.
- Neither output contains the near token's name (`brand-500`). *Note*
  `packages/match/src/integration.test.ts:16-28` already asserts this for the
  card fixture and will keep passing — the new assertion covers the near path.

Create `packages/plugin/src/mode-dev.test.ts`:

- `applyCodegenFilters` with `allowArbitrary: false` nulls a `nearest` className
  while leaving `confidence` and `nearest` intact.
- The Step 6 section-selection function (which does not exist yet — Step 6
  creates it) keeps a second section when a property was omitted.

**Check**: both test commands fail; every failure names a new test; the
`mode-dev.test.ts` failures are import/compile errors for the not-yet-created
Step 6 export, which is expected and must be stated in the commit message.
Commit red.

### Step 2: Emit the raw value from the colour matcher

`packages/match/src/matchers/color.ts:258` — replace `className: null` with the
prefixed arbitrary value, modelled on `color.ts:275-282`. Keep
`confidence: 'nearest'`, keep `nearest`, keep `note`. On a null prefix, leave
`className: null` and keep `confidence: 'nearest'`.

**Check**: `pnpm --filter @fig-tail/match test` — Step 1's colour tests pass.

### Step 3: Emit the raw value from the length matcher

Same at all four sites: `length.ts:189, 215, 230, 259` (the `className: null`
lines). Confirm you found every one with:

```
grep -n -B1 "confidence: 'nearest'" packages/match/src/matchers/length.ts
```

`-B1` matters — without it the grep prints only the `confidence:` lines and can
never show you a remaining `className: null`.

**Check**: the grep shows no `className: null` above a `confidence: 'nearest'`
except the intentional null-prefix path; Step 1's length tests pass.

### Step 4: Remove both filters

`packages/match/src/index.ts:186` and `packages/match/src/summarise.ts:12` —
drop the `result.confidence !== 'nearest'` condition from each, keeping the
`result.className` truthiness check. Update the doc comment at `index.ts:183`,
which says "nearest results are structurally excluded" and becomes false.

Then triage every failing test. For each, decide and record in the commit
message: was it asserting the **bug** (property vanishes) or the **invariant**
(token name never emitted)? Update the first; never weaken the second.
`summarise.test.ts:30-38` is the known case and is asserting the bug.

**Check**: `pnpm --filter @fig-tail/match test` passes in full **after** triage.
The commit message lists each test changed and which category it fell into.

### Step 4a: Decide what happens to collapsed shorthands

`packages/match/src/index.ts:116` — `collapseSides` bails when any side is
`nearest` or `none`:

```ts
if (sides.some((side) => !side?.className || side.confidence === 'nearest' || side.confidence === 'none')) {
```

Step 4 does not change this, so after the fix a near-miss `padding: 25px` expands
to four sides and emits `pb-[25px] pl-[25px] pr-[25px] pt-[25px]` rather than
`p-[25px]`. Four utilities for one property — on `Spacing / near`, the headline
node for the goal's condition 3, and measurably worse to paste than the `p-6` that
`Card / exact` produces for the same property shape.

Relaxing the bail is not free: `collapseSides` builds the collapsed result at
`index.ts:139-144` **without copying `note` or `nearest`**, so a collapsed
`nearest` would carry neither — `classifyResult` returns null (the linter finding
vanishes) and `formatAttentionLine` prints a bare `padding: nearest`.

Either accept the 4× expansion and say so, or relax the bail **and** propagate
`note`/`nearest`. Pick one; record why.

**Check**: a test asserts
`toClassName(matchDeclarations({ padding: '25px' }, { tokens: baseTokenSet() }))`
against the chosen behaviour — end to end, not on a hand-built array, because
matcher-level tests never reach `collapseSides`. If collapsing, a second test
asserts the collapsed result still classifies as a `nearest` finding.

### Step 4b: Deal with the third copy of the filter

`packages/match/src/normalise.ts:163` holds the same bail inside an exported
`collapseBox`. It is **dead production code** — its only non-test reference is its
own definition (`index.ts` uses `collapseSides`) — and it ships in the published
bundle. Delete it, or align it with the Step 4a decision. Do not leave a third
divergent copy of the rule.

**Check**: `collapseBox` is gone, or matches `collapseSides` and a test says so.

### Step 5: Let the preference layer decide

`packages/plugin/src/mode-dev.ts:53-55` — extend the `allowArbitrary` branch to
also null `className` when `confidence === 'nearest'`. A developer who turned
arbitrary values off does not want `bg-[#3b82f1]` either.

### Step 5b: Do not silently drop the near-token note in Inspect

`packages/plugin/src/ui/main.tsx:148` renders `r.className ?? r.note ?? '—'`.
Today a near-miss row shows the note. After Step 2 it shows `bg-[#3b82f1]` and
**the note disappears from that row**, because `InspectPayload` never carries
`nearest` (`mode-dev.ts:160-165`). The radius near-miss (`length.ts:259`) is the
only one of the five with no `note` at all, so for that case the near token
becomes invisible in Inspect entirely.

`ui/main.tsx` is out of scope here, but "out of scope" does not mean "unchanged".
Either add `nearest` to `InspectPayload` so the row shows both, or record the
regression in writing for plan 015. Do not leave it implicit.

**Check**: the choice is recorded in `docs/release/ux-findings-2026-09-10.md`.

### Step 5a: Decide what Inspect does

Inspect calls `toClassName`/`summarise` on unfiltered results
(`pipeline.ts:39`), so it ignores `allowArbitrary` today — for arbitrary values
as well as near misses. This plan does not have to fix that, but it must not
pretend it isn't there.

Record in `packages/plugin/notes/` which behaviour is intended, and add a test to
`pipeline.consistency.test.ts` that pins the *current* divergence so a future
change is deliberate. If the divergence looks wrong to you, that is a finding for
plan 015, not a fix here.

**Check**: `pnpm --filter @fig-tail/plugin test` — the filter test passes; the
consistency test documents the divergence explicitly.

### Step 6: Never hide an omission

`mode-dev.ts:78` sits inside the `figma.codegen.on('generate')` closure
(`mode-dev.ts:68-92`) and cannot be tested. **Extract the decision into an
exported function** — taking the pre-filter results, the post-filter results, the
rendered sections and the options, returning the sections to show. Put it in
`mode-dev.ts` beside `applyCodegenFilters`, and have line 78 call it.

Retain the second section, regardless of `outputNotes`, when **a property that
had a class lost it to the filters** — that is, a result whose matcher
`className` was non-null and whose filtered `className` is null. This is
deliberately narrower than "anything incomplete": `confidence: 'none'` results
are routine (every unsupported property on a node — `typography.ts:164-170`,
`effects.ts:51-57`, `layout.ts:64-72` and `74-82`, `shadow.ts:33-40`), and
retaining on those would fire on nearly every node and make the **Output →
Classes** preference a no-op.

When retained for this reason under `Classes`, render a section listing only the
omitted properties. That needs a new renderer in `codegen/render.ts` — titles are
chosen at `render.ts:71` and bodies built at `render.ts:29-52`; do not try to
retitle an already-rendered section.

**The `none` case is deliberately deferred**, and that is a real gap: a property
no matcher supports is still silently absent. It is recorded as a follow-up in
"Handoff" rather than solved here, because solving it well means deciding what an
unsupported property should say to a developer, which is plan 015's subject.

**Check**: `pnpm --filter @fig-tail/plugin test` — with `outputNotes: false`,
`allowArbitrary: false` and a near-miss, two sections are returned and the second
names the omitted property. With `outputNotes: false` and a result set whose only
non-emitting entries are `confidence: 'none'`, one section is returned.

### Step 7: Make the documentation true

`README.md:50` reads:

> | Nearest | Close to a token — reported as a note, **not** emitted as that token |

True but incomplete — it never said the property disappeared. Rewrite it to say
the raw value is emitted and the near token is reported. `README.md:49` ("Class
is safe to paste") becomes defensible for the whole string; leave it.

`docs/troubleshooting.md:36-39` is **prose, not a table**, headed "Near
colours/spacing never become classes", and says "Near matches are reported in
drift notes only". That claim becomes false. Rewrite the section.

**Check**: `grep -in "near" README.md docs/troubleshooting.md` — case-insensitive,
because the troubleshooting heading is lowercase "Near" and a `"Nearest"` grep
misses it entirely. No surviving sentence says a near match is reported *only* as
a note.

### Step 8: Close out

Mark V1 resolved in `docs/release/ux-findings-2026-09-10.md` with the commit SHA.
If plan 011 Step 0 surfaced anything about near-miss output, note it.
Update this plan's status row at `plans/README.md`.

**Check**: V1 says resolved and names the commit; the status row reads DONE.

## Validation plan

- **Unit**: Step 1's tests, red before and green after, following the conventions
  in `matchers/color.test.ts`.
- **Fixtures**: `colour-near.json` and `spacing-near.json` exist at
  `packages/match/fixtures/css/` and **are imported by nothing** —
  `integration.test.ts:4` imports only `card-exact.json`. Wiring them into
  `integration.test.ts` is real work, assigned to Step 1, not a pre-existing
  assertion to amend.
- **Whole gate**: `pnpm check` → exit 0.
- **In-product** (with or as part of 011): select `Colour / near` in Dev Mode; the
  primary section contains a `bg-[…]` utility. Switch **Output** to `Classes`;
  the string is unchanged and a second section still names anything omitted.
- **Acceptance**: the owner reads the primary section for a near-miss node and can
  tell, without opening the config, whether the string is complete.

## Done criteria

- [ ] Both decisions above are recorded, and this plan matches them.
- [ ] Any plan-011 evidence this change supersedes is marked STALE (Step 0).
- [ ] All five near-miss sites emit a prefixed raw value, or keep
      `confidence: 'nearest'` with a null class when the prefix cannot apply.
- [ ] **Both** `index.ts:186` and `summarise.ts:12` filters are gone, and
      `index.ts:183`'s doc comment no longer claims exclusion.
- [ ] `applyCodegenFilters` nulls `nearest` when `allowArbitrary` is off, and has
      a test — it had none before.
- [ ] The section-selection logic is an exported, tested function.
- [ ] A test asserts the near token's name never appears in emitted output.
- [ ] The codegen/Inspect divergence is documented and pinned by a test.
- [ ] `colour-near.json` and `spacing-near.json` are consumed by a test.
- [ ] `pnpm check` exits 0.
- [ ] `README.md:50` and `docs/troubleshooting.md:36-39` describe the new behaviour.
- [ ] V1 resolved; `plans/README.md` status row updated.

## STOP conditions

- **The F01 decision is still UNDECIDED.** Steps 2–5 do not start.
- **A pre-existing test asserts a near-miss emits the near token's name.** That
  contradicts the part of F01 this plan upholds. Report it; change nothing.
- **Step 6's extraction would require changing `MatchResult`.** That shape is
  consumed by the linter, subtree export and plan 015 — a decision, not an
  implementation detail.
- **`applyPrefix` behaves differently** from the pattern at `color.ts:275-282`.
- **`pnpm check` fails for a reason unrelated to this change.**

## Handoff / after it lands

- **Arbitrary values containing spaces corrupt the whole string, and this plan
  does not fix it.** There is no space escaping in `@fig-tail/match` — the only
  `\s` replace is `shadow.ts:21`, which collapses runs *within* a value.
  `toClassName` joins with `' '` (`index.ts:188`), so a fill of
  `rgba(59, 130, 246, 0.5)` emits `bg-[rgba(59, 130, 246, 0.5)]` and shreds into
  four garbage tokens — corrupting every other class in the string, not just its
  own. Same for `font-['Helvetica Neue']`. Pre-existing, arguably higher-impact
  than the near-miss (it hits every non-token shadow), squarely inside "safe to
  paste", roughly a three-line fix. **Deliberately not folded in** — this plan
  already carries two undecided design questions — it is **plan 018 Step 1**, and
  Steps 2–3 widen its reach to near-miss rgba fills.
- **The `none` gap remains.** Unsupported properties still vanish silently from
  the string. Step 6 narrows deliberately to keep `Output → Classes` meaningful;
  closing it properly is **plan 018 Step 2** — which also establishes that the gap
  is narrower than it looks, since `none` is in `ATTENTION_CONFIDENCE` and is
  invisible only under the `Classes` preference.
- **Plan 015** inherits the badge inversion (V3): `badge-exact-variable`,
  `badge-exact-value` and `badge-name-match` match no CSS rule, while `arbitrary`
  renders in danger-red. Once near misses carry real classes, that inversion gets
  worse, not better.
- **Plan 011 Step 9** observes this behaviour in-product, against the fixed build.
- **A reviewer should scrutinise** Step 4's triage hardest — which assertions were
  updated and why — and Step 6's retention condition, which is where narrowing it
  to make a test pass would silently hollow out the plan.
