# fig-tail UX findings — 2026-09-10

Source: a cold review of the 0.1.0 plugin surface at `abb2c1b`, conducted by
reading every user-facing string and the branches that produce them. **Nobody has
run this build in Figma**, so rendered behaviour is inferred from code except
where noted.

Findings are split by evidence level. Do not act on an UNVERIFIED finding without
confirming it first.

---

## Verified against the source

Each of these was independently re-checked against the file and line cited.

### V1. A near-miss silently deletes the property from the class string — RESOLVED

`packages/match/src/index.ts:183-189`:

```ts
/** Join copyable classes; nearest results are structurally excluded. */
export const toClassName = (results: MatchResult[]): string => {
  const classes = results
    .filter((result) => result.confidence !== 'nearest' && result.className)
```

`packages/match/src/matchers/color.ts:255-270` returns `className: null,
confidence: 'nearest'` for a colour within ΔE 2 of a token — an early return,
*before* the arbitrary-value fallback further down the same function.
`length.ts` does the same for spacing and radius.

So a fill 1 ΔE off `brand-500` produces a class string with **no background class
at all** — not `bg-brand-500`, not `bg-[#3b82f1]`, nothing. Under the codegen
preference **Output → Classes**, `mode-dev.ts:78` (`sections.slice(0, 1)`) drops
the notes section too, so there is *zero* signal that anything was omitted.

**This deviates from the program's own invariant.** `plans/README.md:54-56`:
"**Fallbacks fail toward raw values**, never toward a guessed token name."
Failing toward *nothing* is not failing toward a raw value. `README.md:68` tells
the developer "Class is safe to paste" — it is safe, but silently incomplete,
which is the harder failure to debug.

This is the highest-severity finding in this document and the one most likely to
cost trust in front of a team.

**Resolved (plan 012).** Both filters are gone — `index.ts` (codegen) and
`summarise.ts` (Inspect) — and all five near-miss sites now fall through to the
raw-value return that already existed below them, rather than early-returning
`className: null`. `confidence` stays `nearest`, so the drift linter keeps its
high-severity finding. Disposition F01's second clause is superseded; see the
amendment in `plans/REVIEW-DISPOSITIONS-2026-07-31.md`.

### V2. The lint Markdown table the README advertises is unreachable

`README.md:64` promises "Export a Markdown table from Tools for reviews."

`packages/plugin/src/ui/main.tsx:160-171`:

```ts
if (state.status) return state.status
if (state.exportCode) return state.exportCode
```

Lint sets both `state.status` and `state.exportCode` (`main.tsx:394-405`), and
status is always non-empty afterwards — so `#tool-out` shows
`"7 findings · 214 nodes · 380ms"` and the Markdown never renders.

### V3. The three highest-confidence badges have no styling

`main.tsx:148` emits `badge-${confidence}`. The `Confidence` union
(`packages/match/src/types.ts:4-10`) is `exact-variable | exact-value |
name-match | nearest | arbitrary | none`. `styles.css:173-186` defines only
`.badge-exact`, `.badge-nearest`, `.badge-arbitrary`, `.badge-none`.

`badge-exact-variable`, `badge-exact-value` and `badge-name-match` match nothing.
Green is defined and never rendered; `arbitrary` — the documented honest fallback
— gets `--figma-color-bg-danger-tertiary`, i.e. red. The signal is inverted:
red for what is fine, neutral for what is perfect.

### V4. Button names in the docs do not exist in the UI

`main.tsx:225-226` renders **`Apply to file`** and **`Save personally`**.
`README.md:34` and `docs/setup.md:22` call them "Save on file" and "Save
personal". A designer following the docs looks for buttons that are not there.

"Apply to file" also reads like it modifies the design — the opposite of what a
read-only plugin wants to imply.

### V5. There is a fourth tier label, and the docs describe three

`packages/plugin/src/storage.ts:355-368` defines
`Using your personal config — overriding this file's shared config`, returned
when both tiers exist and the user tier is preferred. `README.md:45-51` and the
storage matrix both describe three tiers only.

