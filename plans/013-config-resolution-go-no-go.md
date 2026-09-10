# Plan 013: Find out whether fig-tail can read the pilot team's config

> **Executor instructions**: This plan is a **gate**. It answers one yes/no
> question before anyone spends more effort. Read "How this gate lies to you"
> before running anything — an earlier version of this plan returned GO on a
> config where **none** of the team's own colours resolved.

## Status

- **Priority**: P0 — **runs before every other plan in the series**
- **Effort**: S
- **Risk**: LOW to run, HIGH to skip, **HIGH to run naively**
- **Depends on**: none
- **Category**: research
- **Grounded at**: `b0c8310` — 2026-09-10
- **Serves**: [GOAL-developer-adoption.md](GOAL-developer-adoption.md) — all four
  conditions are void if this fails

## Why this matters

fig-tail's entire value is emitting `bg-brand-500` where every competing plugin
emits `bg-[#3b82f6]`. If it cannot read the pilot team's config it emits
`bg-[#3b82f6]` — correctly, honestly, and worthlessly.

`plans/README.md:352` records plan 001 landing at **4/8** wild fixtures fully
resolved. `packages/theme/spike/FINDINGS.md:29-31` names the failing half:

> - External `presets` / cross-package `require` (with-preset, monorepo-extend)
> - Plugin packages (`@tailwindcss/forms`, `@tailwindcss/typography`)
> - CSS-variable colour strings that are not absolute colours (shadcn-like)

Those are not exotic. A monorepo with `@acme/tailwind-config`, a shadcn project,
or anything importing `@tailwindcss/typography` sits in the failing half.

## How this gate lies to you

**Read this section before Step 1. Every trap below was demonstrated by actually
running the resolver, not reasoned about.**

### Trap 1 — bundled defaults masquerade as project tokens

Once an exact `tailwindcss` version is supplied, ~300 stock Tailwind colours fill
`tokens.colors`. Counting keys, or eyeballing "are colours resolved", tells you
nothing about whether **the team's own** tokens survived.

Demonstrated on `fixtures/configs/v3/shadcn-like.js` with `tailwindcss: "3.4.19"`:

```
colors: 300 keys · unknownNamespaces: [] · partialNamespaces: []
defaults: {"status":"confirmed","version":"3.4.19"} · unresolvedCount: 0
```

Every surface signal says clean. But **not one** of `border`, `input`, `ring`,
`background`, `foreground`, `primary` resolved — `hsl(var(--border))` is not an
absolute colour, so each vanished **with zero diagnostics**. The 300 that remain
are `slate-50`, `red-500` and friends, which that team does not use.

### Trap 2 — `unknownNamespaces` never fires

`packages/theme/src/v4/index.ts:334` is a literal `unknownNamespaces: []`. **For
any v4 team this signal is structurally incapable of firing.** On v3 it is
computed but was empty on all eight fixtures, including the known-failing ones.
Do not build the verdict on it.

### Trap 3 — "present" does not mean "usable"

A shadcn radius resolves as `"lg": {"raw": "var(--radius)", "px": null}`. It is a
key in the token set, so it looks resolved. But `packages/match/src/matchers/length.ts:43`
does `if (token.px === null) continue` — it can never match anything. A token with
`px: null` (or a colour that is not an absolute colour) is **present and
permanently unmatchable**.

### Trap 4 — the CLI throws away the evidence

`packages/cli/src/index.ts:70-82` writes only `schemaVersion`, `tokens`,
`provenance` and `unresolvedCount` — **an integer**. The unresolved *list* is
never written. You cannot answer "is every unresolved entry explainable" from
that file. Step 2 uses a read-only script instead.

### Trap 5 — a NO-GO that is not about the config at all

Three ways to get a crash that says nothing about coverage:

1. **Unbuilt dependency.** `pnpm --filter @fig-tail/cli build` does **not** build
   `@fig-tail/theme`; there is no turbo/nx `dependsOn`. Running the CLI then dies
   with `ERR_MODULE_NOT_FOUND`. Build both.
