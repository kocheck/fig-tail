# Plan 006: Add the read-only drift linter (designer dry-run)

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. If anything in "STOP conditions" occurs,
> stop and report — do not improvise. When done, update the status row for this
> plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat <SHA at which 003 completed>..HEAD -- packages/plugin/src/storage.ts packages/plugin/src/mode-design.ts`
> This plan adds another view to the design-mode UI and reuses `readConfig()`.
> If either has changed, read it before starting.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW — this plan is **strictly read-only**. It cannot damage a file.
  Its risk is a noisy report nobody acts on, which Step 5's severity model
  addresses.
- **Depends on**: 002, 003
- **Category**: design
- **Grounded at**: the commit at which plans 002 and 003 landed.

## Why this matters

The repo owner asked for "a dry run mode for a designer to lint out any issues".
This is that mode, and it is worth building for its own sake, not just as a
safety mechanism.

Plan 004 tells a developer about drift one node at a time, at the moment they
are trying to build something — which is the worst time to discover that a fill
is 2 ΔE off the palette. This plan lets the **designer** find it first, across a
whole page, before anyone inspects it. Same engine, different audience, much
earlier in the workflow.

It is also the honest prerequisite for plan 007. Stamping Tailwind names onto
variables means writing to the document, and the owner's constraint is that
nothing gets written without a human first seeing exactly what would change.
This plan builds that review surface. Plan 007 then adds an Apply button to a
diff the designer has already learned to read — rather than introducing writes
and a review UI in the same change.

**Nothing in this plan writes to the Figma document.** Not one call.

## Context the executor needs

### What exists after plans 002, 003, and (optionally) 004

- `@fig-tail/match` exports `matchDeclarations`, `summarise`, and the
  `MatchResult` type with its `confidence` ladder and `nearest` field. See
  plan 004's "Context" for the full type signatures — they are unchanged.
- `packages/plugin/src/storage.ts` exports `readConfig()`, cached.
- `packages/plugin/src/mode-design.ts` runs when `figma.editorType === 'figma'`
  and currently shows the setup UI from plan 003 Step 6.
- If plan 004 landed, `packages/plugin/src/hints.ts` exports `buildHints(node)`.
  **If 004 has not landed, implement `buildHints` here** per plan 004 Step 2 and
  its mapping table, in the same file path — 004 will then find it already
  present. Do not duplicate it.

### The four things this linter reports

Distinct problems with distinct fixes. Keep them separate in the UI; a single
merged list of "issues" is not actionable.

1. **Drift** — a value that is *nearly* a token (`confidence: 'nearest'`).
   `#3B82F1` where the palette says `#3B82F6`. Almost always accidental: a
   hand-typed hex, a pasted value, an old copy. Highest signal in the report.
2. **Off-system** — a value with no token anywhere near it
   (`confidence: 'arbitrary'`). Could be deliberate (a one-off illustration
   colour) or a missing token. Needs a human to decide, so it must be
   dismissible.
3. **Unbound** — the node's value matches a token exactly, but no Figma variable
   is bound to it. The design is *correct* and *fragile*: it will not follow a
   theme change. This is the most common finding in most files and the easiest
   to fix in Figma.
4. **Unmapped variable** — a variable exists in the file but has no
   `codeSyntax.WEB`, and fig-tail can propose one from the theme. This is
   exactly the input plan 007 acts on, and generating it here is why 007
   depends on 006.

### Scanning scope and performance

`documentAccess: "dynamic-page"` means pages load lazily. To scan beyond the
current page you must `await figma.loadAllPagesAsync()`, which on a large file
is slow and memory-hungry.

Therefore: **scan the current selection, or the current page. Never the whole
document.** Offer "Selection" (default when something is selected) and
"This page". A whole-document scan is explicitly out of scope — see Scope.

There is no 15-second timeout here (this is design mode, not codegen), but a
page with thousands of nodes still needs to not freeze Figma:

- Walk with an explicit stack, not recursion — deep component trees will blow
  the sandbox stack.
- Process in batches of ~50 nodes with a `yield` between them, and post progress
  to the UI so it can show a counter and a Cancel button.
- Skip invisible nodes and nodes inside collapsed instances by default (a
  preference can re-enable them). Instance children usually mirror their main
  component; reporting them multiplies findings by instance count for no gain.
- Deduplicate findings by `(property, value, nearestToken)` and report a count
  — "17 nodes use #3B82F1" is one finding, not seventeen.

### Severity model

Ordering the report by severity is what makes it get used. Fixed order:

