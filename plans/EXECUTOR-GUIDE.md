# Executor guide — optional expanded guidance

Every numbered plan is self-contained and can be executed without this file.
This guide expands the shared working style and repository conventions for a
human who wants more context. Read the numbered plan completely first; consult
this guide as needed.

If anything here conflicts with your plan, **your plan wins** — it is more
specific. Say so in your commit message when it happens.

---

## 1. How to work

1. Read your plan's **Build sheet** section. It lists the exact files to create
   and the numbered tasks to do, in order.
2. Do **one task at a time**, in the given order. Do not skip ahead, do not
   batch, do not start task 4 while task 3 is unverified.
3. After each task, run its **Done when** command. It must produce the stated
   result before you move on.
4. Commit after each task (format in §7). A verification-only task must write a
   durable evidence note named by the plan; commit that note. Never create an
   empty commit merely to satisfy this rule.
5. When every task is done, work through your plan's **Done criteria** checklist
   and confirm each item literally. Then update your plan's row in
   `plans/README.md` to `DONE`. Editing that status row is a universal scope
   exception even when a task's file list does not repeat it.

**Do not** reorganise the plan, combine tasks, or "improve" the approach. If the
plan seems wrong, finish what is unambiguous and report the rest (§6).

---

## 2. Non-negotiables

These apply to every plan. Breaking one is never acceptable, whatever a task
seems to need.

| # | Rule | What it means in code |
|---|---|---|
| 1 | **Never write to the Figma document** except the two sanctioned shipped paths | Only `figma.root.setPluginData` (plan 003) and `Variable.setVariableCodeSyntax('WEB', …)` (plan 007) may enter production bundles. Plan 007's isolated throwaway API spike is explicitly scoped to a disposable file. |
| 2 | **Never write `variable.name`** | Tailwind names go in Code syntax. No exceptions. |
| 3 | **The plugin and browser resolver never execute user config** | No `eval`, `new Function`, or dynamic import in browser/plugin code. Plan 009's optional Node CLI is the only exception: it executes config only from a trusted checkout after the caller supplies the explicit trust flag. |
| 4 | **Never make a network request** | The manifest is `networkAccess: { allowedDomains: ["none"] }`. No `fetch`, no telemetry, no analytics. |
| 5 | **Never label a Tailwind class as project-confirmed when it is not** | With a validated config, suppress classes disabled by prefix/core-plugin uncertainty. With no config, a generic arbitrary suggestion may be shown only with a warning that project prefix/core settings can require adaptation. A wrong named token silently applies no styling. |
| 6 | **Never fall back silently** | Every fallback shows the user what was used, why, and how to get the better result. |
| 7 | **Never commit a secret** | No tokens, no API keys, no `.env` with real values. |

---

## 3. Environment setup

Run once, at the start of your first task:

```bash
corepack enable
pnpm install
```

Node 20 or newer. If `pnpm` is missing after `corepack enable`, install it with
`npm i -g pnpm` and note that in your commit message.

Plan 001 pins the exact pnpm release in root `packageManager` and commits
`pnpm-lock.yaml`. Do not regenerate it with a different pnpm release. CI uses
`corepack` and `pnpm install --frozen-lockfile` from the first production commit.

---

## 4. Repository conventions

### Layout

```
fig-tail/
├── package.json            # workspace root, "private": true
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
├── packages/
│   ├── theme/              # @fig-tail/theme   — plan 001
│   ├── match/              # @fig-tail/match   — plan 002
│   ├── plugin/             # @fig-tail/plugin  — plans 003-008
│   └── cli/                # @fig-tail/cli     — plan 009
├── fixtures/
└── plans/
```

### Every package's `package.json`

```jsonc
{
  "name": "@fig-tail/<name>",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsdown",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint src"
  }
}
```

`@fig-tail/plugin` differs: it builds with `node build.mjs` and is **not**
published. Its plan says so.

Library packages use `tsdown`, the maintained successor recommended by tsup's
own repository. Keep a checked-in `tsdown.config.ts` per publishable package so
entry points, ESM output, minification, declarations, and externals are explicit.

### TypeScript configs