2. **A live resolver bug.** `packages/theme/src/v3/ts-prepass.ts:8` runs its
   TypeScript-stripping regex on **every** v3 config including plain `.js`, and
   its character class contains `,` `{` `}` `[` `]`. It eats object-literal values
   and closing braces. Verified:

   ```
   INPUT                       AFTER stripTypeScript
   theme: {                    theme: {
     colors: s.colors,           colors,
   },                          (whole line consumed)
   ```

   A brace is gone, `acorn.parse` fails, and `v3/evaluate.ts:87` throws
   *"Could not parse … Replace dynamic TypeScript/JS constructs with plain
   values"* — blaming the user for valid JavaScript fig-tail mangled itself. This
   hits `colors: { ...colors, brand: '#f00' }`, one of the most common idioms
   there is. **This is a live P0 defect recorded in
   `docs/release/ux-findings-2026-09-10.md`; it is not this plan's to fix, but it
   is this plan's to not misattribute.**
3. **A v4 entry that `@import`s its `@theme` from a second file.** Both the CLI
   and the plugin read one file, so `resolve.ts` reports `missing-import` for a
   project that would work once the files are combined.

**None of these three is a config-coverage NO-GO.** Distinguish them.

## Inputs & resources

| Input | Detail |
|---|---|
| The pilot team's real `tailwind.config.js`/`.ts` or v4 CSS entry | Not a fixture. Not yours. Ask today — this is the long pole. |
| Their `package.json` | Only an exact `x.y.z` `tailwindcss` counts (`cli/src/index.ts:31-32`, disposition F02) |
| **A list of the token names they actually use** | Ask for it, or read it out of the config yourself. Without this, Trap 1 is unavoidable. |

The CLI and the plugin resolve through the same function — both call
`resolveTheme` from `@fig-tail/theme` with one source and an optional version
(`packages/cli/src/index.ts:34-37`, `packages/plugin/src/setup.ts:50-53`), and
`resolveTheme` takes text rather than a filesystem, so there is no Node-only
escape hatch. **Inputs are equivalent; outputs are not** — see Trap 4.

## Scope

**In scope**: building the packages, running the resolver, writing
`docs/release/config-go-no-go.md`, and a throwaway inspection script under `/tmp`.

**Out of scope**:
- **Fixing anything**, including the `ts-prepass` bug. Record and move on.
- **Modifying `packages/cli`** to print more. Use the script instead.
- **Figma.** This needs none.

## Steps

### Step 1: Get the real config, and the list of names that matter

Ask the team for the config, `package.json`, and — the part everyone skips —
**which token names they actually use in their code**: their brand colours, their
spacing scale, their radii. Ten names is plenty. If they cannot tell you, read the
config's own `theme`/`extend` keys and use those.

Without this list, Trap 1 is unavoidable and the gate is decorative.

**Check**: all three are recorded, and the name list came from the team or from
their config's own declarations — not from Tailwind's defaults.

### Step 2: Build both packages, then resolve with a script that shows everything

```
pnpm install
pnpm --filter @fig-tail/theme build
pnpm --filter @fig-tail/cli build
```

Then write a throwaway script in `/tmp` that imports the built theme package,
calls `resolveTheme` with the team's config text (plus the exact version if
`package.json` supplies one), and prints:

- the **full** `unresolved` array — every entry, not a count
- `warnings`
- `tokens.source.defaults`
- `unknownNamespaces` and `partialNamespaces` (for the record; see Trap 2)
- **for each name from Step 1**: present or absent, and if present whether it is
  usable — `px !== null` for lengths, an absolute colour for colours

The CLI is fine for a smoke run, but its output cannot answer Step 3 (Trap 4).

**Check**: the script ran and printed all of the above, or a verbatim error is
recorded **together with which of Trap 5's three causes it is**.

### Step 3: Answer the only question that matters

**Of the names from Step 1, how many are present AND usable?**

That is the gate. Everything else is context. Also record:

1. **Each unresolved entry** — and whether you can explain it. Per
   `plans/README.md:291-292`, "it couldn't read part of our config and I don't
   know why" is the one answer that costs trust.
