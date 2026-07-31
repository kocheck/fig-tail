# Plan 007: Add opt-in variable Code-syntax stamping

> **Executor instructions**: This plan is self-contained. Read it in full and
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
> **Drift check (run first)**: this plan was written at commit `2157dc6`, before
> plan 006 existed. Confirm 006 is `DONE`, locate its landing commit with
> `git log --oneline -- plans/006-readonly-drift-linter.md packages/plugin/src/lint`,
> and compare its proposal/result types with the contracts below. A mismatch is
> a STOP condition; do not use a placeholder SHA.
>
> **⚠️ Read the "Hard constraints" section below before writing any code.**
> This is the only plan that mutates design-variable data. Plan 003 writes only
> explicit plugin metadata under its namespace. The
> constraints on it were set explicitly by the repo owner and are not
> negotiable, not by you and not by a reviewer who thinks they are excessive.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: **HIGH** — not because it is technically hard, but because it is the
  only code that changes design-variable data rather than namespaced plugin
  metadata. A bug here damages real design work that may not be recoverable
  through undo.
- **Depends on**: 006
- **Category**: dx
- **Planned at**: commit `2157dc6`, 2026-07-31 — dependency contract is prospective.

## Build sheet

Use Node 20+ and pnpm. Preserve plan 006's package scripts and strict TypeScript
settings; use named exports, no `any`, no non-null assertions, and colocated
Vitest tests. Before every commit run
`pnpm -r typecheck && pnpm -r lint && pnpm -r test`.

Do the tasks below **in order, one at a time**. Each task's *Done when* is a
command or a named in-Figma check; it must produce the stated result before you
start the next task. Commit after each task. Everything after this section is
**reference** — read a section when a task points you at it.

### ⚠ This is the only plan that writes design-variable data

Before task 1: **duplicate a Figma file you can afford to damage** and work only
in that. Never develop this plan against anything real.

Re-read "Hard constraints" in full before writing any code. The short version:

- In shipped `src/` code, only ever call
  `variable.setVariableCodeSyntax('WEB', value)`. Task 1's isolated throwaway
  spike may call the documented remove API once to verify it, but that call
  never enters the production bundle or allowlist.
- Never assign `variable.name`. Never touch values, modes, scopes, description,
  or the `ANDROID`/`iOS` platforms.
- Nothing is written without a rendered diff, per-row opt-in, and a confirm.
- Add **exactly one** ESLint allowlist entry. If you want a second, stop.

### Files this plan creates

| Path | Purpose | Task |
|---|---|---|
| `packages/plugin/spike/codesyntax.ts`, `spike/FINDINGS.md` | throwaway spike + findings | 1 |
| `packages/plugin/src/lint/variables.ts` (edit) | validated reusable token-key proposals | 2 |
| `packages/plugin/src/ui/stamp/**` | dry-run diff screen | 3 |
| `packages/plugin/src/stamp/apply.ts` + test | **the single write site** | 4 |
| `eslint.config.js` (edit) | one new allowlist entry | 4 |
| `packages/plugin/src/stamp/guardrails.test.ts` | the six guardrail tests | 6 |
| `README.md` (section only) | what stamping does, and that it writes | 7 |

No new dependencies.

### Tasks

