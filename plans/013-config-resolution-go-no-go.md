# Plan 013: Find out whether fig-tail can read the pilot team's config

> **Executor instructions**: This plan is a **gate**. It has one job: answer a
> yes/no question before anyone spends more effort. If the answer is no, STOP and
> report — do not proceed to any other plan.

## Status

- **Priority**: P0 — **runs before every other plan in the series**
- **Effort**: S (half a day, most of it waiting for someone to send you a file)
- **Risk**: LOW to run, HIGH to skip
- **Depends on**: none
- **Category**: research
- **Grounded at**: `abb2c1b` — 2026-09-10
- **Serves**: [GOAL-developer-adoption.md](GOAL-developer-adoption.md) — all four
  conditions are void if this fails

## Why this matters

fig-tail's entire value is emitting `bg-brand-500` where every competing plugin
emits `bg-[#3b82f6]`. If it cannot read the pilot team's Tailwind config, it
emits `bg-[#3b82f6]` — correctly, honestly, and worthlessly. The plugin would
work exactly as designed and deliver nothing anyone would miss.

This is not hypothetical. `plans/README.md:352` records plan 001 landing at
**4/8** wild fixtures fully resolved, against its own 6/8 bar.
`packages/theme/spike/FINDINGS.md:25-31` names what the failing half have in
common:

> - External `presets` / cross-package `require` (with-preset, monorepo-extend)
> - Plugin packages (`@tailwindcss/forms`, `@tailwindcss/typography`)
> - CSS-variable colour strings that are not absolute colours (shadcn-like)

Those are not exotic. A monorepo with `@acme/tailwind-config`, a shadcn project,
or anything importing `@tailwindcss/typography` sits in the failing half.

The failure direction is the harsh one. Per `plans/README.md:207-209`, a
*replacing* `theme.colors` that cannot be evaluated marks the namespace
**unknown**, not default — so every colour falls to a raw value.

A council of five advisors reviewed this program and all five independently put
this check first. It costs half a day. Running it after the pilot costs the pilot.

## Context the executor needs

**The instrument already exists and needs no new code.** `packages/cli` is
present, buildable, and marked `"private": true` — plan 009 was REJECTED for
*shipping* a CLI, not for having one.

Critically, **the CLI and the plugin resolve through the same function**. Both
call `resolveTheme` from `@fig-tail/theme` with the same `sources: [{ name, text }]`
shape — the CLI at `packages/cli/src/index.ts:35-38`, the plugin at
`packages/plugin/src/setup.ts:1`. The CLI adds Node file reading around it and
nothing else. `resolveTheme` takes **text**, not a filesystem, so it has no
Node-only escape hatch the plugin lacks. A CLI result is therefore a faithful
proxy for what the plugin will do in the browser.

Two behaviours to know before reading output:

- `packages/cli/src/index.ts:20-22` refuses to read project files without
  `--trust-project`.
- `packages/cli/src/index.ts:29-33` only accepts an **exact** `x.y.z`
  `tailwindcss` version from `package.json`. A range (`^3.4.0`) is ignored and
  bundled defaults stay unconfirmed — which is by design (disposition F02) and
  will show up in the report.
- `packages/cli/src/index.ts:39` **throws** when nothing resolved at all. A crash
  here is a result, not a bug — record it.

## Inputs & resources

| Input | Detail | Notes |
|---|---|---|
| The pilot team's real `tailwind.config.js`/`.ts` or v4 CSS entry | Not a fixture. Not your own. | Ask for it today — this is the long pole |
| Their `package.json` | For the exact `tailwindcss` version | Optional but changes the verdict |
| Node + pnpm | `corepack enable && pnpm install` | |

| Purpose | Command | Expected |
|---|---|---|
| Build the CLI | `pnpm --filter @fig-tail/cli build` | `packages/cli/dist/cli.js` exists |
| Resolve | `node packages/cli/dist/cli.js export --entry <their-config> --out /tmp/tokens.json --trust-project --package-json <their-package.json>` | prints `Wrote /tmp/tokens.json (N unresolved)` |

## Scope

**In scope**: running the resolver, reading the output, writing the verdict into
`docs/release/config-go-no-go.md` (new file), and updating this plan's status row.

