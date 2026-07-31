# Plan 003: Scaffold the plugin shell, dual capability, and config storage

> **Executor instructions**: This plan is self-contained. Read it in full, then
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
> **Drift check (run first)**: this revision was written at commit `7932c82`, before
> plan 001's package existed. Confirm plans 000 and 001 are `DONE`, run
> `git diff --stat 7932c82..HEAD -- packages/theme fixtures/figma`, and compare live exports
> with the contracts quoted below. A non-empty diff is expected; a contract
> mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — concentrated in Step 5 (chunked storage under a hard 100 kB
  per-entry cap). The cross-user read question in Step 8 used to be the big risk;
  the three-tier config-source ladder demotes it to a convenience question, since
  any developer can add the config themselves without edit access.
- **Depends on**: 000, 001
- **Category**: dx
- **Planned at**: commit `7932c82`, 2026-07-31 — dependency contracts are prospective.

## Build sheet

Use Node 20+ and pnpm. Copy package scripts and strict TypeScript settings from
`packages/theme` where applicable; the plugin is the documented exception that
builds with `build.mjs`. Use named exports, no `any`, no non-null assertions,
and colocated Vitest tests. Before every commit run
`pnpm -r typecheck && pnpm -r lint && pnpm -r build && pnpm -r test`.

Do the tasks below **in order, one at a time**. Each task's *Done when* is a
command or a named in-Figma check; it must produce the stated result before you
start the next task. Commit after each task. Everything after this section is
**reference** — read a section when a task points you at it.

### You need Figma desktop for this plan

Tasks 2–8 cannot be done in a browser. Install the Figma **desktop app**, and
create a **scratch file you can edit** — never test against a real design file.
Import the plugin with Plugins → Development → Import plugin from manifest.

### Files this plan creates

| Path | Purpose | Task |
|---|---|---|
| `packages/plugin/package.json`, `tsconfig.sandbox.json`, `tsconfig.ui.json`, `vitest.config.ts`, `build.mjs` | package + isolated sandbox/UI types + two-bundle esbuild | 1 |
| `packages/plugin/src/shared/messages.ts`, `messages.test.ts` | neutral sandbox↔UI bootstrap contract and first meaningful test | 1 |
| `packages/plugin/manifest.json` | dual capability, no network | 2 |
| `packages/plugin/src/main.ts` | inert scaffold entry, then real mode branching | 1, 3 |
| `packages/plugin/src/mode-dev.ts`, `mode-design.ts` | the two editor branches (stubs) | 3 |
| `packages/plugin/src/setup.ts` + test | resolve → validate → store orchestration | 4 |
| `packages/plugin/src/storage.ts`, `storage-types.ts` + tests | complete 3-tier contract, private data, gzip, chunking | 5 |
| `packages/plugin/src/ui/index.html`, `main.tsx`, `styles.css` | inert scaffold UI, then setup UI with 6 states | 1, 6 |
| `eslint.config.js` (edit) | write-safety rule | 7 |
| `packages/plugin/src/write-safety.test.ts` | bundle audit | 7 |
| `packages/plugin/notes/storage-matrix.md` | durable tier/cross-account verification | 8 |
| `README.md` (section only) | installing locally | 9 |

### Dependencies

```bash
pnpm add --filter @fig-tail/plugin --save-exact fflate
pnpm add --filter @fig-tail/plugin -D --save-exact @figma/plugin-typings esbuild
```

Plus `@fig-tail/theme` as `workspace:*`.

### Tasks