| # | Do this | Files it may touch | Done when |
|---|---|---|---|
| 1 | **Spike.** Answer the 6 questions in Step 1 on the throwaway file, with pasted output and a screenshot for Q1. | `spike/**` | `spike/FINDINGS.md` answers all 6 with evidence. **If Q1 is false — Figma does not show code syntax in Inspect — STOP and report.** |
| 2 | Tighten proposals to validated, utility-agnostic token keys (`brand-500`, `4`, `lg`). Each proposal gains a plain-language **reason**. Read-only change. | `src/lint/variables.ts` + test | Tests cover colour/spacing/radius keys, one token used across multiple property contexts, invalid/stale existing syntax, and a conflict proposing nothing |
| 3 | The dry-run diff screen. **Every row starts unchecked.** Rows with existing code syntax are disabled until "overwrite" is ticked. Conflict rows cannot be selected. Proposed values are editable. | `src/ui/stamp/**` | Walked by hand, **and** a before/after snapshot of every variable's `codeSyntax` proves nothing was written by merely opening the screen |
| 4 | The apply path: confirm dialog with the exact count, re-validate each proposal against the live variable (skip if changed), assert target/platform/value-shape before each write, batch, report applied/skipped/failed. **One write site, one eslint-disable comment naming plan 007.** | `src/stamp/apply.ts` + test, `eslint.config.js` | Apply 3 selected → exactly 3 changed, verified by re-reading; all other variables byte-identical to a pre-apply snapshot (name, value, scopes, description, modes, ANDROID/iOS). Then edit one in Figma, re-open a stale diff → that row is **skipped** |
| 5 | Establish and document undo. Apply 10, undo, compare against a pre-apply snapshot. Put the recovery text **on the result screen**, not just the README. | `src/ui/stamp/**` | The documented undo procedure, followed literally, restores the file — verified by snapshot comparison |
| 6 | Write the six guardrail tests from Step 6. Then **break each of 1–3 and 6 deliberately and confirm the test fails.** | `src/stamp/guardrails.test.ts` | All six pass; each deliberate violation was observed failing; the verification is recorded in the commit message |
| 7 | README section (~60 lines). **Lead with the fact that it writes to your Figma file.** | `README.md` | A designer reading only that section can answer: does this change my variable names? (No.) Can I undo it? (Yes, this way.) Does it happen automatically? (No.) |

**If any task appears to need a write other than `codeSyntax.WEB`, STOP.** That
is the hard line, not a judgement call.

---

## Why this matters

Right now a developer inspecting a design gets a class name that fig-tail
*inferred* by comparing a hex value against a palette. It is usually right. It
is never certain.

This plan removes most inference without coupling a reusable variable to one
CSS property. Once a Figma variable carries `codeSyntax.WEB = "brand-500"`, the
matcher validates that token key and value against the active config, then
derives `bg-brand-500`, `text-brand-500`, or `border-brand-500` from the node's
CSS property. Only that validated combination is exact. The confidence ladder on both
Dev Mode surfaces (plans 004 and 005)
jumps from `exact-value` to `exact-variable` across the whole file at once. It
is the single largest quality improvement available in the program.

There is a second benefit that costs nothing extra: **Figma's own Dev Mode
Inspect panel displays a variable's code syntax natively.** A developer who has
never installed fig-tail, looking at a stamped file, sees the reusable token
key `brand-500` in the variable's details. The property-specific class still
requires the node context supplied by fig-tail.

The cost is that it writes to the file. Hence everything below.

## Hard constraints

Set by the repo owner. Every one of these is verified mechanically in Step 6 and
in the Done criteria.

1. **The plugin never updates any Figma variable unless the user explicitly
   tells it to.** No write on load, on scan, on selection change, on navigation,
   or as a side effect of any other action. The *only* write path begins at a
   click on a button labelled Apply, on a screen showing exactly what will
   change.
2. **Tailwind names go into the variable's Code syntax field, never into the
   variable's name.** `variable.name` is never assigned, anywhere, for any
   reason. The only shipped write API this plan may use is
   `Variable.setVariableCodeSyntax('WEB', …)`; the Step 1 throwaway spike's
   documented removal call stays outside `src/` and the bundle.
3. **Nothing else about a variable is ever written**: not its value, not its
   modes, not its scopes, not its description, not its collection, not its
   `ANDROID` or `iOS` code syntax. Only `WEB`.
4. **Dry run is the default and cannot be skipped.** The Apply button does not
   exist until a dry-run diff has been generated and displayed in the current
   session. There is no "apply all without reviewing" affordance, no CLI flag,
   no keyboard shortcut that bypasses it.
5. **No node, style, page, or document property is ever written.** Shipped code in this plan
   adds exactly one entry to the write-safety allowlist from plan 003 Step 7:
   `setVariableCodeSyntax`. If you find yourself wanting a second, stop.

