# Plan 015: Make the product tell the truth about itself

> **Executor instructions**: Follow each step and confirm its **Check**. Where a
> step says delete a claim, delete the claim — do not implement the feature to
> make the claim true. That is a different plan with a different cost.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 013 (GO). Best done after 012 so the README rewrite is one pass.
- **Category**: docs, dx
- **Grounded at**: `abb2c1b` — 2026-09-10
- **Serves**: [GOAL-developer-adoption.md](GOAL-developer-adoption.md) conditions 1, 3, 4

## Why this matters

Three things the product currently claims are not true, and a developer will hit
all three in the first hour:

1. **`README.md:64`** — "Export a Markdown table from Tools for reviews." The
   Markdown is generated (`lint/run-lint.ts:21`) and never displayed:
   `ui/main.tsx:160-171` returns `state.status` before it ever reaches
   `state.exportCode`, and lint always sets a status.
2. **The drift linter shows a count and nothing else.** Findings are fully
   computed with node names, severities and nearest tokens
   (`lint/run-lint.ts:8`), passed to the UI, and discarded —
   `ui/main.tsx:400` renders `N findings · N nodes · Nms`. `lint/dismiss.ts`
   implements dismissal end to end and **has zero callers**.
3. **`plans/README.md:442`** credits plan 003 with mitigating config staleness
   via "a stored timestamp and a staleness warning." The timestamp exists
   (`storage.ts:226`). The warning does not exist anywhere —
   `grep -rn "stale|out of date|days ago" packages/plugin/src/ui/ packages/plugin/src/codegen/`
   returns nothing.

Plus `subtreeFormat` ships as a user-flippable dropdown in
`packages/plugin/manifest.json` (Off / HTML / JSX / Outline) for a feature nobody
has run at scale. A curious developer will flip it. There is no "off switch" for a
manifest preference — the only way to not ship it is to not declare it.

**Intent**: a developer should be able to trust every sentence the product says
about itself. A tool that over-claims once gets checked forever after — which is
the same failure mode as plan 012's, arriving through the docs instead of the
output.

## Context the executor needs

- **The linter is not in the manifest.** It is a button in the plugin's own UI.
  Only `subtreeFormat` is a `codegenPreferences` dropdown. (An earlier review
  claimed both; that was wrong, and it matters because the two need different
  treatment.)
- `toolOutContent()` at `ui/main.tsx:160-171` has a fixed precedence:
  `stampResult` → `status` → `exportCode` → JSON dump. Status wins, always.
- The confidence badge classes at `ui/main.tsx:148` are emitted as
  `badge-${confidence}`, and `Confidence` is
  `exact-variable | exact-value | name-match | nearest | arbitrary | none`
  (`match/src/types.ts:4-10`). `ui/styles.css:173-186` defines only
  `.badge-exact`, `.badge-nearest`, `.badge-arbitrary`, `.badge-none`. The three
  highest-confidence values match **no rule** and fall back to neutral, while
  `arbitrary` — the documented honest fallback — renders in
  `--figma-color-bg-danger-tertiary`, i.e. red. Red for what is fine, neutral for
  what is perfect.
- Button names in the docs do not exist in the UI: `README.md:29-30` and
  `docs/setup.md:22` say "Save on file" / "Save personal"; `ui/main.tsx:225-226`
  render **`Apply to file`** and **`Save personally`**. The same wrong names
  appear in `docs/troubleshooting.md:6-7, 58` and
  `packages/plugin/notes/storage-matrix.md:9, 29`.

## Scope

**In scope**: `packages/plugin/manifest.json`, `ui/main.tsx`, `ui/styles.css`,
`README.md`, `docs/setup.md`, `docs/troubleshooting.md`,
`packages/plugin/notes/storage-matrix.md`, `plans/README.md:442`, and tests for
the UI changes.

**Out of scope**:
- **Building the staleness warning.** Delete the claim; the fix is a real piece of
  work (the read cache never invalidates on another session's write —
  `storage.ts:246-252, 376-381`) and belongs to the plan that handles mid-pilot
  config changes.
- **The Markdown export feature.** Delete the claim, not the code.
- **`dismissFinding`.** Leave it unwired; rendering findings does not require
  dismissal, and wiring it is scope creep.
- **Subtree export's implementation.** Only its manifest exposure changes.
- **Near-miss class-string behaviour.** Plan 012.

## Steps

### Step 1: Stop shipping the subtree dropdown

Remove the `subtreeFormat` entry from `codegenPreferences` in
`packages/plugin/manifest.json`. Leave `tree/export.ts` and its tests alone — the
code stays, the user-facing switch goes.

`mode-dev.ts:25-29` reads `custom.subtreeFormat` and defaults to `'off'` when
absent, so removing the declaration should leave the branch inert. Confirm that
rather than assuming it.

**Check**: `pnpm --filter @fig-tail/plugin test` passes; a test asserts
`optionsFromPreferences({})` yields `subtreeFormat: 'off'`; the manifest declares
four preferences, not five.

### Step 2: Render the findings that already exist