2. **Silent losses.** A colour that is not absolute vanishes with *no* diagnostic
   (Trap 1). So a name from Step 1 that is simply absent, with nothing in
   `unresolved` about it, is the **worst** result available — invisible failure.
3. **Defaults status** — `confirmed` or `unconfirmed` with its reason.
4. **Usable-but-stock ratio.** Roughly how much of `tokens.colors` is Tailwind's
   default palette versus the team's. High stock + low project is Trap 1 exactly.

**Check**: `docs/release/config-go-no-go.md` states the present-and-usable count
out of the Step 1 list, by name, with the unresolved list quoted in full.

### Step 4: Call it

- **GO** — most of the Step 1 names are present and usable, and every unresolved
  entry is explainable. A developer selecting a brand-coloured layer will see the
  team's token name.
- **PARTIAL** — some namespaces usable, others not. **Not automatically a go.**
  State what a developer sees for the failing namespaces. Owner's call, not the
  executor's.
- **NO-GO (coverage)** — the team's names are largely absent or unusable. Stop the
  programme. The follow-up is a resolver-coverage plan aimed at what actually
  broke.
- **NO-GO (harness)** — one of Trap 5's causes. **This is not a verdict about the
  config.** Fix the harness or record the resolver bug, then re-run. Do not stop
  the programme on this.

**Check**: the verdict names which of the four it is. A crash is never recorded as
a coverage NO-GO without ruling out all three Trap 5 causes.

## Validation plan

- **Positive control**: run the same script against
  `fixtures/configs/v3/minimal.js` — a fixture known to resolve. The Step 1-style
  name check should come back present-and-usable.
- **Negative control**: run it against `fixtures/configs/v3/shadcn-like.js` with
  an exact version, using that fixture's *own* declared names (`border`, `ring`,
  `primary`, …). It must report them **absent**. If your method reports that
  fixture as clean, your method has Trap 1 and the real run cannot be trusted.
- Write both control results into the report next to the team's, using a
  **different `--out` path** than the team's run.

## Done criteria

- [ ] The team's real config, `package.json`, and token-name list were used.
- [ ] Both packages were built before running anything.
- [ ] The full unresolved list is quoted, not counted.
- [ ] Every Step 1 name is marked present-and-usable / present-but-unusable / absent.
- [ ] Both controls ran, and the shadcn control correctly reported absent.
- [ ] A verdict names which of the four outcomes it is.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- **The team cannot or will not share their config.** A finding about the pilot's
  viability — report it rather than substituting a fixture.
- **The shadcn negative control comes back clean.** Your instrument has Trap 1;
  fix the method before trusting anything.
- **The verdict is PARTIAL.** Owner's call.
- **You are tempted to try a different config to get a better result.**
- **You are about to record a crash as a coverage NO-GO** without ruling out an
  unbuilt dependency, the `ts-prepass` regex, and a multi-file v4 entry.

## Handoff / after it lands

- On **GO**, plan 014 is next, then 012 — **but 012 opens with two UNDECIDED
  owner decisions** (whether it supersedes disposition F01, and `className` vs a
  new `rawClassName` field). Put both to the owner as part of reporting this
  verdict, or 012 stops on arrival. If F01 is upheld, 012 lands in reduced shape
  and the goal's condition 3 is not fully addressed — plan 017's pre-registration
  needs to know that.
- On **NO-GO (coverage)**, the series pauses; the next plan is resolver coverage
  scoped to what actually failed — a far better-grounded plan than one written
  speculatively.
- On **NO-GO (harness)**, fix and re-run; the `ts-prepass` regex in particular is
  a P0 defect that will hit real users regardless of this pilot.
- Keep the config file **and pin its version** — plan 016 Step 3 needs it, and
  plan 017 Step 1 must record which version the pilot ran against. Note the
  plugin has **no production import path for a token JSON** — `grep schemaVersion
  packages/plugin/src` returns three hits, all in test files — so 011 and 017
  re-resolve the raw config in the plugin UI.
