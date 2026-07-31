# Plan 008: Add whole-subtree className export

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
> and compare `pipeline.ts`, `hints.ts`, render types, and UI routing with the
> prospective contracts below. A mismatch is a STOP condition.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED — the risk is scope creep. This plan sits one step away from
  "generate my component for me", which is a different and much larger product.
  The Scope section draws that line deliberately; hold it.
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

You need Figma desktop, plan 004's test file, **and** a realistically complex
frame (100+ nodes, nested components, text). Add it to `fixtures/figma/README.md`.

Route every node through `src/pipeline.ts`. **Do not call
`matchDeclarations` directly** — plan 005 has a test that fails if you do.

### Files this plan creates

| Path | Purpose | Task |
|---|---|---|
| `packages/plugin/src/tree/walk.ts` + test | iterative traversal, caps, cancel | 1 |
| `packages/plugin/src/hints.ts` (edit) | shared variable cache | 2 |
| `packages/plugin/src/pipeline.ts` (edit), `tree/resolve.ts` + test | shared context + chunked resolution | 3 |
| `packages/plugin/src/tree/emit/html.ts`, `jsx.ts`, `outline.ts` + tests | the three emitters | 4 |
| `packages/plugin/src/render.ts` (edit) | the Subtree section, both surfaces | 5 |
| `packages/plugin/src/mode-dev.ts` (edit) | one absolute Codegen deadline | 6 |
| `packages/plugin/manifest.json` (edit) | format + cap preferences | 5 |
| `README.md` (section only) | what it is and is not | 7 |

No new dependencies.

### Tasks

| # | Do this | Files it may touch | Done when |
|---|---|---|---|
| 1 | The walker: **iterative stack, never recursion.** Inspect defaults: depth 6 / 150 nodes. Codegen defaults: depth 5 / 40 nodes. Skip invisible, flatten `GROUP`. Returns a flat array + `truncated` + reason. | `src/tree/walk.ts` + test | Tests cover both surface profiles and caps, invisible exclusion (incl. children), group flattening with reparenting, and a 500-node tree not blowing the stack |
| 2 | Add a per-call `Map<variableId, Variable>` cache to `buildHints`, with a backwards-compatible signature (optional param, fresh map default). | `src/hints.ts` + test | 100 nodes binding the same variable → exactly **1** `getVariableByIdAsync` call. Plan 004's existing hints tests still pass unchanged |
| 3 | Extend `resolveNode` with an optional shared cache/deadline context, then resolve in chunks (~10 at a time) with cancel support. Returns the intermediate tree. | `src/pipeline.ts`, `src/tree/resolve.ts` + tests | Existing single-node callers/tests pass unchanged; mocked concurrency never exceeds the chunk size; calls equal nodes completed before deadline/cancel. Timing in commit message |
| 4 | The three emitters over the intermediate tree. Two-space indent. HTML-escape text **and** `data-name`. Byte-deterministic. | `src/tree/emit/**` + tests | Snapshots for all three formats, incl. nesting, escaping (`<`, `&`, `"`), the vector placeholder comment, and the truncation marker. Two runs → byte-identical |
| 5 | Add Subtree to **both** surfaces only when the node has children. Codegen uses discrete native select preferences; Inspect adds progress/cancel and larger controls. Keep plan 004's single-node section **first**. | `src/render.ts`, `src/ui/inspect/**`, `manifest.json` | All three formats render; each surface's caps respected; truncation marker shown; leaf section absent; JSX parses as JSX |
| 6 | Measure both profiles and the largest frame. Enforce one **2-second Codegen deadline from handler entry**; Inspect stays progressive/cancellable and may run longer. | `src/mode-dev.ts`, `src/tree/resolve.ts`, `src/ui/inspect/**` | Codegen always returns before 3 s and ordinarily before 2 s; temporarily lower guard to 100 ms → clean truncation. Inspect scans 150 nodes with progress and Cancel. Timings in commit message |
| 7 | README section (~40 lines) with a real input/output example. Say plainly what it is **not**: no assets, no positioning, not a component. | `README.md` | A developer reading it correctly predicts what they will get and does **not** expect a working component |