### V6. The plugin emits no console output

`grep -rn "console\." packages/plugin/src/` returns nothing. Any debugging or
timing strategy that assumes a plugin console will show something is dead on
arrival. (Recorded in plan 011 Step 6.)

### V7. The TypeScript-stripping regex corrupts plain JavaScript configs

`packages/theme/src/v3/ts-prepass.ts:8` runs on **every** v3 config, `.js`
included:

```ts
text = text.replace(/:\s*[A-Za-z0-9_$.|<>,\s[\]{}]+(?=\s*[=,)])/g, '')
```

The character class contains `,` `{` `}` `[` `]` and whitespace, so on ordinary
JavaScript it eats object-literal values and closing braces. Reproduced directly:

```
INPUT                       AFTER stripTypeScript
theme: {                    theme: {
  colors: s.colors,           colors,
},                          }
```

A brace is gone, `acorn.parse` then fails, and `v3/evaluate.ts:87` throws
*"Could not parse … Replace dynamic TypeScript/JS constructs with plain values"* —
blaming the user for valid JavaScript that fig-tail mangled itself.

Configs this breaks include `colors: { ...colors, brand: '#f00' }` (spreading
`tailwindcss/colors` — one of the most common idioms in Tailwind), any
`screens: defaultTheme.screens,` inside `extend`, and the cross-package
`theme: { colors: shared.colors }` shape used by monorepos.

**Severity: P0.** It converts a supported config into a hard failure with a
misleading message, and the reported line number refers to the *post-strip* text,
so it points at nothing in the user's file. It has no owner plan yet.

### V8. `unknownNamespaces` is a hardcoded empty array on the v4 path

`packages/theme/src/v4/index.ts:334` — `unknownNamespaces: []`, a literal. Any
consumer treating it as a signal gets nothing for v4 configs. It was also empty
across all eight v3 fixtures, including the known-failing ones, so it is not a
usable indicator on either path.

### V9. A resolved token can be permanently unmatchable

A shadcn-style radius resolves as `{"raw": "var(--radius)", "px": null}` — present
in the token set, so it reads as resolved, while
`packages/match/src/matchers/length.ts:43` does `if (token.px === null) continue`
and can never match it. "Present" and "usable" are different properties and
nothing in the output distinguishes them. Colours that are not absolute values
vanish entirely, with no diagnostic at all.

### V12. Arbitrary values containing spaces corrupted the whole class string — RESOLVED

There was no space escaping anywhere in `@fig-tail/match`. `toClassName` joins
with a single space, so any arbitrary value containing one fragmented:

```
shadow-[0px 7px 13px 2px rgba(11, 22, 33, 0.37)]
└── nine tokens in the class attribute, corrupting every OTHER class too
```

Figma emits spaced values routinely — every non-token `box-shadow`, and
`font-['Helvetica Neue']`. This was higher-impact than the near-miss defect
(V1), because it corrupted the entire string rather than dropping one property.

