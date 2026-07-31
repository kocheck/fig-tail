# Plan 006: Add the read-only drift linter (designer dry-run)

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
> plan 005 existed. Confirm 005 is `DONE`, locate its landing commit with
> `git log --oneline -- plans/005-devmode-inspect-panel-surface.md packages/plugin/src`,
> and compare the live `pipeline.ts`, storage, hints, and UI routing with the
> prospective contracts below. A mismatch is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — document writes remain mechanically impossible, but the
  availability and parity of `getCSSAsync()` in design mode must be proven
  before choosing the surface. Task 0 resolves that uncertainty.
- **Depends on**: 005
- **Category**: dx
- **Planned at**: commit `2157dc6`, 2026-07-31 — dependency contract is prospective.

## Build sheet

Use Node 20+ and pnpm. Preserve plan 005's package scripts and strict TypeScript
settings; use named exports, no `any`, no non-null assertions, and colocated
Vitest tests. Before every commit run
`pnpm -r typecheck && pnpm -r lint && pnpm -r test`.

Do the tasks below **in order, one at a time**. Each task's *Done when* is a
command or a named in-Figma check; it must produce the stated result before you
start the next task. Commit after each task. Everything after this section is
**reference** — read a section when a task points you at it.

### Before you start

You need Figma desktop, plan 004's test file with a config loaded, **and** a
large messy Figma file (several hundred nodes) for task 6. A duplicated Community
file is fine.

**This plan writes nothing to the document.** If you find yourself adding an
ESLint allowlist entry, you have gone out of scope — stop and re-read Scope.

### Files this plan creates

| Path | Purpose | Task |
|---|---|---|
| `packages/plugin/notes/css-api-surface-spike.md` | design/Dev Mode CSS parity evidence + route decision | 0 |
| `packages/plugin/src/lint/types.ts` + test | `Finding`, `Severity`, `ScanResult` | 1 |
| `packages/plugin/src/lint/scan.ts` + test | node walker + classification | 2 |
| `packages/plugin/src/lint/variables.ts` + test | variable → token proposals | 3 |
| `packages/plugin/src/ui/lint/**` | report view | 4 |
| `packages/plugin/src/lint/dismiss.ts` + test | per-user dismissals | 5 |
| `README.md` (section only) | what the four findings mean | 7 |

No new dependencies.

### Tasks

| # | Do this | Files it may touch | Done when |
|---|---|---|---|
| 0 | Spike `getCSSAsync()` on the same nine nodes in design mode and Dev Mode; record property/value parity and choose the linter surface using Step 0's decision rule. Commit the note before production code. | `notes/css-api-surface-spike.md` | Nine-node result table exists. If parity holds, design-mode UI is chosen; otherwise the existing Dev Mode Inspect UI is chosen. No CSS extraction is reimplemented |
| 1 | Write the finding types and the severity sort (high→medium→low, then node count descending). | `src/lint/types.ts` + test | A hand-built `ScanResult` sorts into the documented order with node-count as tiebreak |
| 2 | The scanner: **iterative stack walk** (not recursion), batches of 50 with a yield, progress callback, cancel flag, skip invisible + instance children, dedupe by `(property, value, nearestToken)`. Classify per the mapping in Step 2. | `src/lint/scan.ts` + test | Unit tests cover every classification branch, the dedupe (3 nodes → 1 finding, `nodeIds.length === 3`), skip rules, and mid-walk cancel leaving `cancelled: true` |
| 3 | The variable proposer: reusable token-key value match, name match, agreement → `high`/`medium`/`conflict`. **A conflict proposes nothing.** | `src/lint/variables.ts` + test | Tests cover all 3 outcomes, the 3 name-normalisation forms, the conflict case, unsupported variable types skipped, valid existing syntax skipped, and invalid/stale syntax reported |
| 4 | The report UI: scope picker, progress + cancel, grouped results, "Select these nodes", empty state, Markdown export. | `src/ui/lint/**` | On plan 004's test file: the near-miss node appears as high-severity drift naming the right token; 25 px padding appears with `distance: 1`; the gradient node produces nothing; "Select these nodes" selects and scrolls; the Markdown pastes as a readable table |
| 5 | Severity ordering + per-finding Dismiss. Persist in **`clientStorage`** by plan 003's `documentConfigId` + finding hash when tier 1 exists; otherwise use clearly labelled session-only dismissals. Add "Show dismissed (N)". | `src/lint/dismiss.ts` + test, `src/ui/lint/**` | Tier-1 dismissal survives reload; tier-2/3 dismissal says "this session" and resets on reload; toggle works. **And** `getSharedPluginData('figtail','meta')` is byte-identical before and after |
| 6 | Run a page scan on the large messy file. Record node count, duration, responsiveness, cancel behaviour. | none (measurement) | 1,000 nodes in <10 s, UI responsive (scroll the canvas mid-scan and confirm it moves), cancel shows partial results. Timings in the commit message |
| 7 | README section explaining the 4 finding types **for a designer** — what each means and how to fix it in Figma (~50 lines). | `README.md` | A reader can correctly explain what "unbound" means and what to do about it, without asking |

