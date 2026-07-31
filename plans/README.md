# fig-tail — Plans

Tailwind class names in Figma Dev Mode, resolved against a real codebase's
Tailwind config. Developed with the improve skill on 2026-07-31.

Execute in the order below unless dependencies say otherwise. Each executor:
read the plan fully before starting, honor its STOP conditions, and update your
row in the table when done.

---

## What this program builds

A designer drops their team's `tailwind.config.js` (v3) or `app.css` (v4)
into the fig-tail plugin once. It is stored on the Figma document.

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

### Components

| Component | What it is | Plans |
|---|---|---|
| `@fig-tail/theme` | Tailwind config → token set. Pure TS, runs in a browser. Bundles Tailwind's v3 and v4 default themes. | 001 |
| `@fig-tail/match` | CSS declaration + token set → Tailwind class + confidence | 002 |
| `@fig-tail/plugin` | The plugin: Dev Mode Code section, Dev Mode Inspect panel, design-mode setup | 003, 004, 005, 006, 007, 008 |
| `@fig-tail/cli` | Optional escape hatch for configs the in-browser resolver can't fully evaluate | 009 |
| Distribution | README, setup guide, Figma Community listing | 010 |

---

## Verified Figma platform facts

Checked against Figma's documentation on 2026-07-31. Individual plans restate
the ones they depend on. **If any of these turns out to be false during
execution, that is a STOP condition for the plan that relies on it.**

1. A single plugin may declare **both** `"codegen"` and `"inspect"` in
   `manifest.capabilities`.
2. **`codegen`** runs in the **Code section** of the Dev Mode Inspect panel. The
   plugin appears in Figma's native language dropdown; once selected,
   `figma.codegen.on('generate')` fires on every selection change.
3. **`inspect`** runs in the **Inspect panel** itself. Its iframe takes the full
   height and width of the panel.
4. The `generate` callback has a **hard 15-second timeout** and may be async.
5. **`figma.showUI` is not allowed inside the `generate` callback.** Call it
   outside and use `figma.ui.postMessage`, or call it from a
   `preferenceschange` handler.
6. `codegenPreferences` with `"itemType": "action"` adds a menu item that fires
   `preferenceschange`; that handler **may** call `figma.showUI`.
7. **`setSharedPluginData` enforces 100 kB per entry** (namespace + key + value),
   enforced since March 2025. Chunking across keys is the documented workaround.
8. `figma.clientStorage` has a 5 MB total limit and is **per-user**.
9. `"documentAccess": "dynamic-page"` is required for all new plugins. A Dev
   Mode plugin runs on the **current page only** unless pages are explicitly
   loaded.
10. `node.getCSSAsync()` returns the CSS the Inspect panel displays.
11. `variable.setVariableCodeSyntax('WEB' | 'ANDROID' | 'iOS', value)` writes a
    variable's Code syntax — which Figma's own Inspect panel displays.
12. Users can **save** a plugin to their account for access across files.
13. **Org admins** can *pin* a Dev Mode plugin so it appears in the Inspect panel
    for all users, and can set a default code language. Both are
    Organization/Enterprise features.

### Not verified — and it matters

**Whether the Code-section language selection persists per user across files and
sessions.** No documentation found either way. If it does not persist, a
developer must pick "Tailwind" from the dropdown on every file — which is
exactly the hunting this program exists to eliminate.

This is why plan 005 builds the **Inspect panel surface** in addition to the
Code section: the inspect panel is a persistent, pinnable surface that does not
depend on a dropdown selection. Plan 005 Step 1 tests the persistence question
directly and records the answer in
`packages/plugin/notes/devmode-discovery.md`, which plan 010's documentation is
then written from.

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

### 2. Write-safety (non-negotiable — set by the repo owner)

fig-tail **never mutates the Figma document** except when a human clicks an
explicit "Apply" in the setup UI, having first seen a dry-run diff of exactly
what will change.

- The **only** document-write APIs permitted anywhere in this codebase are
  `figma.root.setSharedPluginData` (config storage, plan 003) and
  `Variable.setVariableCodeSyntax('WEB', …)` (plan 007).