| # | Do this | Files it may touch | Done when |
|---|---|---|---|
| 1 | Scaffold the package and `build.mjs` with inert but real sandbox/UI entries and a neutral message-contract test. Split sandbox and iframe TypeScript configs; DOM types are UI-only and Figma globals sandbox-only. | package, both tsconfigs, Vitest config, build, scaffold entries, `src/shared/**` | test and build succeed; both artifacts exist; negative type fixtures prove `document` fails in sandbox code and `figma` fails in UI code; UI remains one inlined HTML file |
| 2 | Reuse plan 000's registered development-plugin ID, then write `manifest.json` as Step 2 specifies, including both capabilities. | `manifest.json` | Import into Figma desktop with no manifest errors; the plugin appears in the design list and both Dev Mode surface selectors, and invoking it loads the compiled scaffold without a missing-artifact error |
| 3 | Branch on both `figma.editorType` **and** `figma.mode`; add design, codegen, and inspect stubs. Never call `figma.showUI` inside `generate`. | `src/main.ts`, `mode-dev.ts`, `mode-design.ts` | By hand: Code section shows the codegen stub; the action opens setup; Inspect mode shows the iframe placeholder; design editor opens setup |
| 4 | Config ingestion. Run `resolveTheme` in the UI iframe. Accept exact version evidence from a dropped `package.json`; handle missing files by name. Redact diagnostics and pass only resolved data/source metadata to storage. | `src/setup.ts` + test | resolver outcomes pass; exact/missing/skewed versions show correct default status; a secret marker inside an unresolved expression is absent from every sandbox message and diagnostic |
| 5 | Implement the exact `StoredConfig`, `ReadConfigResult`, and `WriteResult` contracts below. Three tiers, private `setPluginData`, stable document ID, ≤80 kB chunks, meta last, stale cleanup, diagnostics, cache. Never persist raw config. | storage files + tests | contract/type tests pass; 250 kB round-trip; 4→2 cleanup; corrupt reads retain diagnostics/fallback; unresolved-expression canary absent from document and client storage |
| 6 | Setup UI, six states. Must open from Dev Mode and design editor. Show exact-version/default coverage, `unknownNamespaces`, `partialNamespaces`, unresolved diagnostics, source filenames/hashes, and the fact that raw source is discarded. | `src/ui/**` | all states walked by hand, including missing package.json, minor skew, no edit access, both tiers, and Remove |
| 7 | Write-safety: ESLint and a bundle test whose package script always builds first. Exactly one allowlist entry (`setPluginData`). | `eslint.config.js`, `src/write-safety.test.ts`, package test script | `pnpm --filter @fig-tail/plugin test -t write-safety` builds current source and passes; a deliberate node-name mutation fails both guards; remove and re-run |
| 8 | Verify every tier/transition and the production cross-account read; write the results to `notes/storage-matrix.md`. | `notes/storage-matrix.md` | all one-user transitions recorded; second-account read passed or explicitly UNVERIFIED. UNVERIFIED adds the plan-010 publication gate |
| 9 | README "Installing the plugin" section (~25 lines). | `README.md` | You followed your own README from a clean checkout and reached a loaded config in Dev Mode without opening another file |

**Task 7 is the one a reviewer will check hardest.** A guard nobody has watched
fail is not a guard.

---

## Why this matters

This plan makes the product promise real: **a designer drops in their
`tailwind.config.js` once, and every developer who installs the plugin sees real
class names.** No CLI, no npm install, no token file to generate or keep in sync.

Two decisions carry that promise, and both live here.

**The config is resolved in the plugin**, by calling plan 001's browser-safe
resolver on the pasted source. That is what removes the CLI from the developer's
path entirely.

**The result is stored on the Figma document by preference**, so one person's
setup serves the whole team and the theme becomes a property of the design file.
But that is a preference, not a requirement: a developer who cannot read the
file's shared config — or who is looking at a file nobody has configured — can
add the Tailwind config themselves in seconds, and a developer who does neither
still gets arbitrary-value output rather than nothing. Three tiers, each
labelled. Nobody is ever blocked; they just see which tier they are on.

This is also where the program's write-safety invariant gets mechanically
enforced rather than merely promised — which is why the ESLint rule and bundle
test are in this plan and not bolted on later.

Nothing here produces Tailwind output. That is plans 004 and 005. This is the
substrate they sit on.

## Context the executor needs

### Verified Figma platform facts

Checked against Figma's plugin documentation on 2026-07-31, with sources below.
**Open each linked page before implementing against the fact you depend on** —
these summaries were gathered by search (the pages 403 automated fetching), so
they are not quotations. If a page contradicts this list, the page wins: fix the
list in the same commit.

