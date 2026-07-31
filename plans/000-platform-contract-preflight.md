# Plan 000: Prove the Figma platform contracts before implementation

> **Execution order**: run this plan **before plan 001**. Plans 001–008 consume
> its evidence. Do not
> begin production packages while this plan is still TODO.
>
> **Executor instructions**: this is a spike plan. It creates durable evidence,
> fixtures, and a throwaway development plugin; it does not create production
> package code. Read the whole plan, perform one task at a time, and commit each
> task separately. Update the status row in `plans/README.md` when done.
>
> **Drift check (run first)**:
> `git diff --stat 7932c82..HEAD -- packages fixtures spikes plans/000-platform-contract-preflight.md`
> This plan was written against a plan-only repository. If production code now
> exists, read it before running the spike and record which assumptions have
> already been settled.

## Status

- **Priority**: P0 — execution prerequisite and publication risk gate
- **Effort**: M
- **Risk**: HIGH if skipped. Four product claims depend on undocumented or
  mode-sensitive behaviour: the two Dev Mode surfaces, real CSS output, private
  document data across accounts, and design-only variable writes.
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `7932c82`, 2026-07-31 — greenfield.

## Build sheet

Use the Figma desktop app. Do not install the workspace dependencies and do not
create any production package. The spike is deliberately plain JavaScript so it
can run before plan 001 scaffolds the repository.

### Before you start

You need:

- a Figma account that can register and run a development plugin;
- one disposable editable Figma file;
- a second account or collaborator with view-only or Dev-seat access for the
  cross-account read test; and
- permission to share only the disposable file, never a real product file.

If the second account is unavailable, complete every other task and mark that
single result **UNVERIFIED**. That does not block implementation, because plan
003 has a personal-storage fallback. It **does block public release** in plan
010 until another account completes the test.

### Files this plan creates

| Path | Purpose | Task |
|---|---|---|
| `spikes/figma-platform/manifest.json`, `main.js`, `ui.html` | throwaway no-build development plugin | 1 |
| `spikes/figma-platform-isolation/manifest.json`, `main.js` | disposable second-ID reader used only for cross-plugin isolation | 4 |
| `packages/plugin/notes/platform-preflight.md` | versioned evidence and decisions | 1–6 |
| `fixtures/figma/README.md` | durable nine-node fixture definition and file URL | 2 |
| `fixtures/figma/css/design/*.json`, `dev/*.json` | verbatim `getCSSAsync()` captures | 3 |

No dependencies. No package manager commands.

### Tasks

| # | Do this | Files it may touch | Done when |
|---|---|---|---|
| 1 | Register a development plugin, create the no-build spike, and record the exact Figma desktop version, plugin API version, account/seat types, date, and official docs consulted. | `spikes/figma-platform/**`, `notes/platform-preflight.md` | The manifest imports with no error; the note contains exact versions and direct source links, not memory-based claims |
| 2 | Prove the manifest/mode matrix: one plugin with `editorType: ["figma","dev"]` and both `codegen` and `inspect`. Record `(editorType, mode)`, UI availability, and the launch path for design, Codegen, and Inspect. Build the nine-node fixture file described below. | spike, note, `fixtures/figma/README.md` | All three routes have evidence. The fixture README names every node and records the shared disposable-file URL |
| 3 | On all nine fixture nodes, capture `getCSSAsync()` in design mode and Dev Mode. Store verbatim sorted JSON plus a normalized parity table. | spike, note, `fixtures/figma/css/**` | Eighteen captures exist. Every property/value difference is explained. Plan 002 has real inputs; plans 006 and 008 have a surface decision |
| 4 | Prove private document storage: write chunked test data to `figma.root.setPluginData`, reload, restart Figma, and read it from the second account without edit access. Register a disposable second development-plugin ID and prove it cannot read the first ID's data. | both spikes, note | The note records both plugin IDs, same-user persistence, cross-account result, view/Dev-seat result, and cross-plugin isolation. No raw config or credential-shaped value is used |
| 5 | Prove the write-capability matrix on a disposable local variable: read and write `codeSyntax.WEB` in design mode, attempt the same from Dev Mode, test no-edit access, restore the original value, and record undo/version-history behaviour. | spike, note | The matrix names allowed/denied outcomes with exact errors. The variable is restored and a before/after snapshot proves no other field changed |
| 6 | Write the binding decisions and delete any unneeded instrumentation. Mark each contract PASS, FAIL WITH FALLBACK, or UNVERIFIED. Update dependent plans only if observed behaviour contradicts them. | note, plans only when contradicted | The note ends with a decision table and names the exact downstream plan/task for every fallback or gate |

## Why this matters

The original plans asked early executors to build a matcher from illustrative
CSS, choose a linter route later, and trust that plugin data and write APIs would
behave the same across accounts and editor modes. Those assumptions sit beneath
nearly every package. Discovering one is false after plans 001–007 would force a
cross-program rewrite. This plan turns them into small, versioned experiments
before production architecture hardens around them.

The output is evidence, not a prototype to evolve into production. Later plans
reuse the fixture, plugin ID, and decisions; they do not import spike code.

## Context the executor needs

## The nine-node platform fixture

Create these layers manually in one disposable Figma file. Keep names stable;
later plans use them as durable fixture IDs.

1. `Card / exact` — auto-layout frame, padding, gap, radius, solid background,
   border, and shadow.
2. `Text / exact` — text with family, size, weight, line height, and solid fill.
3. `Size / fixed` — a fixed-width and fixed-height rectangle.
4. `Colour / near` — solid fill slightly different from a configured token.
5. `Spacing / near` — 25 px padding when the nearest token is 24 px.
6. `Variable / bound` — solid fill and spacing bound to local variables.
7. `Gradient / unsupported` — a gradient background.
8. `Layout / nested` — nested auto-layout, group, and hidden child.
9. `Text / mixed` — a text node with mixed or unsupported text properties.

