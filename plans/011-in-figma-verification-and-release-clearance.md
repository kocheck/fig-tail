# Plan 011: Verify fig-tail in Figma and clear 0.1.0 for release without the team-sharing claim

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. If anything in "STOP conditions" occurs,
> stop and report — do not improvise. Commit after each step. When done, update
> the status row for this plan in `plans/README.md`.
>
> **This plan is different from 000–010: it cannot be executed by an agent.**
> Every measurement in it requires a human sitting at the Figma **desktop** app
> with this repo checked out. An agent can help transcribe results afterwards,
> but no step here may be marked PASS from documentation, from code reading, or
> from inference. **Observed or it did not happen.**
>
> **Drift check (run first)**:
> `git log --oneline abb2c1b..HEAD` and `git status --short`.
> If `packages/plugin/src/**`, `packages/match/src/**`, or `packages/theme/src/**`
> changed since `abb2c1b`, every measurement below must be taken against the
> newer build — rebuild before starting and record the real SHA in Step 1.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED — no production code changes are planned, but this plan can
  discover that a feature marked DONE does not work in the real product.
- **Depends on**: 000, 003, 004, 005, 006, 007, 008, 010 (all DONE)
- **Category**: tests
- **Grounded at**: commit `abb2c1b`, 2026-07-31

## Why this matters

fig-tail 0.1.0 is fully built and fully unproven. `docs/release/feature-audit.md`
carries eight `UNVERIFIED` in-Figma rows and every one of them describes
behaviour nobody has ever watched happen: the plugin has never been loaded into
Figma desktop by a human. The automated suite proves the resolver and the matcher
are correct about *inputs it was given*; it proves nothing about whether Figma
hands the plugin those inputs, whether the Dev Mode surfaces render, whether
stored config survives a restart, or whether codegen returns inside Figma's
timeout. Shipping on that evidence would mean publishing a plugin under the
owner's name that may not run at all.

This plan closes that gap and produces a release decision. It also **removes the
team-sharing claim from 0.1.0** rather than verifying it — see the decision
below — which converts the last Community blocker from an experiment that cannot
currently be run into a documentation change that can.

## The team-sharing decision (made 2026-08-02 — do not re-litigate)

`plans/README.md` → "Not verified — and how each is de-risked" → item B describes
an unverified claim: that a second person opening the same file reads the config
the first person saved. `packages/plugin/notes/storage-matrix.md` requires both
accounts to run the **same plugin ID** to test it, and two `Import plugin from
manifest` copies do not share one. Figma offers private plugin distribution only
on Organization tier, which the owner does not have. So the only route to a
shared ID is publishing to the Figma Community — which is the exact thing the
test was meant to gate. The test is circular as specified.

**Decision: 0.1.0 ships without the team-sharing claim.** This is not new
policy; it is the fallback plans/README already designed for a negative result
("a negative result costs convenience rather than function"). The document
storage tier still exists and is still verified in Step 5 — for the *same user
across sessions*, which is what Steps 5's rows actually test. What changes is
that no user-facing text may promise that a **collaborator** reads it.

Cross-account verification moves to a future 0.2.0 plan. Step 11's handoff
records what that plan needs.

## Context the executor needs

### What exists right now

