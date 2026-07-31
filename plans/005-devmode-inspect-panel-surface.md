# Plan 005: Ship the Dev Mode Inspect-panel surface

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
> plan 004 existed. Confirm 004 is `DONE`, locate its landing commit with
> `git log --oneline -- plans/004-devmode-codegen-panel.md packages/plugin/src`,
> and compare `mode-dev.ts`, `hints.ts`, and `render.ts` with the prospective
> contracts below. A mismatch is a STOP condition; do not use a placeholder SHA.

## Status

- **Priority**: P1 — part of the core promise, not an extra.
- **Effort**: M
- **Risk**: MED — the main risk is the two Dev Mode surfaces drifting apart and
  reporting different answers for the same node. Step 2 makes that structurally
  impossible rather than a matter of discipline.
- **Depends on**: 004
- **Category**: dx
- **Planned at**: commit `2157dc6`, 2026-07-31 — dependency contract is prospective.

## Build sheet

Use Node 20+ and pnpm. Preserve plan 004's package scripts and strict TypeScript
settings; use named exports, no `any`, no non-null assertions, and colocated
Vitest tests. Before every commit run
`pnpm -r typecheck && pnpm -r lint && pnpm -r test`.

Do the tasks below **in order, one at a time**. Each task's *Done when* is a
command or a named in-Figma check; it must produce the stated result before you
start the next task. Commit after each task. Everything after this section is
**reference** — read a section when a task points you at it.

### You need Figma desktop, and plan 004's test file

A second Figma account helps for task 1 but is not required.

### Files this plan creates or edits

| Path | Purpose | Task |
|---|---|---|
| `packages/plugin/notes/devmode-discovery.md` | the persistence findings | 1 |
| `packages/plugin/src/pipeline.ts` + test | **the** shared resolution path | 2 |
| `packages/plugin/src/mode-dev.ts` (refactor) | now calls the pipeline | 2 |
| `packages/plugin/src/render.ts` (refactor) | shared grouping/ordering | 2 |
| `packages/plugin/src/inspect/index.ts` | sandbox side, selection handling | 3 |
| `packages/plugin/src/ui/inspect/**` | the panel UI | 3 |
| `packages/plugin/src/consistency.test.ts` | surfaces produce identical strings | 4 |
| `README.md` (section only) | "Two ways to see it" | 6 |

No new dependencies.

### Tasks

| # | Do this | Files it may touch | Done when |
|---|---|---|---|
| 1 | Answer the 5 discovery questions in Step 1 by hand and write them up with screenshots. **Do not skip to task 2 first.** | `notes/devmode-discovery.md` | The file answers all 5 and ends with **one sentence** stating what a first-time developer must do. Plan 010's README is built from that sentence |
| 2 | **Refactor before building anything new.** Extract `resolveNode` into `src/pipeline.ts`; point `mode-dev.ts` at it. Add the test asserting `matchDeclarations` is imported in **exactly one file**. | `src/pipeline.ts`, `mode-dev.ts`, `render.ts` + test | The single-import-site test passes, **and** plan 004's full 9-node matrix produces byte-identical output to `fixtures/figma/README.md`. Any difference is a refactor bug, not an improvement |
| 3 | Build the panel: config status (3 tiers + `unknownNamespaces`), header w/ multi-select stepper, all-classes + format toggle, grouped classes w/ confidence badges, needs-attention, empty state. Debounce `selectionchange` at ~120 ms and enforce latest-request-wins. | `src/inspect/**`, `src/ui/inspect/**` | Every state walked by hand. Rapid A→B selection can never render stale A after B. **Every copy button pasted into a text editor and compared** — they must copy exactly what they display |
| 4 | Add the cross-surface consistency test, then verify by hand across all 9 nodes. | `src/consistency.test.ts` | Test passes; the 9-node hand comparison shows zero differences; comparison recorded in the commit message |
| 5 | Measure warm / rapid / cold. Verify the 3 fallback modes on **both** surfaces. | `src/inspect/**` | Warm <250 ms, cold <1 s, rapid selection stays responsive. No config → arbitrary classes + banner on both surfaces, never an error |
| 6 | README "Two ways to see it" — Code section and Inspect panel, with task 1's sentence and a screenshot of each. | `README.md` | Someone followed it from a fresh Figma session and reached class names by **both** routes |