If a step in this plan appears to require breaking one of these, that is a STOP
condition, not a judgement call.

## Context the executor needs

### What exists after plan 006

- `src/lint/variables.ts` exports the proposal logic: for each local variable
  lacking valid `codeSyntax.WEB`, it proposes a reusable Tailwind token key by value-matching and
  name-matching against the theme, returning `high` confidence when both agree,
  `medium` when only one produces an answer, and `conflict` when they disagree
  (in which case it proposes nothing).
- `src/lint/types.ts` defines `Finding` with `variableId`, `variableName`, and
  `suggestion`.
- The linter lives in the UI route selected by plan 006's API spike, with a
  Markdown export.
- Tier-1 dismissals use `documentConfigId`; tier-2/3 dismissals are session-only.
- Plan 003's write-safety ESLint rule and bundle test are in place and currently
  allow exactly one write: `figma.root.setSharedPluginData` in `storage.ts`.

### The Figma API this plan uses

```ts
// Read
const vars = await figma.variables.getLocalVariablesAsync()
const v = await figma.variables.getVariableByIdAsync(id)
v.codeSyntax          // { WEB?: string; ANDROID?: string; iOS?: string }

// Write — the ONLY write permitted by this plan
v.setVariableCodeSyntax('WEB', 'brand-500')
```

