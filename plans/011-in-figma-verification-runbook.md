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
- **Depends on**: plans/000 through plans/010 (all DONE in code)
- **Category**: process
- **Grounded at**: `abb2c1b` — 2026-09-10

## Why this matters

fig-tail 0.1.0 is fully built and unit-tested, and has never once been run
inside Figma. Ten of eleven plans are marked DONE with an `UNVERIFIED` caveat,
and roughly twenty individual claims across `packages/plugin/notes/` and
`docs/release/` rest on documentation reading plus code-path inspection rather
than observation. One of them — cross-account document read — is the single
named blocker on the Figma Community publish.

The cost is not theoretical. This repo's own demo checklist says a plugin that
emits a wrong class name in front of developers does more damage than one that
does not exist. Right now nobody can say whether the plugin loads, whether the
config a designer saves is readable by the developer sitting next to them, or
whether the CSS shapes the matching engine was built against resemble what
Figma actually returns. This plan converts that pile of assumptions into
recorded evidence, so the publish decision is made on facts.

Intent, for judgment calls: **the goal is truthful status, not green status.**
A recorded FAIL with a documented fallback is a complete success of this plan.
Manufacturing a PASS is the only real failure mode.

## Context the executor needs

### Current state

- `packages/plugin/manifest.json` declares `"id": "fig-tail-dev"`,
  `editorType: ["figma","dev"]`, `capabilities: ["codegen","inspect"]`,
  `documentAccess: "dynamic-page"`, `networkAccess.allowedDomains: ["none"]`.
- Config storage has three tiers, resolved **document → personal → none**. The
  exact UI labels, which the checks below match against verbatim:
  - Document: `Using the config saved on this file`
  - Personal: `Using your personal config — this file has no shared one`
  - None: `No Tailwind config — generic Tailwind syntax; … Add your config for confirmed names.`
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
3. **Codegen has no latency instrumentation.** `grep` for
   `durationMs|performance|elapsed` across `packages/plugin/src/codegen/` and
   `mode-dev.ts` returns nothing. The linter does surface duration
   (`packages/plugin/src/ui/main.tsx:400` renders `${state.lint.durationMs}ms`),
   so Step 7 has a real instrument and Step 6 does not. Step 6 says how to
   handle that.

## Inputs & resources

Have all of these before starting. Missing any one of them blocks a specific
step, named in the right-hand column.

| Input | Detail | Blocks |
|---|---|---|
| Figma **desktop** app | Record exact version in the env stamp | all |
| Account **A** | Edit access on the test file | 2–9 |
| Account **B** | Separate account, Dev-seat or view-only, on the same file | 4 |
| A shared plugin ID both accounts can install | See Step 1 — this is the gate | 4 |
| A real `tailwind.config.js`/`.ts` (v3) or CSS entry with `@theme` (v4) | The team's real config, not a fixture | 3–9 |
| Matching `package.json` with an exact `x.y.z` `tailwindcss` version | Ranges are rejected by design | 3 |
| A **throwaway** Figma file with local variables | Step 8 writes to it | 8 |
| A large Figma file, ≥1,000 nodes on one page | Record its source URL so the measurement is reproducible | 7 |
| Test file with the nine stable node names | Names listed in `fixtures/figma/css/design/` | 2, 9 |

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
- `fixtures/figma/css/{design,dev}/*.json` and
  `packages/match/fixtures/css/*.json` — Step 9 re-capture only.
- `plans/README.md` — status row for this plan, and the `UNVERIFIED` caveats in
  rows 000–010 that this plan resolves.

**Out of scope** (do NOT touch, even though they look related):

- **Any `packages/*/src/**` file.** This plan measures the 0.1.0 build; changing
  the thing being measured invalidates the measurement. Bugs found become
  written findings, not fixes. The one permitted exception is Step 6's
  instrumentation, and only under the conditions stated there.
- **Submitting to Figma Community, or tagging/publishing to npm.** This plan
  produces the evidence that lets the owner decide. It does not decide.
- **`manifest.json`'s `id` field**, except as Step 1 explicitly directs.
- **The owner-decision rows in `docs/release/approval-packet.md`.** Fill the
  prepared-status rows; leave APPROVED/DEFER/REJECT to the owner.
- **Plan 009 / `@fig-tail/cli`.** REJECTED for this ship.

## Working approach

Branch `verify/in-figma-0.1.0`. One commit per step, message
`verify(NNN): <step> — <PASS|FAIL|BLOCKED summary>`. Commit evidence
screenshots alongside the note edit they support. Do not open a PR unless asked.

Steps 2–9 are independent *except* Step 1 gates Step 4, and Step 3's substeps
are strictly ordered. If a step is BLOCKED, record it and continue to the next
— a partial run with honest rows is the expected outcome, not a failure.

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
not by executor improvisation — see "Breaking the circularity" below. If that
section still reads UNDECIDED, **STOP and get the decision before starting this
step**.

