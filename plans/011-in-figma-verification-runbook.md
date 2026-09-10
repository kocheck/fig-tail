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
> `git diff --stat abb2c1b..HEAD -- packages/plugin fixtures/figma packages/match/fixtures`
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
are marked DONE with an `UNVERIFIED` caveat, and 37 `UNVERIFIED` markers sit
across `packages/plugin/notes/`, `docs/release/` and `plans/README.md` — all of
them resting on documentation reading plus code-path inspection rather than
observation. One — cross-account document read — is the named blocker on the
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
3. **An env stamp** — Figma desktop version, account label (A/B), seat type,
   plugin ID used, date.

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
- `spikes/figma-platform-isolation/main.js` — **Step 5 only**, to correct the
  keys it reads. This is test instrumentation, not shipped code; a broken
  instrument produces false evidence, which is the one thing this plan exists to
  prevent.
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

**Dependencies between steps**: Step 1 gates Step 4. Step 3's substeps are strictly
ordered. **Step 5 depends on Step 3**, because it needs a document-tier config
already saved on the file. Steps 2, 6, 7, 8 and 9 are independent. If a step is
BLOCKED, record it and continue — a partial run with honest rows is the expected
outcome, not a failure.

**Before anything**: run `pnpm --filter @fig-tail/plugin build`, then import
`packages/plugin/manifest.json` into Figma desktop. Record the build's commit SHA
in the env stamp, so every row below is attributable to a known build.

## Breaking the circularity — OWNER DECISION: **route B**, decided 2026-09-10

**0.1.0 ships as a local/team manifest install. It is not published to Community
in this pass, and the cross-account row is expected to end BLOCKED.** The
alternatives are kept below so the reasoning survives; do not switch routes
mid-run without a new owner decision.

| Route | What happens | Cost |
|---|---|---|
| A. Publish, then verify | Publish to Community — that ID is the shipping ID — then immediately run Step 4 on account B. On FAIL, unpublish or patch. | A public listing exists before the blocker clears. Requires listing copy that does **not** claim team sharing until Step 4 is PASS. |
| **B. Re-scope 0.1.0 to local/team install — CHOSEN** | Do not publish. Verify Steps 2–3 and 5–9 fully; record cross-account as BLOCKED with the plan-tier reason. Ship via manifest import for the team demo. | Community publish slips to 0.2.0. Matches the existing CHANGELOG note that the plugin ships via Community *or* local manifest install. |
| C. Borrow an org | Run the cross-account test inside an Organization/Enterprise workspace you have access to, via org-private publishing. | Needs an org you can publish into. The plugin ID there is not the shipping ID, so mechanism evidence transfers but stored config does not. |

**Why B.** It is the only route where every published claim stays backed by
evidence, and it costs nothing a 0.2.0 publish cannot recover once an org or an
escape hatch exists. It also matches what `CHANGELOG.md` already says — the
plugin ships via Community *or* local manifest install.

**What B means for this plan**: Steps 2, 3, 5, 6, 7, 8 and 9 run in full and are
expected to produce real PASS/FAIL rows. Step 4 runs **only** if one of Step 1's
escape hatches works; otherwise it is recorded BLOCKED with the plan-tier reason.
A run that ends with Step 4 BLOCKED and everything else evidenced is a **complete
success** of this plan.

**What B does not change**: nothing about the plugin's behaviour or copy. The
README already hedges Community install as "when published", so no claim needs
retracting. Do not add "local install only" language to shipped docs under this
plan — that is a release decision, and it belongs to the owner.

## Steps

### Step 1: Establish one plugin ID installable by both accounts

This is the gate for the Community blocker, and the most likely place this plan
stops. Per fact 7, `setPluginData` is namespaced to the plugin ID. Two separate
**Import plugin from manifest** copies receive **distinct IDs**, so testing
cross-account read that way proves nothing — each account would read its own
empty namespace and the FAIL would be an artifact of the method.

