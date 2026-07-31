# Plan 010: Package, document, and publish

> **Executor instructions**: This plan is self-contained. Read it in full and
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
> **Drift check (run first)**: this revision was written at commit `7932c82`.
> Run `git log --oneline 7932c82..HEAD`, read `plans/README.md`, and confirm
> which of plans 005–009 are DONE before writing a word of documentation —
> documenting an unbuilt feature is the main failure mode here.
>
> **⚠️ Steps 4 and 5 are outward-facing and irreversible-ish.** Publishing to
> npm and to the Figma Community puts the owner's name on public artefacts.
> Neither happens without the owner's explicit go-ahead — see Step 3.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED — low technical risk, real reputational risk. This is the plan
  that makes the work public under the owner's name.
- **Depends on**: 005 (with prerequisite 000 and plans 001–004, the minimum shippable product). Plans
  006–009 are documented if done and omitted if not.
- **Category**: docs
- **Planned at**: commit `7932c82`, 2026-07-31 — dependencies are prospective.

## Build sheet

Use Node 20+ and pnpm. Preserve the landed workspace scripts and strict
TypeScript settings. Before every commit run
`pnpm -r typecheck && pnpm -r lint && pnpm -r build && pnpm -r test`.

Do the tasks below **in order, one at a time**. Each task's *Done when* is a
command or a named in-Figma check; it must produce the stated result before you
start the next task. Commit after each task. Everything after this section is
**reference** — read a section when a task points you at it.

### ⚠ Tasks 4 and 5 are public and effectively irreversible

They publish to npm and submit to the Figma Community under the owner's name.
**Neither happens without the owner's explicit approval in task 3.** Do not run
ahead.

### Files this plan creates

| Path | Purpose | Task |
|---|---|---|
| `docs/release/feature-audit.md` | durable verification of what actually shipped | 1 |
| `README.md` (full rewrite) | the front door | 2 |
| `docs/setup.md`, `docs/troubleshooting.md` | the long versions | 2 |
| `CONTRIBUTING.md` | incl. the write-safety invariant | 2 |
| `CHANGELOG.md`, package metadata | release prep | 3 |
| `.github/workflows/ci.yml` (edit), `release.yml` | harden existing CI + tagged publish | 3 |
| `docs/community/**` listing copy, icon, cover, screenshots | approval packet | 3 |
| `plans/README.md` (edit) | final statuses | 6 |

### Tasks

| # | Do this | Files it may touch | Done when |
|---|---|---|---|
| 1 | Audit what actually shipped. Verify each DONE plan's headline feature in the release build, including the second-account private-storage read. Write evidence, versions, accounts/seats, and outcomes to the release audit. | `docs/release/feature-audit.md` | audit matches statuses; cross-account read is PASS (UNVERIFIED/FAIL stops Community publication and team-sharing copy); any other mismatch → STOP |
| 2 | Write all the docs, describing **only** what task 1 verified. Structure per Step 2, including the three config tiers and why unreadable config parts give raw values. | `README.md`, `docs/**`, `CONTRIBUTING.md` | **From a fresh clone on a clean machine**, follow the developer path and then the designer path literally. Both work end to end. Fix every place you had to improvise |
| 3 | Version 0.1.0, changelog, metadata, harden plan 001's CI, add OIDC release workflow, prepare Community assets, package dry-runs, and quiet secret audit. Verify all dist inspections rebuild first. Then request separate channel approvals. | release/package/CI/community files | frozen CI passes; publishable tarballs/bins clean; secret audit quiet; approval packet complete; owner explicitly approves each channel |
| 4 | *(Only with npm approval.)* Tag and publish `@fig-tail/theme`, `@fig-tail/match`, and `@fig-tail/cli` if plan 009 shipped, using npm trusted publishing with provenance. | tag + release workflow | Every intended package is on npm at 0.1.0 with provenance; a clean-directory install works; tarballs contain no source |
| 5 | *(Only with Community approval and task-1 cross-account PASS.)* Find and record the current official Figma publishing guide, re-check distribution, and submit approved assets. | listing submission only | live, installable from a different account; that account reads the file config and completes README path; development/release plugin identity preserves private data access |
| 6 | Update `plans/README.md`: DONE / TODO / REJECTED with one-line rationales, plus a "Shipped 0.1.0" note. | `plans/README.md` | Every row matches reality; nothing left IN PROGRESS |

