# Plan 003: Scaffold the plugin shell, dual capability, and config storage

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. If anything in "STOP conditions" occurs,
> stop and report — do not improvise. When done, update the status row for this
> plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat <SHA at which plan 001 completed>..HEAD -- packages/theme`
> This plan calls `resolveTheme()` and stores its `TokenSet`. If either has
> changed since 001 landed, read the changes before starting.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — concentrated in Step 5 (chunked document storage under a hard
  100 kB per-entry cap) and Step 8 (read-back from a Dev Mode seat that may lack
  edit access). Both are verifiable in-product before anything is built on them.
- **Depends on**: 001
- **Category**: dx
- **Grounded at**: the commit at which plan 001 landed.

## Why this matters

This plan makes the product promise real: **a designer drops in their
`tailwind.config.js` once, and every developer who installs the plugin sees real
class names.** No CLI, no npm install, no token file to generate or keep in sync.

Two decisions carry that promise, and both live here.

**The config is resolved in the plugin**, by calling plan 001's browser-safe
resolver on the pasted source. That is what removes the CLI from the developer's
path entirely.

**The result is stored on the Figma document**, not in per-user storage. Per-user
storage would multiply setup friction by team size and guarantee the copies
drift. Document storage makes the theme a property of the design file, which is
the only version of this that scales past one person.

This is also where the program's write-safety invariant gets mechanically
enforced rather than merely promised — which is why the ESLint rule and bundle
test are in this plan and not bolted on later.

Nothing here produces Tailwind output. That is plans 004 and 005. This is the
substrate they sit on.

## Context the executor needs

### Verified Figma platform facts

Checked against Figma's plugin documentation on 2026-07-31. These are
load-bearing; if any turns out to be false, that is a STOP condition.

1. A single plugin may declare **both** `"codegen"` and `"inspect"` in
   `manifest.capabilities`.
2. **`codegen`** runs in the **Code section** of the Dev Mode Inspect panel. The
   plugin appears in Figma's native language dropdown; once selected,
   `figma.codegen.on('generate')` fires on every selection change.
3. **`inspect`** runs in the **Inspect panel** itself; its iframe takes the full
   height and width of the panel.
4. The `generate` callback has a **hard 15-second timeout**. It may be async.
5. **`figma.showUI` is not allowed inside the `generate` callback.** Call it
   outside and use `figma.ui.postMessage`, or call it from a `preferenceschange`
   handler.
6. `codegenPreferences` with `"itemType": "action"` adds a menu item that fires
   `figma.codegen.on('preferenceschange')`; **that** handler may call
   `figma.showUI`. This is the supported way to give a codegen plugin a settings
   modal.
7. **`setSharedPluginData` enforces a 100 kB limit per entry** (namespace + key +
   value combined), enforced since March 2025. Chunking across keys is the
   documented workaround.
8. **`figma.clientStorage` has a 5 MB total limit**, is per-user and per-plugin,
   and is not shared between collaborators.
9. **`"documentAccess": "dynamic-page"`** is required in the manifest for all new
   plugins. A Dev Mode plugin runs on the **current page only** unless pages are
   explicitly loaded.
10. **`figma.editorType`** is `'dev'` in Dev Mode and `'figma'` in the design
    editor. A plugin can declare `"editorType": ["figma", "dev"]` and branch.
11. Users can **save** a plugin to their account for access across files. **Org
    admins** can additionally *pin* a Dev Mode plugin so it appears in the
    Inspect panel for all users — an Organization/Enterprise feature.

### What is NOT verified and must be checked in Step 8

**Whether a Dev Mode user without edit access can read
`figma.root.getSharedPluginData(...)`.** Reading shared plugin data ought to be
permitted for anyone who can open the file, but this has not been confirmed
in-product for a Dev-seat viewer — and the entire paste-once architecture depends
on it. Step 8 tests it directly. Step 5 builds a `clientStorage` fallback
regardless, so a negative result degrades rather than blocks.

### The write-safety invariant (program-wide, set by the repo owner)

Restated here because this plan is where it gets enforced:

> fig-tail never mutates the Figma document except when a human clicks an
> explicit "Apply" in the setup UI, having first seen a dry-run diff. The only
> document-write APIs permitted anywhere in this codebase are
> `figma.root.setSharedPluginData` (this plan) and
> `Variable.setVariableCodeSyntax('WEB', …)` (plan 007). Variable **names** are
> never written.

Storing the config is a document write, and is one of the two exceptions,
because it is the direct result of a human dropping in a file and clicking Save.
It writes only under the `figtail` namespace on `figma.root`, and touches no
node, no variable, no style. Make that explicit in a comment at the call site and
in the ESLint rule's allowlist.

### Distribution constraint

The repo owner's Figma account is on Starter and Professional tiers with no
Organization or Enterprise plan, so private org-only plugin publishing is not
available. During development the plugin runs as an unpublished local plugin
(Figma **desktop** app → Plugins → Development → Import plugin from manifest).
You need the desktop app to test anything in this plan.

### What gets stored, and why both

Store **two** things:

1. **The resolved `TokenSet`** — what plans 004–008 actually read. Large
   (up to ~120 kB), so it is gzipped and chunked.
2. **The original config source text** — small (a few kB), and worth keeping for
   three reasons: the setup UI can show what was provided; a future resolver
   improvement can re-resolve without asking the designer for the file again; and
   a support conversation can start from the actual input.

Both go under the `figtail` namespace. Neither contains secrets — a Tailwind
config is design tokens and file globs. **Add a guard anyway**: before storing
source text, scan for anything resembling a credential (`process.env`,
`api_key`, `token`, long base64-ish literals) and warn the user, since the source
becomes readable by everyone with file access. See Step 6.

### Package layout to create

```
packages/plugin/
├── manifest.json
├── package.json
├── build.mjs                  # esbuild: sandbox bundle + inlined UI HTML
├── src/
│   ├── main.ts                # sandbox entry — the `figma` global lives here
│   ├── storage.ts             # chunked read/write + clientStorage fallback
│   ├── setup.ts               # resolve + validate + store orchestration
│   ├── mode-design.ts         # figma.editorType === 'figma'
│   ├── mode-dev.ts            # figma.editorType === 'dev' (stubs here)
│   └── ui/
│       ├── index.html
│       ├── main.tsx           # setup UI
│       └── styles.css
└── dist/                      # built output, gitignored
```

The Figma plugin sandbox has **no DOM and no `fetch`**. `main.ts` runs in a
QuickJS-like sandbox; the UI is a real iframe with a DOM. They communicate via
`figma.ui.postMessage` / `parent.postMessage`.

**Where the resolver runs**: `@fig-tail/theme` is pure ES2020 with no DOM and no
Node built-ins, so it runs in either. Run it **in the UI iframe**, not the
sandbox — parsing a large config is CPU-heavy and the sandbox is shared with
Figma's own responsiveness. The iframe posts the resulting `TokenSet` to the
sandbox for storage.

Keep the UI dependency-light. Preact or plain TypeScript with template literals
are both fine; React is unnecessary weight for a setup form. Whatever you choose,
`build.mjs` must inline the UI into a single HTML file — Figma plugins ship one.

## Inputs & resources

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm -r typecheck` | exit 0 |
| Test | `pnpm --filter @fig-tail/plugin test` | all pass |
| Build | `pnpm --filter @fig-tail/plugin build` | `dist/main.js`, `dist/ui.html` |
| Write-safety | `pnpm --filter @fig-tail/plugin lint` | exit 0 |
| Bundle audit | `pnpm --filter @fig-tail/plugin test -t write-safety` | passes |
| Bundle size | `du -b packages/plugin/dist/main.js packages/plugin/dist/ui.html` | main under 250 kB, ui under 400 kB |

