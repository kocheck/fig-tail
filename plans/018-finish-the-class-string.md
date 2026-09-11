# Plan 018: Finish the class string — spaces, and properties with nothing to say

> **Executor instructions**: Two independent defects, both deliberately deferred
> by plan 012. Step 1 is a small fix with a large blast radius; Step 2 is a design
> decision with a small fix attached. Do them in that order.

## Status

- **Priority**: P1 (Step 1 is arguably P0 — see below)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 012
- **Category**: bug
- **Grounded at**: `93fafd2` — 2026-09-10
- **Serves**: [GOAL-developer-adoption.md](GOAL-developer-adoption.md) condition 3

## Why this exists

Plan 012 deferred two defects, in writing, to "the next thing after it" and to
"plan 015's subject". Plan 015 does not take either — its scope is the manifest,
the UI panels and the docs. Both were left owned by nobody, on the condition the
goal calls the whole product. This plan owns them.

### Defect 1 — an arbitrary value containing a space shreds the whole string

There is **no space escaping anywhere in `@fig-tail/match`**. The only whitespace
handling is `matchers/shadow.ts:21`, which collapses runs *within* a value.
`toClassName` joins with a single space (`index.ts:188`), so any arbitrary value
containing one breaks into fragments:

```
rgba(59, 130, 246, 0.5)  →  bg-[rgba(59,  130,  246,  0.5)]
                            └── four garbage tokens in the class attribute
```

This corrupts **every other class in the string**, not just its own. Figma emits
spaced `rgba(...)` — see the `box-shadow` value in
`fixtures/figma/css/dev/card-exact.json` — so it fires on ordinary content. Same
for `font-['Helvetica Neue']` via `matchers/typography.ts`.

It is pre-existing, it is arguably higher-impact than the near-miss defect 012
fixed (it hits every non-token shadow), and **012 Steps 2–3 widened its reach** to
near-miss `rgba` fills. Tailwind's own convention for this is an underscore.

### Defect 2 — properties with no match are invisible under one preference

`confidence: 'none'` is returned for any property outside the supported sets
(`index.ts:100-106`) plus genuine no-match cases — gradients (`color.ts:149-156`),
disabled core plugins (`color.ts:160-168`, `length.ts:109-117`).

**This is less broken than plan 012 implied**, and the difference matters. `'none'`
*is* in `ATTENTION_CONFIDENCE` (`codegen/render.ts:6`), so it always produces a
drift line. It is invisible only when the second section is dropped — under
**Output → Classes**. Plan 012's Step 6 deliberately narrowed section retention to
filter-nulled results, because retaining on every `none` would fire on nearly
every node (real `getCSSAsync` output routinely includes `position`,
`box-sizing`, `overflow`) and make the preference a no-op.

So the question is not "how do we stop `none` being silent" — it usually isn't.
It is: **what should a developer see, under `Classes`, when part of their
selection had nothing to offer?**

## Context the executor needs

- `toClassName` (`index.ts:184-189`) and `summarise` (`summarise.ts:9-15`) both
  join with `' '`. Any escaping must apply to both, or codegen and Inspect
  disagree.
- Arbitrary values are built in at least four places: `color.ts:207` and `:275`,
  `length.ts:155` and `:284`, plus `shadow.ts:65` and `typography.ts:72`. A fix
  applied at one site leaves the others broken. `grep -n '\-\[\$' packages/match/src`
  finds them.
- `applyPrefix` (`availability.ts:15`) wraps a class *after* it is built, so
  escaping belongs inside the value interpolation, before the prefix.
- Tailwind reads `_` in an arbitrary value as a space. Escaping is not lossy, but
  it **is** a behaviour change to a published package's output.
- `ATTENTION_CONFIDENCE` at `render.ts:6` is `['nearest', 'arbitrary', 'none']`.

## Scope

**In scope**: `packages/match/src/matchers/*.ts` (value interpolation only),
`packages/match/src/index.ts` and `summarise.ts` if a shared helper is used,
`packages/plugin/src/codegen/render.ts` and `mode-dev.ts` for Step 2, tests for
both, `CHANGELOG.md`, and `docs/release/ux-findings-2026-09-10.md`.