**Task 3 is a hard gate.** Nothing outward-facing ships without the owner saying
so, and this is the one plan whose actions cannot be quietly reverted.

---

## Why this matters

fig-tail's whole premise is that setup is worth it: one person drops a config
into the plugin once, and every developer gets class names from the real config.
The optional CLI appears only when the in-plugin resolver reports a complex
config it cannot fully read. Even the normal one-time setup is a larger ask than
"install a plugin", and it fails at the first confusing step.
The documentation is not a wrapper around the product — for a tool with a
two-part setup, it *is* part of the product.

Publishing matters for a second reason. The owner is on Figma Starter and
Professional tiers with no Organization plan, so **private plugin distribution
is unavailable**. Public Figma Community listing, or per-developer local
installation from source, are the only two options. Both need documentation
someone else can follow without asking questions.

## Context the executor needs

### What ships

Check `plans/README.md` for what is actually DONE. Plan 000 must have passed its
platform gates; the minimum shipped implementation is 001–005:

- `@fig-tail/theme` — the Tailwind config resolver, v3 and v4 (published; the
  schema and validator are useful on their own)
- `@fig-tail/match` — the engine (published; independently useful)
- `@fig-tail/plugin` — not published to npm; it ships to the Figma Community
- `@fig-tail/cli` — **only if plan 009 shipped.** It is an escape hatch, not a
  setup step, and the docs must place it that way (see Step 2).

### Distribution constraints, verified 2026-07-31

- The owner's Figma plans are Starter tier except one Professional team. **No
  Organization or Enterprise plan**, so private org-only plugin publishing is
  not available.
- Plugin development and local installation require the **Figma desktop app**.
- Plan 003 registered the development plugin and committed its real manifest ID
  before import testing. Do not replace it with a placeholder or assume
  submission is the first time an ID exists.
- Figma's submission and review flow is time-sensitive. Step 5 re-reads the
  current official documentation instead of relying on remembered timings or
  rejection patterns.

**Documentation for this step was not verified when this plan was written.**
Figma's plugin-publishing flow changes, and no publishing doc was confirmed
reachable. Before Step 5, locate the current official publishing guide from
[developers.figma.com](https://developers.figma.com/docs/plugins/plugin-quickstart-guide/)
and Figma's help centre ([Create a plugin for development](https://help.figma.com/hc/en-us/articles/360042786733-Create-a-classic-plugin-for-development)
is the local-install counterpart), read it, and **record the URL in this plan**
so the next person does not repeat the search. Do not follow a remembered
process for an outward-facing, reviewed submission.

**Verify the tier before Step 5.** If the account has moved to Org/Enterprise
since 2026-07-31, private publishing becomes available and is probably the
better choice — raise it with the owner rather than proceeding.

### What a reader needs, in order

Two audiences with different entry points. Structure the docs around them:

1. **A developer who was handed a Figma link.** Wants: install the plugin, open
   Dev Mode, read classes. Does not care about the CLI. Should be reading for
   under two minutes before it works.
2. **A designer or lead setting it up.** Wants: drop the config into the plugin,
   understand what the resolver could not read, and understand what the linter
   and stamping do. The CLI appears only as the complex-config escape hatch.

Lead with the developer path. It is the larger audience and the shorter read.

## Inputs & resources