Needed on hand:

- **Figma desktop app** — plugin development requires it.
- A **scratch Figma file** you can edit. Do not test against real design files.
- `@figma/plugin-typings` as a dev dependency.
- The config fixtures from plan 001 (`fixtures/configs/`) as paste-test input.
- **For Step 8 only**: a second Figma account, or a collaborator, with view-only
  or Dev-seat access to the scratch file. If neither is available, see the Step 8
  fallback.

## Suggested toolkit (optional)

- `esbuild` for both bundles; the sandbox target is ES2017.
- `fflate` for gzip in the sandbox (tiny, no Node built-ins). Base64-encode the
  gzipped bytes, since plugin data values are strings.
- `validateTokenSet` from `@fig-tail/theme` for storage validation.

## Scope

**In scope**:

- `packages/plugin/**` — manifest, build, sandbox entry, storage layer, setup
  orchestration, and the design-mode setup UI
- The Dev Mode entries (both `codegen` and `inspect`) as **stubs** that report
  whether a config is loaded — real output is plans 004 and 005
- `eslint.config.js` — adding the write-safety rule (Step 7)
- Root `README.md` — a short "installing the plugin locally" section
- `.gitignore` — `packages/plugin/dist`

**Out of scope**:

- Any use of `@fig-tail/match` — plan 002/004. Do not import it; the stubs must
  not produce classes.