**The read-only assertion test is mandatory** (see Validation plan): run a full
scan against a mocked `figma` where every mutation method throws, and assert the
scan completes. That test stays in the suite permanently.

---

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

### What exists after plan 005

- `src/pipeline.ts` is the only plugin import site for `matchDeclarations`; it
  returns classes, match results, config tier, tokens/null, warnings, and
  unknown namespaces for a node. The linter must reuse it rather than fork the
  CSS/matching path.
- `packages/plugin/src/storage.ts` exports `readConfig()`, cached.
- `packages/plugin/src/mode-design.ts` runs when `figma.editorType === 'figma'`
  and currently shows the setup UI from plan 003 Step 6.
- `packages/plugin/src/hints.ts` exports the tested bound-variable resolver.
- Plan 003 stores a stable `documentConfigId` inside tier-1 metadata. Public
  plugins cannot use `figma.fileKey` as a general per-file identifier.

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
4. **Unmapped variable** — a variable exists in the file but has no valid
   `codeSyntax.WEB`, and fig-tail can propose a reusable Tailwind **token key**
   from the theme. This is
   exactly the input plan 007 acts on, and generating it here is why 007
   depends on 006.

### Scanning scope and performance

`documentAccess: "dynamic-page"` means pages load lazily. To scan beyond the
current page you must `await figma.loadAllPagesAsync()`, which on a large file
is slow and memory-hungry. —
[Migrating to dynamic loading](https://www.figma.com/plugin-docs/migrating-to-dynamic-loading/)
· [Working in Dev Mode](https://developers.figma.com/docs/plugins/working-in-dev-mode)

Therefore: **scan the current selection, or the current page. Never the whole
document.** Offer "Selection" (default when something is selected) and
"This page". A whole-document scan is explicitly out of scope — see Scope.

There is no documented Codegen-style deadline on either candidate UI route,
but a page with thousands of nodes still needs to not freeze Figma:

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
- The existing single UI router — adding the lint view to design mode if Task 0
  proves parity, otherwise to Dev Mode Inspect
- Tests for all of the above
- A README section describing the linter

**Out of scope**:

- **Any document write.** No `setVariableCodeSyntax`, no node mutation, and no
  `setSharedPluginData` call. Per-user `clientStorage` is allowed only for the
  dismissal behavior specified in Step 5. Plan 003's write-safety guards must
  pass unchanged, with no new allowlist entries. If you need to add an ESLint
  exception, you are out of scope.
- **Auto-fix of any kind.** Not "bind this variable for me", not "round this to
  the nearest token". Plan 007 is the only plan that writes design-variable
  data, and only to `codeSyntax`.
- **Whole-document scanning.** `loadAllPagesAsync()` must not appear in this
  plan's code.
- The Codegen surface. The linter may live inside plan 005's Dev Mode Inspect
  surface only when Task 0 shows design-mode CSS is unavailable or materially
  different.
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

### Step 0: Prove the CSS API on the intended surface

Before choosing a UI route, run a throwaway, read-only spike against plan 004's
nine-node fixture matrix. For each node, call `getCSSAsync()` once in the design
editor and once in Dev Mode, then record in
`packages/plugin/notes/css-api-surface-spike.md`: success/error, sorted property
names, and normalized values. Do not record user content beyond the fixture.

Decision rule:

- If all nine design-mode calls succeed and their normalized outputs match Dev
  Mode, put the linter in the design-mode route as originally intended.
- If design mode rejects, omits properties, or changes meanings, put the linter
  in the existing Dev Mode Inspect iframe from plan 005. Reuse
  `resolveNode`; do not recreate Figma's CSS from raw node properties.

Delete throwaway instrumentation before the commit. The note and its result
table are the durable artifact.

**Check**: the note covers all nine nodes, cites the Figma/plugin versions used,
states the selected route, and confirms no document-write API was called.

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
  suggestion?: { tokenKey: string; tokenValue: string; distance?: number; unit?: string }
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
progress callback, cancellation flag. For each node, call plan 005's
`resolveNode()` and classify its `MatchResult` values. Do not call
`getCSSAsync()`, `buildHints()`, or `matchDeclarations()` from the scanner; the
single-import-site invariant still applies:

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
`figma.variables.getLocalVariablesAsync()`
([Working with variables](https://developers.figma.com/docs/plugins/working-with-variables)). For each, if `codeSyntax.WEB` is
absent **or fails plan 002's configured-key-and-value validation**, propose a
reusable token key from the theme by:

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

Emit these as `unmapped-variable` findings with the token key in `suggestion`.
Never stamp or propose `bg-*`, `text-*`, or `border-*`: the same colour variable
may back all three properties, and the matcher derives the property-specific
utility at use time.

This function is the input plan 007 consumes. Export it cleanly and keep it
free of UI concerns.

**Check**: unit tests for each confidence outcome, the three name-normalisation
forms, the conflict case (proposes nothing, reports the conflict), variables
whose type is unsupported (BOOLEAN, STRING → skipped, not errored), a variable
with valid configured `codeSyntax.WEB` (→ no finding), and invalid/stale syntax
(→ an overwrite-required finding, never silently trusted).

### Step 4: Build the report UI

A second view in the single plugin iframe, reachable from the route selected in
Step 0 and back to that surface's ordinary view.

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

Dismissals use **`figma.clientStorage`** — deliberately *not* document storage,
because that would be a document write and would impose one person's judgement
on everyone else's report. When a tier-1 config supplies
`documentConfigId`, key by that ID plus a finding hash. When only tier 2 or 3 is
active there is no public, stable per-file identifier: keep dismissals in
module memory for the session and label the action "Dismiss this session".
Never use `figma.fileKey`; it is private-plugin-only.

Include a "Show dismissed (N)" toggle so dismissals are never invisible.

**Check**: dismiss a finding → it disappears from the list and the count drops.
Re-scan → it stays dismissed. Toggle "Show dismissed" → it reappears, marked.
For tier 1, reload the plugin → dismissals persist. For tier 2/3, reload → they
reset as labelled. Confirm via the plan 003 storage read
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
  outcomes plus the conflict case; name normalisation; valid and stale existing
  code syntax; tier-1 persistent versus tier-2/3 session dismissal scope.
- **API surface spike**: Step 0's nine-node design/Dev Mode parity table and
  resulting route decision.
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
- [ ] Step 0's nine-node comparison selected the linter route from evidence;
      no parallel CSS extractor exists
- [ ] All four finding types are produced correctly on the test file
- [ ] Findings are deduplicated with an accurate node count
- [ ] Findings are sorted by severity, then by node count descending
- [ ] "Select these nodes" selects and scrolls to the affected nodes
- [ ] The Markdown export pastes as a readable table
- [ ] Tier-1 dismissals persist by `documentConfigId`; tier-2/3 dismissals are
      explicitly session-only and reset on reload
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
  (say, several hundred on a normal page). Do not stop building — **ship the
  degraded version**: default the report to high-severity findings only, collapse
  the rest behind a "show all (N)" toggle, and cap the initial render. Then bring
  the owner the actual numbers, because thresholds that noisy usually mean the
  finding definitions need rethinking, and that is their call. A report nobody
  can act on is worse than no report; a report that opens on the worst twenty
  things is actionable.
- The write-safety lint rule flags `figma.currentPage.selection = …` or
  `scrollAndZoomIntoView` and narrowing it cleanly is not obvious. Do not add a
  broad exception to make it pass.
- `getLocalVariablesAsync()` does not return variables from linked libraries and
  the file's variables mostly live in a library. Keep going — local variables are
  still worth linting — but report it, because it substantially limits plan 007
  and needs to be known before 007 starts rather than during it.
- Scanning a page requires `loadAllPagesAsync()` in practice (i.e. the current
  page's nodes are not fully available without it).
- `getCSSAsync()` is unavailable or divergent in design mode **and** the plan
  005 Dev Mode Inspect surface cannot host the linter. The first half alone is
  not a STOP; Step 0 defines that fallback.
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
