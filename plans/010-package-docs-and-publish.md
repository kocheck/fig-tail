# Plan 010: Package, document, and publish

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. If anything in "STOP conditions" occurs,
> stop and report — do not improvise. When done, update the status row for this
> plan in `plans/README.md`.
>
> **Drift check (run first)**: `git log --oneline -20` and read
> `plans/README.md`. This plan documents whatever has actually shipped. Confirm
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
- **Depends on**: 005 (with 001–004, the minimum shippable product). Plans
  006–009 are documented if done and omitted if not.
- **Category**: docs
- **Grounded at**: the commit at which plan 005 landed, or later.

## Why this matters

fig-tail's whole premise is that setup is worth it: run a CLI, paste a file
once, and every developer gets class names from the real config. That is a
larger ask than "install a plugin", and it fails at the first confusing step.
The documentation is not a wrapper around the product — for a tool with a
two-part setup, it *is* part of the product.

Publishing matters for a second reason. The owner is on Figma Starter and
Professional tiers with no Organization plan, so **private plugin distribution
is unavailable**. Public Figma Community listing, or per-developer local
installation from source, are the only two options. Both need documentation
someone else can follow without asking questions.

## Context the executor needs

### What ships

Check `plans/README.md` for what is actually DONE. The minimum is 001–005:

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
- Publishing to the Figma Community assigns the plugin its permanent ID. The
  manifest currently carries a placeholder (plan 003 Step 2) — publishing is
  what fills it in.
- Figma reviews Community submissions. Review takes days, and rejections
  usually cite the description, the listing images, or permissions.

**Verify the tier before Step 5.** If the account has moved to Org/Enterprise
since 2026-07-31, private publishing becomes available and is probably the
better choice — raise it with the owner rather than proceeding.

### What a reader needs, in order

Two audiences with different entry points. Structure the docs around them:

1. **A developer who was handed a Figma link.** Wants: install the plugin, open
   Dev Mode, read classes. Does not care about the CLI. Should be reading for
   under two minutes before it works.
2. **A designer or lead setting it up.** Wants: run the CLI in the codebase,
   paste the file, understand what the linter finds and what stamping does.
   Ten minutes, and they need to understand the tradeoffs.

Lead with the developer path. It is the larger audience and the shorter read.

## Inputs & resources

| Purpose | Command | Expected on success |
|---|---|---|
| Full check | `pnpm -r typecheck && pnpm -r lint && pnpm -r test` | exit 0 |
| Build all | `pnpm -r build` | every package's `dist/` present |
| Package dry-run | `pnpm -r publish --dry-run --no-git-checks` | no errors, correct file lists |
| Plugin bundle | `pnpm --filter @fig-tail/plugin build && du -b packages/plugin/dist/*` | main under 400 kB, ui under 500 kB |

Needed on hand:

- **npm publish rights** for the `@fig-tail` scope — credential type: an npm
  automation token, stored in the owner's password manager and in GitHub Actions
  secrets. **Never commit it, never paste it into a file, never echo it.** If it
  does not exist yet, the owner creates it; you do not.
- A **Figma account with Community publishing enabled** (the owner's).
- Screenshots of both Dev Mode surfaces (plans 004 and 005) and the setup UI.

## Scope

**In scope**:

- Root `README.md` — the full rewrite
- `docs/setup.md`, `docs/troubleshooting.md`
- `CONTRIBUTING.md`, `CHANGELOG.md`
- `package.json` metadata for the three published packages (description,
  keywords, repo, license, `files`, `exports`)
- `.github/workflows/ci.yml` — typecheck, lint, test, build on push and PR
- `.github/workflows/release.yml` — npm publish on tag (using the stored token
  secret; the workflow references it, never contains it)
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
trust the table alone. For each DONE plan, verify its headline feature works in
the built plugin. Write the result as a checklist in the commit message.

Anything the table calls DONE that does not work is a STOP condition: either the
status is wrong or the feature regressed, and both need the owner before you
document anything.

**Check**: a written list of shipped features, each verified by hand, matching
`plans/README.md`.

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
   your CSS entry (v4), review what fig-tail could and could not read, save. No
   CLI, no install.
5. What the confidence levels mean, and specifically why a near-match is
   reported rather than emitted.
6. The linter and stamping, **if 006/007 shipped** — with stamping's write
   behaviour stated plainly and early.
7. Privacy: no network access, nothing leaves Figma, no telemetry.
8. Limitations, honestly: what it does not do (no component generation, no
   assets, no responsive variants), and the Tailwind versions supported.
9. Contributing, licence.

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
  config)
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
- Add `.github/workflows/ci.yml`: typecheck, lint, test, build on push and PR.
- Add `.github/workflows/release.yml`: publish on tag, reading the npm token
  from a repository secret. The workflow **references** the secret name; it
  never contains a value.
- Run `pnpm -r publish --dry-run --no-git-checks` and read the file lists.
  Confirm no source, no fixtures, no `plans/`, and no `spike/` directories are
  included.

**Then stop and ask the owner**, presenting: the package names and versions, the
dry-run file lists, the draft Community listing text and images from Step 4, and
the fact that the account tier permits only public Community distribution.

**Check**: dry-run output reviewed and clean; the owner has explicitly approved
(a) npm publication and (b) Figma Community submission. **Do not proceed to
Steps 4 or 5 without both.** If only one is approved, do that one.

### Step 4: Publish the npm packages *(gated on Step 3)*

Tag and let the release workflow publish `@fig-tail/theme` and `@fig-tail/match`,
plus `@fig-tail/cli` **only if plan 009 shipped**.

**Check**: each published package appears on npm at 0.1.0; the tarballs contain
no source, fixtures, plans, or spikes. If the CLI shipped, `npx @fig-tail/cli
export` works from a clean directory with no local checkout.

### Step 5: Submit to the Figma Community *(gated on Step 3)*

Listing assets and copy:

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
a file that already has a theme configured. The manifest's placeholder ID has
been replaced with the assigned ID and committed.

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
- **Secret audit**: `git log -p | grep -iE 'npm_[A-Za-z0-9]|figd_|figu_'` over
  the full history returns nothing. Run it before publishing, not after.

## Done criteria

ALL must hold.

- [ ] `pnpm -r typecheck && pnpm -r lint && pnpm -r test && pnpm -r build` → exit 0
- [ ] README, `docs/setup.md`, `docs/troubleshooting.md`, `CONTRIBUTING.md`,
      `CHANGELOG.md` all exist and describe **only** shipped features
- [ ] `CONTRIBUTING.md` states the write-safety invariant and points to plans
      003 and 007
- [ ] Both README paths verified end to end from a fresh clone
- [ ] CI workflow runs on push and PR and is green
- [ ] Release workflow references the npm token as a secret and contains no
      credential value
- [ ] Publish dry-run shows no source, fixtures, plans, or spikes in the tarballs
- [ ] The secret audit over full git history returns nothing
- [ ] The owner explicitly approved npm publication and Community submission
- [ ] *(If approved)* all three packages live on npm at 0.1.0, verified by a
      clean install
- [ ] *(If approved)* the plugin is live in the Community and installable from a
      different account, and the assigned plugin ID is committed to the manifest
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
- The npm scope `@fig-tail` is taken, or publishing rights are unavailable.
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
