# Plan 003: Scaffold the plugin shell, manifest, and document token storage

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. If anything in "STOP conditions" occurs,
> stop and report — do not improvise. When done, update the status row for this
> plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat <the SHA at which plan 001 completed>..HEAD -- packages/tokens`
> This plan validates pasted JSON with the zod schema from `@fig-tail/tokens`.
> If that schema changed since 001 landed, read it before starting.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — the risk is concentrated in Step 4 (chunked document storage
  under a hard 100 kB per-entry cap) and Step 6 (read-back from a Dev Mode seat
  that may not have edit access). Both are verifiable in-product before anything
  else is built on them.
- **Depends on**: 001
- **Category**: dx
- **Grounded at**: the commit at which plan 001 landed.

## Why this matters

This plan makes one decision real: **the designer pastes the theme once, and
every developer inspecting the file gets it.** The alternative — every developer
pasting their own copy into their own local plugin storage — multiplies setup
friction by the size of the team and guarantees the copies drift apart.

Storing the token JSON on the Figma *document* rather than in per-user storage
is what makes fig-tail a property of the design file instead of a property of
each person's machine. It is also the step where the program's write-safety
invariant gets mechanically enforced rather than merely promised, which is why
the ESLint rule and bundle test are in this plan and not bolted on later.

Nothing here produces user-visible Tailwind output — that is plan 004. This is
the substrate everything else sits on.

## Context the executor needs

### Verified Figma platform facts

These were checked against Figma's plugin documentation on 2026-07-31. They are
load-bearing; if any turns out to be false, that is a STOP condition.

1. **Codegen plugins** declare `"capabilities": ["codegen"]` and at least one
   entry in `"codegenLanguages"`. They register
   `figma.codegen.on('generate', cb)`; the callback fires on every Dev Mode
   selection change and returns an array of panel sections.
2. **The generate callback has a hard 15-second timeout** and errors out if
   exceeded. It may be `async`.
3. **`figma.showUI` is not allowed inside the generate callback.** The
   documented pattern is to call `figma.showUI` outside it and use
   `figma.ui.postMessage` from within.
4. **`codegenPreferences` with `"itemType": "action"`** creates a menu item in
   the Dev Mode codegen UI. Clicking it fires
   `figma.codegen.on('preferenceschange', ({ propertyName }) => …)`, and *that*
   handler **is** allowed to call `figma.showUI`. This is the supported way to
   give a codegen plugin a settings modal.
5. **`setSharedPluginData` enforces a 100 kB limit per entry**
   (namespace + key + value combined), enforced since March 2025. Chunking
   across multiple keys is the documented workaround.
6. **`figma.clientStorage` has a 5 MB total limit**, is per-user and
   per-plugin, and is not shared between collaborators.
7. **`"documentAccess": "dynamic-page"`** is required in the manifest for all
   new plugins.
8. **`node.getCSSAsync()`** returns the CSS shown in the Inspect panel.
   Available in Dev Mode.
9. **`figma.editorType`** is `'dev'` in Dev Mode and `'figma'` in the design
   editor. A single plugin can declare `"editorType": ["figma", "dev"]` and
   branch on it.

Sources: Figma plugin docs — codegen plugins, `figma.codegen.on`, plugin
manifest, `setSharedPluginData`, working in Dev Mode.

### What is NOT verified and must be checked in Step 6

**Whether a Dev Mode user without edit access can read
`figma.root.getSharedPluginData(...)`.** Reading shared plugin data should be
permitted for anyone who can open the file, but this has not been confirmed
in-product for a Dev-seat viewer, and the entire paste-once architecture depends
on it. Step 6 tests it directly. Step 4 builds a `clientStorage` fallback
regardless, so a negative result degrades rather than blocks.

### The write-safety invariant (program-wide, set by the repo owner)

Restated here because this plan is where it gets enforced:

> fig-tail never mutates the Figma document except when a human clicks an
> explicit "Apply" in the design-mode UI, having first seen a dry-run diff.
> The only document-write API permitted anywhere in this codebase is
> `Variable.setVariableCodeSyntax('WEB', …)`. Variable **names** are never
> written — Tailwind names go in the variable's Code syntax field.

Storing the token JSON via `setSharedPluginData` is a document write, and is the
**one** exception, because it is the direct result of a human pasting JSON and
clicking Save. It writes only under the `figtail` namespace on `figma.root`. It
touches no node, no variable, no style. Make that explicit in a code comment at
the call site and in the ESLint rule's allowlist.

### Distribution constraint

The repo owner's Figma account is on Starter and Professional tiers with no
Organization or Enterprise plan. Private org-only plugin publishing requires
Org/Enterprise, so it is unavailable. During development, the plugin runs as an
unpublished local plugin (Figma desktop app → Plugins → Development → Import
plugin from manifest). Public Community publishing is plan 009's problem, not
this plan's — but it does mean **you need the Figma desktop app** to test
anything in this plan.

### Package layout to create

```
packages/plugin/
├── manifest.json
├── package.json
├── build.mjs                  # esbuild: two bundles, one inlined HTML
├── src/
│   ├── main.ts                # sandbox entry — the `figma` global lives here
│   ├── storage.ts             # chunked read/write + clientStorage fallback
│   ├── mode-design.ts         # figma.editorType === 'figma' branch
│   ├── mode-dev.ts            # figma.editorType === 'dev' branch (stub here)
│   └── ui/
│       ├── index.html
│       ├── main.tsx           # settings/paste UI
│       └── styles.css
└── dist/                      # built output, gitignored
```

The Figma plugin sandbox has **no DOM and no `fetch`**. `main.ts` is plain JS in
a QuickJS-like sandbox; the UI is a real iframe with a DOM. They communicate via
`figma.ui.postMessage` / `parent.postMessage`.

Keep the UI dependency-light. Preact or plain TypeScript + template literals are
both fine; React is unnecessary weight for a paste form. Whatever you choose,
the built UI HTML must be inlined into a single file by `build.mjs` (Figma
plugins ship one HTML file).

## Inputs & resources

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm -r typecheck` | exit 0 |
| Test | `pnpm --filter @fig-tail/plugin test` | all pass |
| Build | `pnpm --filter @fig-tail/plugin build` | `dist/main.js` and `dist/ui.html` exist |
| Write-safety check | `pnpm --filter @fig-tail/plugin lint` | exit 0 (the ESLint rule from Step 5) |
| Bundle audit | `pnpm --filter @fig-tail/plugin test -t write-safety` | passes |

