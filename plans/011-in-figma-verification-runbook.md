# Plan 011: Verify fig-tail inside Figma and replace every UNVERIFIED marker with evidence

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. If anything in "STOP conditions" occurs,
> stop and report — do not improvise. When done, update the status row for this
> plan in `plans/README.md`.
>
> **This plan cannot be executed by an agent.** Every step requires a human
> driving Figma desktop with two accounts. An agent may prepare builds and edit
> evidence files, but may never record a verification result it did not observe.
>
> **Drift check (run first)**:
> `git diff --stat abb2c1b..HEAD -- packages/plugin packages/match/src fixtures/figma packages/match/fixtures`
> (`packages/match/src` matters: plan 012 changes only files there, so without it
> a 012'd build reports clean drift and Step 9 measures the wrong expectations.)
> If the plugin source, manifest, or CSS fixtures changed since `abb2c1b`, re-read
> "Current state" below and confirm it still holds before starting.

## Status

- **Priority**: P0
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/000–008 and 010 (DONE in code). Plan 009 is REJECTED
  for this ship and is not a dependency.
- **Category**: process
- **Grounded at**: `abb2c1b` — 2026-09-10

## Why this matters

fig-tail 0.1.0 is fully built and unit-tested, and has never once been run
inside Figma. Eight of the eleven plans (000, 003, 004, 005, 006, 007, 008, 010)
are marked DONE with an `UNVERIFIED` caveat, and **48** `UNVERIFIED` markers sit
across `packages/plugin/notes/`, `docs/`, `fixtures/figma/` and `plans/README.md`
at `abb2c1b` (measured, not estimated) — all of them resting on documentation
reading plus code-path inspection rather than observation. One — cross-account document read — is the named blocker on the
Figma Community publish.

The cost is not theoretical. This repo's own demo checklist says a plugin that
emits a wrong class name in front of developers does more damage than one that
does not exist. Right now nobody can say whether the plugin loads, whether the
config a designer saves is readable by the developer sitting next to them, or
whether the CSS shapes the matching engine was built against resemble what
Figma actually returns.

This plan converts that pile of assumptions into recorded evidence for a 0.1.0
that ships as a **local/team manifest install**. The Figma Community publish is
deliberately deferred to 0.2.0, because on a Professional plan the only route to
a shared plugin ID is publishing — see "Breaking the circularity".

Intent, for judgment calls: **the goal is truthful status, not green status.**
A recorded FAIL or BLOCKED with a documented reason is a complete success of this
plan. Manufacturing a PASS is the only real failure mode.

## Context the executor needs

### Current state

- `packages/plugin/manifest.json` declares `"id": "fig-tail-dev"`,
  `editorType: ["figma","dev"]`, `capabilities: ["codegen","inspect"]`,
  `documentAccess: "dynamic-page"`, `networkAccess.allowedDomains: ["none"]`.
- Config storage has three tiers, resolved **document → personal → none**, but
  there are **four** labels, because the personal tier has two. All four, quoted
  verbatim from `packages/plugin/src/storage.ts:355-368` — the checks below match
  against these exact strings, so none is abbreviated:
  - Document: `Using the config saved on this file`
  - Personal, no document config present:
    `Using your personal config — this file has no shared one`
  - Personal, overriding a document config (**this is what substep 5 produces**):
    `Using your personal config — overriding this file's shared config`
  - None: `No Tailwind config — generic Tailwind syntax; project prefix/settings may require changes. Add your config for confirmed names.`
- **Config can be cleared from inside the plugin.** `packages/plugin/src/ui/main.tsx:227-228`
  render `Remove file config` and `Remove personal config`, wired at
  `main.tsx:336-340` to `clearConfig` (`storage.ts:548`). This is the reset
  mechanism Step 3 needs. It is not written down in `docs/`, which is why Step 3
  asks you to document it.
- A working capture spike exists at `spikes/figma-platform/` (its own plugin id
  `fig-tail-platform-spike`) with a `capture-css` route that calls
  `node.getCSSAsync()` and posts the result to its UI. A second spike,
  `spikes/figma-platform-isolation/`, uses a different plugin id and is the
  cross-plugin isolation reader.
- Evidence files to be updated, all currently carrying `UNVERIFIED` rows:
  `packages/plugin/notes/platform-preflight.md`,
  `packages/plugin/notes/storage-matrix.md`,
  `packages/plugin/notes/stamping-verification.md`,
  `packages/plugin/notes/devmode-discovery.md`,
  `packages/plugin/notes/linter-performance.md`,
  `packages/plugin/notes/subtree-performance.md`,
  `docs/release/feature-audit.md`, `docs/release/approval-packet.md`.

### Platform facts this plan depends on

Restated from `plans/README.md`; open the linked page before relying on any of
them, because a summary is not a spec and the API may have moved.

| # | Fact | Source |
|---|---|---|
| 4 | `figma.codegen.on('generate')` fires on every selection change. Figma's API reference says 15 s, its codegen guide says 3 s. **Treat 3 s as the hard limit** and 2 s as the internal deadline (the code uses `DEFAULT_DEADLINE_MS = 2000`). | [figma.codegen.on](https://developers.figma.com/docs/plugins/api/properties/figma-codegen-on) · [Codegen plugins](https://developers.figma.com/docs/plugins/codegen-plugins) |
| 7 | `setPluginData` is **private to the plugin ID** and enforces 100 kB per entry. Collaborators using the same plugin are the intended readers. | [setPluginData](https://developers.figma.com/docs/plugins/api/properties/nodes-setplugindata/) |
| 8 | `figma.clientStorage` is 5 MB, per-user, per-plugin. | [Update 109](https://developers.figma.com/docs/plugins/updates/2025/03/17/version-1-update-109/) |
| 11 | `variable.setVariableCodeSyntax(platform, value)` writes `codeSyntax`; platforms are `'WEB'`, `'ANDROID'`, `'iOS'`. | [setVariableCodeSyntax](https://developers.figma.com/docs/plugins/api/properties/Variable-setvariablecodesyntax/) |
| 13 | `figma.editorType` is `'dev'` in Dev Mode, `'figma'` in the design editor; inside Dev Mode `figma.mode` distinguishes codegen from inspect. | [figma.mode](https://developers.figma.com/docs/plugins/api/properties/figma-mode/) |
| 17 | `figma.fileKey` is unavailable to public plugins. | [Plugin API](https://developers.figma.com/docs/plugins/api/figma/) |

### Three defects found while writing this plan — read before Step 9

1. **`fixtures/figma/css/**` is consumed by nothing.** No test, script, or
   config in the repo imports it. `packages/plugin/notes/platform-preflight.md`
   line 73 claims "Plan 002 consumes `fixtures/figma/css/**` as-is; hash
   equality checks apply to those files." That claim is false as of `abb2c1b`.
2. **The fixtures that *do* feed tests are a second, duplicated copy** at
   `packages/match/fixtures/css/` (imported by `packages/match/src/
   summarise.test.ts` and `integration.test.ts`). It is byte-identical to the
   root copy today and is not mentioned anywhere in the preflight note.
   Re-capturing only the root copy would therefore produce **zero** test signal.
3. **Codegen has no latency instrumentation, and the plugin emits no console
   output at all.** `grep` for `durationMs|performance|elapsed` across
   `packages/plugin/src/codegen/` and `mode-dev.ts` returns nothing, and
   `grep -rn "console\." packages/plugin/src/` returns nothing either. The
   linter does surface duration (`packages/plugin/src/ui/main.tsx:400` renders
   `${state.lint.durationMs}ms`), so Step 7 has a real instrument and Step 6 has
   none. Step 6 says how to handle that.
4. **The cross-plugin isolation spike reads the wrong keys, and would pass
   vacuously.** `spikes/figma-platform-isolation/main.js:3` reads
   `['ft.spike.meta', 'ft.spike.chunk.0', 'ft.spike.chunk.1']` — the *capture
   spike's* keys. fig-tail writes under `figtail.*`
   (`packages/plugin/src/storage.ts:25-30`: `figtail.meta`, `figtail.payload.*`,
   `figtail.document-id`). Run as-is against a fig-tail config it prints
   `ISOLATION PASS` regardless of whether plugin-data namespacing works, because
   it looks for keys that exist under no plugin ID at all. Step 5 fixes this
   before measuring anything.

## Inputs & resources

Have these before starting. The right-hand column names which step each one
blocks, so a missing input costs that step rather than the run.

| Input | Detail | Blocks |
|---|---|---|
| Figma **desktop** app | Record exact version in the env stamp | all |
| Account **A** | Edit access on the test file | 2–9 |
| Account **B** | Separate account, **view-only** (no edit access) on the test file | 3b, 8 (no-edit row), 4 |
| A shared plugin ID both accounts can install | See Step 1. Under route B this is expected to be unobtainable | 4 only |
| A real `tailwind.config.js`/`.ts` (v3) or CSS entry with `@theme` (v4) | The team's real config, not a fixture | 3–9 |
| Matching `package.json` with an exact `x.y.z` `tailwindcss` version | Ranges are rejected by design | 3 |
| A **throwaway** Figma file with local variables | Step 8 writes to it | 8 |
| A large Figma file, ≥1,000 nodes on one page | Record its source URL so the measurement is reproducible | 7 |
| Test file with the nine stable node names | **Does not exist yet — build it.** The names and expected classes are the table at `fixtures/figma/README.md:20-30` (`Card / exact`, `Text / exact`, `Size / fixed`, `Colour / near`, `Spacing / near`, `Variable / bound`, `Gradient / unsupported`, `Layout / nested`, `Text / mixed`). These are layer names, *not* the slug filenames in `fixtures/figma/css/design/`. Paste the file's share URL into `fixtures/figma/README.md:7`. | 2, 9 |
| Someone who has not seen the plugin | For the Step 2 discoverability question only. Optional — Step 2 says what to do without one | 2 (one question) |

Build commands:

| Purpose | Command | Expected on success |
|---|---|---|
| Full gate | `pnpm check` | exit 0 |
| Plugin build | `pnpm --filter @fig-tail/plugin build` | `packages/plugin/dist/main.js` + `dist/ui.html` written |

## The evidence rule

This repo already recorded `PASS (code path)` in places that read as
verification and were not. Do not repeat that.

A row may be marked **PASS** only when the recorder personally observed the
result in Figma, and writes all three of:

1. **What was observed** — the literal string, number, or behaviour.
2. **An artifact** — screenshot committed to
   `docs/release/evidence/2026-09-10/<step>-<name>.png`, referenced by filename.
3. **The build's commit SHA**, on every row.
4. **An env stamp** — Figma desktop version, account label, seat type, plugin ID —
   recorded **once per session**, not per row.

**Screenshots are required only on the rows that gate the pilot**: config tier
resolution (Step 3), variable-bound emission (Step 5c), near-miss class output
(Step 9), and anything Step 0 flags as surprising. Everywhere else, the observed
value plus the SHA is the evidence. This repo's pathology is *unobserved* rows,
not unphotographed ones — a pasted string you actually read defeats it just as
well, and at a fraction of the cost for an audience of two colleagues.

The SHA is not optional bookkeeping. Plan 012 changes the class string this
runbook measures, and without a SHA on each row there is no way to tell a current
measurement from one superseded by a later build — which is how three-part,
personally-observed, screenshotted evidence quietly becomes the very artifact this
rule exists to prevent. A row whose SHA is not an ancestor of `HEAD` for the paths
it covers is **STALE**, not PASS.

Bare `PASS`, `PASS (code path)`, `looks right`, and `should work` are forbidden
values. If a check could not be run, the value is `BLOCKED` plus the reason —
never `PASS`.

## Scope

**In scope** (the only things to change):

- `packages/plugin/notes/*.md` — result rows and env stamps.
- `docs/release/feature-audit.md`, `docs/release/approval-packet.md` — status rows.
- `docs/community/publish-runbook.md` — prerequisite checkboxes only.
- `docs/release/evidence/2026-09-10/` — new screenshots.
- `docs/release/ux-findings-2026-09-10.md` — the V1 row only, to record what Step 9
  observed in-product.
- `fixtures/figma/css/{design,dev}/*.json` and
  `packages/match/fixtures/css/*.json` — Step 9 re-capture only.
- `fixtures/figma/README.md` — the file URL at line 7, and the "seeded from
  documented shapes" wording at lines 9–11, which Step 9 makes false.
- `packages/plugin/notes/first-hour.md` — new, from Step 0.
- This plan itself — Step 0 is expected to change the steps below it.
- `plans/README.md` — status row for this plan, and the `UNVERIFIED` caveats in
  rows 000–010 that this plan resolves.

**Out of scope** (do NOT touch, even though they look related):

- **Any `packages/*/src/**` file.** This plan measures the 0.1.0 build; changing
  the thing being measured invalidates the measurement. Bugs found become
  written findings, not fixes. There is no exception: Step 6 does **not**
  add instrumentation (see that step), and `spikes/` is not `packages/*/src/`.
- **Submitting to Figma Community, or tagging/publishing to npm — including an
  unlisted or link-only publish.** An unlisted publish is still a publish and
  still needs an owner decision. This plan produces evidence; it does not decide.
- **`manifest.json`'s `id` field**, except as Step 1 explicitly directs.
- **The owner-decision rows in `docs/release/approval-packet.md`.** Fill the
  prepared-status rows; leave APPROVED/DEFER/REJECT to the owner.
- **Plan 009 / `@fig-tail/cli`.** REJECTED for this ship.

## Working approach

Branch `verify/in-figma-0.1.0`, cut from the commit this plan is grounded at
(`abb2c1b`) or the current default branch head, whichever the owner names — record
which. One commit per step, message `011-<step number>: <summary>` (matching the
`<plan>-<task>` convention in `plans/EXECUTOR-GUIDE.md:252-259`). Commit evidence
screenshots alongside the note edit they support. Do not open a PR unless asked.

Screenshots go to `docs/release/evidence/2026-09-10/<step>-<slug>.png`, where
`<slug>` is a short kebab-case name for what is pictured — e.g.
`03-document-tier-label.png`, `05-isolation-empty-read.png`. Create the directory.

**`EXECUTOR-GUIDE.md:198-204` requires `pnpm check` to pass before every commit.
This plan overrides that for Step 9 only**, whose whole purpose may be to record a
failing `pnpm check`. Every other commit follows the guide.

**Dependencies between steps**: Step 0 precedes everything and may rewrite what
follows. Step 3's substeps are strictly ordered. Steps 2, 5c, 6 and 9 are
independent. If a step is BLOCKED, record it and continue — a partial run with
honest rows is the expected outcome, not a failure.

**What moved out of this plan.** Plugin identity, cross-account document read and
cross-plugin isolation are now **plan 016**: they are distribution questions, not
verification of what a developer sees. The 1,000-node linter and subtree
performance runs, and the stamping apply matrix, were **cut** — no developer
pasting a class string touches those features, and `subtreeFormat` is being
removed from the manifest in plan 015. They return if and when Community publish
does.

**Before anything**: run `pnpm --filter @fig-tail/plugin build`, then import
`packages/plugin/manifest.json` into Figma desktop. Record the build's commit SHA
in the env stamp, so every row below is attributable to a known build.

## Steps

### Step 0: Use it for an hour before running any of this

**Do this first, and do not skip it because the rest of the plan looks thorough.**

Nobody has opened fig-tail in Figma. A ten-step runbook written for software its
author has never watched run is a guess with a table of contents. So: build the
plugin, import it, load the pilot team's config from plan 013, and **use it for
about an hour** on a real file. No script, no rows to fill, no screenshots.

Then come back and revise this plan from what you saw. Steps 2, 3, 5c, 6 and 9
below are the best guess available today; an hour of contact will tell you which
of them matter, which are trivially fine, and what nobody thought to check.
Rewriting a step because reality differed is the intended outcome, not a failure
of planning.

Write down, roughly: what surprised you, what you had to work out for yourself,
anything that looked wrong, and anything that made you stop trusting the output.

**Check**: `packages/plugin/notes/first-hour.md` exists with those four notes, and
any step below that the hour proved wrong or missing has been edited — with the
edit noted in the commit message.

### Step 2: Confirm all three routes load

Install the plugin on account A. Exercise each route and confirm the plugin
renders rather than erroring:

- Design editor (`editorType 'figma'`) — run fig-tail from the plugins menu.
- Dev Mode **Code section** (`'dev'`/`'codegen'`) — select **Tailwind CSS** in
  Figma's language dropdown.
- Dev Mode **Inspect panel** (`'dev'`/`'inspect'`) — open fig-tail from the
  Inspect plugin picker.

While in Dev Mode, also confirm the five `codegenPreferences` from
`manifest.json` appear in the preferences menu: `Configure Tailwind…`,
`Include layout utilities`, `Allow arbitrary values`, `Output`, `Subtree export`.

For `devmode-discovery.md`, record **all three** open questions it names
(lines 20, 34 and 48):

1. The literal wording and position Figma renders for the plugin in the language
   dropdown.
2. Whether the Inspect panel entry point is findable without being told where it
   is. Answer by watching one person who has not seen the plugin try to find it,
   and write down what they actually did. **If no such person is available**,
   record `BLOCKED — no naive subject available` rather than answering from your
   own experience; you already know where it is, so your own attempt measures
   nothing.
3. Whether the language selection persists across reloads and restarts — select
   Tailwind CSS, reload, reopen, and record whether it is still selected.

**Check**: the route table in `packages/plugin/notes/platform-preflight.md`
(lines 22–24) has all three rows replaced with observed results plus screenshots,
the five preference labels are confirmed present, and all three
`devmode-discovery.md` questions carry an answer or an explicit BLOCKED.

### Step 3: Walk the tier ladder in this exact order

**Order is load-bearing.** Tiers resolve document → personal → none, so a higher
tier masks the ones below it. Testing document first makes the personal and none
labels unobservable without a reset.

**Button names**: the UI reads **Resolve**, **Apply to file**, **Save personally**,
**Remove file config**, **Remove personal config** (`packages/plugin/src/ui/main.tsx:224-228`).
`README.md` and `docs/setup.md` call the first two "Save on file" and "Save
personal" — that mismatch is a real finding; record it, and click what the UI says.

**Reset**: `Remove file config` / `Remove personal config` return a file to the
none tier. Personal config is `clientStorage`, so it is **per-account** — removing
it on account A does not touch account B's.

#### 3a — the ladder, entirely on account A

Account A holds edit access, so it can produce all four labels. Run on the nine-node
test file, in order:

1. **None** — remove both configs, reload, select a layer. Expect the none label.
2. **Personal** — Resolve, **Save personally**. Reload. Expect
   `Using your personal config — this file has no shared one`.
3. **Document** — **Apply to file**. Reload. Expect
   `Using the config saved on this file`, taking precedence over the personal
   config from substep 2 (which is still there, on this same account).
4. **Restart persistence** — quit Figma entirely, reopen, select a layer. Expect
   the document label still.
5. **Preference switch** — with both tiers present, toggle the document↔user
   preference and reload. Expect the **fourth** label,
   `Using your personal config — overriding this file's shared config`. It is
   listed in "Current state"; seeing it is the expected result, not a surprise.

#### 3b — personal write without edit access, on account B

This is a separate check, not a rung of the ladder. It needs an account that
genuinely lacks edit access — account A in Dev Mode still holds edit rights and
proves nothing. On account B, view-only on the same file: run setup, Resolve,
**Save personally**, reload, confirm the personal label.

**This does not need a shared plugin ID.** Personal config lives in
`clientStorage`, which is per-user per-plugin, so account B running its own
manifest import is a valid test of "can a no-edit-access user save a personal
config". Only Step 4's cross-account *document read* needs the IDs to match.

Also record what **Apply to file** does on account B, since `canWriteDocument`
is computed but the button is rendered unconditionally — expected is a failure
message, not a silent no-op. Whatever happens, write it down.

**Check**: `packages/plugin/notes/storage-matrix.md` rows "Document write +
same-user reload", "Document write + Figma restart", "Personal write without edit
access" and "Preference switch document↔user persists" each carry an observed
label matching the verbatim strings in "Current state", with a screenshot. Add two
new rows the table lacks: **"None tier label"** (substep 1) and **"Personal
overriding document label"** (substep 5). The 3b row names the account and seat.
The reset procedure and the button-name mismatch are written into that file.

### Step 5c: Does variable binding actually work? (suspected shipped bug)

**This may be the most important thing this runbook finds.** Check it early.

`packages/plugin/src/codegen/hints.ts:49` calls the **synchronous**
`figma.variables.getVariableById(id)`, inside a `try`/`catch` that sets
`variable = null` on any error (`hints.ts:50-53`). The manifest declares
`"documentAccess": "dynamic-page"` (`manifest.json:9`), under which the
synchronous getters are documented to **throw**; the async form is
`getVariableByIdAsync`. Every other document read in the plugin already uses the
async form — `pipeline.ts:114`, `stamp/apply.ts:87`, `lint/variables.ts:108` —
which makes `hints.ts:49` look like a straggler rather than a choice.

If it does throw in product, the catch swallows it silently and **every variable
hint resolves to null**, on every surface, for every node with `boundVariables`.
Matching degrades to raw-value matching, `exact-variable` — the top of the
confidence ladder and the product's main differentiator — becomes unreachable, and
nothing warns anyone. There is no console output to notice it in.

Select the **`Variable / bound`** node with a config loaded, in Dev Mode. Record
the emitted class, its confidence, **and whether the bound variable actually has
`codeSyntax.WEB` set**.

That last part is not optional. `exact-variable` requires `hint.codeSyntax`, which
requires `variable.codeSyntax.WEB` (`packages/plugin/src/codegen/hints.ts:58-63`,
consumed at `packages/match/src/matchers/color.ts:181`). If the fixture's variable
has no WEB syntax, `exact-variable` is unreachable **by design** and a result of
`exact-value` says nothing about whether the hint path works. Check the variable
first; if it has no WEB syntax, set one (or pick a variable that has one) before
drawing any conclusion.

**Check**: `packages/plugin/notes/platform-preflight.md` gains a "Variable hints"
row recording the observed confidence for `Variable / bound`, with a screenshot.
If the confidence is anything other than `exact-variable`, that is a **finding, not
a failure of this step** — write it up and continue; a fix is a new plan.

### Step 6: Measure codegen latency against the 3 s budget

Per fact 4, 3 s is the hard limit and the code's internal deadline is 2 s. As
noted above, **codegen carries no timing instrumentation**, so there is nothing
in-product to read.

**There is no in-product instrument, and the plugin console is not one either** —
`grep -rn "console\." packages/plugin/src/` returns nothing, so the plugin emits
no output for a console to show. Do not go looking for it.

The only method available without changing the build is external timing: run ten
selection changes on the heaviest node in the test file, time them with a
stopwatch, and record the range. Label it in the note as a **coarse external
measurement**, because that is what it is — it includes Figma's own selection and
render time, so it is an upper bound on the callback, not a measurement of it.

That is sufficient for the only question being asked here: *is there any sign of
approaching the 3 s hard limit?* If the observed range is anywhere near 3 s, that
is a finding worth a real instrument — record it and STOP rather than adding
timing code to a build you are in the middle of measuring.

**Check**: `packages/plugin/notes/platform-preflight.md` gains a "Codegen
latency" section recording: the method (coarse external timing), the ten observed
values and their range, the node used, and a verdict against the 3 s hard limit —
stated as an upper bound, not as a callback measurement.

### Step 9: Re-capture CSS fixtures and reconcile the tests

Read the three defects above first — the naive version of this step produces no
signal.

1. Using `spikes/figma-platform/`'s `capture-css` route, capture
   `getCSSAsync()` output for each of the nine stable node names, in **both**
   the design editor and Dev Mode.
2. Write them to `fixtures/figma/css/design/` and `fixtures/figma/css/dev/`,
   replacing the seeded files.
3. **Also update `packages/match/fixtures/css/`** — this is the copy the tests
   import. Which of the design/dev pair to use is a decision to record, not
   guess: **if they differ**, use the Dev Mode capture (that is the surface the
   plugin ships on) and write down that the divergence existed; **if they are
   identical**, use either and record that they matched — which is itself the
   answer to the design/dev parity question `platform-preflight.md:28-32` calls
   provisional.
4. Diff the real captures against the seeded ones and record whether design and
   dev output actually match (the preflight note calls this a provisional PASS).
5. Run `pnpm check`.

**While you have each node selected, record one extra observation.** Two of the
nine nodes exist precisely to exercise near-misses: `Colour / near` (ΔE ~0.8 from
`brand-500`) and `Spacing / near` (25 px against a 24 px token). For each, on the
Dev Mode Code section, write down **the complete primary class string** — then
switch the `Output` preference to **Classes** and write it down again.

**Record what you see and the build SHA — do not score it against an expectation.**
At `abb2c1b` the code drops the near-miss property (`index.ts:186` filters
`confidence !== 'nearest'`; `mode-dev.ts:78` drops the notes section under
`Classes`), so on that build expect no background utility on `Colour / near` and
no padding utility on `Spacing / near`.

**But plan 012 changes exactly this.** On a build that includes 012 the property
*should* be present as a raw value — which is the fix working, not evidence that
finding V1 was wrong. So the row records the observation plus the SHA, and the
reading of it depends on whether 012 is in that build. Do not write "V1 not
reproduced" without checking `git log --oneline -- packages/match/src` first.

**If tests fail, that is the finding.** It means the matching engine was tuned
to fabricated CSS shapes. Record the failures verbatim in a new
`packages/plugin/notes/fixture-recapture.md` and STOP. **Do not edit the
captured fixtures to make tests pass** — that would restore exactly the fiction
this step exists to remove, and would do it silently.

Also correct the false claim at `platform-preflight.md` line 73 and document the
two-copy fixture arrangement.

**Check**: both fixture directories contain real captures; `pnpm check` result
recorded either as exit 0 or as verbatim failures in `fixture-recapture.md`;
line 73's claim corrected.

### Step 10: Roll results up

Propagate every result into the summary surfaces:

- `docs/release/feature-audit.md` — the **six** CONDITIONAL rows (lines 9–14) and
  the blocker row (line 17). Line 38's summary verdict too.
- `docs/release/approval-packet.md` — prepared-status rows only (line 22 included).
- `docs/community/publish-runbook.md` — the cross-account prerequisite checkbox.
- `plans/README.md` — this plan's status row, plus the `UNVERIFIED` caveats in
  rows 000, 003–008 and 010 that are now resolved. Rows still unverified keep
  their caveat, with the reason.
- `fixtures/figma/README.md` — line 7's file URL, and lines 9–11's "seeded from
  documented shapes" wording, which Step 9 makes false.

**Residual markers.** `platform-preflight.md:65-68` is a decision table whose rows
read "PASS WITH FALLBACK (code paths ready; in-product UNVERIFIED)". Those are
summaries of the rows above them, not independent claims: update each to match
whatever its underlying rows now say.

**Check**: `grep -rn "UNVERIFIED" packages/plugin/notes/ docs/ fixtures/figma/ plans/README.md`
returns only markers this plan did not have a step for, and each surviving one has
a written reason on the same line. Record the before and after counts. The baseline is **48** at `abb2c1b` for
exactly the paths in the grep above; re-measure before starting rather than
trusting this number, and note that `docs/release/ux-findings-2026-09-10.md` did
not exist at `abb2c1b`, so before/after are not the same corpus unless you say so.

## Validation plan

- **Per-step**: each Check above is satisfied by an observed value plus a
  committed screenshot, per the evidence rule.
- **Whole-plan**: the owner reads `docs/release/feature-audit.md` and can state,
  for every row, whether it passed, failed, or was blocked, and why — without
  asking a follow-up question. That is the acceptance bar, and the owner
  confirms it.
- **Integrity spot-check**: pick any two PASS rows at random and confirm the
  referenced screenshot exists and shows what the row claims. A row whose artifact
  is missing is treated as unverified. Also confirm each row's stamped SHA is an
  ancestor of `HEAD` for the paths that row covers — if not, the row is STALE.

## Done criteria

ALL must hold:

- [ ] Every row **that a step in this plan targets** reads PASS, FAIL, or
      BLOCKED-with-reason — no `UNVERIFIED`, no bare `PASS`. Specifically: the
      route table and storage/stamping matrices in `platform-preflight.md`, the
      eight rows of `storage-matrix.md` plus the two new ones from Step 3, the
      in-product question in `stamping-verification.md`, the 1,000-node row in
      `linter-performance.md`, the 100+ node row in `subtree-performance.md`, and
      all three questions in `devmode-discovery.md` (which is prose, not a table —
      answer them in place). Rows in those files describing code-level facts no
      step measures are left alone.
- [ ] Every PASS row names an observed value and the build SHA; the session
      carries one env stamp; the four gating rows carry screenshots.
- [ ] Step 0 ran, and this plan was revised from what it found.
- [ ] Every expectation this plan found to be **wrong about the build** — the Dev
      Mode and no-edit-access stamp rows, the isolation spike's keys, the
      "Save on file"/"Save personal" button names in `README.md` and
      `docs/setup.md` — is corrected or recorded as a finding.
- [ ] The cross-account document read row is PASS, FAIL, or BLOCKED with Step 1's
      written reason and route B recorded.
- [ ] Nothing was published to Figma Community or npm under this plan.
- [ ] Both fixture directories hold real captures, and `pnpm check` is either
      exit 0 or its failures are recorded verbatim in `fixture-recapture.md`.
- [ ] `platform-preflight.md` line 73's false claim about fixture consumption is corrected.
- [ ] The near-miss observation from Step 9 is recorded for both `Colour / near`
      and `Spacing / near`, under both `Output` settings, and the result is noted
      against finding V1 in `docs/release/ux-findings-2026-09-10.md`.
- [ ] No file under `packages/*/src/**` was modified. (`spikes/figma-platform-isolation/main.js`
      is expected to change, per Step 5.)
- [ ] `docs/release/feature-audit.md` and `approval-packet.md` reflect every result.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back — do not improvise — if:

- **Step 9's `pnpm check` fails after re-capture.** Report the failures; never
  edit a captured fixture to go green.
- **Anyone proposes switching off route B** (publishing to Community to unblock
  Step 4). That is a new owner decision, not an executor call.
- **Step 1 finds no route to a shared plugin ID.** Do not substitute two
  manifest imports and record the result as a real cross-account test.
- **Step 1's escape hatches look like they work but the two plugin IDs differ.**
  A "none" tier on account B then proves nothing except the method was wrong.
- **The evidence recorded would be against a plugin ID that is not the shipping
  one**, and nobody has decided whether that is acceptable.
- **Any step would require editing `packages/*/src/**`** to proceed. Step 5's
  spike fix is the only permitted code change, and `spikes/` is not `src/`.
- **Stamping Apply is about to run on anything other than the throwaway file.**
- **The plugin does not load at all in Step 2** — everything downstream is moot;
  report immediately rather than working around it.
- **Step 5's positive control fails** — the isolation reader cannot see its own
  data. An empty read then proves nothing.
- **A check's result is ambiguous** — a tier you cannot explain, or a label that
  is not one of the **four** quoted in "Current state". Record what you saw and
  ask. Do not round it to the nearest expected outcome.

## Handoff / after it lands

- **Community publish is deferred to 0.2.0 by decision, not by oversight.** The
  reopening condition is concrete: an Organization/Enterprise workspace to
  publish privately into, or a confirmed collaborator-invite route. (An unlisted
  publish would also do it, but is itself a publish and needs its own decision.)
  When one appears, Step 4 is the only step that needs re-running.
- **npm is unaffected.** `@fig-tail/theme` and `@fig-tail/match` were never
  gated on cross-account read; that decision stays in the approval packet.
- **The demo checklist** in `plans/README.md` ("Before you show it to
  developers") is the *other* prerequisite for showing this to anyone. This
  plan does not satisfy it — it makes satisfying it possible.
- **A reviewer should scrutinise** the PASS rows hardest, specifically whether
  each artifact shows what its row claims. The failure mode this repo has
  already demonstrated is confident status text ahead of the evidence.
- **Deliberately deferred**: fixing anything this plan finds. Bugs become new
  plans, so that the record of what 0.1.0 actually did stays intact.
- **If Step 9 fails**, the follow-up plan is a real one — the matching engine
  would need re-grounding against true CSS shapes, which likely reopens plan 002.