- The real Inspect-panel surface — plan 005. This plan renders a placeholder.
- The linter UI — plan 006.
- Any call to `setVariableCodeSyntax` — plan 007. This plan writes **only**
  `figma.root.setSharedPluginData('figtail', …)`.
- Subtree walking — plan 008. The CLI — plan 009. Publishing — plan 010.
- Network access. The manifest sets `"networkAccess": { "allowedDomains": ["none"] }`
  and it stays that way.

## Working approach

- Branch as instructed. Commit per step, prefixed `003-N:`.
- Test in the Figma **desktop** app against the scratch file after every step
  touching the manifest or storage. The build-then-reload cycle is the only real
  feedback loop; unit tests cannot exercise the `figma` global.
- When something behaves differently from the "Verified Figma platform facts"
  list, write down what actually happened before changing code.

## Steps

### Step 1: Scaffold the package and the build

Create `packages/plugin` per the layout above. `build.mjs` runs two esbuild
passes: `src/main.ts` → `dist/main.js` (format `iife`, target `es2017`, platform
`browser`, no Node polyfills), and the UI → a single inlined `dist/ui.html`. Add
a `--watch` flag; the reload loop is frequent.

**Check**: `pnpm --filter @fig-tail/plugin build` → exit 0; both files exist;
`dist/ui.html` contains its CSS and JS inline (grep for `<script` with no `src=`).

### Step 2: Write the manifest with both Dev Mode capabilities

```jsonc
{
  "name": "fig-tail",
  "id": "<assigned by Figma on first publish — placeholder for now>",
  "api": "1.0.0",
  "main": "dist/main.js",
  "ui": "dist/ui.html",
  "editorType": ["figma", "dev"],
  "documentAccess": "dynamic-page",
  "networkAccess": { "allowedDomains": ["none"] },
  "capabilities": ["codegen", "inspect"],
  "codegenLanguages": [{ "label": "Tailwind", "value": "tailwind" }],
  "codegenPreferences": [
    { "itemType": "action", "propertyName": "settings", "label": "Configure Tailwind config…" }
  ]
}
```

`capabilities` declares **both** surfaces: `codegen` for the Code section,
`inspect` for the Inspect panel (built out in plan 005). `editorType` includes
`"figma"` so the same plugin provides design-mode setup. `networkAccess` uses the
special `["none"]` keyword, blocking all requests.

**Check**: import the plugin into Figma desktop with no manifest errors. Verify
**all three** surfaces are reachable: it appears in the design editor's plugin
list; it appears in Dev Mode's Code-section language dropdown as "Tailwind"; and
it appears in Dev Mode's Inspect panel plugin list. Confirm each by hand and note
it in the commit message.

**STOP and report** if Figma rejects `["codegen", "inspect"]` together, or
rejects that combination with `editorType: ["figma", "dev"]`. Splitting into two
plugins would change the whole program's shape.

### Step 3: Implement mode branching and the three stubs

In `src/main.ts`, branch on `figma.editorType`:

- `'figma'` → `figma.showUI(__html__, { width: 520, height: 640 })`, hand off to
  `mode-design.ts`.
- `'dev'` → register `figma.codegen.on('generate', …)` and
  `figma.codegen.on('preferenceschange', …)`; the latter opens the setup UI when
  `propertyName === 'settings'`. Also render the inspect-panel placeholder.

The generate stub returns one `CodegenResult`:

```ts
figma.codegen.on('generate', async () => [{
  title: 'fig-tail',
  language: 'PLAINTEXT',
  code: tokensLoaded
    ? `Config loaded: Tailwind v${meta.major}, ${meta.tokenCount} tokens, added ${meta.storedAt}`
    : 'No Tailwind config yet. Open fig-tail in the design editor and drop in your tailwind.config.js.',
}])
```

Critically: **do not call `figma.showUI` inside the generate callback.** It is
disallowed and will throw. The `preferenceschange` handler is where the modal
opens.