Needed on hand:

- **Figma desktop app** (plugin development requires it; the browser version
  cannot import a local manifest).
- A **scratch Figma file** you can edit — do not test against real design files.
- `@figma/plugin-typings` as a dev dependency.
- The fixture token JSON from plan 001
  (`fixtures/tw4-app/figtail.tokens.json`) as paste-test input.
- **For Step 6 only**: a second Figma account, or a collaborator, with view-only
  or Dev-seat access to the scratch file. If neither is available, see the
  Step 6 fallback.

## Suggested toolkit (optional)

- `esbuild` for both bundles — fast, and the plugin sandbox target is just ES2017.
- `fflate` for gzip in the sandbox (tiny, no Node built-ins). Base64-encode the
  gzipped bytes for storage, since plugin data values are strings.
- `zod` schema from `@fig-tail/tokens` for validating pasted JSON.

## Scope

**In scope**:

- `packages/plugin/**` — manifest, build, sandbox entry, storage layer, and the
  design-mode paste/settings UI
- The Dev Mode entry point as a **stub** that renders a single "fig-tail is
  configured / not configured" section — real codegen is plan 004
- `eslint.config.js` — adding the write-safety rule (Step 5)
- Root `README.md` — a short "installing the plugin locally" section
- `.gitignore` — `packages/plugin/dist`

**Out of scope**:

- Any use of `@fig-tail/match` — plan 004. Do not import it here; the stub must
  not produce classes.
- The linter UI — plan 005.
- Any call to `setVariableCodeSyntax` — plan 006. This plan writes **only**
  `figma.root.setSharedPluginData('figtail', …)` and nothing else.
- Subtree walking — plan 007.
- Publishing, listing assets, Community metadata — plan 009.
- Fetching tokens over the network. The manifest sets
  `"networkAccess": { "allowedDomains": ["none"] }` and it stays that way.

## Working approach

- Branch as instructed. Commit per step, prefixed `003-N:`.
- Test in the Figma **desktop** app against a scratch file after every step that
  touches the manifest or storage. The build-then-reload cycle is the only real
  feedback loop here; unit tests cannot exercise the `figma` global.
- When something behaves differently from the "Verified Figma platform facts"
  list above, write down what actually happened before changing code.

## Steps

### Step 1: Scaffold the package and the build

Create `packages/plugin` per the layout above. `build.mjs` runs two esbuild
passes: `src/main.ts` → `dist/main.js` (format `iife`, target `es2017`,
platform `browser`, no Node polyfills), and the UI → a single inlined
`dist/ui.html`. Add a `--watch` flag; the reload loop is frequent.