Verified against Figma's plugin docs on 2026-07-31: `setVariableCodeSyntax`
adds or modifies a platform definition on `codeSyntax`; valid platforms are
`'WEB'`, `'ANDROID'`, `'iOS'`. `removeVariableCodeSyntax('WEB')` is the
documented removal API, although shipped code in this plan intentionally does
not add a second write path. Code syntax represents a custom token name, not a
property-specific utility. —
[setVariableCodeSyntax](https://www.figma.com/plugin-docs/api/properties/Variable-setvariablecodesyntax/)
· [removeVariableCodeSyntax](https://developers.figma.com/docs/plugins/api/properties/variables-removevariablecodesyntax/)
· [Working with variables](https://developers.figma.com/docs/plugins/working-with-variables)
· [Update 75](https://www.figma.com/plugin-docs/updates/2023/08/21/version-1-update-75/)

**Open those pages before writing the apply path.** They are summaries located by
search, not quotations, and this is the one plan that writes to someone's file.

Facts that are **not** verified and must be established in Step 1:
- **Whether library (non-local) variables can be written at all.** They almost
  certainly cannot from a consuming file. If most of a team's variables live in
  a library, this feature only works when run *in the library file*, which is a
  significant usage caveat that belongs in the docs.
- **How many `setVariableCodeSyntax` calls Figma tolerates in one go**, and
  whether they land as one undo entry or many. This determines the batching in
  Step 4 and what Step 5 can honestly say about undo.

### What belongs in Code syntax

A colour variable has no single property-specific class: the same `brand-500`
may produce background, text, or border utilities. Spacing tokens likewise may
be used for padding, gap, width, or inset. Figma scopes restrict where a
variable appears in pickers; they do not turn the variable itself into one CSS
property.

Therefore store the reusable token key only: colour `brand-500`, spacing `4`,
radius `lg`. The proposal must prove that the key exists in the correct
namespace of the active `TokenSet` and its normalized value equals the live
variable value. Scopes may appear in the explanatory reason, but they never add
`bg-`, `text-`, `p-`, `gap-`, or another utility prefix. Plans 002 and 004 own
property-specific derivation.

## Inputs & resources

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm -r typecheck` | exit 0 |
| Test | `pnpm --filter @fig-tail/plugin test` | all pass |
| Build | `pnpm --filter @fig-tail/plugin build` | `dist/main.js`, `dist/ui.html` |
| Write-safety | `pnpm --filter @fig-tail/plugin lint && pnpm --filter @fig-tail/plugin test -t write-safety` | exit 0, passes with exactly 2 allowlist entries |

Needed on hand:

- Figma desktop app.
- **A throwaway Figma file with local variables that you can afford to damage.**
  Duplicate one; do not develop against anything real. Steps 1, 4, and 5
  exercise writes; Steps 2 and 3 must remain read-only.
- A Tailwind config loaded into that file via the plan 003 setup UI.
- A file that *consumes* variables from a library, for the Step 1 library test.

## Scope

**In scope**:

- `packages/plugin/src/stamp/**` — the apply path, batching, and result reporting
- `packages/plugin/src/ui/stamp/**` — the diff review screen and Apply flow
- `packages/plugin/src/lint/variables.ts` — tightening proposals to the
  reusable token-key contract from "Context" (read-only change to a read-only file)
- `eslint.config.js` — **exactly one** new allowlist entry for
  `setVariableCodeSyntax`
- Tests, including the guardrail tests in Step 6
- A README section covering what stamping does, that it writes to the file, and
  how to undo it

**Out of scope**:

- **Writing `variable.name`.** Never. See Hard constraints.
- **Writing anything other than `codeSyntax.WEB`** — no values, no modes, no
  scopes, no descriptions, no `ANDROID`/`iOS` syntax.
- **Creating or deleting variables or collections.**
- **Binding variables to node properties.** Even though it would fix plan 006's
  "unbound" findings, it is a document mutation of a kind the owner ruled out.
- **Any automatic or scheduled stamping.** No "keep in sync" mode, no re-stamp
  on theme update. Every write is one human click.
- Whole-document / cross-file stamping.
- Publishing — plan 010.

## Working approach

- Branch as instructed. Commit per step, prefixed `007-N:`.
- **Work on the throwaway file only.** If you need to demonstrate against a real
  file, duplicate it first.
- The write call should exist in exactly one function, in one file, with the
  ESLint disable comment directly above it naming this plan. Every other module
  calls that function. One write site is what makes the guardrails auditable.

## Steps

### Step 1: Spike the write API and record its real behaviour

**Produces findings, not shipped code.** Do not skip; Steps 4 and 5 depend on
the answers.

On the throwaway file, write `packages/plugin/spike/codesyntax.ts` and answer,
in `packages/plugin/spike/FINDINGS.md`, with pasted evidence:

1. Does `setVariableCodeSyntax('WEB', 'brand-500')` show up in Figma's native
   Dev Mode Inspect panel for that variable? **Screenshot it.** If it does not,
   the second motivation in "Why this matters" is void and the owner should know.
2. Confirm the documented `removeVariableCodeSyntax('WEB')` API restores the
   empty state on the throwaway variable, then restore the original snapshot.
   Do not probe invalid `null`/`undefined` calls.
3. Can a **library** variable be written from a consuming file? Expect no —
   record the exact error.
4. Do 50 sequential calls land as **one** undo entry or 50? Does
   `figma.commitUndo()` group them? Time 50 calls and 500 calls.
5. Does writing code syntax mark the file as edited / create a version-history
   entry? (Matters for what Step 5 can say about recovery.)
6. Does it require edit access, and what is the exact failure on a Dev seat?

**Check**: `FINDINGS.md` answers all six with pasted output or screenshots, not
assertions. A reviewer reading only that file knows what Steps 4 and 5 will do.

**STOP and report** if (1) is false — if Figma does not surface code syntax in
Inspect, the value proposition changes and the owner should re-decide before you
build the UI.

### Step 2: Tighten proposals to reusable token keys

In `src/lint/variables.ts`, make every proposal a reusable token key validated
against the active config and live variable value. Keep the file read-only —
this step adds no writes.

Each proposal gains: the proposed token key for `codeSyntax.WEB`, the confidence
(`high` / `medium` / `conflict`), and a **reason** string explaining how it was
derived ("value matches configured colour token `brand-500`; usable as text,
fill, or border according to node context"). The reason is displayed in the
diff and is what makes the review meaningful.

**Check**: unit tests for colour, spacing, and radius namespaces; the same colour
key reused in fill/text/stroke contexts without changing its stamped value;
multi-scope and `ALL_SCOPES` variables still receive a bare key; and a
`conflict` proposal produces nothing and carries the reason.

### Step 3: Build the dry-run diff screen

A third route in plan 006's selected UI surface, reachable from the lint view's
`unmapped-variable` findings.

Show a table, one row per variable:

| Variable | Current code syntax | Proposed | Confidence | Why |
|---|---|---|---|---|
| `brand/500` | *(empty)* | `brand-500` | high | value and name match configured colour token |
| `text/body` | `--text-body` | *(none)* | conflict | name and value identify different tokens ⚠ |
| `radius/lg` | *(empty)* | `lg` | high | value matches configured radius token |

Requirements:

- **Every row starts unchecked.** Nothing is selected by default — the designer
  opts each one in. "Select all high-confidence" is an acceptable convenience;
  "select all" including medium and conflict is not.
- **Rows whose current code syntax is non-empty are visually distinct and
  disabled by default**, with an explicit "overwrite" checkbox. Overwriting
  something a human already wrote is a different act from filling a blank, and
  it must feel like one.
- **`conflict` rows are shown but cannot be selected.** Display the conflict
  ("named `brand-500`, but its value matches `brand-600`") — that is a real
  finding, and the fix is in Figma, not here.
- **The proposed key is editable inline**, but Apply stays disabled until the
  edited key exists in the active token namespace and its normalized value
  agrees with the live variable. Show the validation error next to the row.
- A persistent summary: "N of M variables selected. Applying writes to N
  variables in this file."
- **No Apply button until this screen has rendered a diff.** Enforce it in code
  (the apply handler asserts a diff was generated in this session and rejects
  otherwise), not just in the UI.

**Check**: on the throwaway file, open the screen and confirm: all rows start
unchecked; a variable with existing code syntax is disabled until "overwrite" is
ticked; a conflict row cannot be selected and explains itself; inline editing
changes the value that would be written; the counter is accurate. Then confirm
**nothing has been written** — re-read every variable's `codeSyntax` and compare
to a snapshot taken before opening the screen.

### Step 4: Implement the apply path

`src/stamp/apply.ts`. One exported function, one write site:

```ts
// eslint-disable-next-line no-restricted-properties -- plan 007: the single
// permitted variable write. See plans/007-variable-codesyntax-stamping.md.
variable.setVariableCodeSyntax('WEB', value)
```

Before writing anything:

1. **Confirmation dialog** stating the exact count and that it modifies this
   Figma file: "Write Tailwind code syntax to 12 variables in this file?" with
   Cancel and Apply. Cancel is the default focus.
2. **Re-validate every selected proposal against the live variable.** If a
   variable's `codeSyntax.WEB`, name, resolved default-mode value, scopes, or
   collection changed since the diff was generated (someone else edited it, or
   the designer left the screen open), skip it and report it as skipped. Never
   apply a proposal whose evidence changed under you.
3. **Assert the invariant in code** before each write: the target is a
   `Variable`, the platform is exactly `'WEB'`, the config checksum still
   matches the diff, and the proposed key still exists in the correct token
   namespace with a value equal to the live variable. Validate through the
   TokenSet API rather than a permissive regex. Throw on violation — stale or
   malformed syntax written into a design file is worse than a failed apply.

Then write in batches (size per Step 1's findings), with progress, and produce a
result summary: applied / skipped (with reasons) / failed (with errors). Show it
in the UI and offer a Markdown copy of the summary.

**Check**: on the throwaway file, apply 3 selected variables. Confirm: exactly
those 3 have code syntax, verified by re-reading; the other variables are byte
-identical to a pre-apply snapshot (name, value, scopes, description, modes, and
`ANDROID`/`iOS` syntax all unchanged); the summary reports 3 applied, 0 skipped,
0 failed. Then modify one variable's code syntax manually in Figma, re-open a
stale diff, and confirm that row is **skipped**, not overwritten.

### Step 5: Verify undo and document recovery

Per Step 1's findings, establish and document exactly how a designer undoes a
stamp.

Test on the throwaway file: apply 10 variables, then press Cmd/Ctrl+Z. Record
how many undos are needed and whether the file returns to its prior state
(verified by comparing against a pre-apply snapshot of all variables). Also
check Figma's version history for a restorable entry.

Then write the recovery instructions into the UI itself — on the result screen,
below the summary, in plain language: "To undo: press Cmd+Z <N> times, or
restore from File → Version history." Do not bury this in the README only; the
moment someone needs it is the moment they are looking at that screen.

Do **not** build a plugin "revert" button in this plan even though Figma exposes
`removeVariableCodeSyntax`: overwrites may need restoring a prior non-empty
value rather than removing it, and a second production write path expands the
safety surface. Recovery is Figma undo/version history, verified here.

**Check**: the documented undo procedure, followed literally, returns the
throwaway file to its pre-apply state, verified by snapshot comparison. The
recovery text appears on the result screen.

### Step 6: Add guardrail tests

These are the mechanical proof of the Hard constraints, and they stay in the
suite permanently.

1. **Allowlist count test**: parse `eslint.config.js` and assert exactly **two**
   write allowlist entries exist — `setSharedPluginData` (plan 003) and
   `setVariableCodeSyntax` (this plan). Fails if a third is ever added.
2. **Single write-site test**: scan TypeScript AST/source under `src/` and assert
   exactly one call expression targets `setVariableCodeSyntax`, in
   `src/stamp/apply.ts`; then keep the bundle identifier audit as a secondary
   signal. Minification must not be the only proof.
3. **Name-never-written test**: assert the bundle contains no assignment to
   `.name` on a variable. (Match the pattern your bundler emits; verify the test
   actually fails by temporarily adding such an assignment.)
4. **No-apply-without-diff test**: call the apply handler directly without
   generating a diff first and assert it rejects.
5. **Read-only-until-apply test**: drive the whole flow — load, scan, open the
   diff screen, edit proposals, cancel — against a mocked `figma` where
   `setVariableCodeSyntax` throws, and assert nothing throws. Only the Apply
   click may reach it.
6. **Platform test**: assert every call site passes `'WEB'`. No `ANDROID`, no
   `iOS`.

**Check**: all six pass. Then, for each of tests 1–3 and 6, deliberately
introduce the violation it guards against and confirm the test **fails**;
remove it and confirm it passes. Record this verification in the commit message.
A guardrail nobody has watched fail is not a guardrail.

### Step 7: Document stamping

A README section: what stamping does, that it **writes to your Figma file**, why
it goes in Code syntax rather than the variable name, that library variables must
be stamped in the library file (per Step 1), how to undo, and what improves
afterwards (both Dev Mode surfaces become exact). Lead with the fact that it
writes.
~60 lines.

**Check**: a designer reading only this section can correctly answer: does this
change my variable names? (No.) Can I undo it? (Yes, this way.) Does it happen
automatically? (No, never.)

## Validation plan

- **Unit tests**: reusable token-key validation across colour, spacing, and
  radius namespaces; proposal confidence
  including conflict; the apply-path validation assertions; stale-proposal
  skipping; batching and progress.
- **The six guardrail tests** from Step 6, each verified to fail on a
  deliberate violation.
- **Manual apply matrix** on the throwaway file, each verified by snapshot
  comparison of all variables before and after:
  - [ ] Apply 1 variable → exactly 1 changed
  - [ ] Apply 12 variables → exactly 12 changed
  - [ ] Cancel at the confirmation dialog → 0 changed
  - [ ] A variable with existing code syntax is untouched unless "overwrite"
  - [ ] A conflict row cannot be applied
  - [ ] An edited proposal writes the edited value
  - [ ] A stale proposal is skipped, not overwritten
  - [ ] Names, values, scopes, modes, descriptions, `ANDROID`/`iOS` syntax:
        unchanged in every case
- **Downstream verification**: after stamping, open the file in Dev Mode and
  confirm both Dev Mode surfaces report `exact-variable` only when the stamped
  key and value validate against the active config, and
  that Figma's own Inspect panel shows the code syntax.

## Done criteria

ALL must hold.

- [ ] `pnpm -r typecheck && pnpm -r lint && pnpm -r test` → exit 0
- [ ] Static source/AST audit finds exactly one shipped
      `setVariableCodeSyntax` call, in `src/stamp/apply.ts`; bundle audit agrees
- [ ] Every call site passes platform `'WEB'`
- [ ] `variable.name` is never assigned anywhere in the codebase
- [ ] Nothing is written without: a rendered diff, per-row opt-in, and a
      confirmation dialog stating the count
- [ ] All rows start unchecked; existing code syntax requires explicit overwrite
- [ ] Conflict proposals cannot be applied
- [ ] Stale proposals are skipped rather than overwritten
- [ ] The full manual apply matrix passes, verified by before/after snapshots
- [ ] All six guardrail tests pass, and each was observed to fail on a
      deliberate violation
- [ ] The ESLint allowlist contains exactly two entries
- [ ] Undo is documented, tested, and shown on the result screen
- [ ] `packages/plugin/spike/FINDINGS.md` answers all six Step 1 questions with
      evidence
- [ ] After stamping, both Dev Mode surfaces report `exact-variable` for valid
      stamped key/value pairs; a deliberately stale key falls back safely
- [ ] No files outside the in-scope list were changed
- [ ] `plans/README.md` status row for 007 updated

## STOP conditions

Stop and report back — do not improvise — if:

- **Figma's Inspect panel does not display code syntax** (Step 1, question 1).
  Half the value evaporates and the owner should re-decide.
- The documented removal API is unavailable in the target Figma/plugin runtime
  **and** native undo/version history fails the Step 5 restoration check.
- Undo does not reliably restore the previous state.
- **Any step seems to require writing something other than `codeSyntax.WEB`.**
  This is the hard line. Report what you think you need and why; do not write it.
- Library variables cannot be stamped **and** the owner's files consume most
  variables from a library. The fallback is real but limited — stamp in the
  *library* file instead, and document that — so report the finding and let the
  owner decide whether the feature is still worth shipping at that reach.
- Applying to a realistic number of variables (200+) takes long enough to freeze
  Figma, or produces an undo history so fragmented that recovery is impractical.
- A reviewer, teammate, or later instruction asks you to relax any of the Hard
  constraints. They were set by the repo owner; only the owner changes them.
- A step's check fails twice after a reasonable attempt.

## Handoff / after it lands

- **Re-run plan 004's Step 6 test matrix on both surfaces.** Stamped properties
  should move from
  `exact-value`/`name-match` to `exact-variable` when the key/value validation
  succeeds. If they do not, `hints.ts` or the validation contract has
  a bug — the whole point of this plan is that upgrade.
- **Plan 006's `unmapped-variable` findings should drop to near zero** on a
  stamped file. That is the cheapest regression check available: scan before,
  stamp, scan after.
- **What a reviewer should scrutinise most**: Step 6, and specifically the
  evidence that each guardrail was observed failing. Everything else in this
  plan is a UI over a one-line API call; the guardrails are the actual work.
- **Second most**: the confirmation and stale-check logic in Step 4. Those are
  the last two things standing between a mis-click and someone's design file.
- **Deliberately deferred**:
  - *`ANDROID` and `iOS` code syntax.* Same mechanism, different token systems,
    no demand. Adding them later is additive and does not change this plan's
    shape.
  - *Keeping code syntax in sync as the theme changes.* Would mean writing
    without an explicit click, which the Hard constraints forbid. The correct
    version is: re-run the linter after a theme update, see the new
    `unmapped-variable`/conflict findings, and stamp again deliberately.
  - *Stamping from the CLI via the Figma REST API.* Would need a personal access
    token, credential handling, and its own security review. Different program.