**If you find yourself reconstructing absolute positioning, stop.** That is out
of scope and it makes the output look more finished than it is.

---

## Why this matters

Plan 004 solved one node at a time. That is the right unit for looking something
up, and the wrong unit for building a card with a header, a body, and three
buttons — where a developer clicks through eleven nodes and copies eleven class
strings, reconstructing the nesting from the layers panel as they go.

This plan emits the whole subtree at once: a class-annotated skeleton with the
structure already in place. The developer replaces the tags with their real
components and keeps the classes.

The deliberate limit: **it is a skeleton, not a component.** No state, no props,
no imports, no event handlers, no asset extraction. Anima, Locofy and Builder.io
occupy the full design-to-code space with far more investment; fig-tail's edge is
correct class names from a real config, and this plan extends that edge to a
tree without chasing them.

## Context the executor needs

### What exists after plans 004 and 005

- `src/mode-dev.ts` — the generate handler, single node.
- `src/hints.ts` — `buildHints(node): Promise<Record<string, VariableHint>>`.
- `src/render.ts` — `MatchResult[]` → `CodegenResult[]`.
- `src/storage.ts` — `readConfig()`, cached at module level.
- `src/pipeline.ts` (plan 005) — `resolveNode(node, options)`, the single path
  both Dev Mode surfaces use. Route per-node work through it.
- `@fig-tail/match` — `matchDeclarations`, `toClassName`, `summarise`.
- Manifest declares `codegenPreferences` including an `output` select.

### Reference documentation

Gathered from Figma's docs on 2026-07-31; **open each before implementing
against it**, since these are search-located summaries rather than quotations.

