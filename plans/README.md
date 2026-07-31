# fig-tail — Plans

Tailwind class names in Figma Dev Mode, resolved against a real codebase's
Tailwind config. Developed with the improve skill on 2026-07-31.

Plan numbers are stable IDs, and the index below is the recommended dependency
order (independent branches may run in parallel). **Plan 000 runs first**, before plan 001. Each executor:
read the plan fully before starting, honor its STOP conditions, and update your
row in the table when done.

---

## What this program builds

A designer drops their team's `tailwind.config.js` (v3) or `app.css` (v4), plus
`package.json` for version evidence, into fig-tail once. Only an exact `x.y.z`
Tailwind dependency confirms bundled defaults; ranges remain unconfirmed. The plugin resolves
it locally, discards the raw source, and stores the resolved token set privately
on the Figma document under the fig-tail plugin ID.

From then on, **any developer who installs the plugin and opens the file in Dev
Mode sees real Tailwind class names from that codebase** — `bg-brand-500`,
`p-6`, `rounded-lg` — sitting in the Inspect panel next to Figma's own CSS. No
CLI. No npm install. No token file to generate or keep in sync. Install the
plugin, open Dev Mode, read the classes.

That last part is a hard product requirement, not a nice-to-have. **A developer
installs one plugin and nothing else.** Every architectural decision in these
plans is downstream of it — most importantly, the Tailwind theme resolver runs
*inside the plugin*, in the browser, rather than in a Node CLI.

### What makes this different from what already exists

Several Figma→Tailwind plugins exist (css-tailwind-codegen, tailwind-figma-codegen,
figma-to-tailwind). All of them convert Figma's CSS into *arbitrary values*:
`bg-[#3b82f6]`, `p-[24px]`. That compiles, and it silently routes around the
design system.

fig-tail resolves against the team's actual config, so it emits the token the
codebase defines. And when a design value has **no** matching token, it says so
rather than guessing — which turns the plugin into a design-system QA tool as a
side effect.

### Built for the public, not for one codebase

This ships to the Figma Community. **Nobody here will ever see the configs it
has to handle.** That is a design constraint, not a caveat, and it shows up in
three places:

- **Test corpora are drawn from the wild**, not from the owner's own project.
  Plan 001's eight v3 fixtures come from open-source projects with deliberately
  different shapes. Tuning the resolver to any single team's config would
  optimise for a sample of one.
- **Fallbacks fail toward raw values**, never toward a guessed token name — see
  invariant 2. A wrong class name in someone else's codebase is a silent
  no-op they cannot debug.
- **Limits are documented rather than hidden.** Plan 001 Step 9 and plan 010
  require the docs to state plainly which config patterns the in-plugin resolver
  cannot read, so a stranger can predict what they will get before installing.

### Components

| Component | What it is | Plans |
|---|---|---|
| Platform contract | Disposable Figma spike, real CSS fixtures, storage/read/write evidence | 000 |
| `@fig-tail/theme` | Tailwind config → token set. Pure TS, runs in a browser. Bundles Tailwind's v3 and v4 default themes. | 001 |
| `@fig-tail/match` | CSS declaration + token set → Tailwind class + confidence | 002 |
| `@fig-tail/plugin` | The plugin: Dev Mode Code section, Dev Mode Inspect panel, design-mode setup | 003, 004, 005, 006, 007, 008 |
| `@fig-tail/cli` | Optional escape hatch for configs the in-browser resolver can't fully evaluate | 009 |
| Distribution | README, setup guide, Figma Community listing | 010 |

---

## Verified Figma platform facts, with sources

Checked against Figma's documentation on 2026-07-31. Individual plans restate
the ones they depend on and carry the same links. Where Figma's own pages
conflict, these plans use the stricter interpretation and require an in-product
measurement before relaxing it.