**Check**: in Dev Mode, select a node → the Code section shows the fig-tail
message. Click "Configure Tailwind config…" → the setup iframe opens without
error. The Inspect panel shows the placeholder. In the design editor, running the
plugin opens the same setup UI. Confirm all four by hand.

### Step 4: Wire config ingestion through the resolver

`src/setup.ts` orchestrates, with the resolver call happening **in the UI
iframe**:

1. The UI accepts one or more files by paste or drop, keeping each file's name.
2. It calls `resolveTheme({ sources })` from `@fig-tail/theme`.
3. On a `missing-import` or unresolved `@config` entry, it **asks for the named
   file** rather than failing — a v4 setup often needs `app.css` plus
   `tailwind.config.js`, and the report says exactly which.
4. It posts `{ tokens, unresolved, warnings, sources }` to the sandbox.
5. The sandbox validates with `validateTokenSet` and stores (Step 5).

Time the resolve step and show a spinner past 300 ms. A large config with a full
default theme is real work.

**Check**: unit tests for the orchestration with a mocked resolver: a clean
resolve stores; a resolve with `ok: false` stores nothing and surfaces the report;
a `missing-import` result triggers the "provide this file too" path; a resolve
returning tokens that fail `validateTokenSet` stores nothing and reports. Then in
Figma: drop each of plan 001's fixture configs in and confirm the outcome matches
that fixture's known resolution result.

### Step 5: Implement chunked document storage

`src/storage.ts`:

```ts
const NAMESPACE = 'figtail'
// Keys: `meta`, `tokens.0`, `tokens.1`, …, `source.0`, …
const CHUNK_BYTES = 80_000   // headroom under the 100 kB per-entry cap

export async function writeConfig(payload: StoredConfig): Promise<WriteResult>
export async function readConfig(): Promise<StoredConfig | null>
export async function clearConfig(): Promise<void>
```

Write path:

1. Validate the `TokenSet` with `validateTokenSet`. Reject with a readable error
   listing the first three failures.
2. `JSON.stringify` → gzip (`fflate`) → base64.
3. Split into ≤80 kB chunks; write each as `tokens.<i>` / `source.<i>`.
4. Write `meta` **last**, containing `{ schemaVersion, tokenChunks, sourceChunks,
   byteLength, checksum, storedAt, tailwindMajor, tokenCount, unresolvedCount }`.
   Writing meta last makes a partial write detectable.
5. **Clear stale chunks**: if a previous write used more chunks, overwrite the
   extras with `''`. Forgetting this leaves garbage a future read may
   concatenate.

Read path: read `meta`, read the stated chunk counts, concatenate,
base64-decode, gunzip, parse, validate. Any failure returns `null` **plus a
diagnostic reason** — never throw into the codegen callback, which has a
15-second budget and no error UI.

Also implement the `clientStorage` fallback: if `writeConfig` fails for lack of
edit access, fall back to `figma.clientStorage`; `readConfig` prefers document
storage and falls back to client storage, recording which source was used so the
UI can say "from this file" versus "from your local settings".

Cache the parsed result in a module-level variable, invalidated on write — gunzip
plus parse on every selection change would eat the codegen budget.

**Check**: unit tests with a mocked Figma API — a 250 kB payload round-trips
exactly; a payload shrinking from 4 chunks to 2 leaves no readable `tokens.2`; a
truncated read (meta says 4, three present) returns `null` with a diagnostic;
cache invalidates on write. Then in Figma desktop: drop in a fixture config,
reload the plugin, confirm `readConfig()` returns the same token set (log
`Object.keys(tokens.colors).length` and compare to the fixture snapshot).

### Step 6: Build the setup UI

Five states in the design-mode iframe:

1. **Empty** — two sentences on what this is, then a drop zone and textarea:
   "Drop your `tailwind.config.js` (v3) or your CSS entry with `@theme` (v4)."
2. **Resolving** — spinner past 300 ms.
3. **Review** — before storing, show what was found: Tailwind version, token
   counts per category, and — prominently — **the `unresolved` report**, each
   entry with its path, plain-language message, and remedy. This is the whole
   payoff of plan 001 Step 8; do not bury it. Offer Save and Cancel.
