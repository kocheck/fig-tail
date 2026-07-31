# Plan 004: Ship the Dev Mode codegen panel

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. If anything in "STOP conditions" occurs,
> stop and report — do not improvise. When done, update the status row for this
> plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat <SHA at which 002 and 003 completed>..HEAD -- packages/match packages/plugin`
> This plan is the wiring between those two packages. If either has moved since,
> read the changes before starting.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — low technical risk (both halves exist and are tested), real
  product risk. This is the first plan whose output a human judges by eye, and
  "plausible but wrong" is the failure mode. Steps 6 and 7 exist to catch it.
- **Depends on**: 002, 003
- **Category**: dx
- **Grounded at**: the commit at which plans 002 and 003 landed.

## Why this matters

This is the plan where the program becomes useful to somebody. Everything before
it is infrastructure: a CLI that emits JSON nobody reads, an engine with no
caller, a plugin that says "theme loaded" and stops.

After this plan, a developer opens a Figma file in Dev Mode, clicks a button,
and reads `flex flex-col items-start gap-4 rounded-xl bg-white p-6 shadow-xs`
— class names from *their* codebase, ready to paste. The mental conversion work
that motivated the whole project stops happening.

It is also where the design-system-QA angle first shows up: when a value has no
matching token, the panel says so instead of quietly emitting an arbitrary
value. That single behaviour is what separates fig-tail from the half-dozen
existing Figma→Tailwind plugins.

**Completing 001 → 004 plus 009 is the minimum shippable product.** Treat this
plan as the release gate, not a waypoint.

## Context the executor needs

### What exists after plans 002 and 003

**From `@fig-tail/match`** (plan 002):

```ts
function matchDeclarations(
  css: Record<string, string>,
  tokens: TokenSet,
  options?: Partial<MatchOptions>,
  hints?: Record<string, VariableHint>,   // keyed by CSS property
): MatchResult[]

function toClassName(results: MatchResult[]): string
function summarise(results: MatchResult[]): MatchSummary

type Confidence =
  | 'exact-variable'   // a bound variable carried codeSyntax.WEB — authored, not inferred
  | 'exact-value'      // the CSS value equals a token's value
  | 'name-match'       // a bound variable's name maps to a token, values agree
  | 'nearest'          // within tolerance but not equal — THE DRIFT SIGNAL
  | 'arbitrary'        // nothing close; bg-[#a1b2c3]
  | 'none'             // not expressible in Tailwind

type MatchResult = {
  className: string | null
  confidence: Confidence
  property: string
  value: string
  note?: string
  nearest?: { token: string; tokenValue: string; distance: number; unit: 'deltaE' | 'px' | 'ratio' }
}