| Purpose | Command | Expected on success |
|---|---|---|
| Full check | `pnpm -r typecheck && pnpm -r lint && pnpm -r build && pnpm -r test` | exit 0 |
| Build all | `pnpm -r build` | every package's `dist/` present |
| Theme dry-run | `pnpm --filter @fig-tail/theme publish --dry-run --no-git-checks` | clean file list |
| Match dry-run | `pnpm --filter @fig-tail/match publish --dry-run --no-git-checks` | clean file list |
| CLI dry-run | `pnpm --filter @fig-tail/cli publish --dry-run --no-git-checks` | run only if plan 009 is DONE; clean file list |
| Plugin bundle | `pnpm --filter @fig-tail/plugin build && wc -c packages/plugin/dist/main.js packages/plugin/dist/ui.html` | main under 400 kB, ui under 500 kB |

Needed on hand:

- **npm publish rights** for the `@fig-tail` scope and an npm trusted-publisher
  configuration bound to this GitHub repository/workflow. The release workflow
  uses GitHub OIDC (`id-token: write`) and publishes with provenance; it does
  not require a long-lived npm token. A token is an explicit owner-approved
  fallback only if trusted publishing is unavailable for a documented reason,
  and its value is never pasted, echoed, or committed.
- A **Figma account with Community publishing enabled** (the owner's).
- Screenshots of both Dev Mode surfaces (plans 004 and 005) and the setup UI.

## Scope

**In scope**:

- Root `README.md` — the full rewrite
- `docs/setup.md`, `docs/troubleshooting.md`
- `CONTRIBUTING.md`, `CHANGELOG.md`
- `package.json` metadata for the two required published packages and
  `@fig-tail/cli` only when plan 009 is DONE (description,
  keywords, repo, license, `files`, `exports`)
- `.github/workflows/ci.yml` — typecheck, lint, build, test on push and PR
- `.github/workflows/release.yml` — npm trusted publishing on tag using OIDC and
  provenance, limited to the explicit publishable packages
- Figma Community listing assets: icon, cover, screenshots, description
- The Community submission itself (Step 5, gated on Step 3)

**Out of scope**:

- **Any feature work.** If something is broken, file it and fix it in its own
  plan. Documentation work must not become "and while I was in there…".
- **Documenting features that are not DONE** in `plans/README.md`. Aspirational
  docs are worse than missing docs.
- A marketing site, a landing page, or a domain. The README and the Community
  listing are enough.
- Analytics or telemetry of any kind. The plugin has `allowedDomains: ["none"]`
  and that is a feature worth stating in the docs.
- Publishing `@fig-tail/plugin` to npm — it is not a library.

## Working approach

- Branch as instructed. Commit per step, prefixed `010-N:`.
- Write the docs by **following them literally on a clean machine or a fresh
  clone**. Every instruction you could not follow exactly is a bug in the docs.
- Steps 4 and 5 are gated on Step 3. Do not run ahead.

## Steps

### Step 1: Audit what actually shipped

Read `plans/README.md` and confirm each plan's status against the code — do not
trust the table alone. For each DONE plan, verify its headline feature in the
fresh release build. Write the versions, commands, manual steps, screenshots,
and result to `docs/release/feature-audit.md`, not only a commit message.

Repeat private document-storage reading from a genuinely different account with
view-only or Dev-seat access. PASS is required before Community submission or
copy that promises one-person team setup. FAIL/UNVERIFIED leaves npm publication
available and the personal-config path usable, but Community submission stops.

Anything the table calls DONE that does not work is a STOP condition: either the
status is wrong or the feature regressed, and both need the owner before you
document anything.

**Check**: the committed audit lists every shipped feature and the release-build
cross-account matrix, matching `plans/README.md`.

### Step 2: Write the documentation

**Root `README.md`** — the front door, in this order:

1. One sentence on what it does, and one on what makes it different (real
   config, not arbitrary values).
2. A screenshot of the Dev Mode panel showing real class names. Lead with it.
3. **"For developers"** — install the plugin, open Dev Mode, read classes. Under
   two minutes. Use the one-sentence answer recorded in plan 005 Step 1
   (`packages/plugin/notes/devmode-discovery.md`) for what a first-time developer
   actually has to do — do not write this from memory.
   Cover **both** surfaces: the Code section and the Inspect panel.
4. **"For designers / setting it up"** — drop in `tailwind.config.js` (v3) or
   CSS entry (v4), plus `package.json` for version evidence; explain that only an
   exact `x.y.z` spec confirms defaults and ranges leave them unconfirmed, and that
   raw source is processed locally and discarded. Review and save. No CLI.
5. **"If you can't save to the file"** — the three config-source tiers from plan
   003, in one short table: saved on the file (everyone gets it), saved in your
   settings (just you, needs no edit access), or no config (raw values plus a
   prompt). Frame tier 2 as an ordinary option, not a workaround — a developer
   with a view-only seat should not feel locked out.
6. What the confidence levels mean; why a near-match is reported rather than
   emitted; and why fig-tail shows `bg-[#3b82f6]` instead of a token name when
   it could not read part of your config. That last one is the question the
   Community listing will get most often — answer it in the README before
   someone has to ask.
7. The linter and stamping, **if 006/007 shipped** — with stamping's write
   behaviour stated plainly and early.
8. Privacy: no network access, nothing leaves Figma, no telemetry.
9. Limitations, honestly: what it does not do (no component generation, no
   assets, no responsive variants), the Tailwind versions supported, and which
   config patterns the in-plugin resolver cannot read (from plan 001 Step 9).
10. Contributing, licence.

**`docs/setup.md`** — the long version: monorepo setups, Tailwind v3 vs v4
specifics, what the resolver can and cannot read from a config (from plan 001
Step 9), what to do when it reports unresolved entries, keeping the stored config
fresh, and — **only if plan 009 shipped, and only in its own section after the
normal path** — the CLI escape hatch.

**`docs/troubleshooting.md`** — one entry per real failure, each with the exact
symptom text a user sees:

- "No Tailwind config yet" in Dev Mode
- The resolver reported unresolved entries — what each `reason` means and how to
  fix it
- Validation errors on drop (which file is the right one; v4 needing two files)
- Classes look wrong / arbitrary values everywhere (usually a stale or wrong
   config). Explain that bundled defaults are withheld without exact version
   evidence, even within the same major.
- The plugin does not appear in Dev Mode's language dropdown
- The plugin does not appear in the Inspect panel
- A second developer cannot see the config
- Everything is reported as drift (usually a mismatched config)

**`CONTRIBUTING.md`** — package layout, `pnpm install`, the check commands,
how to run the plugin locally (desktop app required), **and the write-safety
invariant with a pointer to plans 003 and 007.** A contributor must learn that
rule before their first PR, not from a failing lint rule.

**Check**: from a **fresh clone on a clean machine**, follow the README's
developer path and then its designer path, literally, without consulting any
other file or memory. Both must work end to end. Note every place you had to
improvise and fix it before moving on.

### Step 3: Prepare the release and get explicit go-ahead

- Set `version: 0.1.0` across packages; write `CHANGELOG.md` covering what
  shipped.
- Add package metadata: description, keywords, `repository`, `license`, `files`
  (dist + README + LICENSE only), `exports`.
- Harden plan 001's existing `.github/workflows/ci.yml`: exact Corepack/pnpm,
  `pnpm install --frozen-lockfile`, typecheck, lint, build, tests with configured
  coverage thresholds, and all fresh bundle probes on push and PR. Do not
  replace it with a looser release-only workflow.
- Add `.github/workflows/release.yml`: tag-triggered, least-privilege
  permissions (`contents: read`, `id-token: write`), pinned supported Node/npm,
  `npm publish --access public --provenance`, and explicit steps for only the packages that
  actually ship. Configure each package's npm trusted-publisher mapping to this
  repository and exact workflow filename. Do not add `NODE_AUTH_TOKEN` or a
  long-lived npm secret in the normal path.
- Run a separate `publish --dry-run --no-git-checks` for
  `@fig-tail/theme`, `@fig-tail/match`, and conditionally `@fig-tail/cli`.
  Never use recursive publish, which would include private/plugin workspaces.
  Read every file list; confirm no TypeScript source, fixtures, `plans/`, or
  `spike/` directories are included.
  Every size/safety inspection must invoke the relevant build first in the same
  job; CI must fail if an artifact is stale or absent.
- Prepare the full Community approval packet now, before asking: final listing
  copy, icon, cover, screenshots, support URL, declared capabilities, and the
  current manifest permission list. Store it under `docs/community/`. Step 5
  submits these approved assets; it does not invent them after approval.
- Run a non-printing history presence check:
  `git log -p --all | rg -q '(npm_[A-Za-z0-9]{20,}|figd_[A-Za-z0-9_-]{20,}|figu_[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})'`.
  Expected exit is **1** (no match). Never run a command that prints a matching
  credential. If the exit is 0, STOP and ask the owner to run a redacting secret
  scanner/rotation workflow; do not expose the value in logs.

**Then stop and ask the owner**, presenting: the package names and versions, the
dry-run file lists, the Community listing text and images prepared above, and
the fact that the account tier permits only public Community distribution.

**Check**: dry-run output reviewed and clean; the owner has explicitly approved
(a) npm publication and (b) Figma Community submission. **Do not proceed to
Steps 4 or 5 without both.** If only one is approved, do that one.

### Step 4: Publish the npm packages *(gated on Step 3)*

After the owner separately configures/confirms npm trusted publishers, tag and
let the release workflow publish `@fig-tail/theme` and `@fig-tail/match`, plus
`@fig-tail/cli` **only if plan 009 shipped**. Verify provenance on each package
page. Do not silently fall back to a token if OIDC fails.

**Check**: each intended published package appears on npm at 0.1.0 with
provenance; the tarballs contain no source, fixtures, plans, or spikes. If the
CLI shipped, `npx @fig-tail/cli export` from a trusted fixture checkout requires
and honors its explicit config-execution flag.

### Step 5: Submit to the Figma Community *(gated on Step 3)*

Use the already-approved listing assets and copy from `docs/community/`:

- **Name**: fig-tail
- **Tagline**: one line — Tailwind classes from your own config, in Dev Mode.
- **Description**: what it does; that one person drops in the team's Tailwind
  config once and everyone else just installs the plugin; that it makes **no
  network requests**; which Tailwind versions it reads; and what it does not do
  (no component generation, no assets, no responsive variants). Set expectations
  honestly — most Community plugin complaints are unmet expectations, and the
  drop-in-your-config setup is unusual enough to state upfront.
- **Icon** and **cover image**.
- **Screenshots**: the Dev Mode panel with real classes; the drift section; the
  Inspect panel; the setup screen showing a resolved config; the linter report
  if 006 shipped.
- Support link → the repo's issues page.

Re-verify the account tier before submitting (see "Context"). Then submit and
record the review outcome. On rejection, address the stated reason and
resubmit — do not change the product to satisfy a listing note without checking
with the owner.

**Check**: the plugin is live in the Community, installable from a **different**
Figma account, and that account can complete the README's developer path against
a file that already has a theme configured. Confirm the published plugin maps to
the real manifest ID committed during plan 003; no placeholder ever ships.

### Step 6: Close out the plans

Update `plans/README.md`: mark shipped plans DONE, mark anything not built TODO
or REJECTED with a one-line rationale, and add a short "Shipped 0.1.0" note with
the date and what it contained.

**Check**: `plans/README.md` accurately reflects reality — every row's status
matches the code, and nothing is left IN PROGRESS.

## Validation plan

- **Clean-machine walkthrough**: both README paths, followed literally from a
  fresh clone. This is the primary validation; everything else is secondary.
- **A second person's walkthrough**, if anyone is available. The gap between
  "the author can follow it" and "a stranger can follow it" is where
  documentation actually fails.
- **CI green** on the release commit.
- **Publish dry-run** file lists reviewed for leaked source or secrets.
- **Post-publish smoke test**: install from npm and from the Community on a
  different account, and complete the developer path.
- **Secret-presence audit**: the quiet `git log -p --all | rg -q …` check exits
  1 and prints no match. Run it before publishing, not after; a 0 exit triggers
  the redacting scan/rotation STOP path.

## Done criteria

ALL must hold.

- [ ] `pnpm -r typecheck && pnpm -r lint && pnpm -r build && pnpm -r test` → exit 0
- [ ] README, `docs/setup.md`, `docs/troubleshooting.md`, `CONTRIBUTING.md`,
      `CHANGELOG.md` all exist and describe **only** shipped features
- [ ] The docs describe all three config-source tiers, and present the
      personal-config tier as an ordinary option rather than a workaround
- [ ] The docs are honest about which config patterns the in-plugin resolver
      cannot read, and what to do about each
- [ ] The docs explain why unreadable parts of a config produce raw values
      rather than Tailwind's defaults — a stranger should understand that this
      is deliberate, not a bug
- [ ] `CONTRIBUTING.md` states the write-safety invariant and points to plans
      003 and 007
- [ ] Both README paths verified end to end from a fresh clone
- [ ] `docs/release/feature-audit.md` contains durable evidence for every DONE
      feature and a PASS/FAIL/UNVERIFIED second-account storage result
- [ ] CI workflow runs on push and PR and is green
- [ ] Release workflow uses least-privilege GitHub OIDC trusted publishing with
      provenance and contains no long-lived npm credential path by default
- [ ] Publish dry-run shows no source, fixtures, plans, or spikes in the tarballs
- [ ] The quiet secret-presence audit exits 1 without printing a match
- [ ] The owner made and recorded a separate approve/defer/reject decision for
      npm publication and Community submission; only approved channels ran
- [ ] *(If npm approved)* every intended package (two, or three when plan 009
      shipped) lives on npm at 0.1.0 with provenance, verified by a clean install
- [ ] *(If Community approved)* the plugin is live and installable from a
      different account, mapped to the proven plugin ID, and that account reads
      the file's private config; Community cannot run on FAIL/UNVERIFIED
- [ ] `plans/README.md` reflects reality with no IN PROGRESS rows
- [ ] No files outside the in-scope list were changed

## STOP conditions

Stop and report back — do not improvise — if:

- **A feature `plans/README.md` calls DONE does not actually work.** Do not
  document around it and do not fix it here.
- The clean-machine walkthrough fails at any step and the fix is a code change
  rather than a documentation change.
- The owner has not approved publication. **Nothing outward-facing ships without
  it** — this is the one plan whose actions cannot be quietly reverted.
- The release-build cross-account private-storage read is FAIL or UNVERIFIED and
  Community publication is requested. Stop Community submission; npm may proceed
  if separately approved.
- The npm scope `@fig-tail` is taken, or publishing rights are unavailable.
- npm trusted publishing cannot be configured or the OIDC release fails. Stop
  and show the owner the failure; use a long-lived token only after a separate,
  explicit security decision.
- The Figma account tier has changed such that private publishing is now
  possible — that likely changes the distribution decision.
- Any credential appears in git history, a workflow file, or a published
  tarball. Stop, report, and recommend rotating it.
- The Community submission is rejected for a reason that implies a product
  change rather than a listing change.
- A step's check fails twice after a reasonable attempt.

## Handoff / after it lands

- **Watch the first week of issues.** For a tool with a two-part setup, early
  issues are almost always documentation gaps, not bugs. Fold the answers back
  into `docs/troubleshooting.md`.
- **If 006–009 were not built**, real usage is the best input on which to do
  next. Ship 0.1.0, then decide.
- **What a reviewer should scrutinise most**: the clean-machine walkthrough, and
  the claim that the docs describe only shipped features. Ask which features
  were verified by hand in Step 1.
- **Deliberately deferred**: a landing page, video walkthroughs, and any
  telemetry. The last one is a deliberate permanent decision, not a backlog
  item — `allowedDomains: ["none"]` is part of what the docs promise.