**Check**: `pnpm --filter @fig-tail/plugin build` → exit 0, and both
`dist/main.js` and `dist/ui.html` exist. `dist/ui.html` contains its CSS and JS
inline (grep it for `<script` with no `src=` attribute).

### Step 2: Write the manifest

```jsonc
{
  "name": "fig-tail",
  "id": "<assigned by Figma on first publish — leave a placeholder for now>",
  "api": "1.0.0",
  "main": "dist/main.js",
  "ui": "dist/ui.html",
  "editorType": ["figma", "dev"],
  "documentAccess": "dynamic-page",
  "networkAccess": { "allowedDomains": ["none"] },
  "capabilities": ["codegen"],
  "codegenLanguages": [{ "label": "Tailwind", "value": "tailwind" }],
  "codegenPreferences": [
    { "itemType": "action", "propertyName": "settings", "label": "Configure theme…" }
  ]
}
```

Note `editorType` includes `"figma"` so the same plugin provides the design-mode
setup UI. Note `networkAccess` is `["none"]` — the special keyword that blocks
all network requests.

**Check**: import the plugin into Figma desktop (Plugins → Development → Import
plugin from manifest) with no errors. It appears in the plugin list in the
design editor, **and** appears as a codegen source in Dev Mode's Code section
(open Dev Mode, select any node, check the language dropdown for "Tailwind").

### Step 3: Implement mode branching and the codegen stub

In `src/main.ts`, branch on `figma.editorType`:

- `'figma'` → `figma.showUI(__html__, { width: 480, height: 600 })` and hand off
  to `mode-design.ts`.
- `'dev'` → register `figma.codegen.on('generate', …)` returning a single
  section, and `figma.codegen.on('preferenceschange', …)` which opens the
  settings UI when `propertyName === 'settings'`.

The generate stub returns one `CodegenResult`:

```ts
figma.codegen.on('generate', async () => [{
  title: 'fig-tail',
  language: 'PLAINTEXT',
  code: tokensLoaded
    ? `Theme loaded: Tailwind v${meta.major}, ${meta.tokenCount} tokens, exported ${meta.generatedAt}`
    : 'No theme configured. Open the fig-tail plugin in the design editor and paste your figtail.tokens.json.',
}])
```

Critically: **do not call `figma.showUI` inside the generate callback.** It is
disallowed and will throw. The `preferenceschange` handler is where the modal
opens.

**Check**: in Dev Mode, select a node → the Code section shows the fig-tail
"No theme configured" message. Click "Configure theme…" in the codegen menu →
the settings iframe opens without error. In the design editor, running the
plugin from the Plugins menu opens the same UI. Confirm all three by hand and
note it in the commit message.

### Step 4: Implement chunked document storage

`src/storage.ts`, with this contract:

```ts
const NAMESPACE = 'figtail'
// Keys: `meta` (small, always one entry) and `tokens.0`, `tokens.1`, …
const CHUNK_BYTES = 80_000   // headroom under the 100 kB per-entry cap

export async function writeTokens(json: unknown): Promise<WriteResult>
export async function readTokens(): Promise<TokenSet | null>
export async function clearTokens(): Promise<void>
```

Write path:
1. Validate against the `@fig-tail/tokens` zod schema. Reject with a readable
   error listing the first three validation failures — a designer pasting the
   wrong file must be told *which* file they should have pasted.
2. `JSON.stringify` → gzip (`fflate`) → base64.
3. Split into ≤80 kB chunks; write each as `tokens.<i>`.
4. Write `meta` last, containing `{ schemaVersion, chunkCount, byteLength,
   sha256OrCrc, generatedAt, tailwindMajor, tokenCount, writtenAt }`. Writing
   meta last means a partial write is detectable — meta's `chunkCount` will not
   match what is readable.