**Do task 2 before task 3.** Building the panel first and unifying afterwards is
exactly how the two surfaces end up permanently divergent.

---

## Why this matters

The requirement is that a developer opens a design in Dev Mode and the Tailwind
classes are **just there** — not something they have to go hunting for.

Plan 004 puts fig-tail in the **Code section**, which is the right place for it:
inline with Figma's own CSS output, one panel down from the properties a
developer is already reading. But reaching it means picking "Tailwind" from the
language dropdown, and **whether that choice persists across files and sessions
is not documented anywhere** — despite searching Figma's plugin docs, help
centre, and forum. If it does not persist, every developer re-selects it on every
file, which is exactly the hunting this program exists to eliminate.

The `inspect` capability is the answer to that risk. It is a separate,
full-height surface in Dev Mode's Inspect panel that does not depend on the Code
language dropdown. Whether an ordinary user must launch/select it again is an
in-product discovery question for Step 1; do not call it persistent until that
test proves it. Org admins can **pin** it so it appears automatically for
every developer in the organisation — and while the repo owner's account cannot
pin (no Organization tier), this plugin is being published publicly, and org-tier
teams are exactly the ones who will install it.

It also removes a real constraint. The Code section is a plain text box: no
copy-per-group, no confidence badges, no interaction. An iframe is a real UI.

So: two surfaces, one pipeline. Step 1 finally answers the persistence question
and records it.

## Context the executor needs

### Verified Figma platform facts

Gathered from Figma's documentation on 2026-07-31. **Open the linked page before
implementing against a fact you depend on** — these are summaries located by
search, not quotations, and the pages 403 automated fetching. If a page
contradicts a line here, the page wins; fix the line in the same commit.