type VariableHint = { codeSyntax?: string; name?: string; collection?: string }
```

`nearest` results **do not** emit a class unless `options.acceptNearest` is
true. That default is deliberate — see Step 4.

**From `@fig-tail/plugin`** (plan 003):

- `src/storage.ts` → `readTokens(): Promise<TokenSet | null>`, with a
  module-level cache invalidated on write. Reads from document storage
  (`figma.root.getSharedPluginData('figtail', …)`, chunked + gzipped) with a
  `clientStorage` fallback.
- `src/mode-dev.ts` → currently a stub that returns one `CodegenResult`
  reporting whether a theme is configured. **You are replacing that stub.**
- A manifest already declaring `capabilities: ["codegen"]`,
  `codegenLanguages: [{ label: 'Tailwind', value: 'tailwind' }]`, and one
  `codegenPreferences` action (`settings`).

### Verified Figma platform facts this plan depends on

1. `figma.codegen.on('generate', cb)` fires on every Dev Mode selection change.
   **The callback has a hard 15-second timeout.** It may be async.
2. `figma.showUI` is **not allowed inside** the generate callback. Preference
   actions (`preferenceschange`) may call it.
3. `node.getCSSAsync()` returns the CSS the Inspect panel shows, as a flat
   `Record<string, string>`. Dev Mode only.
4. `figma.codegen.preferences` exposes the user's current preference values;
   `codegenPreferences` in the manifest declares them. `itemType` may be
   `"select"`, `"unit"`, `"bool"`, or `"action"`.
5. A `CodegenResult` is `{ title: string, code: string, language: CodegenLanguage }`.
   Returning several renders several titled sections in the Code panel.
   `language` drives syntax highlighting; `'PLAINTEXT'`, `'HTML'`, `'CSS'`,
   `'JSON'`, `'TYPESCRIPT'` are among the valid values.
6. `variable.codeSyntax` is `{ WEB?: string; ANDROID?: string; iOS?: string }`.

### Bound variables — the highest-value input

`node.boundVariables` maps node fields to variable aliases. The field names are
**Figma property names, not CSS property names**, and mapping between them is
this plan's job:

| `boundVariables` key | Shape | CSS property to hint |
|---|---|---|
| `fills` | `VariableAlias[]` (per paint) | `background-color` (or `color` on a TextNode) |
| `strokes` | `VariableAlias[]` | `border-color` |
| `itemSpacing` | `VariableAlias` | `gap` |
| `counterAxisSpacing` | `VariableAlias` | `row-gap` |
| `paddingLeft` / `Right` / `Top` / `Bottom` | `VariableAlias` | `padding-left` … |
| `topLeftRadius` / `topRightRadius` / `bottomLeftRadius` / `bottomRightRadius` | `VariableAlias` | `border-top-left-radius` … |
| `strokeWeight` | `VariableAlias` | `border-width` |
| `opacity` | `VariableAlias` | `opacity` |
| `width` / `height` | `VariableAlias` | `width` / `height` |

Resolve each alias with `await figma.variables.getVariableByIdAsync(id)`, then
build a `VariableHint` from `variable.codeSyntax.WEB` and `variable.name`.

Two things to get right:

- **A `fills` binding on a `TextNode` means `color`, not `background-color`.**
  Branch on `node.type === 'TEXT'`.
- **Resolve variables in parallel** (`Promise.all`), and **deduplicate by
  variable ID** — a card with four padding sides bound to the same token would
  otherwise make four identical async calls inside a 15-second budget.

When plan 006 has stamped variables, `codeSyntax.WEB` is the literal class
(`bg-brand-500`) and the match is `exact-variable` with no inference at all.
When it has not, `variable.name` still beats a hex value. Both paths must work
from day one — do not gate this on plan 006.

### Performance budget

15 seconds is generous but not infinite, and the callback runs on **every
selection change**, so slowness is felt constantly. Target **under 200 ms** for
a single node.

Where the time goes: `readTokens()` (gunzip + parse — cached after the first
call, so amortised to ~0), `getCSSAsync()` (one await), variable resolution
(N awaits, parallelised and deduped), matching (pure, microseconds).

Never let an exception escape the callback. A throw inside `generate` surfaces
as an opaque Figma error with no way to explain what went wrong. Catch
everything and return a `CodegenResult` that says what failed and what to do
about it.

## Inputs & resources

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm -r typecheck` | exit 0 |
| Test | `pnpm --filter @fig-tail/plugin test` | all pass |
| Build | `pnpm --filter @fig-tail/plugin build` | `dist/main.js`, `dist/ui.html` |
| Write-safety | `pnpm --filter @fig-tail/plugin lint && pnpm --filter @fig-tail/plugin test -t write-safety` | exit 0, passes |
| Bundle size | `du -b packages/plugin/dist/main.js` | under 400 kB |

Needed on hand:

- **Figma desktop app** (local plugin development requires it).
- A **test Figma file** — build this in Step 6; it is a deliverable, not scratch.
- The fixture token JSON from plan 001 (`fixtures/tw4-app/figtail.tokens.json`),
  pasted into the test file via the plan 003 settings UI.

## Scope

**In scope**:

- `packages/plugin/src/mode-dev.ts` — the real generate handler
- `packages/plugin/src/hints.ts` — `boundVariables` → `VariableHint` resolution
- `packages/plugin/src/render.ts` — `MatchResult[]` → `CodegenResult[]`
- `packages/plugin/manifest.json` — adding the `codegenPreferences` from Step 5
- `packages/plugin/src/ui/**` — a preferences panel *only if* Step 5 shows the
  manifest preference types are insufficient
- Tests for all of the above
- `fixtures/figma/README.md` — describing the test file built in Step 6

**Out of scope**:

- **Walking child nodes.** This plan generates classes for the *selected node
  only*. Subtree export is plan 007, and it is a materially different problem
  (structure, nesting, naming). If you find yourself writing a recursive
  traversal, stop.
- **Any document write.** No `setVariableCodeSyntax`, no node mutation. The
  write-safety guards from plan 003 Step 5 must still pass unchanged.