| Severity | Finding type | Rationale |
|---|---|---|
| High | Drift | Nearly-right values are almost certainly mistakes |
| Medium | Unmapped variable | Blocks plan 007 and degrades every dev's output |
| Medium | Off-system | May be deliberate; needs a decision |
| Low | Unbound | Correct today, fragile tomorrow |

Within a severity, order by node count descending. The finding affecting 40
nodes matters more than the one affecting 1.

## Inputs & resources

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm -r typecheck` | exit 0 |
| Test | `pnpm --filter @fig-tail/plugin test` | all pass |
| Build | `pnpm --filter @fig-tail/plugin build` | `dist/main.js`, `dist/ui.html` |
| Write-safety | `pnpm --filter @fig-tail/plugin lint && pnpm --filter @fig-tail/plugin test -t write-safety` | exit 0, passes |

Needed on hand:

- Figma desktop app.
- The plan 004 test file (`fixtures/figma/README.md` records its URL) — it
  already contains a near-miss node, an off-scale node, and an unsupported node.
- A **large, messy Figma file** for the performance test in Step 6. A real
  project file is ideal; if none is available, duplicate a Figma Community file
  with several hundred nodes.
- A Tailwind config loaded into the test file via the plan 003 setup UI.

## Scope

**In scope**:

- `packages/plugin/src/lint/**` — the scanner, finding types, and severity model
- `packages/plugin/src/ui/lint/**` — the report view
- `packages/plugin/src/mode-design.ts` — adding navigation between the settings
  view and the lint view
- `packages/plugin/src/hints.ts` — **only** if plan 004 has not landed yet
- Tests for all of the above
- A README section describing the linter

**Out of scope**:

- **Any document write.** No `setVariableCodeSyntax`, no node mutation, no
  plugin data other than the existing config storage. Plan 003's write-safety
  guards must pass unchanged, with no new allowlist entries. If you need to add
  an ESLint exception, you are out of scope.
- **Auto-fix of any kind.** Not "bind this variable for me", not "round this to
  the nearest token". Plan 007 is the only plan that writes, and only to
  `codeSyntax`.
- **Whole-document scanning.** `loadAllPagesAsync()` must not appear in this
  plan's code.
- The Dev Mode surfaces — plans 004 and 005 own them. This is a design-mode
  surface.
- Modifying `@fig-tail/match`. If a finding type needs engine support that does
  not exist, that is a STOP condition.
- Publishing or listing assets — plan 010.

## Working approach

- Branch as instructed. Commit per step, prefixed `006-N:`.
- Keep the scanner (`src/lint/scan.ts`) free of UI concerns and free of the
  `figma` global where possible — take a node array in, return findings out, so
  it is unit-testable.
- Test on the messy file, not just the clean one. A linter that only works on
  tidy input is not a linter.

## Steps

### Step 1: Define finding types and the scanner contract

`src/lint/types.ts`:

```ts
export type FindingType = 'drift' | 'off-system' | 'unbound' | 'unmapped-variable'
export type Severity = 'high' | 'medium' | 'low'

export type Finding = {
  type: FindingType
  severity: Severity
  property: string           // CSS property, or 'variable' for unmapped-variable
  value: string              // the offending value, or the variable's value
  /** What it nearly matched, when applicable. */
  suggestion?: { token: string; tokenValue: string; className: string; distance?: number; unit?: string }
  /** Node ids this finding applies to. Length is the count shown in the UI. */
  nodeIds: string[]
  nodeNames: string[]        // first 5, for display
  /** For unmapped-variable only. */
  variableId?: string
  variableName?: string
}