**Out of scope**:
- **Fixing anything.** If the config does not resolve, that is the finding. Do
  not improve the resolver here; that becomes its own plan with a real reason to
  exist.
- **Figma.** This step needs no Figma at all.
- **Any other plan.** Nothing else starts until this reports.

## Steps

### Step 1: Get the real config

Ask the pilot team for `tailwind.config.js`/`.ts` (or the v4 CSS entry with
`@theme`) and `package.json`. Do not substitute a fixture, your own config, or a
reconstruction. A sample of one is the point here — it is the *right* one.

**Check**: both files are on disk and came from the team, not from this repo.

### Step 2: Resolve it

Build the CLI and run the export command above. If it throws, capture the error
verbatim.

**Check**: either `/tmp/tokens.json` exists with a printed unresolved count, or a
verbatim error is recorded.

### Step 3: Read the report, not the exit code

Open `/tmp/tokens.json`. A zero exit is not a pass. Answer each of these in
writing:

1. **Are colours resolved to names?** Look for the team's brand colours as named
   token keys. If `unknownNamespaces` includes `colors`, every colour will emit a
   raw value in the plugin — the single most important line in the file.
2. **What is in the unresolved list?** For each entry, say whether you understand
   it. Per the demo checklist at `plans/README.md:288-290`, "it couldn't read part
   of our config and I don't know why" is the one answer that costs trust.
3. **Are bundled defaults confirmed?** If the version was a range rather than
   exact `x.y.z`, default-derived namespaces are unconfirmed and spacing/radius
   may be unknown too.
4. **Which namespaces are usable?** Colours, spacing, radius, typography — name
   the ones that resolved and the ones that did not.

**Check**: `docs/release/config-go-no-go.md` answers all four with quoted values
from the output.

### Step 4: Call it

Write one of three verdicts, with the reasoning:

- **GO** — colours and spacing resolve to names, and every unresolved entry is
  understood and explainable. Proceed to plan 014.
- **PARTIAL** — some namespaces resolve, others do not. **Not automatically a
  go.** State plainly what a developer would see for the namespaces that failed,
  and whether the plugin still beats reading Figma's CSS panel. That is a
  judgment call and it belongs to the owner, not the executor.
- **NO-GO** — colours are unknown, or the resolve threw. Stop the program and
  report. The follow-up is a resolver-coverage plan aimed at what actually broke,
  which is a far better-grounded plan than one written speculatively today.

**Check**: the verdict is written, and if it is PARTIAL or NO-GO, no downstream
plan has been started.

## Validation plan

- The report quotes actual values from `/tmp/tokens.json` rather than describing
  them.
- A second person can read the verdict and say what a developer would see on a
  brand-coloured layer without re-running anything.
- Sanity check: run the same command against
  `fixtures/configs/v3/monorepo-extend.js` (a known-partial fixture) and confirm
  the report format distinguishes it from the team's result. If both look
  identical, the report is not saying enough.

## Done criteria

- [ ] The team's real config and `package.json` were used.
- [ ] `docs/release/config-go-no-go.md` exists with all four Step 3 answers,
      quoting real output.
- [ ] A GO / PARTIAL / NO-GO verdict is recorded with reasoning.
- [ ] On PARTIAL or NO-GO, no downstream plan has been started.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- **The team cannot or will not share their config.** That is itself a finding
  about the pilot's viability — report it rather than substituting a fixture.
- **The resolve throws.** Record the error; do not debug the resolver here.
- **The verdict is PARTIAL.** Do not decide it yourself. Put it to the owner with
  the evidence.
- **You are tempted to try a different config to get a better result.** The
  question is whether it works for *this* team.

## Handoff / after it lands

- On **GO**, plan 014 is next (restore variable matching), then 012.
- On **NO-GO**, the whole series pauses and the next plan is resolver coverage
  scoped to the specific construct that failed — which is a much stronger plan
  than one written in advance against eight generic fixtures.
- Either way, keep the resolved `tokens.json`. Plan 011's in-Figma run should use
  the same config so its results are comparable, and plan 017's pilot depends on
  the same file being installed.