| Path | Role in this plan |
|---|---|
| `packages/plugin/manifest.json` | Ships `"id": "fig-tail-dev"` — a hand-written placeholder, not a Figma-issued ID. Step 1 replaces it. |
| `packages/plugin/notes/storage-matrix.md` | Table of storage checks, all `UNVERIFIED`. Step 5 fills it. |
| `packages/plugin/notes/platform-preflight.md` | Plan 000's evidence file. Every row says `UNVERIFIED — requires local Figma desktop`. Steps 1, 3, 4, 8 fill it. |
| `packages/plugin/notes/devmode-discovery.md` | Three `In-product UNVERIFIED` markers. Step 3 answers them. |
| `packages/plugin/notes/linter-performance.md` | 1,000-node row `UNVERIFIED`. Step 7 fills it, and already contains a "How to measure" procedure — follow it. |
| `packages/plugin/notes/subtree-performance.md` | 100+ node row `UNVERIFIED`. Step 7 fills it. |
| `packages/plugin/notes/stamping-verification.md` | Question 1 `UNVERIFIED` in desktop. Step 8 fills it. |
| `fixtures/figma/css/{design,dev}/*.json` | Eighteen **seeded** CSS captures for nine node names. Plan 000 requires replacing them with verbatim captures before publication. Step 4 captures and diffs them. |
| `spikes/figma-platform/` | A working read-only capture harness — `captureSelectionCss`, storage read/write, variable write matrix. Reuse it; do not rebuild it. |
| `docs/release/feature-audit.md` | The durable verdict table. Step 11 updates it. |
| `docs/release/approval-packet.md` | Stop gate with two empty owner-decision rows. Step 11 fills them. |
| `docs/community/publish-runbook.md` | Blocked-status checklist. Step 10 updates its blocker. |

### Two sequencing constraints that are easy to get wrong

1. **Plugin data is namespaced per plugin ID.** Any storage evidence gathered
   under `fig-tail-dev` becomes meaningless the moment the manifest ID changes.
   Step 1 therefore swaps in a real Figma-issued ID **before** Step 5 measures
   anything. Do not reorder these.
2. **A real plugin ID does not require publishing.** In Figma desktop,
   *Plugins → Development → New plugin…* scaffolds a plugin and issues a real
   numeric ID without submitting anything to the Community. Take the ID from
   that scaffold and discard the scaffolded code. This is the step
   `docs/community/publish-runbook.md` line 1 calls "Map `fig-tail-dev` →
   production plugin ID", stated concretely.

### Conventions to match

- Evidence goes in the **existing** notes files listed above, in their existing
  table shapes. Do not create new evidence files; do not restructure the tables.
- Replace the literal string `UNVERIFIED` with `PASS` or `FAIL` plus a short
  evidence phrase. A row you did not test stays `UNVERIFIED` — never blank it,
  never guess it.
- One task, one commit (`plans/EXECUTOR-GUIDE.md` §7).
- The seven non-negotiables in `plans/EXECUTOR-GUIDE.md` §2 apply throughout.
  Number 1 matters most here: the only sanctioned document writes are
  `figma.root.setPluginData` and `Variable.setVariableCodeSyntax('WEB', …)`.

## Inputs & resources

| Purpose | Command | Expected on success |
|---|---|---|
| Install deps | `corepack enable && pnpm install` | exit 0 |
| Full check | `pnpm check` | exit 0 (typecheck + lint + build + test) |
| Build plugin | `pnpm --filter @fig-tail/plugin build` | `plugin build ok`, `dist/main.js` + `dist/ui.html` exist |

Also needed on hand:

- **Figma desktop app**, signed in to the owner's account. The browser app
  cannot load local manifests.
- **Edit access** to a scratch file you are willing to have variables written
  into. Never use a real design file (Step 8 writes).
- **A real Tailwind config** to save into the plugin — use one of the eight v3
  fixtures under `fixtures/configs/v3/` or a genuine project config. Record
  which one you used.
- **A large Figma file (~1,000 layers)** for Step 7. Duplicate a Community UI
  kit; record its name and layer count so the measurement is reproducible.
- **A stopwatch or screen recording** for Step 6 latency. Figma does not surface
  codegen timing; you are measuring perceived time to first render.

## Scope

**In scope** — verification, evidence, and the documentation change that follows
from the team-sharing decision:

- `packages/plugin/manifest.json` (the `id` field only)
- `packages/plugin/notes/*.md` (results only, into existing tables)
- `fixtures/figma/css/{design,dev}/*.json` (replaced with verbatim captures)
- `docs/release/feature-audit.md`, `docs/release/approval-packet.md`
- `docs/community/publish-runbook.md`, `docs/community/assets/*.png`
- `README.md`, `docs/setup.md`, `docs/community/listing.md` (team-sharing claim only)
- `plans/README.md` (status row + item B of the de-risking section)