- Variable **names are never written**. Tailwind names go into the variable's
  *Code syntax* field, never into `variable.name`.
- Variable values, modes, collections, scopes, node properties, styles, and text
  content are never written, ever.
- Everything else — codegen, inspect, linting, subtree export — is strictly
  read-only.

Enforced mechanically: plan 003 Step 7 (ESLint `no-restricted-properties` rule
plus a bundle-level test), extended by plan 007 Step 6.

### 3. Dry-run first

Any feature that *could* write runs in dry-run mode by default and produces a
reviewable diff. Applying is a separate, explicit, second action.

### 4. No network

The plugin ships with `"networkAccess": { "allowedDomains": ["none"] }`. The
config arrives by paste or file-drop. No telemetry, no config fetching, no
external calls. This is a permanent decision and a documented feature, not a
backlog item.

### 5. Never guess silently

When the resolver cannot fully evaluate a config, or the matcher cannot find a
token, fig-tail says so precisely. A plausible wrong answer is worse than a
visible gap. This applies to the resolver (plan 001's unresolved-feature
report), the matcher (plan 002's confidence ladder), and every surface that
displays their output.

### 6. No secrets in this repo

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
- [ ] Nothing writes to the design file. If plan 007 has shipped, it has been
      run deliberately beforehand, not during the demo.

---

## Order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001 | Build the in-plugin Tailwind theme resolver (v3 + v4) | P1 | L | — | TODO |
| 002 | Build the CSS→Tailwind matching engine | P1 | L | 001 | TODO |
| 003 | Scaffold the plugin shell, dual capability, and config storage | P1 | M | 001 | TODO |
| 004 | Ship the Dev Mode Code-section panel (codegen) | P1 | M | 002, 003 | TODO |
| 005 | Ship the Dev Mode Inspect-panel surface | P1 | M | 004 | TODO |
| 006 | Add the read-only drift linter (designer dry-run) | P2 | M | 002, 003 | TODO |
| 007 | Add opt-in variable Code-syntax stamping | P2 | M | 006 | TODO |
| 008 | Add whole-subtree className export | P3 | L | 004 | TODO |
| 009 | Add the optional CLI escape hatch for complex configs | P3 | M | 001 | TODO |
| 010 | Package, document, and publish | P1 | S | 005 | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (one-line reason) | REJECTED (one-line rationale)

**Minimum shippable slice: 001 → 002 → 003 → 004 → 005 → 010.** That is a
public, installable plugin that fully delivers the core promise. 006–009 are
upside.

---

## Dependency notes

- **002 depends on 001** for the token-set type it consumes. **003 depends on
  001** because it stores and validates config, and calls the resolver. 002 and
  003 do not depend on each other and can be built in parallel.
- **004 depends on 002 and 003** — it is the wiring between engine and plugin.
- **005 depends on 004** and deliberately reuses its rendering pipeline. The two
  surfaces must never diverge in what they report; 005 Step 2 enforces that with
  a shared render path rather than a parallel implementation.
- **006 depends on 002 and 003**, not 004 — the linter is a setup-side surface.
- **007 depends on 006** deliberately. 006 builds the dry-run diff UI and the
  variable→token proposal logic; 007 adds an Apply button and its guardrails on
  top. Building 007 first would mean building 006's proposal engine anyway,
  without its safety review.
- **007 materially upgrades 004 and 005 after the fact**: once a variable carries
  `codeSyntax.WEB = "bg-brand-500"`, both surfaces read that string directly off
  the node's bound variable and report `exact-variable` confidence — no value
  inference at all. Biggest output-quality lever in the program, which is why it
  is P2 and not P3.
- **008 depends on 004**. **009 depends on 001** and is independent of the
  plugin entirely.
- **010 depends on 005**, since the Inspect surface is part of the core promise
  and the docs describe it.

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
  numeric distance. An LLM would add latency against a hard 15-second timeout,
  nondeterminism, and a network dependency the program has ruled out.

- **Generating full component code from frames.** Anima, Locofy and Builder.io
  occupy that space with far more investment. fig-tail's edge is narrow and
  specific: correct class names from your own config. Plan 008's subtree export
  is the deliberate limit — a class-annotated skeleton, not a component.