1. `manifest.capabilities` may contain **both** `"codegen"` and `"inspect"`;
   possible values are `codegen`, `inspect`, `textreview`, `vscode`. Plan 003
   already declares both. —
   [Plugin manifest](https://developers.figma.com/docs/plugins/manifest)
2. **`inspect`** means the plugin runs in the **Inspect panel** in Dev Mode. When
   it opens an iframe, **the iframe takes the full height and width of the
   Inspect panel**. —
   [Working in Dev Mode](https://developers.figma.com/docs/plugins/working-in-dev-mode)
3. **`codegen`** means the plugin runs in the **Code section** of that panel and
   appears in Figma's native language dropdown; selection happens via the
   dropdown at the section's top right. —
   [Codegen plugins](https://developers.figma.com/docs/plugins/codegen-plugins)
   · [Use code snippets in Dev Mode](https://help.figma.com/hc/en-us/articles/15023202277399-Use-code-snippets-in-Dev-Mode)
4. A Dev Mode plugin runs on the **current page only** by default; other pages
   must be loaded explicitly. This plan never needs another page — it responds to
   the current selection. —
   [Working in Dev Mode](https://developers.figma.com/docs/plugins/working-in-dev-mode)
5. Users can **save** a plugin to their account (the ribbon icon) for access
   across files. —
   [Use plugins in files](https://help.figma.com/hc/en-us/articles/360042532714-Use-plugins-in-files)
6. **Org admins** can *pin* a Dev Mode plugin so it appears in the Inspect panel
   for all users, and can set a default code language. Both are
   Organization/Enterprise features. —
   [Manage Dev Mode settings for an organization](https://help.figma.com/hc/en-us/articles/22927410880535-Manage-Dev-Mode-settings-for-an-organization)
7. The conflicting 3-/15-second `generate` timeout applies to Codegen only.
   This surface has no documented equivalent hard limit — but it must stay
   responsive, and it shares the sandbox with Figma's own UI. —
   [figma.codegen.on](https://developers.figma.com/docs/plugins/api/properties/figma-codegen-on)

Background reading: [Guide to Dev Mode](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode)
for the user-facing view of what a developer actually sees.

### Not verified — and why it does not block

**Whether the Code-section language selection persists per user across files and
sessions.** No documentation found either way. Step 1 tests it and records the
result.

This is deliberately non-blocking, because **this plan is the fallback.**
Whichever way persistence resolves, the Inspect panel is a second surface that
does not depend on the Code language dropdown. Step 1 must document the actual
ordinary-user launch path; only org pinning may be described as automatic
without further evidence. The answer changes what the README tells developers to do *first*
(plan 010), not whether anything ships. If Step 1 cannot be run at all — no
second account, say — record that and carry on.

### What exists after plan 004

- `src/mode-dev.ts` — the `figma.codegen.on('generate')` handler.
- `src/hints.ts` — `buildHints(node)`: resolves `node.boundVariables` into
  `VariableHint` objects (`codeSyntax.WEB` and variable name), deduped by
  variable ID and resolved in parallel.
- `src/render.ts` — `MatchResult[]` → `CodegenResult[]`, including the primary
  class string and the "Needs attention" drift section.
- `src/storage.ts` — `readConfig()`, cached at module level.
- `@fig-tail/match` — `matchDeclarations`, `toClassName`, `summarise`, and the
  `Confidence` ladder: `exact-variable` → `exact-value` → `name-match` →
  `nearest` → `arbitrary` → `none`.
- The manifest already declares `"inspect"`; plan 003 Step 3 left a placeholder
  in the Inspect panel.

### The one-pipeline rule

The two surfaces **must not** be able to disagree. A developer who checks the
Code section and then the Inspect panel and sees two different answers has lost
all trust in the tool, and that failure would be invisible in testing because it
only appears when the two code paths drift months apart.

Therefore: extract the shared work into `src/pipeline.ts` —
`resolveNode(node, options): Promise<NodeResult>`. Both `mode-dev.ts` (codegen) and this surface call
it. **Neither may call `matchDeclarations` directly.** Enforced by a test in
Step 2.

Surfaces differ only in *presentation*: the Code section renders a text box, the
Inspect panel renders a UI. Same inputs, same computation, same answers.

### Selection handling

The iframe needs to know what is selected and re-render when it changes.

- Sandbox: `figma.on('selectionchange', …)` → post the resolved `NodeResult` to
  the iframe.
- **Debounce** at ~120 ms. Dragging across a canvas fires selection changes
  rapidly, and resolving on every one will make Figma feel sluggish. Debounce
  alone is insufficient because async request A can finish after request B;
  increment a request sequence and discard every result that is no longer the
  latest before posting it to the iframe.
- Handle multi-select explicitly: Figma's codegen surface is handed a single
  node, but `figma.currentPage.selection` may hold several. Show the first
  node's classes with a clear "3 layers selected — showing <name>" header and a
  way to step between them. Do **not** merge multiple nodes' classes into one
  string; that would be meaningless.
- Handle empty selection with a genuine empty state, not a blank panel.

### What this surface can do that the Code section cannot

The Code section is a text box with one copy button. Use the iframe for the
things that actually save time:

- **Grouped output with per-group copy** — layout, spacing, typography, colour,
  effects. Developers often want only the typography classes for a text node.
- **Confidence badges per class.** `exact-variable` reads differently from
  `arbitrary`, and in the Code section that distinction is invisible.
- **Drift shown inline**, attached to the class it concerns, rather than in a
  separate section below.
- **The unresolved-config report**, surfaced once at the top when plan 001's
  resolver could not fully read the config. A developer seeing odd output
  deserves to know the config was only partly readable — currently that
  information dies in the setup UI.
- **Copy formats**: raw classes, `class="…"`, `className="…"`.

Keep it dense and quiet. This panel sits next to Figma's own inspect output all
day; it should not compete with it.

## Inputs & resources

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm -r typecheck` | exit 0 |
| Test | `pnpm --filter @fig-tail/plugin test` | all pass |
| Build | `pnpm --filter @fig-tail/plugin build` | `dist/main.js`, `dist/ui.html` |
| Write-safety | `pnpm --filter @fig-tail/plugin lint && pnpm --filter @fig-tail/plugin test -t write-safety` | exit 0, passes |
| Bundle size | `wc -c < packages/plugin/dist/ui.html` | under 500 kB |

Needed on hand:

- **Figma desktop app**.
- The plan 004 test file (its URL is recorded in `fixtures/figma/README.md`),
  with a config already loaded.
- **A second Figma account** for Step 1's persistence test. If unavailable, see
  the Step 1 fallback.

## Scope

**In scope**:

- `packages/plugin/src/pipeline.ts` — the shared resolution path (Step 2)
- `packages/plugin/src/mode-dev.ts` — refactored to call the pipeline
- `packages/plugin/src/inspect/**` — the sandbox side of the inspect surface
- `packages/plugin/src/ui/inspect/**` — the panel UI
- `packages/plugin/src/render.ts` — refactored so both surfaces share grouping
  and ordering logic
- Tests, and a README section covering both surfaces

**Out of scope**:

- **Changing what fig-tail reports.** This plan changes presentation only. If a
  class or a confidence level looks wrong, that is a plan 002 or 004 bug — report
  it, do not patch it here. (The config-status line and the tier-3 banner are
  presentation of state plans 003 and 004 already produce, not new reporting.)
- **Any document write.** Plan 003's guards must pass unchanged, with no new
  allowlist entries. Note that setting `figma.currentPage.selection` (for the
  multi-select stepper) is *not* a document mutation — it changes no persisted
  state — but confirm the lint rule agrees rather than adding a broad exception.
- The linter — plan 006. Stamping — plan 007. Subtree export — plan 008. If plan
  008 lands first, its subtree output gets a section here; if not, do not build
  one speculatively.
- Publishing and listing assets — plan 010.

## Working approach

- Branch as instructed. Commit per step, prefixed `005-N:`.
- **Do Step 2 (the refactor) before Step 3 (the new UI).** Building the panel
  first and unifying afterwards is how the two surfaces end up permanently
  divergent.
- Rebuild and reload in Figma desktop after every step.

## Steps

### Step 1: Settle the language-persistence question

The open question from plan 003 and the README. Test it directly:

1. In Figma desktop, open the test file in Dev Mode, select "Tailwind" in the
   Code section dropdown.
2. Open a **different file** in Dev Mode. Is Tailwind still selected?
3. Quit Figma, reopen, return to the first file. Still selected?
4. On a **second account** that has never used the plugin: is anything
   pre-selected, and what does the dropdown look like before they choose?
5. Note whether the plugin appears in the Inspect panel automatically, or must
   be found and run.

Record all five answers, with screenshots, in
`packages/plugin/notes/devmode-discovery.md`.

*If no second account is available*, run steps 1–3 and 5 and record step 4 as
untested. Do not guess — plan 010's documentation depends on this being accurate.

**Check**: `devmode-discovery.md` answers each point with evidence and states, in
one sentence, what a first-time developer has to do to see fig-tail output. That
sentence is what plan 010's README will be built around.

### Step 2: Extract the shared pipeline and prove both surfaces use it

Create `src/pipeline.ts`:

```ts
export type NodeResult = {
  nodeId: string
  nodeName: string
  nodeType: string
  results: MatchResult[]
  summary: MatchSummary
  className: string          // sorted, canonical order
  groups: Array<{ label: string; classNames: string[]; results: MatchResult[] }>
  configSource: 'document' | 'user' | null
  configLabel: string
  tokens: TokenSet | null
  configWarnings: string[]   // from the stored unresolved report
  unknownNamespaces: string[]
}

export type UiNodeResult = Omit<NodeResult, 'tokens'>

export async function resolveNode(
  node: SceneNode,
  options: Partial<MatchOptions>,
): Promise<NodeResult>
```

It does what plan 004's generate handler currently does inline: `readConfig()`,
`getCSSAsync()`, `buildHints()`, `matchDeclarations()`, `toClassName()`,
`summarise()`, plus the grouping used by both surfaces. It carries config tier,
tokens/null, and unresolved status in the result so neither presentation layer
re-reads storage or reconstructs that state independently. `tokens` is internal
pipeline context only: before posting to the iframe, convert to `UiNodeResult`
and strip the full TokenSet. Do not structured-clone ~120 kB of tokens on every
selection change.

Refactor `mode-dev.ts` to call it. Behaviour must be **unchanged** — plan 004's
test matrix is the regression net.

Then add the enforcement test: assert that `matchDeclarations` is imported in
exactly one file (`src/pipeline.ts`) across `packages/plugin/src`. A second
import site is how the surfaces drift.

**Check**: `pnpm --filter @fig-tail/plugin test` → passes, including the
single-import-site test. Re-run **plan 004's full nine-node test matrix** in Dev
Mode and confirm every output is identical to what `fixtures/figma/README.md`
records. Any difference is a refactor bug, not an improvement.

### Step 3: Build the inspect-panel UI

The panel renders a `UiNodeResult`; the full `TokenSet` never crosses into the
iframe message. Sections top to bottom:

1. **Config status** — always present, one line, naming which tier of plan 003's
   config-source ladder is in use:
   - tier 1 → "Tailwind config: saved on this file"
   - tier 2 → "Tailwind config: your personal settings (this file has none shared)"
   - tier 3 → a prominent banner, "No Tailwind config — generic Tailwind
     suggestions; your project prefix/settings may require changes",
     with an **Add your config** button that opens the setup UI inline. Tier 3
     is not an error state and must not look like one: the panel below it still
     shows complete, copyable arbitrary-value classes, and the button works
     without edit access.

   Plus, on any tier, when `configWarnings` is non-empty: "N settings in your
   config could not be read", expandable to the per-entry reasons and remedies
   from plan 001's resolver report.

   And, given greater weight than the rest of that report, a line for
   `unknownNamespaces`: "Colours could not be read from your config — showing
   raw values for them." Those namespaces are why a developer sees
   `bg-[#3b82f6]` where they expected `bg-brand-500`, and it is the single
   question this panel is most likely to be asked. State it once at the top,
   name the namespaces, and do not repeat it per class.
2. **Header** — node name and type. When multiple layers are selected: "3 layers
   selected — showing Card" with previous/next controls.
3. **All classes** — the full string with one copy button and a format toggle
   (classes / `class="…"` / `className="…"`). This is the common case; put it
   first and make it big.
4. **Grouped classes** — layout, spacing, sizing, typography, colour, borders,
   effects. Each group copyable on its own. Each class carries a confidence
   badge; hovering or tapping shows the source (`"from variable brand/500"`,
   `"matched #3b82f6"`).
5. **Needs attention** — drift, off-system values, and unsupported properties,
   each naming the nearest token and the distance. Absent when empty; never a
   permanent zero-count section.
6. **Empty state** — when nothing is selected: one line explaining that selecting
   a layer shows its classes. Distinct from tier 3, which is about the config,
   not the selection — a user with no config **and** no selection should see the
   config banner and the selection hint, not one masking the other.

Wire selection: `figma.on('selectionchange')` in the sandbox, debounced at
~120 ms, resolving and posting a `NodeResult`. Increment a monotonically
increasing request ID before each resolve and post only if it still equals the
latest ID. Add a deferred-promise test in which A starts, B starts, B resolves,
then A resolves; the iframe must receive B only.

Use plan 003's single inlined `ui.html`. The Inspect sandbox path posts the
initial `{ view: 'inspect' }` route and the UI mounts this panel; it does not
introduce a second manifest UI entry or a second HTML artifact.

**Check**: in Dev Mode on the test file, walk every state by hand — clean node,
drift node, unsupported node, text node, multi-select, empty selection, and a
file whose config has unresolved entries. Every copy button copies exactly what
it displays (paste each into a text editor and compare). The panel updates on
selection change without a visible lag.

### Step 4: Make the two surfaces consistent, and prove it

Add a consistency test that, for a set of mocked nodes, asserts the class string
the codegen surface produces is **byte-identical** to the one the inspect surface
produces. Include a node with drift, one with an arbitrary value, and one with a
bound variable.

Then verify by hand on the test file: for each of plan 004's nine nodes, open the
Code section and the Inspect panel and confirm the class strings match exactly.

**Check**: the consistency test passes, and the nine-node hand comparison shows
no differences. Record the comparison in the commit message.

### Step 5: Performance and resilience

Measure on the test file and on the largest frame available:

- Selection-change to rendered panel, warm — target **under 250 ms**.
- Rapid selection changes (drag across many layers) — the debounce holds and
  Figma stays responsive.
- Cold first render after opening the panel — target under 1 s.

Then verify the fallback and failure modes explicitly: no config stored (→
arbitrary-value classes plus the tier-3 banner, on **both** surfaces — never an
error or a blank panel); corrupt stored config (→ a readable message, and fall
through to tier 2 or tier 3 rather than dying); a node whose `getCSSAsync()`
rejects (→ that node reports an error, the panel keeps working on the next
selection).

**Check**: measurements recorded in the commit message. All three failure modes
produce readable output rather than a blank or frozen panel.

### Step 6: Document both surfaces

Extend the README with a "Two ways to see it" section: the Code section (inline
with Figma's CSS, chosen from the language dropdown) and the Inspect panel.
Describe ordinary-user persistence/launch behavior only as Step 1 observed it;
state separately that org admins can pin it for everyone. State plainly what a
first-time developer has to do. Include a screenshot of each.

**Check**: someone who has never used fig-tail can follow this section on a file
that already has a config and reach class names by either route. Confirm by
following it literally from a fresh Figma session.

## Validation plan

- **Unit tests**: `resolveNode` for each node shape; grouping and ordering; the
  single-import-site enforcement; multi-select handling; debounce and
  out-of-order async completion behaviour;
  the three failure modes.
- **Cross-surface consistency test**: Step 4, byte-identical class strings.
- **Plan 004 regression**: the full nine-node matrix, re-run after the Step 2
  refactor, matching `fixtures/figma/README.md` exactly.
- **Manual panel matrix**: every UI state from Step 3, plus every copy button
  verified by pasting.
- **Performance**: Step 5's measurements.
- **Write-safety regression**: plan 003's lint rule and bundle test pass
  unchanged, with **no new allowlist entries**.

## Done criteria

ALL must hold.

- [ ] `pnpm -r typecheck && pnpm -r lint && pnpm -r test` → exit 0
- [ ] `packages/plugin/notes/devmode-discovery.md` answers all five Step 1
      questions with evidence, and states in one sentence what a first-time
      developer must do
- [ ] `matchDeclarations` is imported in exactly one file (`src/pipeline.ts`),
      asserted by a test
- [ ] Plan 004's nine-node matrix produces identical output after the refactor
- [ ] The Inspect panel renders every state in Step 3, including all three
      config tiers, the unresolved-config warning, multi-select, and empty
      selection
- [ ] Tier 3 shows usable arbitrary-value classes plus an **Add your config**
      action that works from Dev Mode — it never looks like an error
- [ ] `unknownNamespaces` is explained once at the top, naming the namespaces,
      and never repeated per class
- [ ] Every copy button copies exactly what it displays (verified by pasting)
- [ ] The two surfaces produce byte-identical class strings, asserted by a test
      **and** verified by hand across nine nodes
- [ ] Selection-change to rendered panel under 250 ms warm; under 1 s cold
- [ ] Rapid selection changes stay responsive
- [ ] Latest-request-wins test proves a late stale resolve cannot replace the
      current selection
- [ ] All three fallback/failure modes produce readable, usable output on both
      surfaces — a corrupt config degrades to a lower tier rather than failing
- [ ] Plan 003's write-safety guards pass with no new allowlist entries
- [ ] `dist/ui.html` under 500 kB
- [ ] No files outside the in-scope list were changed
- [ ] `plans/README.md` status row for 005 updated

## STOP conditions

Stop and report back — do not improvise — if:

- **The `inspect` capability does not behave as documented** — the iframe does
  not appear in the Inspect panel, or cannot read the current selection. Ship
  what does work (plan 004's Code section is unaffected, and the Step 2 pipeline
  refactor is worth keeping either way), mark this plan BLOCKED with the
  evidence, and report. The program still functions on one surface; what the
  owner needs to weigh is whether discovery is good enough without the second.
- The Step 2 refactor changes any output in plan 004's matrix and the cause is
  not obvious. Do not "fix" the matrix to match; the matrix is the record.
- The two surfaces cannot be made byte-identical for structural reasons.
- Selection changes cannot be made responsive without dropping updates.
- Any part of this requires a document write.
- A step's check fails twice after a reasonable attempt.

## Handoff / after it lands

- **With 001–005 and 010 done, the product is complete against its core
  promise.** A developer installs one plugin and reads real class names. Consider
  publishing here and letting real usage decide whether 006–009 get built.
- **Plan 006** reuses `summarise` and `buildHints` to scan a page. **Plan 007**
  makes `exact-variable` the common case, and the confidence badges in this panel
  are where that improvement becomes visible — re-check them after 007 lands.
  **Plan 008** adds a subtree section to this panel and to the Code section; it
  must go through `pipeline.ts` like everything else.
- **What a reviewer should scrutinise most**: the single-pipeline enforcement.
  Two surfaces reporting different answers is the failure that would destroy
  trust in the tool, and it would not show up in ordinary testing. Ask to see the
  import-site test and the nine-node hand comparison.
- **Deliberately deferred**: a settings view inside the inspect panel (codegen
  preferences already cover the options, and duplicating them invites the two
  from disagreeing), and merged output for multi-select (meaningless as a single
  class string).