**Out of scope** — do NOT touch, even though each looks related:

- **`packages/*/src/**` — any production source.** If a measurement fails, this
  plan's output is a recorded FAIL and a STOP, not a fix. A fix written by the
  person who just found the bug, against no plan, is how verification passes
  turn into month-long rewrites.
- **`packages/match/src/**` matching behaviour**, even if Step 4's real CSS
  differs from the seeded fixtures. Record the diff; a follow-on plan decides
  what to do about it.
- **Cross-account / second-account testing.** Removed from 0.1.0 by the decision
  above. Doing it anyway re-opens a blocker this plan exists to close.
- **Publishing to npm or the Figma Community.** Those are plan 010 tasks 4 and 5
  and they stay there. This plan makes the approval packet *decidable*; it does
  not decide it and does not act on it.
- **Plan 009 / `@fig-tail/cli`.** REJECTED for this ship.
- **Icon and cover art quality.** Step 9 captures screenshots. Producing brand
  art is a separate design task and is not gating.

## Working approach

Branch `claude/improve-deep-yewtj5` or a fresh branch off `main`. Commit after
each step with the step number in the subject. Do not push or open a PR unless
the owner asks. Every commit that records a measurement must include the notes
file it updated — an evidence step with no evidence in the diff is not done.

## Steps

### Step 1: Record the environment and switch to a real plugin ID

Open `packages/plugin/notes/platform-preflight.md`. Replace the **Environment**
table's `UNVERIFIED` rows with real values: Figma desktop version (Figma →
About), the account email and seat tier, your OS and machine (chip + RAM — Step 6
and 7 numbers are meaningless without it), today's date, and the exact commit SHA
you built from.

Then, in Figma desktop: *Plugins → Development → New plugin… → Custom → Empty*.
Figma scaffolds a folder containing a `manifest.json` with a real numeric `id`.
Copy that `id` value, delete the scaffolded folder, and set it as the `id` in
`packages/plugin/manifest.json`, replacing `"fig-tail-dev"`. Record the new ID in
the preflight note's environment table.

**Check**: `grep '"id"' packages/plugin/manifest.json` shows a numeric Figma ID,
not `fig-tail-dev`; the Environment table in `platform-preflight.md` contains no
`UNVERIFIED` and names a real Figma desktop version.

### Step 2: Build the verification file

Build the plugin (`pnpm --filter @fig-tail/plugin build`) and import it:
*Plugins → Development → Import plugin from manifest…* → `packages/plugin/manifest.json`.

Create a new Figma file named `fig-tail verification`. In it, build nine layers
named **exactly** after the fixture files, each shaped to exercise what its name
says — read the seeded JSON in `fixtures/figma/css/design/<name>.json` first and
build a layer that would plausibly produce it:

`card-exact`, `colour-near`, `gradient-unsupported`, `layout-nested`,
`size-fixed`, `spacing-near`, `text-exact`, `text-mixed`, `variable-bound`.

`variable-bound` must have at least one property bound to a **local** Figma
variable — Steps 4 and 8 both depend on it.

Then run fig-tail in the design editor, drop your chosen Tailwind config, click
**Resolve**, and **Save on file**.

**Check**: the file contains nine layers with those exact names; the plugin UI
shows the document-tier label `Using the config saved on this file`.

### Step 3: Prove all three routes load

Exercise each route on the verification file and record what you see in
`packages/plugin/notes/platform-preflight.md` → Route contract table, replacing
`in-product UNVERIFIED` on each row:

1. **Design editor** — run fig-tail from the Plugins menu. The setup UI appears.
2. **Dev Mode codegen** — switch to Dev Mode, select `card-exact`, open the Code
   section, choose **Tailwind CSS** from the language dropdown. Classes render.