**Resolved (plan 018).** One `arbitrary(tokens, utility, value)` helper in
`availability.ts` escapes spaces as `_` (Tailwind's own escape inside brackets)
and applies the prefix. All **13** construction sites across five matchers now
call it, so the escaping — and the null-prefix handling — exist in exactly one
place. A test asserts the joined string's token count equals the emitted class
count; verified to fail without the escape.

### V13. `confidence: 'none'` under `Output → Classes` — narrow gap, accepted

A property no matcher can express (a gradient fill, a disabled core plugin) has
no class and no raw value to fall back on. `none` **is** in `ATTENTION_CONFIDENCE`
(`codegen/render.ts:6`) so it always produces a drift line — it is invisible only
under `Output → Classes`, where the user asked for classes without notes.

Retaining the notes section for every `none` would fire on nearly every node
(real `getCSSAsync()` output carries `position`, `box-sizing`, `overflow` — all
`none`) and make the preference a no-op. Distinguishing "we handle this property
but not this value" from "no matcher covers this property" has no structural
signal today: `provenance.utility` is set only on successful matches, and both
kinds carry only a note. Telling them apart would need either string-sniffing the
note or a new field on a published type.

**Accepted as-is**, documented rather than fixed. `sectionsForOutput` retains the
notes section when the *preference filters* strip a class the matcher produced —
which is the case where the string is incomplete and the user cannot tell.

### V10. The documented install path fails from a clean clone

`docs/setup.md:5-10` gives the only install instructions:

```
1. corepack enable && pnpm install
2. pnpm --filter @fig-tail/plugin build
3. Figma → Plugins → Development → Import plugin from manifest…
4. Choose packages/plugin/manifest.json
```

Step 2 **fails** on a fresh checkout. Reproduced from clean (`rm -rf packages/*/dist`):

```
✘ [ERROR] Could not resolve "@fig-tail/match"
    src/mode-dev.ts:1:46
  The module "./dist/index.js" was not found on the file system
```

`packages/plugin/dist/` is then empty, so step 4 has nothing to import and the
Figma install cannot complete. `pnpm --filter` does not build workspace
dependencies and there is no turbo/nx `dependsOn`.

**Working order**, verified:

```
pnpm --filter @fig-tail/theme build
pnpm --filter @fig-tail/match build
pnpm --filter @fig-tail/plugin build   # → dist/main.js (267.9kb) + ui.html
```

`pnpm -r build` also works.

**Severity: P0 for the developer-adoption goal.** Condition 1 is "two developers
install fig-tail themselves". Every developer who follows the documented steps
hits this, and the error names an internal package rather than a missing step — a
front-end developer has no reason to guess that the fix is building two other
packages first. This is the most likely single cause of a condition-1 failure,
and it says nothing about whether the product is good.

### V11. `pnpm check` cannot pass on a clean checkout

`package.json:13` defines the repo's documented single command as
`pnpm -r typecheck && pnpm -r lint && pnpm -r build && pnpm -r test`. Typecheck
runs **before** build, and packages resolve each other through `dist`, so on a
fresh clone the first stage fails:

```
packages/cli typecheck: src/index.ts(4,68): error TS2307:
  Cannot find module '@fig-tail/theme' or its corresponding type declarations.
```

**CI has never passed on `main`.** Both recorded runs of `ci.yml` on `main` —
including `abb2c1b`, the "prepare 0.1.0 README and publish readiness" commit —
have `conclusion: failure`, with this exact error. `ci.yml` runs
`pnpm install --frozen-lockfile` then `pnpm check` on a fresh checkout, which is
precisely the failing case.

Meanwhile `docs/release/approval-packet.md:22` records `| pnpm check | PASS |`
and `:14` records `CI hardened + probe:browser | Ready`. Both are false, and they
sit in the document that gates the release.

`README.md:99` presents `pnpm check` as the command a contributor runs. It passes
only when `dist` already exists from an earlier build, which is why it looks fine
locally and has never worked from clean.

**Verified fix** — build before typecheck, since packages resolve each other
through `dist`:

```diff
-"check": "pnpm -r typecheck && pnpm -r lint && pnpm -r build && pnpm -r test"
+"check": "pnpm -r build && pnpm -r typecheck && pnpm -r lint && pnpm -r test"
```

Confirmed from an empty `packages/*/dist`: `pnpm -r build` succeeds (pnpm walks
the workspace in topological order), and `pnpm -r typecheck` then passes.

---

## Reported but UNVERIFIED

Credible, cited, and consistent with the code that was read — but not
independently re-checked. Confirm before acting.

| # | Finding | Cited at |
|---|---|---|
| U1 | Config file selection is lost on any re-render, because `configText`/`configName` are declared *inside* `render()` and `render()` clears `root.innerHTML`. In Dev Mode Inspect, `selectionchange` triggers this — pick a config, click a layer, the filename vanishes and Resolve says "Choose a config file first". | `main.tsx:209, 251-253`; `mode-dev.ts:190` |
| U2 | "Apply stamp" auto-selects every eligible variable and auto-grants every overwrite, defeating the engine's `selected: false` / `overwriteRequired` contract. The `confirm()` never says "overwrite". The diff is never rendered, so the designer cannot see which variables or what changes. | `main.tsx:352-372`; `stamp/apply.ts:12-14, 42, 83-86` |
| U3 | With no config, every property falls to `arbitrary`, so the first-run Code panel reads **"Drift / Needs attention (N)"** for a healthy layer. The empty state is framed as design drift. | `codegen/render.ts:6, 71`; `color.ts:205-212` |
| U4 | Unknown write errors default to `no-edit-access`, so a designer *with* edit access is told they lack permission. `write-failed` is unreachable from this path. | `storage.ts:501-506` |
| U5 | The storage read is cached for the plugin's lifetime with no invalidation. A developer who opens Dev Mode before the designer saves keeps seeing "No Tailwind config" until they quit the plugin — which is exactly the two-role setup sequence the README describes. | `storage.ts:246-251, 376-381` |
| U6 | `canWriteDocument` is computed and passed to the UI but never read, so "Apply to file" is enabled in Dev Mode where it cannot succeed. Remove buttons fire with no confirmation. | `mode-design.ts:19`; `main.tsx:224-228` |
| U7 | "Drop your config" is not a drop target — it is a hidden `<input type="file">` with no drag handlers, and the label is not keyboard-operable. | `main.tsx:216-219`; `styles.css:155-157` |
| U8 | Lint silently scans the whole page when nothing is selected, with no warning and no indication afterward of which scope ran. | `lint/run-lint.ts:6`; `lint/scan.ts:50-54` |
| U9 | "Include layout utilities: No" still emits `gap-*`, width and height. | `mode-dev.ts:32-39` |
| U10 | Resolver diagnostics reach designers as raw AST vocabulary — "theme.extend.colors uses ArrowFunctionExpression, which fig-tail cannot evaluate", "Defaults unconfirmed (missing-exact-version)". `PersistedDiagnostic.reason` is carried through and never used for display, though `docs/troubleshooting.md:13-19` already has the plain-language table keyed by reason. | `theme/src/v3/evaluate.ts`; `setup.ts:89`; `main.tsx:297` |
| U11 | Internal identifiers leak into user-facing text: "Saved to user", "Removed user config", raw `VariableID:41:7`, ISO timestamps. | `mode-design.ts:130, 168`; `main.tsx:96, 100` |
| U12 | `dismissFinding` is implemented end to end and has no caller. Lint findings are never rendered at all. | `lint/dismiss.ts`; `main.tsx:394-405` |
| U13 | The document-vs-personal choice is explained in the README and nowhere in the UI — two adjacent identical-weight buttons, no default, no statement that one is shared and one is not. | `main.tsx:225-226` |
| U14 | Copy has two paths with different results (`''` vs `/* no classes */`) and gives no success feedback. | `main.tsx:59-75, 141, 374` |

---

## The sequencing question this raises

Plan 011 verifies the 0.1.0 build and forbids touching `packages/*/src/**`,
deliberately: changing what you are measuring invalidates the measurement.

V1 sits awkwardly against that. It is not a polish item — it is a deviation from
a stated program invariant, on the plugin's primary output, and it is invisible
to the user who hits it. Verifying a build with V1 in it produces valid evidence
about a product that arguably should not ship as-is.

Three ways to sequence, for the owner to decide:

1. **Fix V1, then run 011.** Re-grounds the runbook on a build worth shipping.
   Costs a re-verify of nothing (011 has not run yet), and delays it by one fix.
2. **Run 011 as written, then fix.** Keeps the measurement clean and gives a
   truthful record of what 0.1.0 did. V1 becomes a 0.2.0 blocker.
3. **Run 011, and add V1 to what it observes.** Confirm in-product that a
   near-miss really does vanish from the pasted string before committing to a
   fix — the code says it does, but nobody has watched it happen.

Option 3 is the cheapest way to convert V1 from a strong code reading into an
observed fact, and it does not delay anything.
