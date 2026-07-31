# Plan 007: Add whole-subtree className export

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. If anything in "STOP conditions" occurs,
> stop and report — do not improvise. When done, update the status row for this
> plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat <SHA at which 004 completed>..HEAD -- packages/plugin/src`
> This plan reuses plan 004's `buildHints` and rendering path per node.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED — the risk is scope creep. This plan sits one step away from
  "generate my component for me", which is a different and much larger product.
  The Scope section draws that line deliberately; hold it.
- **Depends on**: 004
- **Category**: dx
- **Grounded at**: the commit at which plan 004 landed.

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

### What exists after plan 004

- `src/mode-dev.ts` — the generate handler, single node.
- `src/hints.ts` — `buildHints(node): Promise<Record<string, VariableHint>>`.
- `src/render.ts` — `MatchResult[]` → `CodegenResult[]`.
- `src/storage.ts` — `readTokens()`, cached at module level.
- `@fig-tail/match` — `matchDeclarations`, `toClassName`, `summarise`.
- Manifest declares `codegenPreferences` including an `output` select.

### The 15-second budget is now the binding constraint

Plan 004 measured ~200 ms warm for a single node, most of it `getCSSAsync()` and
variable resolution. A subtree multiplies that. Sixty nodes at 200 ms is twelve
seconds — inside the limit, but only just, and a real design frame can hold
hundreds of nodes.

Mitigations, in order of impact:

1. **Depth and node-count caps.** Default: depth 6, 150 nodes. When a subtree
   exceeds either, emit what fits, then a truncation marker
   (`<!-- fig-tail: truncated at 150 nodes; increase the limit in preferences -->`).
   Truncated-but-useful beats timed-out-and-empty.
2. **Parallelise per node.** `getCSSAsync()` and variable resolution are
   independent across siblings. Walk the tree to collect nodes first, then
   `Promise.all` in chunks of ~20.
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
| `TEXT` | `<span>` or `<p>` | Include the text content, HTML-escaped |
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
- `packages/plugin/manifest.json` — the format preference and cap preferences
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
- **Code Connect component substitution** — plan 008. If 008 lands first, the
  seam is: 007 emits `<div>`, 008 replaces it with the mapped component. Do not
  build the substitution here.
- **Any document write.** Plan 003's guards must pass unchanged.
- Responsive variants, dark mode, states — same reasoning as plan 002.

## Working approach

- Branch as instructed. Commit per step, prefixed `007-N:`.
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

`src/tree/resolve.ts`: given the flat node array, run `getCSSAsync()` +
`buildHints()` + `matchDeclarations()` in chunks of ~20 with `Promise.all`,
sharing the variable cache. Returns the intermediate tree
(`{ tag, classes, text, children, comment, nodeName }`).

**Check**: a test asserting chunked parallelism (a mocked `getCSSAsync` that
records concurrency never exceeds the chunk size, and total calls equal node
count). Timing on the complex fixture frame recorded in the commit message.

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

Add a third section, "Subtree", emitted **only when the selected node has
children**. A leaf node should not produce a one-line subtree section
duplicating the primary output.

Add the preferences: format select (HTML / JSX / Classes only), max depth
(default 6), max nodes (default 150).

Keep the primary single-node section from plan 004 **first**. It is the common
case; the subtree is the occasional one.

**Check**: in Dev Mode on the complex fixture frame, the Subtree section renders
in all three formats, respects both caps, shows the truncation marker when
capped, and is absent when a leaf node is selected. Copy the JSX output and
paste it into a scratch React file — it should be syntactically valid JSX (it
will not compile without real components; that is expected and correct).

### Step 6: Performance-test and enforce the budget

Measure total generate time on the complex fixture at the default caps, at
depth 10 / 400 nodes, and on the largest frame in the file.

**Hard requirement**: the generate callback must never exceed **10 seconds**,
leaving 5 seconds of headroom under Figma's 15-second limit. If defaults cannot
hit that, lower the defaults — do not raise the risk.

Add a **runtime guard**: track elapsed time during resolution and truncate early
with an explicit marker if it passes 8 seconds, regardless of the caps. A
timeout with no output is the worst outcome; a truncated result with an
explanation is recoverable.

**Check**: measurements recorded in the commit message for all three cases. The
runtime guard verified by temporarily lowering it to 100 ms and confirming a
clean truncation marker rather than an error.

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
- **Performance**: Step 6's measurements plus the runtime-guard verification.
- **Write-safety regression**: plan 003's guards pass unchanged, no new
  allowlist entries.

## Done criteria

ALL must hold.

- [ ] `pnpm -r typecheck && pnpm -r lint && pnpm -r test` → exit 0
- [ ] All three output formats render correctly in Dev Mode
- [ ] Depth and node caps are enforced and configurable via preferences
- [ ] Truncation always emits an explanatory marker
- [ ] The runtime guard truncates cleanly before the 15-second limit (verified)
- [ ] Generate never exceeds 10 seconds on the complex fixture at default caps
- [ ] The variable cache reduces resolution calls to one per unique variable
- [ ] Output is byte-deterministic across runs
- [ ] Text content and node names are HTML-escaped
- [ ] The Subtree section is absent for leaf nodes
- [ ] Plan 004's single-node section is unchanged and still first
- [ ] Plan 003's write-safety guards pass with no new allowlist entries
- [ ] No files outside the in-scope list were changed
- [ ] `plans/README.md` status row for 007 updated

## STOP conditions

Stop and report back — do not improvise — if:

- Generate cannot stay under 10 seconds even at reduced caps on a realistic
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

- **Plan 008** substitutes Code Connect components for `<div>`s in this output.
  The seam is `src/tree/emit/*` — keep the intermediate tree's `tag` field a
  plain string that 008 can replace.
- **What a reviewer should scrutinise most**: whether the output is actually
  used, or deleted and retyped. This is the one plan in the program whose value
  is genuinely uncertain until people try it — ship it, then ask.
- **Deliberately deferred**: asset export, absolute positioning, framework
  templates (Vue/Svelte), and any per-node result caching across generate calls
  (the per-call cache from Step 2 is enough; a cross-call cache would need
  invalidation on document change, which is not worth it yet).