1. A single plugin may declare **both** `"codegen"` and `"inspect"` in
   `manifest.capabilities`. Possible values: `codegen`, `inspect`, `textreview`,
   `vscode`. — [Plugin manifest](https://developers.figma.com/docs/plugins/manifest)
2. **`codegen`** runs in the **Code section** of the Dev Mode Inspect panel. The
   plugin appears in Figma's native language dropdown; once selected,
   `figma.codegen.on('generate')` fires on every selection change. —
   [Codegen plugins](https://developers.figma.com/docs/plugins/codegen-plugins)
3. **`inspect`** runs in the **Inspect panel** itself; its iframe takes the full
   height and width of the panel. —
   [Working in Dev Mode](https://developers.figma.com/docs/plugins/working-in-dev-mode)
4. Figma's API reference says the `generate` callback has a 15-second timeout,
   while its codegen guide says 3 seconds. Use the stricter **3-second** budget
   and a 2-second internal deadline until an in-product measurement resolves the
   discrepancy. — [figma.codegen.on](https://developers.figma.com/docs/plugins/api/properties/figma-codegen-on)
   · [Codegen plugins](https://developers.figma.com/docs/plugins/codegen-plugins)
5. **`figma.showUI` is not allowed inside the `generate` callback.** Call it
   outside and use `figma.ui.postMessage`, or call it from a `preferenceschange`
   handler. — [figma.codegen.on](https://developers.figma.com/docs/plugins/api/properties/figma-codegen-on)
   · [figma.ui](https://developers.figma.com/docs/plugins/api/figma-ui/)
6. `codegenPreferences` with `"itemType": "action"` adds a menu item that fires
   `figma.codegen.on('preferenceschange')`; **that** handler may call
   `figma.showUI`. This is the supported way to give a codegen plugin a settings
   modal, and it is how a Dev Mode user reaches setup. —
   [CodegenPreference](https://developers.figma.com/docs/plugins/api/CodegenPreference/)
7. **`setPluginData` is private to the plugin ID and enforces a 100 kB limit per
   entry.** Other plugins cannot read it; collaborators running the same plugin
   are the intended readers. Chunking across keys is still required. —
   [setPluginData](https://developers.figma.com/docs/plugins/api/properties/nodes-setplugindata/)
8. **`figma.clientStorage` has a 5 MB total limit**, is per-user and per-plugin,
   and is not shared between collaborators. **It needs no edit access**, which is
   what makes the developer-pastes-it-themselves fallback work. —
   [Update 109](https://developers.figma.com/docs/plugins/updates/2025/03/17/version-1-update-109/)
9. **`"documentAccess": "dynamic-page"`** is required in the manifest for all new
   plugins. A Dev Mode plugin runs on the **current page only** unless pages are
   explicitly loaded. —
   [Migrating to dynamic loading](https://www.figma.com/plugin-docs/migrating-to-dynamic-loading/)
10. **`figma.editorType`** is `'dev'` in Dev Mode and `'figma'` in the design
    editor. A plugin can declare `"editorType": ["figma", "dev"]` and branch. —
    [figma.mode](https://developers.figma.com/docs/plugins/api/properties/figma-mode/)
11. Users can **save** a plugin to their account for access across files. **Org
    admins** can additionally *pin* a Dev Mode plugin so it appears in the
    Inspect panel for all users — an Organization/Enterprise feature. —
    [Use plugins in files](https://help.figma.com/hc/en-us/articles/360042532714-Use-plugins-in-files)
    · [Manage Dev Mode settings for an organization](https://help.figma.com/hc/en-us/articles/22927410880535-Manage-Dev-Mode-settings-for-an-organization)

### The config-source ladder — this plan's core design

Plan 000 records whether a Dev Mode user without edit access can read
`figma.root.getPluginData(...)` written by the same plugin ID. Re-read that
evidence before implementation; plan 003 repeats it against production storage.

It does not block anything, because this plan builds a **three-tier ladder**
rather than a single path. Every tier produces usable output, and every tier is
labelled so the user knows which one they are on.

| Tier | Source | Who sets it | Needs edit access | Label shown |
|---|---|---|---|---|
| 1 (preferred) | Private document storage — `setPluginData` on `figma.root` | whoever owns the file, once | yes, to **write** | "Using the config saved on this file" |
| 2 (fallback) | Per-user storage — `figma.clientStorage` | any user, including a Dev-seat viewer | **no** | "Using your personal config — this file has no shared one" |
| 3 (degraded) | No config at all | — | — | "No Tailwind config — generic Tailwind syntax; project prefix/settings may require changes. Add your config for confirmed names." |

**Tier 2 is the answer to the unverified question.** The setup UI is reachable
from Dev Mode (Step 3, via the `codegenPreferences` action), and `clientStorage`
needs no edit access. So a developer who cannot read the file's shared config —
for whatever reason — drops in the Tailwind config themselves, once, and
everything works from then on. Paste-once-for-the-team is the *preferred* path,
not a *required* one.

**Tier 3 keeps the plugin useful with no setup whatsoever.** With no config, the
matcher receives `tokens: null` and returns labelled generic suggestions such as
`bg-[#3b82f6]` and `p-[24px]`. They preserve values under standard unprefixed
Tailwind, but they are not project-confirmed: a prefix, disabled core plugin, or
future-major behavior can require adaptation. The banner states that limitation
and tells the user how to load a config for confirmed output.

**Precedence when both tier 1 and tier 2 exist**: the document config wins, so a
team's shared truth is the default. The UI shows a one-line notice and a switch
("You also have a personal config — use that instead?"), so a deliberate
override is possible but never accidental. Store the user's choice in
`clientStorage`.

Step 8 repeats the read question on production code. A negative result costs
convenience, not function. An UNVERIFIED result blocks plan 010's team-sharing
claim and Community submission.

### The write-safety invariant (program-wide, set by the repo owner)

Restated here because this plan is where it gets enforced:

> fig-tail never mutates the Figma document except when a human clicks an
> explicit "Apply" in the setup UI, having first seen a dry-run diff. The only
> document-write APIs permitted anywhere in this codebase are
> `figma.root.setPluginData` (this plan) and
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

### What gets stored — data minimization is the contract

Store the resolved `TokenSet`, the complete unresolved/warning report, exact
version/default-coverage provenance, source filenames, byte counts, and SHA-256
hashes. **Never store raw config source in v1**, in document or personal storage.
The source may contain private file globs, internal package names, comments, or
credentials. The resolver processes it locally in the iframe and discards it.

The setup UI can show the report and metadata immediately after resolution. On a
later replacement it asks for the files again; that small inconvenience is the
cost of not embedding source code in a design document. A future opt-in source
archive requires a separate privacy/security plan, not a boolean added here.

### Package layout to create

```
packages/plugin/
├── manifest.json
├── package.json
├── build.mjs                  # esbuild: sandbox bundle + inlined UI HTML
├── tsconfig.sandbox.json      # ES2020 + Figma types, no DOM
├── tsconfig.ui.json           # ES2020 + DOM, no Figma global
├── src/
│   ├── main.ts                # sandbox entry — the `figma` global lives here
│   ├── storage.ts             # private chunked read/write + clientStorage fallback
│   ├── storage-types.ts       # persisted/read/write contracts
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
| Bundle size | `wc -c packages/plugin/dist/main.js packages/plugin/dist/ui.html` | main under 250 kB, ui under 400 kB |

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
  private fig-tail keys via `figma.root.setPluginData(...)`.
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

Create two non-overlapping TypeScript projects. `tsconfig.sandbox.json` includes
sandbox/storage/mode code, `lib: ["es2020"]`, and Figma plugin typings. It must
not see DOM globals. `tsconfig.ui.json` includes only iframe/setup UI code and
uses `lib: ["es2020", "dom", "dom.iterable"]`; it must not include the Figma
plugin typings. Shared message types live in a third neutral include path that
typechecks under both. The package `typecheck` script runs both projects.

Create the build's real entry files in this task. The sandbox entry performs no
document work and closes with a scaffold-only message; the UI entry renders a
plain scaffold label. Task 3 replaces the sandbox branch and task 6 replaces the
UI. Define a minimal discriminated sandbox↔UI message in `src/shared/messages.ts`
and test its type guard at runtime so `passWithNoTests: false` is satisfied by a
real boundary test, not an empty-suite exemption.

From this first plugin commit onward, define the plugin package's `test` script
as build-then-Vitest. That invariant lets the later write-safety suite inspect a
fresh current-source bundle even when a caller runs only
`pnpm --filter @fig-tail/plugin test`; a clean checkout must not need a manual
pre-build.

**Check**: test, typecheck, and build pass; the message guard test is collected;
both artifacts exist; `dist/ui.html` has no external script. Temporary negative
fixtures using `document` in sandbox code and `figma` in UI code each fail the
correct TypeScript project.

### Step 2: Write the manifest with both Dev Mode capabilities

Reuse the exact development-plugin ID registered and proven by plan 000. Do not
register a second identity: private plugin data is keyed by plugin ID, so changing
the ID invalidates the storage evidence and makes existing document data unreadable.

```jsonc
{
  "name": "fig-tail",
  "id": "<exact ID from the generated development-plugin manifest>",
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

In `src/main.ts`, branch on the pair `(figma.editorType, figma.mode)`:

- `'figma'` → `figma.showUI(__html__, { width: 520, height: 640 })`, hand off to
  `mode-design.ts`, and post an initial `{ view: 'setup' }` route after the UI is
  ready.
- `'dev'` + `'codegen'` → register `figma.codegen.on('generate', …)` and
  `figma.codegen.on('preferenceschange', …)`; the latter opens the setup UI when
  `propertyName === 'settings'` and then posts `{ view: 'setup' }`.
- `'dev'` + `'inspect'` → open the single bundled iframe and post
  `{ view: 'inspect-placeholder' }`. Do not register the Codegen callbacks on
  this path.
- Any other pair → close with a concise unsupported-mode message.

Use one inlined `ui.html` and explicit initial-route messages. Codegen and
Inspect are separate invocations; do not try to render the inspect iframe from
the Codegen branch.

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
   It also accepts `package.json` solely as version evidence. Only an exact
   `x.y.z` dependency is confirmed; `^`, `~`, ranges, tags, and workspace specs
   are visibly unconfirmed and never authorize bundled-default merging.
2. It calls `resolveTheme({ sources, tailwindVersion })` from `@fig-tail/theme`.
3. On a `missing-import` or unresolved `@config` entry, it **asks for the named
   file** rather than failing — a v4 setup often needs `app.css` plus
   `tailwind.config.js`, and the report says exactly which.
4. It hashes each source in the iframe, redacts diagnostics, then posts `{ tokens, unresolved,
   warnings, sourceMetadata }` to the sandbox. `sourceMetadata` contains name,
   SHA-256, and byte count — never source text. The posted `unresolved` entries
   are `PersistedDiagnostic[]`: copy path/reason/source/line/message, but drop
   the resolver-only `snippet` before crossing the iframe boundary.
5. The sandbox validates with `validateTokenSet` and stores (Step 5).

Time the resolve step and show a spinner past 300 ms. A large config with a full
default theme is real work.

**Check**: unit tests for the orchestration with a mocked resolver: a clean
resolve stores; a resolve with `ok: false` stores nothing and surfaces the report;
a `missing-import` result triggers the "provide this file too" path; a resolve
returning tokens that fail `validateTokenSet` stores nothing and reports. Then in
Figma: drop each plan-001 fixture with matching, missing, and deliberately skewed
`package.json` evidence and confirm the expected default-coverage result. Include
a unique canary specifically inside an unresolved expression and assert it never
crosses the iframe message, including through any diagnostic field.

### Step 5: Implement chunked document storage

`src/storage-types.ts` is authoritative; do not invent result shapes at call
sites:

```ts
export type PersistedDiagnostic = Omit<Unresolved, 'snippet'> & {
  /** Compile-time guard: raw resolver snippets never cross or persist. */
  snippet?: never
}

export type StoredConfig = {
  formatVersion: 1
  tokens: TokenSet
  resolution: { unresolved: PersistedDiagnostic[]; warnings: string[] }
  provenance: ConfigProvenance
}

export type StorageFailure = {
  tier: 'document' | 'user'
  reason: 'missing' | 'no-access' | 'invalid-meta' | 'missing-chunk'
        | 'checksum' | 'decompress' | 'parse' | 'schema'
  detail: string
}

export type ReadConfigResult = {
  active: null | {
    config: StoredConfig
    tier: 'document' | 'user'
    documentConfigId: string | null
  }
  available: { document: boolean; user: boolean }
  preferred: 'document' | 'user'
  overridden: boolean
  failures: StorageFailure[]
}

export type WriteResult =
  | { ok: true; writtenTo: 'document' | 'user'; documentConfigId: string | null }
  | { ok: false; writtenTo: null; reason: 'no-edit-access' | 'validation'
        | 'quota' | 'write-failed'; needsPersonalConfirmation: boolean;
        errors: string[] }

export async function writeConfig(
  payload: StoredConfig,
  options: { target: 'document' | 'user' },
): Promise<WriteResult>
export async function readConfig(): Promise<ReadConfigResult>
export async function clearConfig(target: 'document' | 'user'): Promise<WriteResult>
```

`src/storage.ts` uses:

```ts
const PREFIX = 'figtail'
// Private plugin-data keys: `figtail.meta`, `figtail.payload.0`, …
const CHUNK_BYTES = 80_000

```

Write path:

1. Validate the `TokenSet` with `validateTokenSet`, provenance with
   `validateConfigProvenance`, and the redacted diagnostic shape. Reject with a
   readable error listing the first three failures.
2. `JSON.stringify` → gzip (`fflate`) → base64.
3. Assert the serialized object contains no `sourceText`, `sources[].text`,
   diagnostic `snippet`, or configured canary; split into ≤80 kB chunks as
   `figtail.payload.<i>`.
4. For document target, call `figma.root.setPluginData` only. Write
   `figtail.meta` **last**, containing `{ formatVersion, documentConfigId,
   chunks, byteLength, checksum, storedAt, tailwindMajor, tokenCount,
   unresolvedCount }`.
   Writing meta last makes a partial write detectable.
5. **Clear stale chunks**: if a previous write used more chunks, overwrite the
   extras with `''`. Forgetting this leaves garbage a future read may
   concatenate.

Read path: read meta, stated chunks, checksum, decode, decompress, parse, then
validate the complete stored envelope including provenance and the absence of
diagnostic snippets.
It always returns `ReadConfigResult`; tier 3 is `active: null`, never bare null.
Every corrupt/unavailable tier contributes a typed `StorageFailure`, then falls
through. Never throw into Codegen.

`documentConfigId` is a random stable ID generated on the first successful
document write and preserved on replacements. Public plugins cannot rely on
`figma.fileKey`, which is restricted to private plugins. Plan 006 uses this ID
for per-document dismissal state when a shared config exists.

**Implement the full three-tier ladder from "Context", not just a fallback:**

- `writeConfig(payload, { target })` writes to `'document'` or `'user'`. Choosing
  `'document'` without edit access returns
  `{ writtenTo: null, reason: 'no-edit-access', needsPersonalConfirmation: true }`.
  The UI then offers the personal target and writes there only after a second,
  explicit click. Never silently change the requested storage scope.
- `readConfig()` reads document storage first, then user storage, and returns the
  full `ReadConfigResult`. `active: null` is tier 3; callers still retain failure
  diagnostics for the banner/debug view.
- When **both** exist, document wins by default. Store the user's override choice
  under a `preferUserConfig` key in `clientStorage` and honour it when set.
- Never throw for a missing or unreadable tier. A failed document read falls
  through to the user tier with the reason recorded; a failed user read falls
  through to tier 3.

Cache the parsed result in a module-level variable, invalidated on write — gunzip
plus parse on every selection change would eat the codegen budget.

**Check**: mocked Figma tests cover a 250 kB exact round-trip; 4→2 cleanup;
missing-chunk, checksum, decompression, parse, and schema diagnostics; document
failure with user fallback; stable ID; override; and cache invalidation. A raw
source canary placed inside an unresolved expression is absent from the iframe
message, every persisted diagnostic, every `setPluginData` call, and every
clientStorage value. Reload Figma and compare the token count to the fixture snapshot.

### Step 6: Build the setup UI

The setup UI must be reachable **from Dev Mode as well as the design editor** —
via the `codegenPreferences` action wired in Step 3 — because a developer adding
their own config (tier 2) never leaves Dev Mode. Verify that path, not just the
design-editor one.

Six states in the iframe:

1. **Empty** — two sentences on what this is, then a drop zone and textarea:
   "Drop your `tailwind.config.js` (v3) or CSS entry with `@theme` (v4). Add
   `package.json` to confirm the exact Tailwind defaults." Explain that source is
   processed locally and discarded after resolution.
2. **Resolving** — spinner past 300 ms.
3. **Review** — before storing, show what was found: exact version evidence (or
   missing evidence), token counts, whether bundled defaults were confirmed or
   withheld, and — prominently — the complete `unresolved` report.

   Call out `unknownNamespaces` separately and more loudly than the rest of the
   report, because it is the one that changes output quality most: "fig-tail
   could not read your **colours**, so it will show raw values like `#3b82f6`
   for them rather than token names." Name the affected namespaces. This is the
   whole payoff of plan 001 Step 8; do not bury it. Name `partialNamespaces`
   separately: explicit tokens work, but default tokens were withheld. Before the document-target
   button (label it **Apply to file**, not the generic **Save**), show the exact
   dry-run storage diff: namespace, keys added/replaced/cleared, compressed byte
   counts, and stored source filenames/hashes. State "Raw config source will not
   be saved." Offer Apply to file, Save personally, and Cancel as distinct actions.
4. **Configured** — the same summary, plus **which tier is in use**, stated
   plainly ("Saved on this file — everyone inspecting it gets this" versus
   "Saved in your settings — only you see this"), a **staleness warning when
   `storedAt` is over 30 days old**, the name/hash of each source file, and
   Replace / Remove buttons. Remove confirms.
5. **No edit access** — do not present this as an error. Say that saving to the
   file needs edit access, and offer saving to personal settings as the ordinary
   next step, pre-selected. This is tier 2 and it should feel routine, because
   it is.
6. **Both tiers present** — a one-line notice naming which is active and a
   switch to use the other. Never switch silently.

Plain and clear beats polished. This screen is used once per file per config
change.

**Check**: in Figma desktop on the scratch file, walk all six states by hand:
drop a clean fixture (→ review → configured); drop a fixture with a known
function-valued theme key (→ the report names it with an actionable message);
drop a v4 CSS with `@config` (→ asks for the second file); omit `package.json`
(→ defaults withheld and labelled); use a skewed version (→ no same-major
merge); paste random text (→ clear parse error); include a unique secret-like
canary and verify the resulting metadata/payload contains no canary; Remove.

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
comment naming this plan: `figma.root.setPluginData` in `src/storage.ts`.
(Plan 007 adds the second and only other entry.)

**b) Bundle test.** The plugin package's `test` script first runs `build`, then a
Vitest test reads that same invocation's `dist/main.js` and asserts
none of the banned identifiers appear except the allowlisted one. This catches
anything arriving via a dependency or a dynamic property access the linter cannot
see. Write the failure message so it says what was found and why it is banned,
referencing the invariant. Do not make callers pre-build and do not accept only
a stored source hash: `pnpm --filter @fig-tail/plugin test` must be sufficient
from a clean checkout and must always compile current source before inspection.

**Check**: `pnpm --filter @fig-tail/plugin lint` → exit 0;
`pnpm --filter @fig-tail/plugin test -t write-safety`
→ passes. The test must refuse to run against a missing/stale bundle (record a
source/build hash as a secondary assertion after the unconditional build). Then deliberately
add `figma.currentPage.selection[0].name = 'x'` to `main.ts`, confirm **both**
guards fail, remove it, confirm both pass. Note this verification in the commit
message — a guard nobody has watched fail is not a guard.

### Step 8: Verify the config-source ladder, including cross-user read

Write all results to `packages/plugin/notes/storage-matrix.md`; this is a durable
verification task, not an empty commit. Two things to establish, and only the
second needs a second account.

**a) The ladder works for one user.** On the scratch file, verify each tier and
each transition by hand:

- Tier 3 → the Dev Mode stubs report "no config" and say what to do.
- Save to document → tier 1, labelled "saved on this file".
- Remove the document config, save to personal settings → tier 2, labelled
  "saved in your settings".
- With both present → document wins, the notice appears, the switch works and
  persists.
- No edit access (simulate by opening a file you cannot edit) → the tier-2 path
  is offered as routine, not as an error.

**b) Cross-user read.** With a config saved on the scratch file, open it from a
**second account** with view-only or Dev-seat access and confirm the Step 3 stub
reports the config as loaded.

*If no second account is available*: approximate by sharing the file to a team
where you hold a View seat. Plugin development requires the desktop app, so this
may only be testable with a real second account. **If you cannot test it, do not
guess** — record it as UNVERIFIED in the note and in `plans/README.md`. This does
not block implementation: if cross-user read turns out not to
work, tier 2 already covers that developer, and the only casualty is the
convenience of one-person setup. It does block plan 010 Community publication
and the "configure once for the team" claim until resolved.

**Check**: `notes/storage-matrix.md` records every transition in (a). (b) passed,
or is explicitly UNVERIFIED with the reason and the plan-010 gate.

### Step 9: Document local installation

Add an "Installing the plugin" section to the root `README.md`: build, import via
Figma desktop, run in the design editor to add the config, then switch to Dev
Mode. Note the Org/Enterprise limitation on private publishing so the next person
does not go looking for it. ~25 lines; plan 010 writes the real docs.

**Check**: follow your own README from a clean checkout — install, build, import,
drop in a config, see it load in Dev Mode — without consulting any other file.
Any step you had to figure out is a step that is missing.

## Validation plan

- **Unit tests** (`figma` global mocked): complete storage-contract shapes,
  private chunk round-trip, stale cleanup, every typed read failure, tier
  fallback/override, raw-source canary exclusion, cache invalidation, setup
  orchestration, and exact-version/default coverage.
- **Bundle write-safety test**: Step 7.
- **Manual in-product checklist**, run on the scratch file in Figma desktop and
  recorded in `notes/storage-matrix.md`:
  - [ ] Plugin imports with no manifest errors
  - [ ] Appears in the design editor's plugin list
  - [ ] Appears in Dev Mode's Code-section language dropdown as "Tailwind"
  - [ ] Appears in Dev Mode's Inspect panel plugin list
  - [ ] "Configure Tailwind config…" opens the setup modal from Dev Mode
  - [ ] Each plan 001 fixture config resolves to its known expected result
  - [ ] The unresolved report is displayed, not swallowed
  - [ ] Config persists across a plugin reload
  - [ ] Config persists across a **Figma restart**
  - [ ] The setup UI opens from **Dev Mode**, not only the design editor
  - [ ] Every tier transition in Step 8(a) behaves as described
  - [ ] A second user in Dev Mode reads it (or: durable UNVERIFIED release gate)
  - [ ] Removing the config returns all Dev Mode stubs to the empty message
- **Size check**: `dist/main.js` under 250 kB, `dist/ui.html` under 400 kB. Both
  grow in plans 004 and 005; leaving headroom now matters.

## Done criteria

ALL must hold.

- [ ] `pnpm -r typecheck && pnpm -r lint && pnpm -r build && pnpm -r test` → exit 0
- [ ] `pnpm --filter @fig-tail/plugin build` produces `dist/main.js` and a fully
      inlined `dist/ui.html`
- [ ] The manifest declares `capabilities: ["codegen","inspect"]`,
      `editorType: ["figma","dev"]`, `documentAccess: "dynamic-page"`, and
      `networkAccess.allowedDomains: ["none"]`
- [ ] All three surfaces are reachable in Figma desktop
- [ ] A dropped `tailwind.config.js` resolves in-plugin and stores; a v4 CSS
      entry does too, asking for `@config`/`@import` files by name when needed
- [ ] The unresolved report is displayed to the user before saving
- [ ] Exact Tailwind version evidence controls bundled defaults; missing or
      skewed evidence is labelled and never same-major merged
- [ ] Raw config source is discarded after resolution and a canary test proves
      it is absent from document storage, clientStorage, sandbox messages, and
      persisted unresolved diagnostics (the canary lives inside an unresolved expression)
- [ ] Config round-trips through document storage, surviving a Figma restart
- [ ] Stale chunks are cleared on a shrinking rewrite (tested)
- [ ] All three config-source tiers work, each with its own visible label
- [ ] Tier 2 (personal config) is reachable **from Dev Mode**, needs no edit
      access, and is presented as routine rather than as an error
- [ ] `readConfig()` always returns the complete `ReadConfigResult`, including
      active tier, availability, preference, override, and typed failures;
      tier 3 is `active: null`
- [ ] With both tiers present, document wins by default and the switch persists
- [ ] Both write-safety guards are in place and were **verified to fail** on a
      deliberate violation
- [ ] The only document write in the bundle is `figma.root.setPluginData` under
      fig-tail-prefixed keys
- [ ] Sandbox and UI TypeScript projects have non-overlapping DOM/Figma globals,
      proved by negative type fixtures
- [ ] `notes/storage-matrix.md` contains the manual matrix; an UNVERIFIED
      cross-user result explicitly blocks Community publication in plan 010
- [ ] No files outside the in-scope list were changed
- [ ] `plans/README.md` status row for 003 updated

## STOP conditions

Stop and report back — do not improvise — if:

- **Figma rejects `capabilities: ["codegen", "inspect"]`**, or that combination
  with `editorType: ["figma", "dev"]`.
- `figma.showUI` from the `preferenceschange` handler does not work as
  documented — there would then be no way to configure the plugin from Dev Mode.
- The gzipped fixture token set still needs more than ~8 chunks **and**
  `pruneDefaults` does not bring it down. Read latency inside a 3-second codegen
  budget becomes a real risk, and a leaner schema is a plan 001 change. (Fewer
  than 8 chunks: proceed. This is a threshold, not a hard failure.)
- Running `resolveTheme` in the UI iframe is blocked by the iframe's CSP. (If it
  is merely *slow* — over ~3 s on a normal config — that is not a STOP: show
  progress, resolve once at setup rather than per read, and record the timing.
  Slowness at setup is acceptable; slowness per selection is not, and the cached
  `readConfig` already prevents that.)
- Any of the "Verified Figma platform facts" turns out to be false **and no
  fallback covers it**. If a linked doc simply contradicts the summary, correct
  the summary and carry on — that is expected maintenance, not a stop.
- A step's check fails twice after a reasonable attempt.

## Handoff / after it lands

- **Plan 004** replaces the codegen stub with real output. It calls `readConfig()`
  on every generate — the module-level cache from Step 5 is what keeps that
  inside the conservative 3-second budget. Do not remove it. Plans 004 and 005 are both
  responsible for **surfacing the tier label**, and for handling tier 3 by
  emitting arbitrary values with a banner rather than refusing to run.
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
  guards were observed failing. Second: the tier ladder in Step 5 — specifically
  that no tier transition can happen without the user seeing which tier they are
  on.
- **Deliberately deferred**:
  - *Detecting a stale config by comparing against the codebase.* Needs network
    access, which is ruled out. The 30-day staleness warning is the cheap
    approximation.
  - *Multiple themes per file.* Storage keys are namespaced, so adding a second
    slot later is additive.
  - *Schema migration.* There is only version 1; `meta.schemaVersion` is stored
    so the read path can branch when version 2 exists.