**Out of scope**:
- **The confidence ladder.** No new values.
- **Which properties are supported.** Widening `index.ts:100-106` is a different
  plan with a different justification.
- **The near-miss behaviour.** Plan 012 owns it.
- **Anything in the Inspect panel beyond the joined string.** Plan 015.

## Steps

### Step 1: Escape spaces in every arbitrary value

Write one helper that takes a raw CSS value and returns it safe for a Tailwind
arbitrary bracket, and use it at **every** site that builds `-[…]`. Do not
hand-patch individual matchers.

Find the sites first (`grep -n '\-\[' packages/match/src/matchers/`) and list them
in the commit message, so a reviewer can confirm none was missed.

**Check**: a test asserts that a fill of `rgba(59, 130, 246, 0.5)` produces a
single token containing no space, and that `toClassName` over a result set
containing it returns a string whose `split(' ')` length equals the number of
results with classes. A second test does the same for a font family with a space.
`pnpm check` exits 0.

### Step 2: Decide what `Classes` says when nothing could be emitted

Under **Output → Classes**, a developer sees the primary section only. Decide, and
record the reasoning, between:

- **Leave it.** `none` is usually an unsupported property Figma volunteered, not
  something the developer asked about. The preference means "just the classes",
  and the drift section is one preference away. Cheapest, and defensible.
- **Retain the section when a *supported* property produced nothing** — a gradient
  fill, a disabled core plugin — while staying silent for properties outside the
  supported sets. This distinguishes "we looked and there's nothing" from "we
  don't handle this", which is the distinction a developer actually cares about.
  Needs a way to tell the two apart; `index.ts:100-106` returns a distinct note
  (`Unsupported property …`), so the information exists.

**Recommended: the second**, because "your gradient produced no class" is
actionable and "we don't do `position`" is noise, and today they are identical.
But it is a judgment call about someone else's panel — record the choice.

**Check**: whichever is chosen, a test pins it. If the second: a gradient fill
under `{ outputNotes: false }` returns two sections; a node whose only non-emitting
results are unsupported properties returns one.

### Step 3: Close the findings

Update `docs/release/ux-findings-2026-09-10.md` — the space-escaping defect
becomes a numbered finding if it is not already, and both are marked resolved with
the commit SHA. Note in `CHANGELOG.md` that `@fig-tail/match`'s arbitrary-value
output changed shape.

**Check**: no finding in that document still describes either defect as open.

## Validation plan

- **Unit**: Steps 1 and 2's tests, following the conventions in
  `matchers/color.test.ts`.
- **Whole gate**: `pnpm check` → exit 0.
- **In-product**: select a layer with a non-token `box-shadow`. The primary
  section is one paste-able string with no stray fragments. This is worth adding
  to plan 011's Step 9 observation list if 011 has not yet run.
- **Acceptance**: a developer can select any layer, copy the primary section, and
  paste it without reading it. That is condition 3, and Steps 1 and 2 are the last
  known obstacles to it.

## Done criteria

- [ ] Every `-[…]` construction site uses the shared escaping helper; the commit
      message lists them.
- [ ] A test proves the token count of a joined string equals the class count.
- [ ] Step 2's choice is recorded with reasoning and pinned by a test.
- [ ] `pnpm check` exits 0.
- [ ] Both findings closed; `CHANGELOG.md` notes the output change.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- **Escaping changes a class that currently works.** A token-named class should be
  byte-identical before and after; only arbitrary values change.
- **A matcher builds `-[…]` somewhere the grep did not find it.** Report rather
  than patching ad hoc — a missed site is the whole defect, still live.
- **Step 2's second option needs a `MatchResult` shape change.** That ripples into
  the linter and plan 015; it is a decision, not an implementation detail.

## Handoff / after it lands

- **Condition 3 has no further known code obstacle.** If the pilot still finds
  developers hand-checking, the cause is something nobody has identified yet, and
  that is worth knowing plainly.
- **Plan 011 Step 9** should add a spaced-value node to its observations.
- **A reviewer should scrutinise** the site list in Step 1's commit message. The
  defect is "one site was missed", so the list is the evidence.