5. **Clear stale chunks**: if a previous write used more chunks, explicitly
   overwrite the extras with `''` (Figma's convention for deleting an entry).
   Forgetting this leaves garbage that a future read may concatenate.

Read path: read `meta`, read `chunkCount` chunks, concatenate, base64-decode,
gunzip, `JSON.parse`, validate. Any failure returns `null` **plus a diagnostic
reason** — never throw into the codegen callback, which has a 15-second budget
and no error UI.

Also implement the `clientStorage` fallback: if `writeTokens` fails because the
user lacks edit access, fall back to `figma.clientStorage.setAsync` under the
same shape, and have `readTokens` prefer document storage and fall back to
client storage. Record which source was used in the returned metadata so the UI
can say "loaded from this file" vs "loaded from your local settings".

Cache the parsed result in a module-level variable, invalidated on write —
gunzip + parse on every selection change would eat the codegen budget.

**Check**: unit tests for chunk/dechunk round-tripping (mock the Figma API):
a 250 kB payload round-trips exactly; a payload that shrinks from 4 chunks to 2
leaves no readable `tokens.2`; a truncated read (meta says 4, only 3 present)
returns `null` with a diagnostic. Then in Figma desktop: paste
`fixtures/tw4-app/figtail.tokens.json` via a temporary button, reload the
plugin, and confirm `readTokens()` returns the same object — verify by logging
`Object.keys(tokens.colors).length` and comparing to the file.

### Step 5: Enforce the write-safety invariant mechanically

Two independent guards, because this is the owner's hard constraint and a code
review is not sufficient enforcement.

**a) ESLint rule.** In `eslint.config.js`, for `packages/plugin/**`, add
`no-restricted-properties` (or `no-restricted-syntax`) entries banning every
Figma document-mutation API: `setPluginData`, `appendChild`, `remove`,
`createFrame`/`createText`/`create*`, `setBoundVariable`, `setValueForMode`,
`createVariable`, `createVariableCollection`, and assignment to `.name`,
`.characters`, `.fills`, `.strokes`, `.cornerRadius`, `.paddingLeft` … on any
node or variable.

Allow exactly two things, each with a targeted `eslint-disable-next-line`
carrying a comment that names this plan:
- `figma.root.setSharedPluginData` in `src/storage.ts` (this plan)
- `setVariableCodeSyntax` in the stamping module (plan 006 — not present yet)

**b) Bundle test.** A vitest test that reads the built `dist/main.js` and
asserts it contains **no** occurrence of the banned identifiers except the two
allowlisted ones. This catches anything that arrives via a dependency or a
dynamic property access the linter cannot see.

Write the test so its failure message says *what* it found and *why it is
banned*, referencing the invariant — the person who trips it in six months
needs to understand it is deliberate.

**Check**: `pnpm --filter @fig-tail/plugin lint` → exit 0.
`pnpm --filter @fig-tail/plugin test -t write-safety` → passes. Then
deliberately add `figma.currentPage.selection[0].name = 'x'` to `main.ts` and
confirm **both** guards fail; remove it and confirm both pass again. Note this
verification in the commit message.

### Step 6: Build the design-mode setup UI

The paste surface, in `src/ui/`. Four states:

1. **Empty** — explain what this is in two sentences, link to the CLI command
   (`npx @fig-tail/cli export`), and offer a textarea plus a file-drop zone for
   `figtail.tokens.json`.
2. **Validating** — on paste/drop, validate and show either the error list or a
   preview: Tailwind version, entry file, token counts per category, export
   date, and payload size.
3. **Configured** — show the same summary, the storage location (this file vs
   local settings), a **staleness warning when `generatedAt` is more than 30
   days old**, plus Replace and Remove buttons. Remove requires a confirm.
4. **Read-only** — when the user lacks edit access: explain that saving to the
   file needs edit access, and offer to save to their local settings instead.

Keep it plain. This screen is used once per file per theme change; clarity beats
polish.

**Check**: in Figma desktop, on a scratch file, walk all four states by hand:
paste the valid fixture (→ configured), paste a random JSON object (→ readable
validation errors naming the missing fields), paste malformed text (→ a clear
parse error, not a stack trace), then Remove (→ back to empty). Then **the
critical test**: with the theme saved, open the same file from a second account
with view-only or Dev-seat access, open the plugin in Dev Mode, and confirm the
stub from Step 3 reports the theme as loaded.

*If no second account is available*: approximate by publishing the scratch file
to a team where you hold a View seat, or by using a Figma share link in an
incognito browser session — note that plugin development requires desktop, so
this may only be testable with a real second account. **If you cannot test it
at all, do not guess — record it as unverified in the commit message and in
`plans/README.md`, and raise it.** Plan 004 depends on the answer.

### Step 7: Document local installation

Add an "Installing the plugin" section to the root `README.md`: build, import
via Figma desktop, run in the design editor to paste the theme, then switch to
Dev Mode. Note the Org/Enterprise limitation on private publishing so the next
person does not go looking for it. ~25 lines; plan 009 writes the real docs.

**Check**: follow your own README from a clean checkout — `pnpm install`, build,
import, paste, see the theme load in Dev Mode — without consulting any other
file. Any step you had to figure out is a step that is missing.