export type ScanResult = {
  scope: 'selection' | 'page'
  nodesScanned: number
  nodesSkipped: number       // invisible / instance children
  findings: Finding[]        // pre-sorted by severity then node count
  scannedAt: string
  cancelled: boolean
}
```

**Check**: `pnpm --filter @fig-tail/plugin typecheck` → exit 0, and a test
asserting a hand-built `ScanResult` sorts into the documented severity order
with node-count as the tiebreak.

### Step 2: Implement the node scanner

`src/lint/scan.ts`. Iterative stack-based walk, batches of 50 with a yield,
progress callback, cancellation flag. For each node: `getCSSAsync()`,
`buildHints(node)`, `matchDeclarations(...)`, then classify each `MatchResult`:

- `nearest` → **drift**
- `arbitrary` → **off-system**
- `exact-value` with no hint for that property → **unbound**
- `exact-variable` / `name-match` → no finding (this is the good case)
- `none` → no finding (not a design problem; the property simply is not
  expressible, and plans 004 and 005 already report it per-node)

Deduplicate as described in "Context", collecting `nodeIds`.

**Check**: unit tests with mocked nodes covering each classification branch, the
dedup path (three nodes with the same off-token hex → one finding with
`nodeIds.length === 3`), the skip rules, and cancellation mid-walk leaving
`cancelled: true` with partial findings.

### Step 3: Implement the variable mapping proposer

`src/lint/variables.ts`. Read local variables with
`figma.variables.getLocalVariablesAsync()`. For each, if `codeSyntax.WEB` is
absent, propose a Tailwind class from the theme by:

1. **Value match** — resolve the variable's value for its default mode and match
   it against the token set with `@fig-tail/match`. An exact value match is the
   strongest evidence.
2. **Name match** — normalise the variable name (`brand/500` → `brand-500`,
   `Brand / 500` → `brand-500`, `spacing/gutter` → `gutter`) and look for a
   token with that key.
3. **Agreement** — when both produce an answer and they agree, mark the
   proposal `high` confidence. When only one does, `medium`. When they
   **disagree**, mark it `conflict` and propose neither: a variable named
   `brand-500` whose value is not `brand-500`'s value is itself a finding worth
   surfacing, and guessing which is right would be exactly the kind of
   silent-wrong-answer this program avoids.

Emit these as `unmapped-variable` findings with the proposal in `suggestion`.

This function is the input plan 007 consumes. Export it cleanly and keep it
free of UI concerns.

**Check**: unit tests for each confidence outcome, the three name-normalisation
forms, the conflict case (proposes nothing, reports the conflict), variables
whose type is unsupported (BOOLEAN, STRING → skipped, not errored), and a
variable that already has `codeSyntax.WEB` (→ no finding).

### Step 4: Build the report UI

A second view in the design-mode iframe, reachable from the settings view and
back.

- **Scope picker**: Selection (default when a selection exists) / This page.
- **Scan button**, with progress ("Scanning… 412 / 1,203 nodes") and Cancel.
- **Results**, grouped by finding type, sorted by severity, each showing:
  the value, the suggestion with its distance, the affected node count, and a
  **"Select these nodes"** button that sets `figma.currentPage.selection` and
  calls `figma.viewport.scrollAndZoomIntoView(nodes)`.
  (Setting the selection and moving the viewport are *not* document
  mutations — they change no persisted state. Confirm the write-safety lint rule
  agrees; if it flags them, narrow the rule rather than adding a broad
  exception.)
- **Empty state**: when a scan finds nothing, say so plainly and show what was
  scanned. "No issues found in 412 nodes on this page" is a real result, not an
  error.
- **Export report**: a Copy button producing a Markdown report — the scan scope,
  counts, and a table per finding type. Designers paste this into Slack or a
  ticket; that is how the finding becomes work.

**Check**: on the plan 004 test file, run a Selection scan and a Page scan.
Confirm: the near-miss node appears as high-severity drift naming the correct
nearest token; the 25px padding node appears as drift with a 1px distance; the
gradient node produces no finding; "Select these nodes" actually selects and
scrolls to them; the Markdown export pastes as a readable table.

### Step 5: Wire in the severity ordering and dismissals

Sort per the severity table. Add per-finding **Dismiss**, so a designer can
clear a deliberate off-system value and keep the report meaningful on re-scan.

Dismissals persist in **`figma.clientStorage`, keyed by file ID + a hash of the
finding** — deliberately *not* in document storage, because that would be a
document write and it would impose one person's judgement on everyone else's
report. Per-user is the correct scope for "I have looked at this and it is
fine".

Include a "Show dismissed (N)" toggle so dismissals are never invisible.

**Check**: dismiss a finding → it disappears from the list and the count drops.
Re-scan → it stays dismissed. Toggle "Show dismissed" → it reappears, marked.
Reload the plugin → dismissals persist. Confirm via the plan 003 storage read
path that **nothing was written to document storage** — compare
`figma.root.getSharedPluginData('figtail','meta')` before and after.

### Step 6: Performance-test on a large file

Run a page scan on the large, messy file from "Inputs". Record: node count,
wall-clock duration, whether Figma's UI stayed responsive, and whether Cancel
worked mid-scan.

Target: **1,000 nodes in under 10 seconds** with a responsive UI. If it is
slower, the fix is a larger yield interval or skipping more aggressively — not
removing the yield.

**Check**: timings recorded in the commit message. Cancel verified to stop the
scan and show partial results. Figma remained interactive throughout (scroll the
canvas mid-scan and confirm it moves).

### Step 7: Document the linter

A README section: what the four finding types mean, how to fix each one *in
Figma*, and why unbound values matter even though they are technically correct.
The audience is a designer, not a developer — write it that way. ~50 lines.

**Check**: a designer (or someone reading as one) can read the section and,
without asking questions, correctly explain what "unbound" means and what to do
about it.

## Validation plan

- **Unit tests**: classification for each `Confidence` → `FindingType` mapping;
  dedup; skip rules; cancellation; severity sort; all three variable-proposal
  outcomes plus the conflict case; name normalisation.
- **Read-only assertion**: a test that runs a full scan against a mocked `figma`
  global whose every mutation method throws, and asserts the scan completes.
  This is the mechanical proof of the plan's core claim — it belongs in the test
  suite permanently, not just in this plan's review.
- **Manual matrix** on the plan 004 test file: each of its nine nodes produces
  the expected finding (or correctly produces none).
- **Large-file performance test**: Step 6.
- **Write-safety regression**: plan 003's lint rule and bundle test pass
  unchanged, with **no new allowlist entries**.

## Done criteria

ALL must hold.

- [ ] `pnpm -r typecheck && pnpm -r lint && pnpm -r test` → exit 0
- [ ] All four finding types are produced correctly on the test file
- [ ] Findings are deduplicated with an accurate node count
- [ ] Findings are sorted by severity, then by node count descending
- [ ] "Select these nodes" selects and scrolls to the affected nodes
- [ ] The Markdown export pastes as a readable table
- [ ] Dismissals persist in `clientStorage` and survive a plugin reload
- [ ] Document storage is provably unchanged by a scan (compared before/after)
- [ ] The read-only assertion test passes (every mutation method throws, scan
      still completes)
- [ ] 1,000 nodes scan in under 10 s with a responsive UI and working Cancel
- [ ] Plan 003's write-safety guards pass with **zero new allowlist entries**
- [ ] `loadAllPagesAsync` appears nowhere in this plan's code
- [ ] No files outside the in-scope list were changed
- [ ] `plans/README.md` status row for 006 updated

## STOP conditions

Stop and report back — do not improvise — if:

- **The linter reports so many findings on a real file that it is unusable**
  (say, several hundred on a normal page). That means the thresholds or the
  finding definitions need rethinking with the owner — a report nobody can act
  on is worse than no report. Bring the actual numbers.
- The write-safety lint rule flags `figma.currentPage.selection = …` or
  `scrollAndZoomIntoView` and narrowing it cleanly is not obvious. Do not add a
  broad exception to make it pass.
- `getLocalVariablesAsync()` does not return variables from linked libraries and
  the file's variables mostly live in a library. That would substantially limit
  plan 007 and needs to be known before 007 starts, not during it.
- Scanning a page requires `loadAllPagesAsync()` in practice (i.e. the current
  page's nodes are not fully available without it).
- A finding type needs matching-engine support that plan 002 does not provide.
  Report it; do not edit `@fig-tail/match` from this plan.
- A step's check fails twice after a reasonable attempt.

## Handoff / after it lands

- **Plan 007 builds directly on Step 3.** Its Apply action operates on exactly
  the `unmapped-variable` findings this plan produces, using the same
  proposals and the same confidence levels. 007 adds a write path and its
  guardrails; it should not need to re-derive a single proposal.
- **What a reviewer should scrutinise most**: the read-only claim. Ask to see
  the mutation-throwing test and the before/after comparison of document
  storage from Step 5. This plan's entire safety argument is that it writes
  nothing, and that argument should be mechanically demonstrated rather than
  asserted.
- **Second most**: the severity model. If drift and unbound are ordered wrong,
  the report leads with noise and designers stop opening it.
- **Deliberately deferred**:
  - *Whole-document scanning.* Needs `loadAllPagesAsync()`, which is slow enough
    on large files to be a feature of its own with its own progress model.
  - *Auto-fix / auto-bind.* Binding variables to node properties is a real
    document mutation of exactly the kind the owner ruled out. Not planned.
  - *A CI check that fails a build on drift.* Would need the Figma REST API and
    a token — a different program with different credentials, and the token
    handling would need its own security review.
  - *Text-style and effect-style coverage.* This plan lints values and
    variables; Figma styles are a parallel system with their own mapping
    problem. Worth a follow-up plan if designers ask.