```jsonc
{
  "compilerOptions": {
    "target": "es2020",
    "module": "esnext",
    "moduleResolution": "bundler",
    "lib": ["es2020"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "declaration": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

Each library package's `tsconfig.json` extends it and sets `include`/`outDir`.
The plugin keeps runtime types separate:

- `tsconfig.sandbox.json` keeps `lib: ["es2020"]`; it may include Figma plugin
  typings and must not include DOM types.
- `tsconfig.ui.json` uses `lib: ["es2020", "dom", "dom.iterable"]`; it must not
  include the `figma` global.

The plugin `typecheck` script runs both. A permanent negative type fixture proves
`document` fails in sandbox code and `figma` fails in iframe code.

### TypeScript rules

- **No `any`.** Use `unknown` and narrow. If you cannot avoid `any`, that is a
  report-worthy signal (§6), not a thing to suppress.
- **No non-null assertions (`!`).** Handle the null case.
- **No `as` casts** except to narrow a validated `unknown`.
- **No default exports.** Named exports only, re-exported from `src/index.ts`.
- **No barrel imports between packages** — import from the package root
  (`@fig-tail/theme`), never a deep path.
- Every exported function and type gets a one-line doc comment saying what it
  does. Not how.

### Which packages may import what

| Package | May import | May **not** import |
|---|---|---|
| `@fig-tail/theme` | nothing but `culori`, `acorn` (+ whatever its plan names) | anything Node (`fs`, `path`, `process`), anything Figma |
| `@fig-tail/match` | `@fig-tail/theme`, `culori` | anything Node, anything Figma |
| `@fig-tail/plugin` | `@fig-tail/theme`, `@fig-tail/match`, `@figma/plugin-typings` | anything Node |
| `@fig-tail/cli` | anything Node, `@fig-tail/theme` | Figma anything |

A lint rule enforces the first two rows. Do not add an eslint-disable to get
around it — that is the rule doing its job.

### File naming

- `kebab-case.ts` for files, `PascalCase` for types, `camelCase` for functions.
- Tests sit beside their source: `foo.ts` → `foo.test.ts`.
- One exported concept per file where practical.

---

## 5. Commands

These are the only commands you need. Run them from the repo root.

| Purpose | Command | Expected |
|---|---|---|
| Install | `pnpm install` | exit 0 |
| Typecheck everything | `pnpm -r typecheck` | exit 0 |
| Lint everything | `pnpm -r lint` | exit 0 |
| Test everything | `pnpm -r test` | all pass |
| Build everything | `pnpm -r build` | exit 0 |
| Test one package | `pnpm --filter @fig-tail/<name> test` | all pass |
| Run one test by name | `pnpm --filter @fig-tail/<name> test -t "<name>"` | passes |
| Coverage | `pnpm --filter @fig-tail/<name> test -- --coverage` | see plan's bar |
| Byte size of a build | `wc -c < packages/<name>/dist/index.js` | see plan's budget |

Any command that inspects `dist/**` must build it in the same command first.
Reading a pre-existing bundle is not verification.

**Before every commit**, run:

```bash
pnpm -r typecheck && pnpm -r lint && pnpm -r build && pnpm -r test
```

If that fails, the commit is not ready.

---

## 6. When something goes wrong

Follow this in order. Do not improvise past it.

```
A check fails
   │
   ├─ Have you attempted it fewer than 2 times?
   │     └─ YES → fix and retry
   │
   ├─ Is the failure covered by your plan's "STOP conditions"?
   │     └─ YES → STOP. Write the report (below). Do not continue.
   │
   ├─ Does a fallback exist (your plan or §2 rule 5/6 describes one)?
   │     └─ YES → implement the fallback, LABEL it for the user,
   │              note it in your commit message, CONTINUE
   │
   └─ Otherwise → finish every other task in the plan that does not
                  depend on this one, then write the report and stop.
```

**Default to continuing.** "Partly working and clearly labelled" beats "stopped
and waiting" everywhere except the §2 non-negotiables.

### The report format

When you stop, or when you take a fallback worth flagging, write this — in your
commit message, and in your final message:

```
BLOCKED (or FALLBACK TAKEN): <one line>

Plan / task:   001, task 7
What I tried:  <2-3 lines, with the actual commands and their output>
What happened: <the actual error or result, pasted>
Why I stopped: <which STOP condition, or why no fallback fits>
What I did complete: <list of finished tasks>
What I would need to continue: <the specific decision or information>
```

Paste real output. Do not summarise an error you did not read.

---

## 7. Commits

One commit per task. Format:

```
<plan>-<task>: <imperative summary under 60 chars>

<what changed and why, 1-4 lines>
<any fallback taken, and what it is labelled as>
<any manual verification you performed, with the result>
```

Example:

```
001-5: implement the v3 config adapter

Static evaluation of theme/theme.extend with the documented merge
semantics. theme.<ns> replaces defaults; theme.extend.<ns> merges.
Unresolvable replacing keys mark the namespace unknown, not defaulted.
Hand-checked blue-500, spacing.4, rounded-lg against Tailwind's docs.
```

**Do not** push or open a pull request unless your instructions explicitly say
to. Commit locally and stop.

---

## 8. Testing conventions

- **vitest**, run with `pnpm --filter <pkg> test`.
- Table-driven where there are more than three cases:

  ```ts
  const cases: Array<{ name: string; input: X; expected: Y }> = [
    { name: 'exact colour match', input: …, expected: … },
  ]
  for (const c of cases) {
    it(c.name, () => { expect(fn(c.input)).toEqual(c.expected) })
  }
  ```

- **Name tests so `-t` can select them.** Your plan's checks use
  `test -t v3`, `test -t color`, etc. Put that word in the `describe` block.
- **Snapshot tests**: allowed, but never accept a new snapshot without reading
  it. A green snapshot of wrong output is the worst failure mode in this repo.
  When a plan says to hand-verify values, do it and record the values you
  checked in the commit message.
- **Mock the `figma` global** in plugin tests; never reach for a real Figma
  session in an automated test.
- Test the fallback paths, not just the happy path. Several plans have Done
  criteria specifically about this.

---

## 9. Anti-patterns seen in this problem space

Specific things not to do, because they are tempting and wrong here:

| Do not | Because |
|---|---|
| Fall back to Tailwind's default palette when a config's `theme.colors` is unreadable | The project replaced the palette. Those tokens do not exist in their build. Mark the namespace unknown; emit raw values. |
| Emit a class for a "close enough" colour match | A near-miss is a drift signal to report, not an answer. It is the whole point of the confidence ladder. |
| Add `eslint-disable` to get past the write-safety or import rules | Those rules encode the non-negotiables. Tripping one means you are doing something forbidden. |
| Call `matchDeclarations` from a second place after plan 005 lands | Both Dev Mode surfaces must go through `src/pipeline.ts`, or they will drift and disagree. A test enforces this. |
| Cache aggressively before the plan says to | Premature caching hides correctness bugs while they are cheapest to find. |
| Return early with an error when there is no Tailwind config | "No config" is a supported state. Emit arbitrary values and a banner. |
| Widen scope to fix something adjacent you noticed | Note it in your report. Someone else owns it. |
| Write pretty-printed JSON into plugin storage | There is a hard 100 kB per-entry cap. Compact only. |

---

## 10. Glossary

Terms used across the plans without re-definition.

| Term | Meaning |
|---|---|
| **TokenSet** | The resolved Tailwind theme as plain JSON. Defined in plan 001 Step 2. The contract between every package. |
| **Confidence ladder** | `exact-variable` → `exact-value` → `name-match` → `nearest` → `arbitrary` → `none`. `nearest` is report-only and never enters copyable class output. Defined in plan 002. |
| **Unknown namespace** | A theme namespace the resolver could not read. Emits raw values, never defaults. Plan 001. |
| **Config-source tier** | 1 = saved on the Figma file, 2 = saved in the user's own settings, 3 = no config at all. Plan 003. |
| **Dev Mode** | Figma's developer-facing mode. `figma.editorType === 'dev'`. |
| **Code section** | The panel inside Dev Mode's Inspect panel where codegen plugins render. Plan 004. |
| **Inspect panel** | The wider Dev Mode panel, where `inspect`-capability plugins get a full-height iframe. Plan 005. |
| **Stamping** | Writing a reusable, config-validated Tailwind token key into a Figma variable's Code syntax field. Plan 007. |
| **Drift** | A design value that is *nearly* but not exactly a token. The signal plan 006 hunts. |

---

## 11. Before you say you are done

- [ ] Every task in the Build sheet is complete and its check passed
- [ ] `pnpm -r typecheck && pnpm -r lint && pnpm -r build && pnpm -r test` → exit 0
- [ ] Every item in the plan's **Done criteria** is confirmed literally, not
      assumed
- [ ] Every manual/in-Figma check the plan asks for was actually performed, and
      its result is in a commit message
- [ ] No file outside the plan's **In scope** list was changed
      (`git status` to confirm)
- [ ] `plans/README.md` status row updated
- [ ] Any fallback you took is labelled in the product **and** noted in a commit
- [ ] You did not push and did not open a pull request

If you cannot tick one of these, say which, in your final message.