- `figma.codegen.on('generate')`; the API reference says 15 seconds while the
  Codegen guide says 3 seconds. Treat 3 seconds as hard and keep the internal
  deadline at 2 seconds —
  [figma.codegen.on](https://developers.figma.com/docs/plugins/api/properties/figma-codegen-on)
  · [Codegen plugins](https://developers.figma.com/docs/plugins/codegen-plugins)
- `node.getCSSAsync()`, called once per node in the walk —
  [Update 68](https://developers.figma.com/docs/plugins/updates/2023/06/21/version-1-update-68)
  · [Shared node properties](https://www.figma.com/plugin-docs/api/node-properties/)
- `codegenPreferences` item types, for the format and cap preferences in Step 5 —
  [CodegenPreference](https://developers.figma.com/docs/plugins/api/CodegenPreference/)
- A Dev Mode plugin runs on the **current page only** by default —
  [Working in Dev Mode](https://developers.figma.com/docs/plugins/working-in-dev-mode)

### The stricter 3-second Codegen budget is the binding constraint

Plan 004 targets ~200 ms warm for a single node, most of it Figma API latency.
A subtree multiplies that, while the published docs conflict at 3 versus 15
seconds. The Codegen path must honor the stricter figure. The Inspect iframe has
no equivalent documented callback timeout, so it can expose progress and Cancel
for the larger 150-node workflow.

Mitigations, in order of impact:

1. **Surface-specific depth and node-count caps.** Codegen defaults to depth 5
   / 40 nodes; Inspect defaults to depth 6 / 150 nodes. When a subtree exceeds
   either, emit what fits, then a truncation marker
   (`<!-- fig-tail: truncated at 40 nodes; use Inspect for a larger export -->`).
   Truncated-but-useful beats timed-out-and-empty.
2. **Parallelise per node.** Walk the tree to collect nodes first, then call the
   shared `resolveNode` pipeline in bounded chunks of ~10.
3. **Cache variable resolution across the whole subtree.** A design system frame
   hits the same twenty variables hundreds of times. A `Map<variableId, Variable>`
   for the duration of one generate call is the single biggest win — build it in
   `hints.ts` so plan 004's single-node path benefits too.
4. **Skip invisible nodes** (`node.visible === false`) — they contribute nothing.

### Structure mapping

| Figma | Emitted element | Notes |
|---|---|---|
| `FRAME` / `COMPONENT` / `INSTANCE` with auto-layout | `<div>` with flex classes | Auto-layout already becomes `flex`/`flex-col`/`gap-*` via plan 002's layout matcher |
| `FRAME` without auto-layout | `<div>` | Absolute positioning is **not** reconstructed — see Scope |
| `TEXT` | `<span>` | Include the text content, HTML-escaped; semantic block/paragraph inference is out of scope |
| `RECTANGLE` / `ELLIPSE` / `VECTOR` | `<div>` | With a comment naming the node, so the developer knows to swap in an asset |
| `GROUP` | flattened — emit children directly | Figma groups have no layout meaning |
| Node with an image fill | `<img alt="" />` with a comment | No asset extraction — see Scope |

Node names become a `data-name` attribute (sanitised) so the developer can map
output back to the layer panel. Figma layer names are free text — escape them,
and never interpolate them into anything executable.

### Output formats

Driven by a new `codegenPreferences` select:

- **HTML** — `<div class="…">`, `language: 'HTML'`
- **JSX** — `<div className="…">`, `language: 'TYPESCRIPT'`
- **Classes only** — an indented outline of class strings, no tags, for someone
  who has their own markup

Indent two spaces per level. Emit deterministic output — same input, same bytes,
every time — so a developer can diff two exports.

## Inputs & resources

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm -r typecheck` | exit 0 |
| Test | `pnpm --filter @fig-tail/plugin test` | all pass |
| Build | `pnpm --filter @fig-tail/plugin build` | `dist/main.js`, `dist/ui.html` |
| Write-safety | `pnpm --filter @fig-tail/plugin lint && pnpm --filter @fig-tail/plugin test -t write-safety` | exit 0, passes |

Needed on hand: Figma desktop; the plan 004 test file; **plus** a realistically
complex frame — a real page or a Community design file with 100+ nodes,
nested components, and text. Add it to `fixtures/figma/README.md`.

## Scope

**In scope**:

- `packages/plugin/src/tree/**` — traversal, caps, parallel resolution, emitters
- `packages/plugin/src/hints.ts` — adding the per-call variable cache
- `packages/plugin/src/pipeline.ts` — optional resolution context, preserving
  existing single-node behavior
- `packages/plugin/src/mode-dev.ts` — creating and passing the one absolute
  Codegen deadline
- `packages/plugin/manifest.json` — discrete Codegen format/depth/node select preferences
- `packages/plugin/src/ui/inspect/**` — larger-cap progress and cancel controls
- `packages/plugin/src/render.ts` — adding the subtree section
- Tests, and a README section

**Out of scope**:

- **Real component generation.** No imports, no props, no state, no hooks, no
  event handlers, no framework idioms beyond `className`. If the output looks
  like it could compile as a component, it has gone too far.
- **Asset extraction.** No `exportAsync`, no image data, no SVG. Vectors and
  image fills get a placeholder and a comment. This keeps the plugin free of
  binary handling and keeps output pasteable as text.
- **Absolute positioning reconstruction.** Non-auto-layout frames emit a plain
  `<div>`. Translating Figma's absolute coordinates into `absolute top-[13px]
  left-[27px]` produces brittle code that nobody keeps, and it would make the
  output look more finished than it is.
- **Code Connect component substitution.** Deferred by the repo owner; not in
  this program (see `plans/README.md`, "Considered and set aside"). If it is
  ever built, the seam is: this plan emits `<div>`, that work replaces the `tag`
  with the mapped component. Keep `tag` a plain string so it can.
- **Any document write.** Plan 003's guards must pass unchanged.
- Responsive variants, dark mode, states — same reasoning as plan 002.

## Working approach

- Branch as instructed. Commit per step, prefixed `008-N:`.
- Keep traversal, matching, and emitting in three separate modules. The emitters
  should take a plain tree of `{ tag, classes, text, children, comment }` and
  know nothing about Figma — that makes them trivially testable and makes a
  fourth format a small change.

## Steps

### Step 1: Implement the traversal with caps and cancellation

`src/tree/walk.ts`: iterative (stack-based, not recursive), collecting nodes
with their depth and parent, honouring the depth and count caps, skipping
invisible nodes, and flattening `GROUP` nodes. Returns a flat array plus a
`truncated` flag and the reason.

**Check**: unit tests with a mocked node tree — depth cap truncates at the right
level; count cap truncates at the right node and sets the flag; invisible nodes
are excluded along with their children; groups are flattened with children
reparented; a 500-node tree does not blow the stack.

### Step 2: Add the shared variable cache to `hints.ts`

Introduce a per-generate-call `Map<variableId, Variable>` so repeated bindings
resolve once. Keep `buildHints`'s signature backwards-compatible for plan 004
(an optional cache parameter that defaults to a fresh map).

**Check**: a test where 100 nodes bind the same variable makes exactly one
`getVariableByIdAsync` call. Plan 004's existing `hints.ts` tests still pass
unchanged.

### Step 3: Resolve CSS and matches in parallel

`src/tree/resolve.ts`: given the flat node array, run plan 005's `resolveNode()`
in chunks of ~10 with `Promise.all`, passing a shared variable cache plus an
abort/deadline context. Returns the intermediate tree
(`{ tag, classes, text, children, comment, nodeName }`).

**Check**: a test asserting chunked parallelism (a mocked pipeline records that
concurrency never exceeds the chunk size, total calls equal node count without a
deadline, and no new chunk starts after cancellation). Plan 005's test still
asserts `matchDeclarations` has exactly one plugin import site. Timing on the
complex fixture frame recorded in the commit message.

### Step 4: Implement the three emitters

`src/tree/emit/{html,jsx,outline}.ts`, each taking the intermediate tree. HTML
escaping for text content and `data-name`. Two-space indent. Deterministic
output. A truncation comment when the walk truncated.

**Check**: snapshot tests for all three formats against a hand-built
intermediate tree, including: nested children, a text node with characters
needing escaping (`<`, `&`, a quote), a vector node with its placeholder
comment, and the truncation marker. Assert byte-identical output across two
runs.

### Step 5: Wire it into the codegen panel

Add a section, "Subtree", to **both** Dev Mode surfaces — the Code section
(plan 004) and the Inspect panel (plan 005) — emitted **only when the selected
node has children**. A leaf node should not produce a one-line subtree section
duplicating the primary output.

Add native Codegen preferences as `select` items only:

- format: HTML / JSX / Classes only;
- max depth: 3 / **5 default** / 6;
- max nodes: 20 / **40 default** / 60.

Figma Codegen preferences do not accept arbitrary numeric values. In the
Inspect UI, offer depth 3/5/6/10 and node caps 40/100/150/400, defaulting to
6/150, with progress and Cancel. A 400-node Inspect export is an explicit slow
choice, not a Codegen option.

Keep the primary single-node section from plan 004 **first**. It is the common
case; the subtree is the occasional one.

**Check**: in Dev Mode on the complex fixture frame, the Subtree section renders
in all three formats, respects both caps, shows the truncation marker when
capped, and is absent when a leaf node is selected. Copy the JSX output and
paste it into a scratch React file — it should be syntactically valid JSX (it
will not compile without real components; that is expected and correct).

### Step 6: Performance-test and enforce the budget

Measure Codegen at its default 5/40 and maximum 6/60 profiles. Measure Inspect
at 6/150 and the explicit 10/400 profile, plus the largest frame in the file.

**Hard Codegen requirement**: calculate one absolute deadline at the start of
the existing `generate` handler and pass it through single-node resolution,
traversal, subtree resolution, and emission. Do not start a fresh two-second
budget for the subtree. Stop starting work with enough time to serialize the
partial tree, and return an explanatory truncation marker before Figma's
stricter documented three-second limit. If 5/40 cannot reliably fit, lower the
Codegen defaults.

Inspect is progressive rather than deadline-bound: post completed/total after
each chunk, keep Cancel responsive, and discard a cancelled run's late results.

**Check**: measurements recorded in the commit message for both profiles. The
Codegen guard is verified by temporarily lowering it to 100 ms and confirming a
clean truncation marker. Inspect completes 150 nodes with visible progress and
cancel works during the 400-node run.

### Step 7: Document it

A README section: what the subtree export is and — equally important — what it
is not. Show a real example of input and output. State plainly that it is a
starting skeleton, that assets and positioning are not included, and why.
~40 lines.

**Check**: a developer reading it can correctly predict what they will get, and
does not expect a working component. Confirm by showing it to someone and asking
what they expect.

## Validation plan

- **Unit tests**: traversal caps, invisible skipping, group flattening,
  variable-cache hit count, chunked parallelism, all three emitters' snapshots,
  HTML escaping.
- **Determinism test**: emit the same tree twice; assert byte equality.
- **Manual matrix** on the complex fixture: all three formats, both caps,
  truncation marker, leaf-node absence, JSX syntactic validity.
- **Performance**: Step 6's Codegen deadline measurements plus Inspect
  progress/cancel verification.
- **Write-safety regression**: plan 003's guards pass unchanged, no new
  allowlist entries.

## Done criteria

ALL must hold.

- [ ] `pnpm -r typecheck && pnpm -r lint && pnpm -r test` → exit 0
- [ ] All three output formats render correctly in Dev Mode
- [ ] Depth and node caps are enforced and configurable via preferences
- [ ] Truncation always emits an explanatory marker
- [ ] The Codegen runtime guard truncates cleanly before the conservative
      3-second limit and targets 2 seconds internally (verified)
- [ ] Inspect exports 150 nodes with progress and working Cancel
- [ ] The variable cache reduces resolution calls to one per unique variable
- [ ] Output is byte-deterministic across runs
- [ ] Text content and node names are HTML-escaped
- [ ] The Subtree section is absent for leaf nodes
- [ ] Plan 004's single-node section is unchanged and still first
- [ ] Plan 003's write-safety guards pass with no new allowlist entries
- [ ] No files outside the in-scope list were changed
- [ ] `plans/README.md` status row for 008 updated

## STOP conditions

Stop and report back — do not improvise — if:

- Codegen cannot return before the 3-second limit even at reduced caps on a realistic
  frame. The feature may need to move out of codegen entirely (into a design-mode
  view with its own progress UI), which is a different plan.
- `getCSSAsync()` behaves differently on nested nodes than on top-level ones
  (e.g. returns inherited or absolute values) in a way that makes child classes
  wrong.
- Producing useful output requires absolute positioning after all. That is a
  scope expansion the owner should approve, not a judgement call.
- The output is consistently more misleading than helpful on real frames —
  developers deleting most of it. Bring examples; the honest outcome may be to
  ship only the "Classes only" format.
- A step's check fails twice after a reasonable attempt.

## Handoff / after it lands

- **A future Code Connect iteration** would substitute mapped components for
  `<div>`s in this output. The seam is `src/tree/emit/*` — keep the intermediate
  tree's `tag` field a plain string so that work is additive.
- **What a reviewer should scrutinise most**: whether the output is actually
  used, or deleted and retyped. This is the one plan in the program whose value
  is genuinely uncertain until people try it — ship it, then ask.
- **Deliberately deferred**: asset export, absolute positioning, framework
  templates (Vue/Svelte), and any per-node result caching across generate calls
  (the per-call cache from Step 2 is enough; a cross-call cache would need
  invalidation on document change, which is not worth it yet).