4. **Configured** — the same summary plus storage location (this file vs local
   settings), a **staleness warning when `storedAt` is over 30 days old**, the
   name of each stored source file, and Replace / Remove buttons. Remove
   confirms.
5. **Read-only** — when the user lacks edit access: explain that saving to the
   file needs edit access, and offer local settings instead.

Add the **credential scan** from "Context" before storing source text: if the
config contains anything credential-shaped, warn clearly and let the user store
tokens **without** the source.

Plain and clear beats polished. This screen is used once per file per config
change.

**Check**: in Figma desktop on the scratch file, walk all five states by hand:
drop a clean fixture (→ review → configured); drop a fixture with a known
function-valued theme key (→ the report names it with an actionable message);
drop a v4 CSS with `@config` (→ asks for the second file); paste random text (→ a
clear parse error, not a stack trace); paste a config containing
`apiKey: "sk-live-abc123"` (→ the credential warning appears); Remove (→ back to
empty).

### Step 7: Enforce the write-safety invariant mechanically

Two independent guards. This is the owner's hard constraint, and code review is
not sufficient enforcement.

**a) ESLint rule.** In `eslint.config.js`, for `packages/plugin/**`, add
`no-restricted-properties` / `no-restricted-syntax` entries banning every Figma
document-mutation API: `setPluginData`, `appendChild`, `remove`, `create*`,
`setBoundVariable`, `setValueForMode`, `createVariable`,
`createVariableCollection`, `addDevResourceAsync`, `editDevResourceAsync`,
`deleteDevResourceAsync`, and assignment to `.name`, `.characters`, `.fills`,
`.strokes`, `.cornerRadius`, `.padding*` on any node or variable.

Allow exactly one thing for now, with a targeted `eslint-disable-next-line`
comment naming this plan: `figma.root.setSharedPluginData` in `src/storage.ts`.
(Plan 007 adds the second and only other entry.)

**b) Bundle test.** A vitest test reading the built `dist/main.js` and asserting
none of the banned identifiers appear except the allowlisted one. This catches
anything arriving via a dependency or a dynamic property access the linter cannot
see. Write the failure message so it says what was found and why it is banned,
referencing the invariant.

**Check**: `pnpm --filter @fig-tail/plugin lint` → exit 0;
`pnpm --filter @fig-tail/plugin test -t write-safety` → passes. Then deliberately
add `figma.currentPage.selection[0].name = 'x'` to `main.ts`, confirm **both**
guards fail, remove it, confirm both pass. Note this verification in the commit
message — a guard nobody has watched fail is not a guard.

### Step 8: Verify cross-user read access

**The critical architectural test.** With a config saved on the scratch file,
open the same file from a **second account** with view-only or Dev-seat access,
open the plugin in Dev Mode, and confirm the Step 3 stub reports the config as
loaded.

*If no second account is available*: approximate by sharing the file to a team
where you hold a View seat. Note that plugin development requires the desktop
app, so this may only be testable with a real second account. **If you cannot
test it at all, do not guess** — record it as unverified in the commit message
and in `plans/README.md`, and raise it. Plans 004 and 005 depend on the answer.

**Check**: a second user in Dev Mode reads the stored config — or the inability
to test is explicitly recorded.

### Step 9: Document local installation

Add an "Installing the plugin" section to the root `README.md`: build, import via
Figma desktop, run in the design editor to add the config, then switch to Dev
Mode. Note the Org/Enterprise limitation on private publishing so the next person
does not go looking for it. ~25 lines; plan 010 writes the real docs.

**Check**: follow your own README from a clean checkout — install, build, import,
drop in a config, see it load in Dev Mode — without consulting any other file.
Any step you had to figure out is a step that is missing.

## Validation plan

- **Unit tests** (`figma` global mocked): storage chunk round-trip, stale-chunk
  cleanup, truncated-read detection, validation rejection messages, cache
  invalidation, setup orchestration for all four resolver outcomes, the
  credential scan.
- **Bundle write-safety test**: Step 7.
- **Manual in-product checklist**, run on the scratch file in Figma desktop and
  recorded in the commit description:
  - [ ] Plugin imports with no manifest errors
  - [ ] Appears in the design editor's plugin list
  - [ ] Appears in Dev Mode's Code-section language dropdown as "Tailwind"
  - [ ] Appears in Dev Mode's Inspect panel plugin list
  - [ ] "Configure Tailwind config…" opens the setup modal from Dev Mode
  - [ ] Each plan 001 fixture config resolves to its known expected result
  - [ ] The unresolved report is displayed, not swallowed
  - [ ] Config persists across a plugin reload
  - [ ] Config persists across a **Figma restart**
  - [ ] A second user in Dev Mode reads it (or: recorded as unverified)
  - [ ] Removing the config returns all Dev Mode stubs to the empty message
