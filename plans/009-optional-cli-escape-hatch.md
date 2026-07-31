# Plan 009: Add the optional CLI escape hatch for complex configs

> **Executor instructions**: Read `plans/EXECUTOR-GUIDE.md` first — it holds the
> toolchain, commands, conventions, and failure handling shared by every plan.
> Then read this plan in full and work through its **Build sheet** below, one
> task at a time, confirming each *Done when* before starting the next. Commit
> after each task. When done, update the status row for this plan in
> `plans/README.md`.
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
> **Drift check (run first)**:
> `git diff --stat <SHA at which plan 001 completed>..HEAD -- packages/theme`
> This plan reuses `@fig-tail/theme`'s schema and validator, and produces the
> same `TokenSet`. If either changed since 001, read the changes first.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW technically. The real risk is **positioning**: if the CLI creeps
  into the normal setup path, it breaks the program's central promise. The Scope
  section draws that line; hold it.
- **Depends on**: 001
- **Category**: dx
- **Grounded at**: the commit at which plan 001 landed.

## Build sheet

**Read `plans/EXECUTOR-GUIDE.md` before starting.** It holds the toolchain,
commands, TypeScript rules, commit format, and what to do when a check fails —
none of which is repeated here.

Do the tasks below **in order, one at a time**. Each task's *Done when* is a
command or a named in-Figma check; it must produce the stated result before you
start the next task. Commit after each task. Everything after this section is
**reference** — read a section when a task points you at it.

### The rule that governs this whole plan

> The CLI is an **escape hatch**, not a step. Nothing you write may present it as
> part of normal setup — not the README, not the CLI's own output, not an error
> message.

If a task seems to require making the CLI a required step, stop and report.

### Files this plan creates

| Path | Purpose | Task |
|---|---|---|
| `packages/cli/package.json`, `tsconfig.json` | package setup | 1 |
| `packages/theme/src/index.ts` (edit) | **export-only** exposure of conversion helpers | 1 |
| `packages/cli/src/v3.ts` + test | real `resolveConfig` evaluation | 2 |
| `fixtures/projects/tw3-preset/**` | installable v3 project w/ preset, fn value, plugin, `.ts` | 2 |
| `packages/cli/src/v4.ts` + test | filesystem `@import`/`@config` resolution | 3 |
| `fixtures/projects/tw4-config/**` | installable v4 project using `@config` | 3 |
| `packages/cli/src/equivalence.test.ts` | CLI output == browser output | 4 |
| `packages/cli/src/index.ts` | the `export` command | 5 |
| `packages/plugin/src/setup.ts` (edit) | accept a pre-resolved token JSON | 6 |
| `README.md` (section only) | placed **after** normal setup | 7 |

### Dependencies

```bash
pnpm add --filter @fig-tail/cli jiti cac
pnpm add --filter @fig-tail/cli -D tailwindcss@3 tailwindcss@4
```

The CLI resolves the **target project's** `tailwindcss`, never a bundled copy.

### Tasks