3. **Dev Mode Inspect** — open fig-tail from the Inspect panel's plugin picker.
   The full-height panel renders the same classes for the same layer.

While you are there, answer the three `In-product UNVERIFIED` markers in
`packages/plugin/notes/devmode-discovery.md`: the exact label Figma renders for
fig-tail in the language dropdown (Q1), whether the Inspect panel entry point is
findable without prior knowledge (Q2), and whether the language selection
survives closing and reopening the file (Q3).

**Check**: all three Route contract rows read PASS with a one-line observation;
`devmode-discovery.md` has no `In-product UNVERIFIED` markers left.

### Step 4: Capture real CSS and diff it against the seeded fixtures

Import `spikes/figma-platform/manifest.json` as a second development plugin — it
has its own ID and is read-only, so it cannot disturb Step 5's storage evidence.
For each of the nine layers, in **both** the design editor and Dev Mode, run the
spike's capture and save the JSON verbatim to
`fixtures/figma/css/{design,dev}/<layer-name>.json`, overwriting the seeded file.

Then run `git diff --stat fixtures/figma/css/` and read the full diff.

**Check**: eighteen files updated with real captures; the diff is recorded in
`platform-preflight.md` → CSS fixture contract, stating for each node whether
design and dev output matched, and whether the real capture matched what was
seeded. **Then run `pnpm check`.** If it fails because of the new fixtures, that
is a STOP condition — record the failure and stop, do not adjust the matcher.

### Step 5: Run the same-account storage matrix

Fill `packages/plugin/notes/storage-matrix.md`, rows 1–4 and row 8 only:

| Row | How to test |
|---|---|
| Document write + same-user reload | Close and reopen the plugin. Tier label still says document. |
| Document write + Figma restart | Quit Figma entirely, reopen the file, run the plugin. Config still there. |
| Personal write without edit access | Open the file in Dev Mode on a view-only/Dev seat, **Save personal**. Confirm the personal-tier label. |
| Preference switch document↔user persists | With both tiers populated, toggle the preference, reload, confirm the choice held. |
| Cross-plugin isolation | Import `spikes/figma-platform-isolation/` and confirm it reads **empty** for fig-tail's keys. |

Leave **Cross-account document read** as `UNVERIFIED` and append
`— deferred to 0.2.0 per plan 011`.

**Check**: five rows read PASS or FAIL with evidence; the cross-account row
carries its deferral note; no row is blank.

### Step 6: Measure codegen latency against Figma's budget

On the verification file in Dev Mode, with the Code section open on Tailwind CSS,
click through all nine layers and time each one from selection to rendered
classes. Then select the largest container (`layout-nested`) with the
**Subtree export** preference set to HTML and time that.

`plans/README.md` fact 4 records that Figma's own docs disagree — the API
reference says 15 seconds, the codegen guide says 3 — and instructs recording
observed behaviour before trusting either. If any capture exceeds ~3s, note
whether Figma showed an error, showed stale output, or simply waited.

**Check**: a latency table (layer → observed seconds) is appended to
`packages/plugin/notes/subtree-performance.md` with your machine specs, and
`plans/README.md` fact 4 gains one line recording the observed timeout behaviour.

### Step 7: Measure linter and subtree performance at scale

Follow the existing procedure in `packages/plugin/notes/linter-performance.md`
("How to measure") against your ~1,000-layer file: load a config, run **Lint
drift**, record `visited`, `durationMs`, and whether it truncated or cancelled.

Then run **Export subtree** on a container of 100+ nodes and record whether the
150-node cap and the truncation marker behaved as documented.

**Check**: the 1,000-node row in `linter-performance.md` and the 100+ node row in
`subtree-performance.md` both read PASS or FAIL with real numbers, the file name,
and its layer count.

### Step 8: Verify the stamping write matrix on a scratch file

**On a scratch file only** — this step writes to the document. Confirm you are
not on a real design file before proceeding.

1. In **Dev Mode**, run stamping dry-run. Confirm it produces a proposal and that
   **Apply is unavailable**.