- **Size check**: `dist/main.js` under 250 kB, `dist/ui.html` under 400 kB. Both
  grow in plans 004 and 005; leaving headroom now matters.

## Done criteria

ALL must hold.

- [ ] `pnpm -r typecheck && pnpm -r lint && pnpm -r test` → exit 0
- [ ] `pnpm --filter @fig-tail/plugin build` produces `dist/main.js` and a fully
      inlined `dist/ui.html`
- [ ] The manifest declares `capabilities: ["codegen","inspect"]`,
      `editorType: ["figma","dev"]`, `documentAccess: "dynamic-page"`, and
      `networkAccess.allowedDomains: ["none"]`
- [ ] All three surfaces are reachable in Figma desktop
- [ ] A dropped `tailwind.config.js` resolves in-plugin and stores; a v4 CSS
      entry does too, asking for `@config`/`@import` files by name when needed
- [ ] The unresolved report is displayed to the user before saving
- [ ] The credential scan warns before storing source text
- [ ] Config round-trips through document storage, surviving a Figma restart
- [ ] Stale chunks are cleared on a shrinking rewrite (tested)
- [ ] The `clientStorage` fallback works when the user lacks edit access
- [ ] Both write-safety guards are in place and were **verified to fail** on a
      deliberate violation
- [ ] The only document write in the bundle is `figma.root.setSharedPluginData`
      under the `figtail` namespace
- [ ] The manual checklist is complete, with the second-user test passed or
      explicitly recorded as unverified
- [ ] No files outside the in-scope list were changed
- [ ] `plans/README.md` status row for 003 updated

## STOP conditions

Stop and report back — do not improvise — if:

- **Figma rejects `capabilities: ["codegen", "inspect"]`**, or that combination
  with `editorType: ["figma", "dev"]`.
- **A Dev Mode user without edit access cannot read shared plugin data.** This
  breaks paste-once and forces a different architecture. The owner's call.
- `figma.showUI` from the `preferenceschange` handler does not work as
  documented — there would then be no way to configure the plugin from Dev Mode.
- The gzipped fixture token set still needs more than ~8 chunks. Read latency
  inside a 15-second codegen budget becomes a real risk, and the fix is plan
  001's `pruneDefaults` or a leaner schema, not more chunks.
- Running `resolveTheme` in the UI iframe is blocked by the iframe's CSP or is
  unacceptably slow (over ~3 s on a normal config).
- Any of the eleven "Verified Figma platform facts" turns out to be false.
- A step's check fails twice after a reasonable attempt.

## Handoff / after it lands

- **Plan 004** replaces the codegen stub with real output. It calls `readConfig()`
  on every generate — the module-level cache from Step 5 is what keeps that
  inside the 15-second budget. Do not remove it.
- **Plan 005** replaces the inspect-panel placeholder with the real surface, and
  reuses the same storage and the same UI shell.
- **Plan 006** adds another view alongside setup; keep `mode-design.ts`
  structured so a second view slots in without a rewrite.
- **Plan 007** is the only other code permitted to write to the document, and
  only via `setVariableCodeSyntax`. Its ESLint allowlist entry does not exist
  yet — 007 adds it, with a comment naming plan 007.
- **Plan 009**'s CLI emits a `TokenSet` in exactly the schema this stores, so the
  setup UI must also accept a **pre-resolved token JSON** as an input type.
  Wire that acceptance path now if it is cheap; otherwise note it for 009.
- **What a reviewer should scrutinise most**: Step 7, and the evidence that both
  guards were observed failing. Second: Step 8, because the paste-once promise
  rests on it.
- **Deliberately deferred**:
  - *Detecting a stale config by comparing against the codebase.* Needs network
    access, which is ruled out. The 30-day staleness warning is the cheap
    approximation.
  - *Multiple themes per file.* Storage keys are namespaced, so adding a second
    slot later is additive.
  - *Schema migration.* There is only version 1; `meta.schemaVersion` is stored
    so the read path can branch when version 2 exists.