Two escape hatches were *not* resolved when this plan was written, because
`help.figma.com` was unreachable from the authoring environment. Time-box each to
30 minutes before falling back to the decided route:

- Whether a plugin **collaborator/publisher invite** lets a second account run an
  unpublished plugin.
- Whether Community publishing offers an **unlisted / link-only** visibility that
  is not a full public listing.

If either works it breaks the circularity cleanly and beats every option below.
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

### Breaking the circularity — OWNER DECISION: UNDECIDED

Pick one before Step 1 runs. Each has a different blast radius.

| Route | What happens | Cost |
|---|---|---|
| **A. Publish, then verify** | Publish to Community — that ID is the shipping ID — then immediately run Step 4 on account B. On FAIL, unpublish or patch. | A public listing exists before the blocker clears. Requires listing copy that does **not** claim team sharing until Step 4 is PASS. |
| **B. Re-scope 0.1.0 to local/team install** | Do not publish. Verify Steps 2–3 and 5–9 fully; record cross-account as BLOCKED with the plan-tier reason. Ship via manifest import for the team demo. | Community publish slips to 0.2.0. Matches the existing CHANGELOG note that the plugin ships via Community *or* local manifest install. |
| **C. Borrow an org** | Run the cross-account test inside an Organization/Enterprise workspace you have access to, via org-private publishing. | Needs an org you can publish into. The plugin ID there is not the shipping ID, so mechanism evidence transfers but stored config does not. |

**Recommended: B**, unless the Community listing is time-critical. It is the only
route where every published claim stays backed by evidence, and it costs nothing
that a 0.2.0 publish cannot recover once an org or an escape hatch exists. Under
B, Step 4 is *expected* to end BLOCKED — a correct outcome of this plan, not a
failure of it.

If **A** is chosen, add a Step 4a: before submitting, strip every team-sharing
claim from `docs/community/listing.md` and `README.md`, and restore it only on a
Step 4 PASS.

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

For `devmode-discovery.md`, record the two open questions it names: the literal
wording/position Figma renders for the plugin in the language dropdown, and
whether the Inspect entry point is findable without being told where it is.
Answer the second by watching one person who has not seen the plugin try to
find it, and write what they did.

**Check**: the route table in `packages/plugin/notes/platform-preflight.md`
(lines 22–24) has all three rows replaced with observed results plus screenshots,
and the two `devmode-discovery.md` questions have recorded answers.

### Step 3: Walk the tier ladder in this exact order

**Order is load-bearing.** Tiers resolve document → personal → none, so a
higher tier masks the ones below it. Testing document first makes the personal
and none labels unobservable without a reset. Run these in order on one file:

1. **None** — on a file with no config at either tier, select a layer. Expect
   the none label and generic arbitrary suggestions.
2. **Personal** — run setup, Resolve, **Save personal**. Reload. Expect the
   personal label. Do this from a view-only or Dev-Mode context to also prove
   the "no edit access required" claim in one shot.
3. **Document** — **Save on file** (needs edit access). Reload. Expect the
   document label, and confirm it now takes precedence over the personal config
   saved in substep 2.
4. **Restart persistence** — quit Figma entirely, reopen the file, select a
   layer. Expect the document label still.
5. **Preference switch** — with both tiers present, toggle the document↔user
   preference, reload, confirm the switch persisted.

Write down the reset procedure you used to return the file to "no config" — the
next person needs it, and it is not currently documented anywhere.

**Check**: rows 1, 2, 3, 4 and 10 of the table in
`packages/plugin/notes/storage-matrix.md` carry observed labels matching the
verbatim strings in "Current state" above, each with a screenshot; the reset
procedure is written into that file.

### Step 4: Cross-account document read — the Community blocker

Requires Step 1 to have produced a shared plugin ID. Follow the procedure
already written in `packages/plugin/notes/storage-matrix.md` under
"Second-account procedure": account A saves on file, shares the file with
account B, account B installs the **same** plugin ID, opens the file in Dev
Mode, selects a layer.

Account B must see the **document** label and classes resolved from A's config —
not personal, not none. A "none" result here means B is reading a different
namespace: re-check that the plugin IDs genuinely match before recording FAIL.

**Check**: the "Cross-account document read" row in `storage-matrix.md` and in
`docs/release/feature-audit.md` reads PASS or FAIL with both accounts' env
stamps and a screenshot of account B's Dev Mode showing the document label. On
FAIL, apply the fallback already written in `storage-matrix.md`: keep the
personal path labelled, do not claim team setup in Community copy.

### Step 5: Confirm cross-plugin isolation

With a config saved on the file by fig-tail, run
`spikes/figma-platform-isolation/` (a different plugin ID) against the same
file and confirm its read comes back **empty**.

**Check**: the "Cross-plugin isolation" rows in `platform-preflight.md` (line 49)
and `storage-matrix.md` show the observed empty read with a screenshot,
replacing "PASS (by documented semantics)".

### Step 6: Measure codegen latency against the 3 s budget