Invert the precedence in `toolOutContent()` so a lint result displays its
findings rather than its summary line, and render the findings themselves — node
name, property, severity, nearest token where present — not just a count. Keep
the count; it is useful. Add a copy affordance for the panel, since `#tool-out`
currently has none (only `#inspect-copy` exists, at `ui/main.tsx:373-375`).

The Markdown at `lint/run-lint.ts:21` can now genuinely be surfaced. If you
surface it, `README.md:64` becomes true and Step 4 keeps that line. If you do not,
Step 4 deletes it. Either is fine; decide and be consistent.

**Check**: a test drives a lint payload with two findings through the UI's render
path and asserts both findings' node names appear in `#tool-out`. Record which
choice you made about the Markdown claim.

### Step 3: Fix the confidence badges

Add rules for `.badge-exact-variable`, `.badge-exact-value` and `.badge-name-match`
using the success colour that is already defined and never used. Re-tone
`.badge-arbitrary` off `--figma-color-bg-danger-tertiary` — it is the documented
honest fallback, not an error. Reserve the danger tone for `none`.

Also replace the raw enum text in the badge with human words; `exact-variable` is
an internal identifier appearing in the UI.

**Check**: every value in the `Confidence` union has a matching CSS rule — verify
by listing the union and grepping `styles.css` for each. No confidence value falls
back to the base class.

### Step 4: Make the docs describe what exists

- `README.md:29-30`, `docs/setup.md:22`, `docs/troubleshooting.md:6-7, 58`,
  `packages/plugin/notes/storage-matrix.md:9, 29` — "Save on file" → **Apply to
  file**, "Save personal" → **Save personally**.
- `README.md:64` — keep only if Step 2 surfaced the Markdown; otherwise delete.
- `README.md:60-62` — "scans the selection or page" implies the user chooses.
  They do not: `lint/run-lint.ts:6` always requests `scope: 'selection'`, and
  `lint/scan.ts:50-54` silently falls back to the whole page when nothing is
  selected. Say what it does, or make the fallback visible in the UI.
- `README.md:76` — the limitations list should also say hover, focus and dark-mode
  variants are not considered, since `breakpoints` are resolved into the token set
  (`theme/src/types.ts:153`) and consumed by no matcher.
- Remove any subtree-export mention that implies a user-facing preference.
- `plans/README.md:442` — strike the staleness-warning claim and replace it with
  what is actually true: the timestamp is stored, nothing surfaces it, and the read
  cache does not invalidate on another session's write.

**Check**: `grep -rin "save on file\|save personal\b" README.md docs/ packages/plugin/notes/`
returns nothing. Every remaining feature sentence in `README.md` names something a
developer can do in the build.

### Step 5: Re-read the README as a stranger

Read `README.md` top to bottom pretending you have never seen the plugin. For each
claim, name where in the product it is delivered. Anything you cannot point at is
either a bug to file or a sentence to cut.

**Check**: a written list of README claims → where each is delivered, committed
alongside. Anything unmatched is filed as a finding in
`docs/release/ux-findings-2026-09-10.md`.

## Validation plan

- **Unit**: the tests from Steps 1–3.
- **Whole gate**: `pnpm check` → exit 0.
- **Cross-check**: `docs/release/ux-findings-2026-09-10.md` findings V2, V3, V4
  and U12 are each marked resolved or explicitly deferred with a reason.
- **Acceptance**: the owner reads `README.md` and can point at every claim in the
  running plugin. That is the bar, and it needs the build in Figma — so this
  check completes during plan 011, not before it.

## Done criteria

- [ ] `subtreeFormat` is gone from the manifest and the default path is tested.
- [ ] Lint findings render; a test asserts finding text reaches the panel.
- [ ] Every `Confidence` value has a badge rule; `arbitrary` is not styled as danger.
- [ ] No doc names a button that does not exist.
- [ ] The Markdown claim is either true or deleted.
- [ ] The staleness-warning claim in `plans/README.md:442` is corrected.
- [ ] The README claim → delivery list exists.
- [ ] `pnpm check` exits 0; `plans/README.md` status row updated.

## STOP conditions

- **A claim can only be made true by building a feature.** Delete the claim and
  file the feature; do not quietly expand this plan.
- **Removing `subtreeFormat` changes behaviour beyond the dropdown** — that would
  mean the default path was never inert.
- **Rendering findings needs a new message contract.** `LintPayload` already
  carries them; if it does not fit, something is different from what this plan
  describes.
- **You find a fourth false claim.** Record it and ask — three was the count that
  justified this plan, and a fourth suggests the docs need a full audit rather
  than a targeted fix.

## Handoff / after it lands

- **The mid-pilot config-staleness problem is now documented and unsolved.** The
  read cache never invalidates on another session's write, so a developer with the
  plugin open serves stale classes indefinitely after the designer updates the
  config. Over a two-week pilot that will happen. It belongs to the pilot plan.
- **Plan 011's Step 2** should re-confirm the preference list; this plan changes it.
- **A reviewer should scrutinise** Step 2 hardest: rendering findings is where
  "shows a count" quietly survives behind a slightly better count.