At this stage `fixtures/figma/README.md` records construction values and the
Figma URL, not Tailwind class expectations. Plan 004 adds expected classes after
the resolver and matcher exist.

## Contracts this plan must settle

### A. Route contract

Production may proceed only with an explicit branch for every observed pair of
`figma.editorType` and `figma.mode`. Do not infer that a route is writable merely
because the same plugin is writable in another editor mode.

### B. CSS-fixture contract

Plan 002 must consume the verbatim captures from this plan. Hand-written examples
may remain explanatory examples, but they are not test fixtures. If design-mode
and Dev Mode CSS differ materially, plan 006 lives in Dev Mode Inspect and plan
008 documents the nested-node differences; no code may reconstruct CSS from raw
node fields as a substitute.

### C. Storage contract

The production target is `figma.root.setPluginData`, not shared plugin data.
The desired property is team sharing under the same plugin ID, not visibility to
other plugins. The 100 kB per-entry limit still applies, so the spike must use at
least two chunks and a metadata entry written last.

If cross-account reading fails, plan 003 retains per-user `clientStorage` as a
labelled fallback. Plan 010 may not advertise "configure once for the team" and
may not publish until the second-account result is known.

### D. Write-route contract

Plan 007's Apply action must run only when `figma.editorType === 'figma'` and
edit access is available. Dev Mode may prepare a proposal or a pending selection,
but it never owns the write. The design-mode route must re-read the variables and
recompute/revalidate the diff before presenting Apply; never carry a trusted
write payload across invocations.

## Scope

**In scope**:

- the primary no-build spike under `spikes/figma-platform/**` and the
  task-4 isolation reader under `spikes/figma-platform-isolation/**`;
- one disposable Figma fixture file and its versioned construction recipe;
- verbatim CSS captures and the platform evidence note;
- narrowly correcting a dependent plan if observed platform behaviour directly
  contradicts it; and
- private test values and disposable local-variable writes, restored in-task.

**Out of scope**:

- any production package under `packages/**` other than the evidence note path;
- workspace/package-manager setup (plan 001);
- resolver, matcher, storage, or UI implementation;
- testing against a real design file or storing real config/source content;
- publishing either spike or reusing the isolation identity in production; one
  disposable second development-plugin identity is explicitly in scope for task 4; and
- turning an UNVERIFIED result into an assumption.

## Steps

### Step 1: Register the spike and version the environment

Create/import the three no-build files, then record exact Figma/API/account
versions and official documentation in the note.

### Step 2: Record routes and build the fixture

Exercise every manifest surface and write the nine-node construction recipe
before capturing output. Reuse the same stable layer names everywhere.

### Step 3: Capture CSS without interpretation

Write raw, sorted design/Dev JSON first. Add normalization and the parity table
afterward so normalization cannot erase evidence.

### Step 4: Test private storage across boundaries

Use synthetic multi-chunk data. Test reload, restart, second account/seat, and a
different plugin ID. Record exact failures and do not substitute shared data.

### Step 5: Test writes only on the disposable variable

Snapshot all fields, run the editor/access matrix, restore, and compare the full
snapshot before continuing.

### Step 6: Bind decisions to downstream owners

Finish the PASS / FAIL WITH FALLBACK / UNVERIFIED table. Remove throwaway
instrumentation, retain the minimal reproducible spike, and name the downstream
plan/task responsible for every consequence.

## Validation plan

- Import the spike from its manifest after every edit; there is no build step.
- Capture exact console output and screenshots in the evidence note.
- Store CSS JSON verbatim before normalization; normalization code and results
  live beside the raw capture so later executors can audit both.
- Use a fresh second-account session for storage reading. A second profile on the
  same account does not count.
- Snapshot every variable field before and after task 5, including name, values,
  modes, scopes, description, and all code-syntax platforms.

## Done criteria

- [ ] All three plugin surfaces import and their observed modes are recorded
- [ ] The nine-node fixture file and eighteen real CSS captures exist
- [ ] Plan 002 can build without inventing a `getCSSAsync()` fixture
- [ ] Private plugin data survives reload and restart
- [ ] Cross-account read is PASS or explicitly UNVERIFIED; FAIL activates the
      personal-storage fallback and removes the team-sharing claim
- [ ] A different plugin cannot read the private data
- [ ] The design/Dev/no-edit variable-write matrix is recorded and restored
- [ ] The note ends with PASS / FAIL WITH FALLBACK / UNVERIFIED for every contract
- [ ] No production package code was created
- [ ] `plans/README.md` status row for 000 was updated

## STOP conditions

Stop and report if:

- Figma rejects one plugin declaring both capabilities and both editor types;
  this changes the product/distribution shape.
- Neither Codegen nor Inspect can access `getCSSAsync()` for ordinary scene nodes.
- Private document data cannot persist even for the same user after restart.
- Restoring the disposable variable cannot reproduce its before snapshot.
- A platform fact fails and no labelled fallback is named in this plan.

Cross-account storage remaining UNVERIFIED is not an implementation stop; it is
a plan-010 publication stop.

## Handoff / after it lands

- Plan 001 scaffolds the reproducible workspace after this platform gate.
- Plan 002 copies the real captures, never hand-types replacements.
- Plan 003 reuses the registered development plugin ID and private-storage
  evidence, then implements the production storage contract.
- Plan 006 consumes the recorded design/Dev CSS parity decision.
- Plan 007 always applies from the proven design-editor route.
- Plan 010 re-runs the cross-account read on the release build before Community
  submission.