Per fact 4, 3 s is the hard limit and the code's internal deadline is 2 s. As
noted above, **codegen carries no timing instrumentation**, so there is nothing
in-product to read.

Do the cheapest thing that yields a defensible number:

- Open Figma desktop's plugin console and time the `generate` callback there, if
  the console exposes it; otherwise
- Time by stopwatch across ten selection changes on the heaviest node available
  and record the range, labelling it explicitly as a coarse external measurement.

Record which method was used. Do **not** add timing code to
`packages/plugin/src/` under this plan unless both methods above fail; if they
do, STOP and report rather than editing the build mid-measurement.

**Check**: `packages/plugin/notes/platform-preflight.md` gains a "Codegen
latency" section with the method named, the observed numbers, the node used,
and a verdict against the 3 s hard limit and 2 s internal deadline.

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
  a large tree is **expected behaviour**, not a failure. Record which occurred.

**Check**: `linter-performance.md` and `subtree-performance.md` each carry the
observed number, the file used, and a screenshot of the status line.

### Step 8: Stamping apply matrix — on a throwaway file only

**This step writes to a Figma file.** Use the throwaway file from Inputs. Never
run Apply against the demo file, a shared team file, or any file with variables
someone else depends on.

Confirm the three-row matrix in `platform-preflight.md` (lines 57–59):

- Design editor + edit access → Apply allowed.
- Dev Mode → Apply not offered (dry-run only, per plan 007's design).
- No edit access → Apply denied.

Then confirm the open question in `stamping-verification.md`: does the Inspect
panel actually display `codeSyntax.WEB` on a variable after stamping? Undo via
Figma afterwards and confirm the undo restored the previous state.

**Check**: all three matrix rows and the `stamping-verification.md` question
carry observed results with screenshots; the throwaway file's name is recorded;
undo is confirmed.

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
   guess: use the Dev Mode capture if the two differ, since that is the surface
   the plugin ships on, and write down that the divergence existed.
4. Diff the real captures against the seeded ones and record whether design and
   dev output actually match (the preflight note calls this a provisional PASS).
5. Run `pnpm check`.

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

- `docs/release/feature-audit.md` — the seven CONDITIONAL rows and the blocker row.
- `docs/release/approval-packet.md` — prepared-status rows only.
- `docs/community/publish-runbook.md` — the cross-account prerequisite checkbox.
- `plans/README.md` — this plan's status row, plus the `UNVERIFIED` caveats in
  rows 000–010 that are now resolved. Rows still unverified keep their caveat.

**Check**: `grep -rn "UNVERIFIED" packages/plugin/notes/ docs/ plans/README.md`
returns only rows genuinely still unverified, each with a written reason.

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

- [ ] Every row in `storage-matrix.md`, `platform-preflight.md`,
      `stamping-verification.md`, `linter-performance.md`,
      `subtree-performance.md` and `devmode-discovery.md` reads PASS, FAIL, or
      BLOCKED-with-reason — no `UNVERIFIED`, no bare `PASS`.
- [ ] Every PASS row names an observed value, a committed screenshot, and an env stamp.
- [ ] The cross-account document read row is PASS or FAIL — **or** BLOCKED with
      Step 1's written reason and the chosen circularity route recorded.
- [ ] Both fixture directories hold real captures, and `pnpm check` is either
      exit 0 or its failures are recorded verbatim in `fixture-recapture.md`.
- [ ] `platform-preflight.md` line 73's false claim about fixture consumption is corrected.
- [ ] No file under `packages/*/src/**` was modified.
- [ ] `docs/release/feature-audit.md` and `approval-packet.md` reflect every result.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back — do not improvise — if:

- **Step 9's `pnpm check` fails after re-capture.** Report the failures; never
  edit a captured fixture to go green.
- **The "Breaking the circularity" decision still reads UNDECIDED.** Step 1 does
  not start until the owner has picked A, B or C.
- **Step 1 finds no route to a shared plugin ID.** Do not substitute two
  manifest imports and record the result as a real cross-account test.
- **Route A was chosen and Step 4 comes back FAIL.** Unpublishing a live listing
  is an owner decision, not an executor one.
- **The evidence recorded would be against a plugin ID that is not the shipping
  one**, and nobody has decided whether that is acceptable.
- **Any step would require editing `packages/*/src/**`** to proceed (Step 6's
  narrow exception aside).
- **Stamping Apply is about to run on anything other than the throwaway file.**
- **The plugin does not load at all in Step 2** — everything downstream is moot;
  report immediately rather than working around it.
- **A check's result is ambiguous** (an unfamiliar label, a tier you cannot
  explain). Record what you saw and ask. Do not round it to the nearest
  expected outcome.

## Handoff / after it lands

- **The publish decision is downstream of this plan, not part of it.** With
  evidence recorded, the owner works `docs/release/approval-packet.md` and, on
  a cross-account PASS plus approval, `docs/community/publish-runbook.md`.
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