- **The linter UI** — plan 005. This plan surfaces drift for the *selected node*
  inline; it does not scan pages or produce reports.
- **Code Connect** — plan 008.
- Modifying `@fig-tail/match` or `@fig-tail/tokens`. If the engine is wrong, fix
  it in a plan-002 follow-up commit, not here — but see STOP conditions.
- Publishing — plan 009.

## Working approach

- Branch as instructed. Commit per step, prefixed `004-N:`.
- Rebuild and reload in Figma desktop after every step. The Dev Mode codegen
  panel is the only place this code's behaviour is observable.
- Keep `mode-dev.ts` thin: resolve inputs, call the engine, hand results to
  `render.ts`. Matching logic does not belong in the plugin.

## Steps

### Step 1: Replace the stub with a minimal real generate handler

Rewrite `src/mode-dev.ts`:

```ts
figma.codegen.on('generate', async ({ node }) => {
  try {
    const tokens = await readTokens()
    if (!tokens) return notConfiguredResult()
    const css = await node.getCSSAsync()
    const results = matchDeclarations(css, tokens, optionsFromPreferences())
    return renderSections(results, { node, tokens })
  } catch (err) {
    return errorResult(err)
  }
})
```

`notConfiguredResult()` must be actionable: name the CLI command
(`npx @fig-tail/cli export`) and say to paste the file via the "Configure
theme…" action. A developer who hits this has no idea what fig-tail is.

`errorResult(err)` returns a `PLAINTEXT` section containing the message and a
one-line "report this" pointer. **Never rethrow.**

For this step, `renderSections` just returns one section with
`toClassName(results)`.

**Check**: in Figma desktop, in Dev Mode on the test file, select a simple frame
→ the Code panel's Tailwind section shows a class string. Remove the theme via
the settings UI → the same panel shows the actionable "not configured" message.
Confirm both by hand.

### Step 2: Resolve bound variables into hints

Implement `src/hints.ts`: `buildHints(node): Promise<Record<string, VariableHint>>`
per the mapping table in "Context". Dedupe by variable ID, resolve with
`Promise.all`, handle the TextNode `fills` → `color` case, and skip aliases that
fail to resolve (a variable from an unavailable library) rather than throwing.

Wire it into Step 1's handler as the fourth argument to `matchDeclarations`.

**Check**: unit tests with a mocked `figma.variables` — every row of the mapping
table produces the right CSS-property key; a TextNode `fills` binding produces
`color`; four padding sides bound to one variable produce exactly one
`getVariableByIdAsync` call; an unresolvable alias is skipped without throwing.
Then in Figma: bind a frame's fill to a colour variable, select it, and confirm
the panel's confidence for that property changed (it will be `name-match` until
plan 006 stamps codeSyntax — verify via a temporary debug section).

### Step 3: Render the primary output section

`src/render.ts`. The first section is what people actually use, so it is plain
and copyable — the Code panel gives users a copy button on the section body, so
the body must be **the class string and nothing else**. No comments, no
decoration, nothing they would have to delete after pasting.

```
Title:    "Tailwind"
Language: "HTML"
Code:     flex flex-col items-start gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-xs
```

Classes come pre-sorted in canonical order from `toClassName()` (plan 002
Step 7) — do not re-sort.

**Check**: select the card frame in the test file → the Tailwind section
contains exactly the expected class string with no extra characters. Click
Figma's copy button, paste into a text editor, confirm it is paste-ready.

### Step 4: Render the drift / unmatched section

This is the QA half, and it only appears when it has something to say. Emit a
second section **only if** `summarise(results)` reports any `nearest`,
`arbitrary`, or `none` results.

```
Title:    "Needs attention (3)"
Language: "PLAINTEXT"
Code:
  background-color  #3b82f1  →  no exact token
                              nearest: brand-500 (#3b82f6), ΔE 0.4
                              likely drift — confirm with design

  padding-top       25px     →  no exact token
                              nearest: p-6 (24px), off by 1px

  filter            blur(4px) →  not expressible in Tailwind from this value
```

Rules:

- `nearest` results appear here **and** are excluded from the primary class
  string by default (`acceptNearest: false`). A near-miss is a question, not an
  answer, and silently emitting `bg-brand-500` for `#3b82f1` is exactly the
  failure this program exists to prevent.
- `arbitrary` results **do** appear in the primary string (they are valid
  Tailwind and the developer needs something to paste) *and* are listed here,
  so the gap is visible.