> **How these were gathered, and what you owe them.** These facts come from
> Figma's published documentation, located by search. The pages themselves
> returned HTTP 403 to automated fetching, so the wording below is a summary,
> not a quotation. **Open the linked page before implementing against any fact
> you depend on** — the API may have moved, and a summary is not a spec. If a
> page contradicts this table, the page wins: correct the table in the same
> commit and note it.

| # | Fact | Source |
|---|---|---|
| 1 | A single plugin may declare **both** `"codegen"` and `"inspect"` in `manifest.capabilities`. Possible values are `codegen`, `inspect`, `textreview`, `vscode`. | [Plugin manifest](https://developers.figma.com/docs/plugins/manifest) |
| 2 | **`codegen`** runs in the **Code section** of the Dev Mode Inspect panel; the plugin appears in Figma's native language dropdown. | [Codegen plugins](https://developers.figma.com/docs/plugins/codegen-plugins) · [Working in Dev Mode](https://developers.figma.com/docs/plugins/working-in-dev-mode) |
| 3 | **`inspect`** runs in the **Inspect panel** itself; a Dev Mode plugin's iframe takes the full height and width of the panel. | [Working in Dev Mode](https://developers.figma.com/docs/plugins/working-in-dev-mode) |
| 4 | `figma.codegen.on('generate')` fires on every selection change and may be async. Figma's API reference says **15 seconds**, while its codegen guide says **3 seconds**. Treat **3 seconds as the hard limit**, use a 2-second internal deadline, and record the observed product behaviour before changing that budget. | [figma.codegen.on](https://developers.figma.com/docs/plugins/api/properties/figma-codegen-on) · [Codegen plugins](https://developers.figma.com/docs/plugins/codegen-plugins) |
| 5 | **`figma.showUI` is not allowed inside the `generate` callback.** Move it outside and use `figma.ui.postMessage`. A hidden iframe is created with `figma.showUI(…, { visible: false })`. | [figma.codegen.on](https://developers.figma.com/docs/plugins/api/properties/figma-codegen-on) · [figma.ui](https://developers.figma.com/docs/plugins/api/figma-ui/) |
| 6 | `codegenPreferences` with `"itemType": "action"` adds a menu item that fires `preferenceschange`; **that** handler may call `figma.showUI`. The documented item types are `select`, `unit`, and `action` — there is no `bool` item type. | [CodegenPreference](https://developers.figma.com/docs/plugins/api/CodegenPreference/) · [Plugin manifest](https://developers.figma.com/docs/plugins/manifest) |
| 7 | **`setPluginData` is private to the plugin ID** and enforces 100 kB per entry. Other plugins cannot read it; collaborators using the same plugin are the intended readers. Chunking across keys is required for larger payloads. | [setPluginData](https://developers.figma.com/docs/plugins/api/properties/nodes-setplugindata/) |
| 8 | `figma.clientStorage` has a **5 MB** total limit (raised from 1 MB) and is per-user, per-plugin. | [Update 109](https://developers.figma.com/docs/plugins/updates/2025/03/17/version-1-update-109/) |
| 9 | `"documentAccess": "dynamic-page"` is required for all new plugins. A Dev Mode plugin runs on the **current page only** unless pages are loaded explicitly. | [Migrating to dynamic loading](https://www.figma.com/plugin-docs/migrating-to-dynamic-loading/) · [Working in Dev Mode](https://developers.figma.com/docs/plugins/working-in-dev-mode) |
| 10 | `node.getCSSAsync()` resolves to a JSON object of CSS properties. The shared-node reference does not clearly guarantee design-mode parity; plan 000 captures nine nodes in both modes before plan 002 or 006 chooses an input/surface. | [Update 68](https://developers.figma.com/docs/plugins/updates/2023/06/21/version-1-update-68) · [Shared node properties](https://www.figma.com/plugin-docs/api/node-properties/) |
| 11 | `variable.setVariableCodeSyntax(platform, value)` adds or modifies a platform definition on `codeSyntax`; `removeVariableCodeSyntax(platform)` removes one. Platforms are `'WEB'`, `'ANDROID'`, `'iOS'`. Code syntax is custom token syntax, not inherently a CSS utility class. | [Variable API](https://developers.figma.com/docs/plugins/api/Variable/) · [setVariableCodeSyntax](https://developers.figma.com/docs/plugins/api/properties/Variable-setvariablecodesyntax/) |
| 12 | `networkAccess.allowedDomains` restricts outbound requests; the keyword `"none"` blocks all network access. | [Plugin manifest](https://developers.figma.com/docs/plugins/manifest) |
| 13 | `figma.editorType` is `'dev'` in Dev Mode and `'figma'` in the design editor. Inside Dev Mode, `figma.mode` distinguishes Codegen from Inspect, so the shell must branch on both values. | [figma.mode](https://developers.figma.com/docs/plugins/api/properties/figma-mode/) |
| 14 | Users can **save** a plugin to their account (the ribbon icon) for access across files. | [Use plugins in files](https://help.figma.com/hc/en-us/articles/360042532714-Use-plugins-in-files) |
| 15 | **Org admins** can *pin* a Dev Mode plugin so it appears in the Inspect panel for all users, and can set a default code language. Both are Organization/Enterprise features. | [Manage Dev Mode settings for an organization](https://help.figma.com/hc/en-us/articles/22927410880535-Manage-Dev-Mode-settings-for-an-organization) |
| 16 | Language/plugin selection in the Code section happens via the dropdown at its top right. | [Use code snippets in Dev Mode](https://help.figma.com/hc/en-us/articles/15023202277399-Use-code-snippets-in-Dev-Mode) |
| 17 | `figma.fileKey` is unavailable to public plugins; it requires the private plugin API. Public-plugin per-file state must use an identifier the plugin already stores on the document, or explicitly degrade to session-only state when none exists. | [Plugin API: `figma.fileKey`](https://developers.figma.com/docs/plugins/api/figma/) |

### Further reading for implementers

- [Codegen plugins guide](https://developers.figma.com/docs/plugins/codegen-plugins) — the primary reference for plans 003–005.
- [Figma blog: codegen plugins for automating design to code](https://www.figma.com/blog/figma-dev-mode-codegen-plugins/) — practical framing.
- [Guide to Dev Mode](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode) — the user-facing view of what developers see.
- [Plugin quickstart](https://developers.figma.com/docs/plugins/plugin-quickstart-guide/) — scaffolding and local install.
- [Tailwind v3 theme configuration](https://v3.tailwindcss.com/docs/theme) and [Tailwind v4 theme variables](https://tailwindcss.com/docs/theme) — the two resolution models plan 001 implements.

### Not verified — and how each is de-risked

Neither of these blocks the program. Both have a designed fallback, per the
"Degrade, don't block" invariant below.

**A. Whether the Code-section language selection persists per user across files
and sessions.** No documentation found either way.

*Fallback*: plan 005 builds the **Inspect panel surface** alongside the Code
section. It does not depend on the language dropdown and org admins can pin it,
but whether an ordinary user sees it automatically is also verified rather than
assumed. Plan 005 Step 1 records both discovery paths in
`packages/plugin/notes/devmode-discovery.md`; plan 010's docs are written from
that evidence.

**B. Whether a Dev-seat user without edit access can read private plugin data
written by the same plugin ID.** This is unconfirmed in-product until plan 000.

*Fallback*: **the developer adds the config themselves.** The setup UI is
reachable from Dev Mode (plan 003 Step 3), and per-user storage
(`figma.clientStorage`) needs no edit access at all. So if document storage is
unreadable for them, they paste the config once into their own settings and
everything works — labelled as a personal config so they know where it came
from. Paste-once-for-the-team is the *preferred* path, not a *required* one.
Plan 000 tests it before implementation and plan 010 repeats it against the
release build. A negative result costs convenience rather than function; an
unverified result blocks the team-sharing publication claim.

---

## Program-wide invariants

These hold in **every** plan and are restated inside each plan that touches
them.

### 1. Developers install one thing

A developer installs the fig-tail plugin. Nothing else. No npm package, no CLI,
no token file, no repo access, no configuration. If a plan's design would
require a developer to run a command, the design is wrong.

(Plan 009's CLI is an escape hatch for *setup*, run once by whoever configures
the file — never by a developer inspecting a design.)

### 2. Degrade, don't block — and always label the fallback

When fig-tail cannot do the best version of something, it does the **next best
version and says so**. It never silently substitutes, and it never refuses to
work because one input was imperfect. A developer should always get *something*
usable, and should always be able to tell how good it is.

The fallback ladders this program commits to:

| When | Falls back to | Label the user sees |
|---|---|---|
| Config partly readable, **extending** key missed (`theme.extend.colors`) | Everything that resolved; bundled defaults are included only when an exact supported Tailwind version was supplied | "N settings in your config could not be read" + exact-version/default-theme status |
| Config partly readable, **replacing** key missed (`theme.colors`) | That namespace is marked **unknown**, so it emits arbitrary values — *not* Tailwind's defaults, which the project does not have | "fig-tail could not read your colours; showing raw values for them" |
| No config on the document | The developer's own pasted config (`clientStorage`) | "Using your personal config — this file has no shared one" |
| No config at all | **Generic arbitrary-value suggestions** (`bg-[#3b82f6]`, `p-[24px]`), not project-confirmed | "No Tailwind config — generic Tailwind syntax; project prefix/settings may require changes. Add your config for confirmed names." |
| Variable bound but unresolvable (e.g. from an unavailable library) | Value matching against the theme | confidence drops from `exact-variable` to `exact-value` |
| No token matches a value | Arbitrary value | `arbitrary` confidence badge |
| Value is *near* a token | **Nothing is emitted for it** — the near-miss is reported instead | "no exact token; nearest is `brand-500`, ΔE 0.4" |
| Subtree too large or too slow | A truncated tree | an explicit truncation marker saying why |
| Config resolution fails entirely | Generic raw suggestions; if and only if plan 009 shipped, also offer its optional CLI escape hatch | the plugin labels the generic output; core copy never assumes the CLI exists |

Every fallback carries a visible label naming **what was used**, **why**, and
**what to do to get the better version**. A fallback the user cannot see is a
silent wrong answer, which invariant 6 forbids.

#### Which way a fallback must fail

This program ships publicly, to teams whose configs nobody here will ever see.
So fallbacks have a required **direction**, and it is not the intuitive one:

> **Never emit a named token class unless the config confirms it exists. When
> the config is partly known, prefer a labelled arbitrary value.**

`bg-[#3b82f6]` preserves the value in standard, unprefixed Tailwind and is safer
than inventing a named token. It is **not universally guaranteed**: a project
may use a prefix, disable the relevant core utility, or use an unsupported
future major. When fig-tail lacks the config entirely, it labels arbitrary
output as generic Tailwind syntax rather than claiming the class is confirmed.
`bg-brand-500` compiles to **nothing at all** in a project that has no
`brand-500` — the developer pastes it, the styling silently does not apply, and
they blame the design or their build before they blame fig-tail.

So an unverifiable token name is worse than a raw value, and every fallback
resolves toward the raw value. The concrete consequences, each specified in the
plan that owns it:

- A **replacing** theme key that cannot be evaluated marks its namespace
  *unknown*, never *default* (plan 001).
- Missing or inexact Tailwind version evidence prevents bundled defaults from
  being treated as project-confirmed. New defaults can arrive within a major,
  so same-major guessing is forbidden (plan 001).
- An unresolvable `prefix` or a disabled core plugin suppresses the affected
  utilities rather than emitting them unprefixed or non-existent (plan 002).
- A near-miss value is reported, not emitted (plan 002).

**Two things are refusals, not degradations**, and correctly block: writing to
the document outside the sanctioned path (invariant 3), and executing user
input (plan 001). Do not "fall back" past either.

### 3. Write-safety (non-negotiable — set by the repo owner)

fig-tail **never mutates the Figma document** except when a human clicks an
explicit "Apply" in the setup UI, having first seen a dry-run diff of exactly
what will change.

- The **only** document-write APIs permitted anywhere in this codebase are
  `figma.root.setPluginData` (private config storage, plan 003) and
  `Variable.setVariableCodeSyntax('WEB', …)` (plan 007).
- Variable **names are never written**. Tailwind names go into the variable's
  *Code syntax* field, never into `variable.name`.
- Variable values, modes, collections, scopes, node properties, styles, and text
  content are never written, ever.
- Everything else — codegen, inspect, linting, subtree export — is strictly
  read-only.

Enforced mechanically: plan 003 Step 7 (ESLint `no-restricted-properties` rule
plus a bundle-level test), extended by plan 007 Step 6.

### 4. Dry-run first

Any feature that *could* write runs in dry-run mode by default and produces a
reviewable diff. Applying is a separate, explicit, second action.

### 5. No network

The plugin ships with `"networkAccess": { "allowedDomains": ["none"] }`. The
config arrives by paste or file-drop. No telemetry, no config fetching, no
external calls. This is a permanent decision and a documented feature, not a
backlog item.

### 6. Never guess silently

When the resolver cannot fully evaluate a config, or the matcher cannot find a
token, fig-tail says so precisely. A plausible wrong answer is worse than a
visible gap. This applies to the resolver (plan 001's unresolved-feature
report), the matcher (plan 002's confidence ladder), and every surface that
displays their output. It is the counterweight to invariant 2: **degrade
freely, but never quietly.**

### 7. No secrets in this repo

No Figma personal access tokens, no plugin API keys, no `.env` with real values.
Plans reference credential *locations and types* only.

---

## Before you show it to developers

The repo owner will be demonstrating this to the developers they work with. A
plugin that emits a wrong class name in front of an audience does more damage
than one that does not exist — the developers stop trusting the output, and no
amount of later correctness wins that back.

So before any demo, these must **all** hold. This list is not a substitute for
each plan's Done criteria; it is the subset a demo will expose.

- [ ] Every plan being demonstrated is DONE in the table below, with its Done
      criteria genuinely met — not "basically done".
- [ ] The resolver's output has been **spot-checked by hand** against the real
      config for at least five tokens (plan 001 Steps 4–6 require this and
      record it in commit messages). A green snapshot test proves consistency,
      not correctness.
- [ ] The demo file's config is the **team's real config**, not a fixture. Demo
      what they will actually use.
- [ ] Every node you plan to select has been checked in advance, on both
      surfaces, and produces what you expect. Plan 004 Step 6's test matrix is
      the model: node → expected output, written down beforehand.
- [ ] No `nearest` match is silently presented as an exact one. If the demo file
      has drift, that is worth *showing* — it is a feature — but know where it
      is before someone else finds it.
- [ ] The unresolved-config report is empty, or you can explain every entry in
      it. "It couldn't read part of our config and I don't know why" is the one
      answer that costs trust.
- [ ] A cold start works: install the plugin on a machine that has never had it,
      open the file, read a class name. Do this once, for real, before the demo.
- [ ] You know which **config tier** the demo file is on, and the label the
      audience will see says so. A developer noticing "your personal settings"
      mid-demo, when you meant to show the shared path, is an avoidable
      distraction.
- [ ] Someone in the room can try it on their own machine and it works — which,
      given tier 2, only requires them to install the plugin and drop in the
      config. Have the config file to hand.
- [ ] Nothing writes to the design file. If plan 007 has shipped, it has been
      run deliberately beforehand, not during the demo.

---

## For executors — how to run one of these plans

These plans are written to be executed by a small model or a busy human with
**zero context from the conversation that produced them**. Each numbered plan
contains its own commands, scope, contracts, checks, and STOP conditions.

1. **The plan's own Build sheet** — the first section of every plan. It lists
   the exact files that plan creates, the exact `pnpm add` commands, and a
   numbered task table where each task names the files it may touch and a single
   *Done when* command.
2. **`plans/EXECUTOR-GUIDE.md`** — optional expanded guidance for shared
   conventions and the failure-report format. It is not a substitute for the
   numbered plan; if they conflict, the numbered plan wins.

### The structure of every plan

| Section | What it is for |
|---|---|
| **Build sheet** | What you *do*. File manifest, dependencies, numbered tasks with checks. Follow it in order. |
| Why this matters | Intent. Read it so you can make a right call when a detail is off. |
| Context the executor needs | The facts, inlined. Platform docs, API shapes, constraints. |
| Inputs & resources | What you need on hand before starting. |
| Scope | In-scope and out-of-scope. The out list names the tempting-but-forbidden things. |
| Steps | The detail behind each Build-sheet task. |
| Validation plan | How the whole thing is proven to work. |
| Done criteria | Confirm every line literally before saying you are finished. |
| STOP conditions | Narrow and specific. Everything else degrades — see invariant 2. |
| Handoff | What the next plan depends on, and what a reviewer should scrutinise. |

### One task, one commit

Each Build-sheet task is sized to be independently committable and independently
verifiable. Do not batch them, and do not start a task while the previous one's
check is unverified. If a check fails twice, follow the plan's own STOP
conditions and fallback rules. `EXECUTOR-GUIDE.md` §6 is optional expanded
guidance; the numbered plan wins if the two conflict.

---

## Order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 000 | Prove the Figma platform contracts before implementation | P0 | M | — | TODO |
| 001 | Build the in-plugin Tailwind theme resolver (v3 + v4) | P1 | L | 000 | TODO |
| 002 | Build the CSS→Tailwind matching engine | P1 | L | 000, 001 | TODO |
| 003 | Scaffold the plugin shell, dual capability, and private config storage | P1 | M | 000, 001 | TODO |
| 004 | Ship the Dev Mode Code-section panel (codegen) | P1 | M | 002, 003 | TODO |
| 005 | Ship the Dev Mode Inspect-panel surface | P1 | M | 004 | TODO |
| 006 | Add the read-only drift linter (designer dry-run) | P2 | M | 005 | TODO |
| 007 | Add opt-in variable Code-syntax stamping | P2 | M | 000, 006 | TODO |
| 008 | Add whole-subtree className export | P3 | L | 005 | TODO |
| 009 | Add the optional CLI escape hatch for complex configs | P3 | M | 001, 003 | TODO |
| 010 | Package, document, and publish | P2 | S | 005 | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (one-line reason) | REJECTED (one-line rationale)

**Minimum shippable slice: 000 → 001 → 002 → 003 → 004 → 005 → 010.** That is a
public, installable plugin that fully delivers the core promise. 006–009 are
upside.

---

## Dependency notes

- **000 runs first** and owns the platform evidence: real CSS fixtures, route
  matrix, cross-account private-storage result, and design/Dev write matrix.
- **001 depends on 000** so repository implementation begins only after the
  product's Figma route/storage/write assumptions have evidence.
- **002 depends on 000 and 001** for the token-set type and real CSS captures it
  consumes. **003 depends on 000 and 001** because it stores and validates
  config, calls the resolver, and implements the proven private-storage route.
  002 and 003 do not depend on each other and can be built in parallel.
- **004 depends on 002 and 003** — it is the wiring between engine and plugin.
- **005 depends on 004** and deliberately reuses its rendering pipeline. The two
  surfaces must never diverge in what they report; 005 Step 2 enforces that with
  a shared render path rather than a parallel implementation.
- **006 depends on 005**. It reuses the shared node pipeline and plan 000's
  design/Dev `getCSSAsync()` evidence; it never repeats the spike or rebuilds CSS.
- **007 depends on 006** deliberately. 006 builds the proposal logic and report
  UI; 007 adds a design-editor-only dry-run diff and Apply route. A Dev Mode
  invocation may hand off only variable IDs as untrusted convenience state; the
  design route re-reads and revalidates before showing Apply. Building 007 first
  would mean building 006's proposal engine anyway,
  without its safety review.
- **007 materially upgrades 004 and 005 after the fact**: once a variable carries
  a validated token key such as `codeSyntax.WEB = "brand-500"`, both surfaces
  derive the property-specific utility (`bg-brand-500`, `text-brand-500`, and so
  on) and report `exact-variable` only when the key exists and the live value
  still agrees. A variable is reusable across properties, so plan 007 never
  stamps a property-specific utility into it.
- **008 depends on 005** so both surfaces use the same pipeline. **009 depends
  on 001 and 003**: it reuses the theme schema and adds token-JSON ingestion to
  the plugin setup UI.
- **010 depends on 005**, since the Inspect surface is part of the core promise
  and the docs describe it. Community publication also depends on a passed
  cross-account read using the release build; UNVERIFIED is not publishable.

---

## Review disposition log

The 2026-07-31 improve audit and the ACCEPT/MODIFY rationale for every finding
are recorded in [`REVIEW-DISPOSITIONS-2026-07-31.md`](./REVIEW-DISPOSITIONS-2026-07-31.md).

---

## Considered and set aside

Recorded so these are not re-raised without new information.

- **A required CLI export step.** The first draft of this program had developers'
  themes generated by `npx @fig-tail/cli export` into a token JSON, pasted into
  the plugin. Rejected: the repo owner's requirement is that a developer installs
  the plugin and nothing else, and that the config file itself is what gets
  provided. The resolver therefore runs in-browser (plan 001). The CLI survives
  as plan 009, an **optional** escape hatch for configs whose presets or plugins
  cannot be statically evaluated — run once during setup, never by a developer.

- **Fetching the config from a URL** (raw GitHub, gist, hosted endpoint).
  Rejected by the repo owner in favour of paste/drop: avoids `networkAccess`
  review friction, CORS, private-repo auth, and the hidden-iframe dance codegen
  plugins need for `fetch`. Cost accepted: the stored config goes stale
  silently. Plan 003 mitigates with a stored timestamp and a staleness warning.

- **Evaluating the Tailwind config with `eval` or `new Function`.** Would handle
  every config perfectly. Rejected: it is a plugin-review red flag, the sandbox
  and iframe CSP make it unreliable, and executing arbitrary JavaScript pasted
  by a user is a security posture this project should not adopt. Plan 001 uses
  static AST evaluation instead, and reports precisely what it could not
  resolve.

- **Deriving token names from Figma variable names alone** (`brand/500` →
  `brand-500`) with no config. Zero setup, but the names would be whatever the
  designer typed rather than what exists in code — which is exactly the drift
  this program exposes. Kept only as a *fallback* inside plan 002's confidence
  ladder, never as the primary source.

- **Code Connect integration.** Deferred by the repo owner: Code Connect is not
  set up on their side yet. A future iteration. When it happens, the shape is:
  read the mapping, and emit `<Button variant="primary" />` above the class
  string rather than instead of it. Also unverified at time of writing —
  mappings are readable via Figma's MCP server and CLI, but no *plugin* API for
  them was confirmed. That spike is the first step whenever this is picked up.

- **Private / org-only plugin publishing.** Not available: the owner's Figma
  account is on Starter and Professional tiers with no Organization or
  Enterprise plan. Distribution is public Figma Community (plan 010) or
  per-developer local install from source. Note that org-tier *users* of the
  published plugin do get pinning and default-language settings — plan 005 is
  built so they benefit.

- **AI/LLM-based conversion.** Every value here is a deterministic lookup or a
  numeric distance. An LLM would add latency against the stricter 3-second
  codegen budget,
  nondeterminism, and a network dependency the program has ruled out.

- **Generating full component code from frames.** Anima, Locofy and Builder.io
  occupy that space with far more investment. fig-tail's edge is narrow and
  specific: correct class names from your own config. Plan 008's subtree export
  is the deliberate limit — a class-annotated skeleton, not a component.
