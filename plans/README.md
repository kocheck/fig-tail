# fig-tail — Plans

Tailwind class names in Figma Dev Mode, resolved against a real codebase's
Tailwind theme. Developed with the improve skill on 2026-07-31.

Execute in the order below unless dependencies say otherwise. Each executor:
read the plan fully before starting, honor its STOP conditions, and update your
row in the table when done.

---

## What this program builds

A designer (the person who owns the Figma file) exports their team's real
Tailwind theme to a JSON file, pastes it into the fig-tail plugin once, and it
is stored on the Figma document. From then on, any developer inspecting that
file in Dev Mode sees **real Tailwind class names from that codebase**
(`bg-brand-500`, `p-6`, `rounded-lg`) instead of doing hex-to-token conversion
in their head — and instead of the arbitrary-value output
(`bg-[#3b82f6]`) that every existing Figma→Tailwind plugin produces.

Four components, split across nine plans:

| Component | What it is | Plans |
|---|---|---|
| `@fig-tail/cli` | Node CLI that reads a project's Tailwind v3 or v4 setup and emits a portable token JSON | 001 |
| `@fig-tail/match` | Pure TypeScript engine: CSS declaration + token set → Tailwind class + confidence | 002 |
| `@fig-tail/plugin` | The Figma plugin: design-mode setup/lint UI + Dev Mode codegen panel | 003, 004, 005, 006, 007, 008 |
| Distribution | README, setup guide, Figma Community listing | 009 |

---

## Program-wide invariants

These hold in **every** plan. They are restated inside each plan that touches
them, but they are listed here so a reviewer can check the whole program
against them at a glance.

### 1. Write-safety (non-negotiable — set by the repo owner)

fig-tail **never mutates the Figma document** except when a human clicks an
explicit "Apply" button in the design-mode UI, having first seen a dry-run diff
of exactly what will change.

- The **only** document-write API permitted anywhere in this codebase is
  `Variable.setVariableCodeSyntax('WEB', …)`.
- Variable **names are never written**. Tailwind names go into the variable's
  *Code syntax* field (what Dev Mode shows as "code details"), never into
  `variable.name`.
- Variable values, modes, collections, scopes, node properties, styles, and
  text content are never written, ever.
- Everything else fig-tail does — codegen, linting, subtree export — is
  strictly read-only.

Enforced mechanically, not by discipline: see plan 003 Step 5 (ESLint
`no-restricted-properties` rule + a bundle-level test).

### 2. Dry-run first

Any feature that *could* write runs in dry-run mode by default and produces a
reviewable diff. Applying is a separate, explicit, second action.

### 3. No network

The plugin ships with `"networkAccess": { "allowedDomains": ["none"] }`. Token
JSON arrives by paste/upload only. No telemetry, no config fetching, no
external calls. This was a deliberate choice (see "Considered and set aside").

### 4. No secrets in this repo

No Figma personal access tokens, no plugin API keys, no `.env` with real
values. Plans reference credential *locations and types* only.

---

## Order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001 | Build the `fig-tail export` token extractor CLI (Tailwind v3 + v4) | P1 | M | — | TODO |
| 002 | Build the CSS→Tailwind matching engine | P1 | L | 001 | TODO |
| 003 | Scaffold the plugin shell, manifest, and document token storage | P1 | M | 001 | TODO |
| 004 | Ship the Dev Mode codegen panel | P1 | M | 002, 003 | TODO |
| 005 | Add the read-only drift linter (designer dry-run) | P2 | M | 002, 003 | TODO |
| 006 | Add opt-in variable Code-syntax stamping | P2 | M | 005 | TODO |
| 007 | Add whole-subtree className export | P3 | L | 004 | TODO |
| 008 | Surface Code Connect mappings and dev resources | P3 | S | 004 | TODO |
| 009 | Package, document, and publish | P2 | S | 004 | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (one-line reason) | REJECTED (one-line rationale)

**Minimum shippable slice: 001 → 002 → 003 → 004 → 009.** That is a working,
publishable plugin. Everything else is upside.

---

## Dependency notes

- **002 depends on 001** because the matching engine's input type is the token
  JSON schema that 001 defines. 001 Step 2 writes the schema; 002 consumes it.
- **003 depends on 001** for the same reason — the plugin stores and validates
  that schema — but 003 does **not** depend on 002, so 002 and 003 can be built
  in parallel by two executors if you have them.
- **004 depends on both 002 and 003**: it is the wiring layer between the
  matching engine and the plugin shell.
- **005 depends on 002 and 003**, not on 004. The linter is a design-mode
  surface; it shares the engine but not the codegen panel.
- **006 depends on 005** deliberately. 005 builds the dry-run diff UI and the
  variable→token proposal logic; 006 adds nothing but an Apply button and its
  guardrails on top. Building 006 first would mean building 005's proposal
  engine anyway, without its safety review.
- **006 materially upgrades 004** after the fact: once a variable carries
  `codeSyntax.WEB = "bg-brand-500"`, the codegen panel reads that string
  directly off the node's bound variable and reports `exact-variable`
  confidence — no value guessing at all. This is the single biggest
  output-quality lever in the program, which is why it is P2 and not P3.
- **007 and 008 depend on 004** and are independent of each other.

---

## Considered and set aside

Recorded so these are not re-raised without new information.

- **Fetching the token JSON from a URL** (raw GitHub, gist, or a hosted
  endpoint) instead of pasting it. Rejected by the repo owner in favor of
  paste-only: it avoids `networkAccess` review friction, CORS, private-repo
  auth, and the hidden-iframe dance that codegen plugins need for `fetch`.
  Cost accepted: the pasted theme goes stale silently. Plan 003 Step 4
  mitigates with a stored `generatedAt` timestamp and a staleness warning in
  the panel. Revisit only if staleness turns out to bite in practice.

- **Parsing `tailwind.config.js` / `app.css` inside the plugin.** Would remove
  the CLI, but means reimplementing Tailwind's resolver inside a sandboxed
  iframe, including presets, plugins, `@theme` cascade, and `@config`.
  Fragile and version-chasing. The CLI keeps all Tailwind knowledge in Node,
  where Tailwind's own packages can do the work.

- **Deriving token names from Figma variable names alone** (`brand/500` →
  `brand-500`), with no codebase link. Zero setup, but the names would be
  whatever the designer typed, not what exists in code — which is exactly the
  drift this program is meant to expose. Kept only as a *fallback* inside plan
  002's confidence ladder, never as the primary source.

- **Private / org-only plugin publishing.** Not available: the owner's Figma
  account is on Starter and Professional tiers with no Organization or
  Enterprise plan, and private plugin distribution requires Org/Enterprise.
  Distribution is therefore public Figma Community (plan 009) or per-developer
  local install from source. Verify tier before executing 009 — if the account
  has moved to Org/Enterprise since 2026-07-31, private publishing becomes
  available and 009's approach should be revisited.

- **AI/LLM-based conversion.** Every value in this problem is a deterministic
  lookup or a numeric distance calculation. An LLM would add latency (against a
  hard 15-second codegen timeout), nondeterminism, and a network dependency
  the program has explicitly ruled out.

- **Generating full component code (React/Vue) from frames.** Anima, Locofy and
  Builder.io occupy that space with far more investment. fig-tail's edge is
  narrow and specific: *correct class names from your own config*. Plan 007's
  subtree export is the deliberate limit — a class-annotated skeleton, not a
  component.