- `none` results appear here only.
- When there is nothing to report, emit no section at all. A permanent empty
  "Needs attention (0)" panel trains people to ignore it.

**Check**: build three nodes in the test file — one whose fill is 1–2 ΔE off a
palette token, one with 25px padding, one using an unsupported effect. Select
each and confirm: the drift section appears with the right count, names the
nearest token and the distance, and the near-miss class is absent from the
primary string. Select a fully-matching node and confirm the section is absent
entirely.

### Step 5: Add codegen preferences

Extend `manifest.json`. Use native `codegenPreferences` types wherever possible
so no custom UI is needed:

```jsonc
"codegenPreferences": [
  { "itemType": "action", "propertyName": "settings", "label": "Configure theme…" },
  { "itemType": "bool", "propertyName": "includeLayout",
    "label": "Include layout utilities (flex, items-center…)", "defaultValue": true },
  { "itemType": "bool", "propertyName": "allowArbitrary",
    "label": "Fall back to arbitrary values (bg-[#a1b2c3])", "defaultValue": true },
  { "itemType": "bool", "propertyName": "acceptNearest",
    "label": "Accept near matches (hides drift warnings)", "defaultValue": false },
  { "itemType": "select", "propertyName": "output", "label": "Output",
    "options": [
      { "label": "Classes only", "value": "classes", "isDefault": true },
      { "label": "class=\"…\"",  "value": "attr" },
      { "label": "className=\"…\"", "value": "jsx" }
    ]}
]
```

Read them via `figma.codegen.preferences` in `optionsFromPreferences()` and map
onto `MatchOptions`.

Note the phrasing of `acceptNearest`: its label states the consequence
("hides drift warnings"), because turning it on trades correctness for
convenience and the user should know that at the point of choosing.

**Check**: each preference changes the output live in Dev Mode without a plugin
reload. Specifically: toggling `includeLayout` off removes `flex flex-col
items-start`; toggling `acceptNearest` on moves a near-miss into the primary
string and drops it from the drift section; switching `output` to `jsx` wraps
the result as `className="…"`.

**If** a needed preference cannot be expressed with the native item types, build
a small preferences view in the settings iframe instead — but prefer the native
types; they need no UI and they persist automatically.

### Step 6: Build the test Figma file and record expected output

This is a durable deliverable, not scratch work. In a Figma file you own, build
nodes that exercise every branch, and record each one's expected output in
`fixtures/figma/README.md` (node name → expected class string → why).

Minimum set:

- A card frame: auto-layout, padding, gap, radius, border, fill, shadow
- A text node: size, weight, family, line-height, colour
- A node with **every** supported property bound to a variable
- A node with **no** variables bound (pure value matching)
- A near-miss node (fill 1–2 ΔE off a token)
- An off-scale node (25px padding)
- A node using something unsupported (a gradient fill, or a blur effect)
- A node with alpha on its fill (exercises the `/50` modifier)
- An empty frame (no meaningful CSS — must not crash or emit noise)

**Check**: `fixtures/figma/README.md` lists every node with its expected output,
and the file's share URL is recorded there. Walk all nine by hand in Dev Mode
and confirm each matches. Any mismatch is either a bug to fix or an expectation
to correct — and if it is the latter, say why in the README.

### Step 7: Measure and harden performance

Instrument the generate callback (a temporary `Date.now()` around each phase),
then measure on the test file:

- First selection after plugin load (cold — includes gunzip + parse)
- Subsequent selections (warm — cache hit)
- The most variable-heavy node

Target: **under 200 ms warm**, under 1 s cold. If the cold path is slow, the
token cache from plan 003 Step 4 is the place to look, not the matcher.

Then verify the failure modes explicitly: corrupt one stored chunk by hand via
the settings UI (or by writing garbage to `tokens.1`) and confirm the panel
shows the actionable error rather than an opaque Figma failure or a hang.
Remove the instrumentation before committing.

**Check**: measured timings recorded in the commit message. Corrupted-storage
case produces a readable error section. No selection change takes more than 1 s.

### Step 8: Update the README

Add a "Using it in Dev Mode" section: select a node, open the Code section,
choose Tailwind, what the two sections mean, and what each preference does.
Include one real screenshot of the panel. ~40 lines; plan 009 writes the rest.