2. In the **design editor**, run Apply on `variable-bound`'s local variable.
   Confirm the confirm dialog appears and the result count is shown.
3. In Dev Mode, open Inspect on that layer and confirm the WEB code syntax now
   displays — this is question 1 in `stamping-verification.md`.
4. Press ⌘Z. Confirm Figma's native undo reverts the stamp.
5. Confirm `variable.name` was **not** changed (non-negotiable #2).

**Check**: `packages/plugin/notes/stamping-verification.md` question 1 reads PASS
with what you saw; a new row records the undo result; the Write-route contract
table in `platform-preflight.md` has no `UNVERIFIED` rows left.

### Step 9: Capture the release screenshots

Follow the capture checklist already written in `docs/community/assets/README.md`
steps 3–5, using the verification file: `devmode-codegen.png`, `inspect.png`,
`setup.png`. Icon and cover are explicitly **not** gating this plan — leave them
pending if you do not want to make art today.

**Check**: the three PNGs exist in `docs/community/assets/`, each shows real
resolved class names (not arbitrary values, not an empty state), and
`devmode-codegen.png` is embedded at the top of `README.md`.

### Step 10: Remove the team-sharing claim from user-facing docs

Edit exactly these, and nothing else:

| File:line | Currently says | Change to |
|---|---|---|
| `README.md:7` | "drops the team's `tailwind.config.js` … developers install the plugin and read real classes" | Say the config is saved per file *by the person who installs it*; drop the implication that one person's save reaches others. |
| `README.md:29` | "**Save on file** (shared)" | "**Save on file** (this file, your account)" |
| `README.md:39` | "Shared private plugin data on the file" | "Private plugin data on this file — read by your own account across sessions. Whether a collaborator reads it is unverified in 0.1.0." |
| `docs/setup.md:22` | "(shared)" | same treatment as README:29 |
| `docs/setup.md:28` | "Prefer document save so collaborators share one source." | Delete the sentence. Replace with a note that each person saves their own config in 0.1.0. |
| `docs/setup.md:46` | Document tier row — "Shared private plugin data on the file" | mirror README:39 |
| `docs/community/listing.md:5` | "from your team's config" | "from your Tailwind config" |
| `plans/README.md` item B | "unverified result blocks the team-sharing publication claim" | Record that 0.1.0 ships with the claim removed, and that verification moves to 0.2.0. |

`docs/troubleshooting.md:57` already carries the correct caveat — leave it.

**Check**: `grep -rn "collaborator\|team's config\|(shared)" README.md docs/setup.md docs/community/listing.md` returns nothing that promises another person reads your saved config. `pnpm check` still exits 0.

### Step 11: Fill the audit, the approval packet, and the plan index

1. `docs/release/feature-audit.md` — replace every `CONDITIONAL` verdict with
   PASS or FAIL based on Steps 3–8. Change the **Cross-account document read**
   row from `BLOCKER for Community` to `DEFERRED to 0.2.0 — team-sharing claim
   removed from 0.1.0`.
2. `docs/community/publish-runbook.md` — change **Status** from "BLOCKED on
   cross-account private storage PASS" to reflect the real remaining
   prerequisites, and tick the checklist items Steps 9–10 completed.
3. `docs/release/approval-packet.md` — update the Prepared table from real
   results, then bring it to the owner for the two decision rows. **You do not
   fill those rows yourself.**
4. `plans/README.md` — add this plan's row, and update rows 000 and 003–008 to
   replace their parenthetical `UNVERIFIED` notes with what you measured.

**Check**: no `UNVERIFIED` remains anywhere in `docs/` or `plans/README.md`
except the deliberately deferred cross-account row; the approval packet's two
decision rows are the only thing left empty.

## Validation plan

The whole plan worked when a person who was not in the room can open
`docs/release/feature-audit.md` and see, for every shipped feature, a PASS or
FAIL that names what was observed, on what Figma version, on what machine — and
can therefore decide whether to publish without asking anyone a question.

Confirm all three:

- `grep -rn "UNVERIFIED" docs/ plans/README.md packages/plugin/notes/` returns
  only the cross-account row, carrying its deferral note.
- `pnpm check` exits 0 against the real captured fixtures.
- The owner reads the approval packet and records a decision in both rows —
  APPROVED, DEFER, or REJECT. Any of the three closes this plan; an *empty* row
  does not.

## Done criteria

- [ ] `packages/plugin/manifest.json` carries a real Figma-issued numeric ID
- [ ] All three routes (design, codegen, Inspect) observed loading in Figma desktop
- [ ] Eighteen fixture files replaced with verbatim captures; diff recorded
- [ ] `pnpm check` exits 0 after the fixture replacement
- [ ] Storage matrix rows 1–4 and 8 read PASS or FAIL with evidence
- [ ] Latency, linter, and subtree measurements recorded with machine specs
- [ ] Stamping verified including Dev-Mode-blocked, undo, and untouched `variable.name`
- [ ] Three product screenshots captured and `devmode-codegen.png` embedded in `README.md`
- [ ] Team-sharing claim removed from README, setup, listing, and plans/README item B
- [ ] `feature-audit.md` has no `CONDITIONAL` verdicts left
- [ ] Owner has recorded a decision in both approval-packet rows
- [ ] No file outside the in-scope list was changed — in particular no `packages/*/src/**`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back — do not improvise, and above all do not start fixing code:

- **Any of the three routes fails to load.** A plugin that does not run in Figma
  is not a documentation problem, and Step 3 is the first time anyone has looked.
- **Real captured CSS differs from the seeded fixtures in a way that changes
  matcher output**, or `pnpm check` fails after Step 4. The seeded fixtures were
  plan 000's acknowledged guess; if the guess was wrong, `@fig-tail/match` may be
  tuned to inputs Figma never produces. That is a new plan, not a patch.
- **Document-tier config does not survive a Figma restart** (Step 5 row 2). The
  document tier is the primary storage path; losing it invalidates the setup flow
  the docs describe.
- **Stamping Apply succeeds in Dev Mode**, or any run modifies `variable.name`.
  Both violate non-negotiables in `plans/EXECUTOR-GUIDE.md` §2 and are
  write-safety failures, not bugs to note and move past.
- **Codegen exceeds 3 seconds on an ordinary single layer.** The 2-second
  internal deadline was set from conflicting docs; if real layers blow through
  it, the budget assumption behind plans 004 and 008 is wrong.
- **You find yourself editing `packages/*/src/**`.** That is the signal that this
  verification pass has turned into an implementation pass. Stop and write up
  what you found.
- A step's check fails twice after a reasonable attempt.

## Handoff / after it lands

- **Plan 010 tasks 4 and 5 become runnable** once the owner fills the approval
  packet. They are unchanged and still owner-gated; this plan only supplies the
  evidence they were waiting on.
- **A 0.2.0 cross-account plan is owed.** It needs: a published or
  Organization-tier plugin ID that two accounts can install, a second Figma
  account whose seat tier is *recorded before* testing (unknown as of this plan),
  and a re-run of `storage-matrix.md` row 7 against the release build. Note that
  publishing 0.1.0 to the Community itself supplies the shared ID — so this most
  likely becomes cheap the moment 010 task 5 runs.
- **Watch for a fixture-driven follow-on.** Step 4 is the step most likely to
  produce surprises, because it is the first contact between real Figma output
  and a matcher tuned on seeded shapes. If it produces a STOP, that follow-on
  plan is the highest-priority thing in the repo.
- **A reviewer should scrutinise Step 4's diff and Step 10's wording** hardest:
  the first is where "we shipped correct code against imaginary inputs" would
  surface, and the second is where an over-broad edit could quietly delete a
  claim the product does honestly support.
- **Deliberately deferred**: icon and cover art (Step 9), any second-account
  work, and the CLI escape hatch (plan 009, REJECTED for this ship).