**Known constraint, checked 2026-09-10.** Publishing a plugin privately to an
organization requires an **Organization or Enterprise** plan ([Create private
plugins for an organization](https://help.figma.com/hc/en-us/articles/4404228629655-Create-private-organization-plugins)).
This project is on **Professional**, so that route is unavailable, and the
documented way to put a plugin on a second account is publishing it to Community.

**That makes the gate as written circular**: the Community publish is blocked on
cross-account read, and cross-account read needs a shared plugin ID, which on
Professional needs a Community publish. Break the circularity by owner decision,
not by executor improvisation. **That decision is already made: route B** — see
"Breaking the circularity" above, and read it before starting this step.

Two escape hatches were *not* resolved when this plan was written, because
`help.figma.com` was unreachable from the authoring environment. Time-box each to
30 minutes before falling back to the decided route:

- Whether a plugin **collaborator/publisher invite** lets a second account run an
  unpublished plugin.
- Whether Community publishing offers an **unlisted / link-only** visibility that
  is not a full public listing. **Research only.** An unlisted publish is still a
  publish, which Scope forbids and route B defers — so a positive finding here is
  recorded for the 0.2.0 decision and does **not** unblock Step 4 in this pass.

Only the collaborator-invite hatch, if it exists, can unblock Step 4 under route B.
Record what you find either way — the next person should not re-derive it.

Then decide, and write down, **which ID the evidence is recorded against**. If
verification runs under `fig-tail-dev` but the plugin ships under a
Figma-assigned production ID, the *mechanism* evidence carries over but **no
stored config does** — any config saved during testing is unreadable to the
published plugin, and the cross-account row would describe an artifact that is
not the one shipping. Prefer verifying on the ID that will ship.

**Check**: `packages/plugin/notes/storage-matrix.md` has a new "Plugin identity"
section naming the decided route (A, B, C, or an escape hatch), the exact plugin
ID, whether it is the shipping ID, the outcome of both time-boxed escape-hatch
checks, and — if a shared ID was obtained — a screenshot showing it installed on
both accounts. Under route B, or if no route yields a shared ID, record Step 4 as
`BLOCKED — Professional plan has no private-share route; see plan 011 Step 1`
and continue to Step 2.

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

### Step 4: Cross-account document read — run only if an escape hatch worked

Under the chosen route B there is no Community publish in this pass, so this step
usually does **not** run. Run it only if Step 1's time-boxed checks found a
collaborator-invite or unlisted-publish route that puts the *same* plugin ID on
both accounts. If they did not, record BLOCKED and move to Step 5 — do not
improvise a substitute.

If a route was found: follow the procedure
already written in `packages/plugin/notes/storage-matrix.md` under
"Second-account procedure": account A saves on file, shares the file with
account B, account B installs the **same** plugin ID, opens the file in Dev
Mode, selects a layer.

Account B must see the **document** label and classes resolved from A's config —
not personal, not none. A "none" result here means B is reading a different
namespace: re-check that the plugin IDs genuinely match before recording FAIL.

**Check**: the "Cross-account document read" row in `storage-matrix.md` and in
`docs/release/feature-audit.md` reads either PASS/FAIL with both accounts' env
stamps and a screenshot of account B's Dev Mode showing the document label, or
`BLOCKED — Professional plan has no private-share route; route B chosen
2026-09-10; see plan 011 Step 1`. On FAIL, apply the fallback already written in
`storage-matrix.md`: keep the personal path labelled, do not claim team setup in
Community copy.

### Step 5: Confirm cross-plugin isolation — fix the instrument first

Depends on Step 3 having saved a document-tier config on the file.

**The spike as committed cannot detect a failure.** `spikes/figma-platform-isolation/main.js:3`
reads `['ft.spike.meta', 'ft.spike.chunk.0', 'ft.spike.chunk.1']`, which are the
*capture spike's* keys. fig-tail writes `figtail.meta`, `figtail.payload.*` and
`figtail.document-id` (`packages/plugin/src/storage.ts:25-30`). Run unchanged, it
prints `ISOLATION PASS` whether namespacing works or not, because it reads keys no
plugin ever wrote. A screenshot of that toast would satisfy every letter of the
evidence rule and mean nothing.

So:

1. **Fix the keys.** Change `KEYS` to fig-tail's actual keys. Scope permits editing
   this file, and only this file, for this reason.
2. **Add a positive control.** Before reading fig-tail's keys, have the spike write
   and read back one key of its own. If that read comes back empty, the reader
   itself is broken and a subsequent "empty" result proves nothing — **STOP**.
3. **Then measure.** With the positive control passing, read fig-tail's keys from
   the second plugin ID. Expect empty.

Only step 3's empty read, sitting behind a passing positive control, is evidence.

**Check**: the "Cross-plugin isolation" rows in `platform-preflight.md:49` and
`storage-matrix.md` record both the positive-control result and the empty read of
`figtail.*`, with a screenshot, replacing "PASS (by documented semantics)". The
spike diff is committed with the row.

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

### Step 7: Measure linter and subtree export at scale

The linter reports its own duration in the UI status line
(`packages/plugin/src/ui/main.tsx:400`, rendering
`<n> findings · <n> nodes · <n>ms`), so this measurement is directly readable.

- **Linter**: run Lint drift over a page of ≥1,000 nodes. Record the node count
  and `durationMs` from the status line against the <10 s budget in
  `linter-performance.md`. Record the file's source URL so it is reproducible.
- **Subtree export**: select a subtree of ≥100 nodes and run each of the HTML,
  JSX and Outline formats. Note `mode-dev.ts:81` caps this at
  `maxNodes: 150, deadlineMs: 2000` — a truncated or deadline-exceeded result on
  a large tree is **expected behaviour**, not a failure. Record which of the three
  outcomes occurred: truncated, deadline-exceeded, or completed within both caps
  (possible, since 100 nodes is under the 150 cap — to exercise truncation
  deliberately, select more than 150).

**Check**: `linter-performance.md` and `subtree-performance.md` each carry the
observed number, the file used, and a screenshot of the status line.

### Step 8: Stamping apply matrix — on a throwaway file only

**This step writes to a Figma file.** Use the throwaway file from Inputs. Never
run Apply against the demo file, a shared team file, or any file with variables
someone else depends on.

Confirm the three-row matrix in `platform-preflight.md` (lines 57–59). **Two of
its three expectations are worded wrongly for the shipped build** — record what
actually happens, not what the row predicts:

- **Design editor + edit access** → Apply allowed. (Expected correct.)
- **Dev Mode** → the row says "denied or unsafe" and this plan previously said
  "not offered". Both are wrong: `main.tsx:242` renders the `Apply stamp` button
  **unconditionally**, and `main.ts:11` registers the handler globally, so the
  button is present and clickable in Dev Mode Inspect. Clicking it should surface
  `Stamping can only apply in the design editor` (`mode-design.ts:194`) and a
  `design-editor-only` failure (`mode-design.ts:197`). Expected behaviour is
  **offered and refused**. Record the exact notification text.
- **No edit access** (account B, view-only) → there is no edit-access gate in the
  code: `stamp/apply.ts:59` gates only on `figma.editorType`, and per-variable
  write failures collect into a `failed` array (`apply.ts:65-70`). Any refusal
  comes from Figma's own permission enforcement, not from fig-tail. There is no
  predicted string — record verbatim whatever the user sees, including "nothing
  happened" if that is the truth.

Then confirm the open question in `stamping-verification.md`: does the Inspect
panel actually display `codeSyntax.WEB` on a variable after stamping? Undo via
Figma afterwards and confirm the undo restored the previous state.

**Check**: all three matrix rows carry observed results with screenshots, and any
row whose stated expectation the build contradicts is **rewritten to match the
build**, with a note saying it was wrong. The `stamping-verification.md` question
carries an observed answer. The throwaway file's name is recorded. Undo is
confirmed.

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

The code says the near-miss property is absent from both
(`packages/match/src/index.ts:184` filters `confidence !== 'nearest'`, and
`mode-dev.ts:78` drops the notes section under `Classes`), so the expected
observation is a class string with **no background utility** on `Colour / near`
and **no padding utility** on `Spacing / near`, with no note explaining the
absence under `Classes`.

Nobody has watched this happen. Confirming it in-product converts
`docs/release/ux-findings-2026-09-10.md` finding V1 from a code reading into an
observed fact, and it costs one extra look at nodes you are already selecting.
Record it either way — including if the property turns out to be present, which
would mean V1 is wrong.

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
a written reason on the same line. Record the before and after counts — it was 37
across those paths at `abb2c1b`.

## Validation plan

- **Per-step**: each Check above is satisfied by an observed value plus a
  committed screenshot, per the evidence rule.
- **Whole-plan**: the owner reads `docs/release/feature-audit.md` and can state,
  for every row, whether it passed, failed, or was blocked, and why — without
  asking a follow-up question. That is the acceptance bar, and the owner
  confirms it.
- **Integrity spot-check**: pick any two PASS rows at random and confirm the
  referenced screenshot exists and shows what the row claims. A row whose
  artifact is missing is treated as unverified.

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
- [ ] Every PASS row names an observed value, a committed screenshot, and an env stamp.
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