## Validation plan

- **Unit tests** (vitest, `figma` global mocked): storage chunk round-trip,
  stale-chunk cleanup, truncated-read detection, schema-rejection messages,
  cache invalidation on write.
- **Bundle write-safety test**: as Step 5.
- **Manual in-product checklist**, run on a scratch file in Figma desktop and
  recorded in the PR/commit description:
  - [ ] Plugin imports with no manifest errors
  - [ ] Appears in Dev Mode's codegen language dropdown as "Tailwind"
  - [ ] "Configure theme…" opens the settings modal from Dev Mode
  - [ ] Paste + save persists across a plugin reload
  - [ ] Paste + save persists across a **Figma restart**
  - [ ] A second user in Dev Mode reads the theme (or: recorded as unverified)
  - [ ] Removing the theme returns the Dev Mode stub to "No theme configured"
- **Size check**: `dist/main.js` under 200 kB. It will grow in plan 004; leaving
  headroom now matters.

## Done criteria

ALL must hold.

- [ ] `pnpm -r typecheck && pnpm -r lint && pnpm -r test` → exit 0
- [ ] `pnpm --filter @fig-tail/plugin build` produces `dist/main.js` and a
      fully-inlined `dist/ui.html`
- [ ] The manifest declares `documentAccess: "dynamic-page"`,
      `networkAccess.allowedDomains: ["none"]`, `capabilities: ["codegen"]`,
      and `editorType: ["figma","dev"]`
- [ ] Token JSON round-trips through document storage, surviving a Figma restart
- [ ] Stale chunks are cleared on a shrinking rewrite (tested)
- [ ] The `clientStorage` fallback works when the user lacks edit access
- [ ] Both write-safety guards are in place and were verified to actually fail
      on a deliberate violation
- [ ] The only document write in the bundle is
      `figma.root.setSharedPluginData` under the `figtail` namespace
- [ ] The manual in-product checklist is complete, with the second-user test
      either passed or explicitly recorded as unverified
- [ ] No files outside the in-scope list were changed
- [ ] `plans/README.md` status row for 003 updated

## STOP conditions

Stop and report back — do not improvise — if:

- **A Dev Mode user without edit access cannot read shared plugin data.** This
  breaks paste-once and forces a different architecture (per-user
  `clientStorage`, or asking the designer to distribute the JSON file to each
  dev). That is the owner's call, not yours.
- `figma.showUI` from the `preferenceschange` handler does not work as
  documented — there would then be no way to configure a codegen plugin from
  Dev Mode, which changes the setup story.
- The gzipped fixture theme still exceeds 100 kB **after** chunking would
  require more than ~8 chunks. Read latency inside a 15-second codegen budget
  becomes a real risk and the schema needs slimming (plan 001's
  `--prune-defaults`, or a leaner schema).
- Figma rejects `editorType: ["figma", "dev"]` combined with
  `capabilities: ["codegen"]`. Splitting into two plugins is a significant
  change to the whole program's shape.
- Any of the nine "Verified Figma platform facts" turns out to be false.
- A step's check fails twice after a reasonable attempt.

## Handoff / after it lands

- **Plan 004** replaces the Step 3 stub with real codegen. It will call
  `readTokens()` on every generate — the module-level cache from Step 4 is what
  keeps that inside the 15-second budget. Do not remove it.
- **Plan 005** adds a second design-mode view alongside the settings UI; keep
  `mode-design.ts` structured so a second view slots in without a rewrite.
- **Plan 006** is the only other code permitted to write to the document, and
  only via `setVariableCodeSyntax`. Its ESLint allowlist entry does not exist
  yet — 006 adds it, with a comment naming plan 006.
- **What a reviewer should scrutinise most**: Step 5. The write-safety guards
  are the mechanism protecting the owner's hard constraint, and a guard that
  has never been observed to fail is not a guard. Ask to see evidence that both
  were tripped deliberately and recovered.
- **Deliberately deferred**:
  - *Auto-detecting a stale theme by comparing against the codebase.* Would
    need network access, which is ruled out. The 30-day staleness warning is
    the cheap approximation.
  - *Multiple themes per file* (e.g. one per product surface). No demand yet,
    and it would complicate every read path. The storage keys are namespaced
    (`tokens.*`) so adding a second slot later is additive.
  - *Migration between `schemaVersion`s.* There is only version 1. When version
    2 exists, `meta.schemaVersion` is already stored, so the read path can
    branch — that is why it is written.