| # | Do this | Files it may touch | Done when |
|---|---|---|---|
| 1 | Scaffold `packages/cli`. Export the conversion helpers from `@fig-tail/theme` **without changing their behaviour**. | `packages/cli/*`, `packages/theme/src/index.ts` | `pnpm -r typecheck && pnpm -r test` → exit 0 **and** plan 001's snapshot files show an empty `git diff`. If a snapshot moved, you changed behaviour — revert |
| 2 | The v3 path: resolve the project's `tailwindcss`, `require()` the config via `jiti`, run its `resolveConfig`, hand the result to the shared helpers. Build the fixture project. | `src/v3.ts` + test, `fixtures/projects/tw3-preset/**` | `test -t v3` passes, asserting in **one test** both that the CLI resolves the preset/fn/plugin values **and** that the browser resolver reports them unresolvable for the same config |
| 3 | The v4 path: filesystem `@import`/`@config` resolution, project's `theme.css` for defaults. | `src/v4.ts` + test, `fixtures/projects/tw4-config/**` | `test -t v4` passes, and the CLI resolves the `@config`-referenced preset the browser resolver cannot |
| 4 | The equivalence suite: for **every** plan-001 fixture the browser resolver fully resolves, assert byte-identical `TokenSet` (normalise `generatedAt` only). | `src/equivalence.test.ts` | `test -t equivalence` passes for every fully-resolvable fixture; the count is in the commit message. **Do not add tolerances to make it pass** — find which path is wrong |
| 5 | The `export` command: detect major by **installed version**, dispatch, validate, write, print a stderr summary whose last line says to drop the file into the plugin's setup screen. | `src/index.ts` | All four commands in Step 5 behave as stated, incl. a non-zero exit with an actionable message on a non-Tailwind directory |
| 6 | Make the plugin's setup UI accept a pre-resolved `figtail.tokens.json` (validate, store directly, no resolve step), and show the CLI as the source. | `packages/plugin/src/setup.ts`, `src/ui/**` | Drop a CLI-produced file in Figma → stores, Configured names the CLI, Dev Mode produces classes. Then drop the **raw** config for the same project → the unresolved report appears |
| 7 | README section, placed **after** the normal setup instructions. | `README.md` | A reader following the normal setup path never meets an instruction to install the CLI |

---

## Why this matters

Plan 001's in-browser resolver deliberately does not execute JavaScript. It
parses. That is the right trade for the common case — most Tailwind configs are
static object literals — but it means a real category of configs cannot be fully
resolved:

- `presets: [require('@company/tailwind-preset')]` — a shared internal preset
- `spacing: ({ theme }) => …` — function-valued theme keys
- `tailwind.config.ts` using TypeScript beyond the bounded pre-pass
- Plugins that contribute theme values

These are common in exactly the teams most likely to want fig-tail: mature
design systems with a shared config package. Plan 001 reports each case
precisely rather than guessing, which is correct — but a report is not a
solution.

This CLI is the solution. It runs in the codebase, where `require()` works and
`resolveConfig()` is available, produces a `TokenSet` in the same schema, and the
designer drops **that** into the plugin instead of the raw config. Same setup
flow, same storage, same everything downstream.

**It does not change what a developer installs.** A developer still installs the
plugin and nothing else. This is a one-time setup tool for whoever configures the
Figma file, run once when the plugin says it could not fully read their config.

That framing is the whole point of the plan. A CLI presented as a normal step
would undo the product's main advantage over every other Figma→Tailwind plugin.

## Context the executor needs

### The one-line rule

> The CLI is an **escape hatch**, not a step. Every user-facing surface must
> present it as what you reach for **when the plugin tells you to**, never as
> part of normal setup.

This applies to the README, the plugin's error messages, the Community listing,
and this CLI's own output.

### What exists after plan 001

- `@fig-tail/theme` exports `resolveTheme(input): ResolveResult`,
  `validateTokenSet(value)`, and the `TokenSet` type.
- `TokenSet` is the schema plan 003 stores and plans 002/004/005 consume. It
  carries `schemaVersion`, `source` (major, entry, prefix, remBasePx), and
  namespaced token maps. See plan 001 Step 2 for the full shape.
- The v3 and v4 adapters already contain the merge semantics, key flattening,
  colour conversion, and rem→px logic. **This plan must not reimplement any of
  it.**

### What the CLI does that the browser resolver cannot

It can execute the config the way Tailwind itself does:

- **v3**: `require()` the config (via `jiti` for `.ts`), then run `resolveConfig`
  from the **project's own** installed `tailwindcss` — the project's version is
  the source of truth, not a version bundled with the CLI. That resolves presets,
  plugins, and function-valued theme keys exactly as the build does.
- **v4**: locate the CSS entry, resolve `@import` and `@config` chains against
  the real filesystem, and read `node_modules/tailwindcss/theme.css` from the
  project's install for the defaults.