**Check**: someone who has never used fig-tail can follow this section, from a
file that already has a theme configured, and get a class string. Confirm by
having someone else do it, or by following it literally from a fresh Figma
session.

## Validation plan

- **Unit tests** (`figma` global mocked): `buildHints` for every mapping-table
  row plus the TextNode and dedupe cases; `renderSections` for the four
  scenarios (configured + clean, configured + drift, not configured, error);
  `optionsFromPreferences` mapping every preference to `MatchOptions`.
- **Error-path tests**: `getCSSAsync` rejecting, `readTokens` returning `null`,
  a corrupt token set, an unresolvable variable alias — each must return a
  `CodegenResult`, never throw.
- **The Step 6 manual matrix** — nine nodes, each with a recorded expected
  output. This is the real acceptance test.
- **Write-safety regression**: plan 003's lint rule and bundle test must still
  pass unchanged. This plan adds no writes.
- **Performance**: Step 7's measurements.

## Done criteria

ALL must hold.

- [ ] `pnpm -r typecheck && pnpm -r lint && pnpm -r test` → exit 0
- [ ] Selecting a node in Dev Mode shows a copyable Tailwind class string
- [ ] Class output is in canonical Tailwind order (verified against the card
      fixture's exact expected string)
- [ ] Bound variables produce `exact-variable` when `codeSyntax.WEB` exists and
      `name-match` when only a name does
- [ ] `nearest` results are excluded from the primary string by default and
      reported in the drift section with token, value, and distance
- [ ] The drift section is absent when there is nothing to report
- [ ] All five codegen preferences work live without a plugin reload
- [ ] The "not configured" message names the CLI command and the settings action
- [ ] No exception escapes the generate callback (error-path tests pass)
- [ ] Warm selection-change latency under 200 ms; cold under 1 s; measurements
      recorded
- [ ] All nine test-file nodes match their recorded expectations in
      `fixtures/figma/README.md`
- [ ] Plan 003's write-safety lint rule and bundle test still pass unchanged
- [ ] `dist/main.js` under 400 kB
- [ ] No files outside the in-scope list were changed
- [ ] `plans/README.md` status row for 004 updated

## STOP conditions

Stop and report back — do not improvise — if:

- **The matching engine produces confidently wrong output on the test file** —
  an `exact-value` match that is visibly not the right token. That is a plan-002
  correctness bug and the thresholds need revisiting with the owner, not a
  patch here.
- `getCSSAsync()` returns a materially different shape from the examples in plan
  002's "Context" (different property names, nested objects, units). Plan 002's
  matchers were written against that shape and would all need revisiting.
- The generate callback cannot stay under 15 seconds on a realistically complex
  node. That is an architecture problem, not a tuning problem.
- Codegen preferences do not persist between sessions, or do not reach
  `figma.codegen.preferences` as documented — the settings model would need
  rethinking.
- A node type in the test file crashes `getCSSAsync()` or the matcher in a way
  that cannot be caught locally.
- Making this work requires **any** document write. It must not. If it seems to,
  something is wrong with the approach.
- A step's check fails twice after a reasonable attempt.

## Handoff / after it lands

- **This is the release gate.** With 001–004 and 009 done, fig-tail is
  shippable. Consider publishing before starting 005–008, so real usage informs
  what gets built next.
- **Plan 005** reuses `buildHints` and `summarise` to scan a whole page instead
  of one node. Keep both exported and free of Dev-Mode-only assumptions.
- **Plan 006** will make `exact-variable` the common case rather than the rare
  one. After 006 lands, re-run the Step 6 matrix — several nodes should improve
  from `name-match` or `exact-value` to `exact-variable`, and if they do not,
  the hint plumbing in `hints.ts` has a bug.
- **Plan 007** calls the same pipeline per node while walking a tree; the 200 ms
  budget becomes 200 ms × N. Whatever caching 007 needs, put it at the
  `readTokens`/`buildHints` boundary, not inside the matcher.
- **What a reviewer should scrutinise most**: Step 4's rule that `nearest` never
  enters the primary class string. It is the difference between a tool that
  tells the truth and one that produces plausible-looking wrong code. Any
  pressure to "just emit the close one" should be resisted — that is what the
  `acceptNearest` preference is for, opted into knowingly.
- **Deliberately deferred**: multi-node selection (Figma passes one node to
  `generate`; handling a multi-select would mean defining what a combined class
  string even means), and any per-node caching of results.