The CLI then **converts that fully-resolved theme into the same `TokenSet`**,
reusing `@fig-tail/theme`'s conversion helpers. The only thing it replaces is the
*evaluation* step; everything after it must be shared code.

### Where shared code has to live

`@fig-tail/theme` must stay browser-clean — no Node built-ins (plan 001 enforces
this with a lint rule). So the conversion helpers this CLI needs must be exported
from `@fig-tail/theme` as pure functions taking an already-evaluated plain
object.

If they are currently private to the v3/v4 adapters, **exporting them is an
allowed change to `packages/theme`** — but it must be export-only. Do not alter
their behaviour, and re-run plan 001's snapshot suite afterwards to prove you
did not.

### Output equivalence is the acceptance bar

For a config the browser resolver **can** fully handle, the CLI must produce a
`TokenSet` **identical** to the browser resolver's. If the two paths can disagree
on a config both can read, users get different class names depending on which
route they took — the same trust-destroying failure plan 005 guards against
between surfaces. Step 4 tests this across the whole plan 001 fixture corpus.

## Inputs & resources

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm -r typecheck` | exit 0 |
| Test | `pnpm -r test` | all pass |
| Build | `pnpm --filter @fig-tail/cli build` | `packages/cli/dist/index.js` exists |
| Run on a fixture | `pnpm --filter @fig-tail/cli exec fig-tail export --cwd ../../fixtures/projects/tw3-preset` | writes `figtail.tokens.json`, exit 0 |
| Equivalence suite | `pnpm --filter @fig-tail/cli test -t equivalence` | all pass |

Reference documentation:

- Tailwind v3 configuration — https://v3.tailwindcss.com/docs/configuration
- Tailwind v4 theme variables — https://tailwindcss.com/docs/theme

No accounts or credentials. This plan is pure Node.

## Suggested toolkit (optional)

- `jiti` for loading `tailwind.config.ts`.
- `cac` or `commander` for argument parsing.
- The project's own `tailwindcss` resolved from the target directory — **never**
  a copy bundled with the CLI.

## Scope

**In scope**:

- `packages/cli/**` — the `fig-tail export` command, v3 and v4 evaluation paths,
  tests
- `packages/theme/src/**` — **export-only** changes to expose the conversion
  helpers this CLI reuses
- `fixtures/projects/**` — real installable projects for testing (distinct from
  plan 001's `fixtures/configs/`, which are config files only)
- A README section, framed per "The one-line rule"
- The plugin's unresolved-report messages already point at the CLI (plan 001
  Step 5) — update the wording if the command name differs

**Out of scope**:

- **Changing the resolution behaviour of `@fig-tail/theme`.** Export-only. Any
  behaviour change breaks plan 001's snapshots and the equivalence bar.
- **Making the CLI required, or presenting it as a normal setup step**, anywhere.
- **Uploading to Figma.** The CLI writes a file; a human drops it into the
  plugin. No Figma REST API, no personal access tokens, no credential handling
  in this repo.
- A watch mode. The export is one-shot; re-running is cheap.
- Publishing — plan 010, which already covers the npm packages.

## Working approach

- Branch as instructed. Commit per step, prefixed `009-N:`.
- Run plan 001's full test suite after **every** change to `packages/theme`. That
  suite is the proof you did not alter behaviour while exporting helpers.

## Steps

### Step 1: Scaffold the CLI and export the shared helpers

Create `packages/cli` with the workspace conventions. Identify the conversion
helpers inside `packages/theme`'s adapters (colour conversion, rem→px, key
flattening including `DEFAULT`, namespace mapping, `TokenSet` assembly) and
export them without changing them.

**Check**: `pnpm -r typecheck && pnpm -r test` → exit 0, with plan 001's
snapshots **unchanged** (`git diff` on the snapshot files is empty). If any
snapshot moved, you changed behaviour — revert and export differently.

### Step 2: Implement the v3 evaluation path

Resolve `tailwindcss` from the target project root, `require()` the config
(through `jiti` for `.ts`), call the project's `resolveConfig`, then hand the
resolved theme to the shared conversion helpers.

Build `fixtures/projects/tw3-preset/` — a real installable project with a shared
preset, a function-valued theme key, a plugin contributing theme values, and a
`.ts` config. This is exactly the config category the browser resolver reports as
unresolvable, which is the point.

**Check**: `pnpm --filter @fig-tail/cli test -t v3` → passes. Running the CLI on
`fixtures/projects/tw3-preset` produces a `TokenSet` containing the preset's
tokens, the function-derived spacing, and the plugin's contributions — all of
which plan 001's browser resolver reports as unresolvable for the same config.
Assert both facts in the same test, so the escape hatch's reason for existing is
in the suite.

### Step 3: Implement the v4 evaluation path

Locate the CSS entry, resolve `@import` and `@config` against the filesystem,
read the project's `node_modules/tailwindcss/theme.css` for defaults, and hand
the merged `@theme` set to the shared helpers.

Build `fixtures/projects/tw4-config/` — a v4 project using `@config` to pull in a
v3 config with a preset.

**Check**: `pnpm --filter @fig-tail/cli test -t v4` → passes, and the CLI resolves
the `@config`-referenced preset that the browser resolver cannot.

### Step 4: Prove equivalence with the browser resolver

For **every** config in plan 001's `fixtures/configs/` that the browser resolver
fully resolves, assert the CLI produces a byte-identical `TokenSet` (normalising
only `generatedAt`).

Any difference is a bug in one of the two paths. Do not add tolerances to make
the test pass — find which one is wrong.

**Check**: `pnpm --filter @fig-tail/cli test -t equivalence` → passes for every
fully-resolvable fixture. Record the count in the commit message.

### Step 5: Wire the `export` command

`fig-tail export [--cwd <dir>] [--out <file>] [--prune-defaults] [--stdout]`

1. Resolve the project root (default `process.cwd()`).
2. Detect the Tailwind major by resolving `tailwindcss/package.json` from the
   project root and reading `version` — **by installed version, not by which
   files exist**, since a v4 project may still have a `tailwind.config.js` via
   `@config`.
3. Dispatch, validate with `validateTokenSet`, write `figtail.tokens.json` (or
   stdout).
4. Print a summary to **stderr**: Tailwind version, entry file, token counts,
   byte size with a warning above 120 kB naming `--prune-defaults`, and a final
   line telling the user what to do next — drop this file into the fig-tail
   plugin's setup screen.
5. Exit non-zero with an actionable message when: no `tailwindcss` in the
   project, an unsupported major, no entry found, or self-validation fails.

**Check**: all five of these behave as stated —

```
pnpm --filter @fig-tail/cli exec fig-tail export --cwd ../../fixtures/projects/tw3-preset   # exit 0, writes file
pnpm --filter @fig-tail/cli exec fig-tail export --cwd ../../fixtures/projects/tw4-config   # exit 0, writes file
pnpm --filter @fig-tail/cli exec fig-tail export --cwd /tmp                                 # exit != 0, names the missing tailwindcss
pnpm --filter @fig-tail/cli exec fig-tail export --cwd ../../fixtures/projects/tw3-preset --stdout | head -c 200   # JSON on stdout, summary on stderr
```

plus: the summary's closing line names the plugin setup screen as the next step.

### Step 6: Confirm the plugin accepts the CLI's output

Plan 003's setup UI accepts config source text. It must also accept a
pre-resolved `figtail.tokens.json` — drop it in, `validateTokenSet` it, store it
directly with no resolution step. If plan 003 already wired this (its handoff
notes flag it), verify it; if not, add it here as a small change to the setup UI.

The Configured state must show **where the tokens came from** — "resolved from
`tailwind.config.js`" versus "imported from `figtail.tokens.json` (CLI)" — so a
future maintainer knows why re-dropping the raw config might behave differently.

**Check**: in Figma desktop, drop a CLI-produced `figtail.tokens.json` into the
setup UI. It stores without a resolution step, the Configured state names the CLI
as the source, and the Dev Mode surfaces produce class names from it. Then drop
the **raw** config for the same project and confirm the plugin reports the
unresolved entries — demonstrating both paths and the difference between them.

### Step 7: Document it as an escape hatch

Add a README section — placed **after** the normal setup instructions, not
inside them — titled something like "If fig-tail can't fully read your config".
It should say: when you need this (the plugin told you), what to run, what to do
with the output, and what the CLI can resolve that the plugin cannot.

**Check**: a reader following the README's normal setup path never encounters an
instruction to install the CLI. A reader who hits an unresolved-config report is
led to this section from the plugin's own message.

## Validation plan

- **Unit tests**: v3 evaluation (presets, function values, plugins, `.ts`), v4
  evaluation (`@import`, `@config`, defaults), version detection, all error
  exits.
- **Equivalence suite**: Step 4 — byte-identical output for every
  fully-resolvable fixture.
- **Complement test**: Step 2 — the CLI resolves what the browser resolver
  reports as unresolvable, asserted in one test.
- **`packages/theme` regression**: plan 001's full suite and snapshots unchanged.
- **Manual**: Step 6's round trip through the plugin.

## Done criteria

ALL must hold.

- [ ] `pnpm -r typecheck && pnpm -r lint && pnpm -r test` → exit 0
- [ ] Changes to `packages/theme` are **export-only**; plan 001's snapshots are
      byte-identical
- [ ] The CLI resolves presets, function-valued theme keys, plugin-contributed
      values, and `.ts` configs
- [ ] The equivalence suite passes for every fully-resolvable plan 001 fixture
- [ ] A single test asserts the CLI resolves what the browser resolver reports as
      unresolvable
- [ ] `fig-tail export` succeeds on both project fixtures and fails with an
      actionable message elsewhere
- [ ] The CLI's summary tells the user what to do with the output file
- [ ] The plugin accepts `figtail.tokens.json` and shows the CLI as its source
- [ ] The README presents the CLI **after** normal setup, framed as an escape
      hatch
- [ ] No Figma credentials or REST API usage anywhere in this plan
- [ ] No files outside the in-scope list were changed
- [ ] `plans/README.md` status row for 009 updated

## STOP conditions

Stop and report back — do not improvise — if:

- **The equivalence suite cannot pass** for a config both paths can read. One
  path is wrong, and which one it is matters more than shipping this plan.
- Exporting the shared helpers requires changing their behaviour. Report what
  needs to change; a behaviour change to `packages/theme` is a plan 001 concern.
- Making the CLI work requires it to become a **required** setup step. That
  contradicts the program's central promise and is the owner's call.
- Anything here would need Figma credentials or REST API access.
- `resolveConfig` is unavailable in the target Tailwind version in a way that
  breaks the v3 path.
- A step's check fails twice after a reasonable attempt.

## Handoff / after it lands

- **Plan 010** publishes `@fig-tail/cli` to npm alongside `@fig-tail/theme` and
  `@fig-tail/match`, and documents it in the escape-hatch position established
  here. Do not let the docs promote it upward.
- **What a reviewer should scrutinise most**: the equivalence suite, and the
  export-only claim about `packages/theme` (check plan 001's snapshot diff is
  genuinely empty). Second: the README's framing — a CLI that drifts into the
  normal setup path silently costs the product its main differentiator.
- **Deliberately deferred**: a CI check that fails a build when
  `figtail.tokens.json` drifts from the config (useful, but it belongs to teams'
  own repos, not this one), and any direct upload to Figma (would require
  credential handling and its own security review).
