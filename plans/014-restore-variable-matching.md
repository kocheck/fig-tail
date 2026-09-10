# Plan 014: Restore variable matching (and stop the tests concealing it)

> **Executor instructions**: Follow this plan step by step. Confirm each **Check**
> before moving on. The mock change in Step 2 is not optional cleanup — skipping
> it re-conceals the bug this plan exists to fix.

## Status

- **Priority**: P0
- **Effort**: S
- **Risk**: LOW — small change, high blast radius if the diagnosis is right
- **Depends on**: 013 (GO)
- **Category**: bug
- **Grounded at**: `abb2c1b` — 2026-09-10
- **Serves**: [GOAL-developer-adoption.md](GOAL-developer-adoption.md) condition 3

## Why this matters

`packages/plugin/src/codegen/hints.ts:49` calls the **synchronous**
`figma.variables.getVariableById(id)`, inside a catch that swallows everything:

```ts
  let variable: Variable | null = null
  try {
    variable = figma.variables.getVariableById(id)
  } catch {
    // Variable may be from an unavailable library — fall through to value matching.
    variable = null
  }
```

`packages/plugin/manifest.json:9` declares `"documentAccess": "dynamic-page"`,
under which Figma's synchronous getters are documented to **throw**; the async
form is `getVariableByIdAsync`. Every other document read in this plugin already
uses the async form — `pipeline.ts:114`, `stamp/apply.ts:87`,
`lint/variables.ts:108`. `hints.ts:49` is the only straggler.

If it throws in product, the catch turns it into `null` and **every variable hint
silently disappears**, on every surface, for every node with `boundVariables`.
Matching degrades to raw-value matching and `exact-variable` — the top of the
confidence ladder and the reason this plugin exists rather than any of the four
competing ones — becomes unreachable. Nothing warns anyone. The plugin emits
plausible, slightly-worse output forever.

**And the test suite is why nobody caught it.** All five plugin mocks define
`getVariableById` synchronously — `codegen/hints.test.ts:11` returns a value
directly, `pipeline.test.ts:12` returns `null` directly, and three others do the
same. The suite asserts a contract Figma does not honour under `dynamic-page`, so
it is green *because* it encodes the bug.

**Intent, for judgment calls**: the goal is that a variable-bound layer emits the
token the variable names. If a change makes the tests pass but leaves that
untrue, it is the wrong change.

## Context the executor needs

- `resolveVariable` in `codegen/hints.ts` is called from `collectHints`, which is
  called at `mode-dev.ts:73` (codegen) and `pipeline.ts:119` (Inspect, lint,
  subtree). All four surfaces are affected.
- `figma.codegen.on('generate', async (event) => …)` is **already async**
  (`mode-dev.ts:68`), so awaiting inside the hint path is available without
  restructuring the callback.
- There is a per-operation cache around the lookup (`hints.ts:44-46, 54`). Making
  the call async means caching a **promise**, not a value, or the cache will
  stampede on repeated ids within one node.
- Figma's 3 s codegen budget (fact 4, `plans/README.md:94`) now covers an awaited
  round-trip per unique variable. A node with many bound variables is the case to
  watch; plan 011's latency step should re-measure after this lands.

## Inputs & resources

| Purpose | Command | Expected |
|---|---|---|
| Full gate | `pnpm check` | exit 0 |
| Plugin tests | `pnpm --filter @fig-tail/plugin test` | all pass |
| Find every sync mock | `grep -rn "getVariableById" packages/plugin/src/ --include=*.test.ts` | 5 hits |

## Scope

**In scope**:
- `packages/plugin/src/codegen/hints.ts` — the call, the signature, the cache.
- Any caller whose signature must become async as a result.
- **All five test mocks** — `codegen/hints.test.ts` (two), `pipeline.test.ts`,
  `pipeline.consistency.test.ts`, and any other the grep finds.
- `packages/plugin/notes/platform-preflight.md` — record the change and what it
  implies for plan 011's Step 5c.

**Out of scope**:
- **The other three async call sites.** They are already correct.
- **The `catch` block's existence.** Keep it — a variable from an unavailable
  library is a real case. What changes is that it stops swallowing a
  platform-contract error. Consider distinguishing the two, but do not remove the
  fallback.
- **Matching logic.** This plan restores an input; it does not change what the
  matcher does with it.
- **The near-miss class-string work.** That is plan 012.

## Steps

### Step 1: Prove the mocks are wrong before changing the code

Change one mock — `codegen/hints.test.ts:11` — to an **async** function returning
a promise, matching `getVariableByIdAsync`'s real shape. Do not touch
`hints.ts` yet.

The test should now fail, because the production code calls it synchronously and
gets a promise back. **That failure is the proof**: it demonstrates the suite was
asserting a contract the platform does not provide.

**Check**: `pnpm --filter @fig-tail/plugin test` fails, and the failure is in the
hints test for the reason above. Record the message in the commit.

### Step 2: Make the hint path async

Switch to `figma.variables.getVariableByIdAsync(id)`, `await` it, and propagate
`async` up through `collectHints` and its callers as far as needed. Cache the
**promise** rather than the resolved value, so repeated ids in one node await one
call.

Keep the catch, but let it distinguish an unavailable-library variable from a
platform error if you can do so without guessing. If you cannot, leave the
comment honest about what it now covers.

**Check**: the Step 1 test passes. `pnpm --filter @fig-tail/plugin test` passes.

### Step 3: Fix the remaining four mocks

Convert every other `getVariableById` mock to the async form. A mock that still
defines the sync API is a mock asserting the platform contract this plan just
disproved.

**Check**: `grep -rn "getVariableById\b" packages/plugin/src/ --include=*.test.ts`
returns only async definitions — no bare sync function returning a value.

### Step 4: Record it

Note in `packages/plugin/notes/platform-preflight.md` that the sync call was
found and replaced, that it was concealed by sync mocks, and that **whether it
actually threw in product was never observed**. Plan 011's Step 5c still runs —
it now confirms the fix rather than the defect.

**Check**: the note says plainly what was inferred from documentation versus what
was observed. Do not write that the bug was confirmed in Figma; nobody has looked.

## Validation plan

- **Unit**: the converted mocks plus the existing hint assertions.
- **Whole gate**: `pnpm check` → exit 0.
- **In-product** (plan 011 Step 5c): select `Variable / bound` with a config
  loaded and confirm the emitted class carries `exact-variable` provenance, per
  the expectation at `fixtures/figma/README.md:26`.
- **Honesty check**: this plan can make the code correct and the tests truthful.
  It **cannot** confirm the original bug was real. Only Figma can, and that is
  fine — the async form is correct under `dynamic-page` either way.

## Done criteria

- [ ] `hints.ts` uses `getVariableByIdAsync` and awaits it.
- [ ] The cache stores promises, not values.
- [ ] All five mocks are async; none defines a sync `getVariableById`.
- [ ] `pnpm check` exits 0.
- [ ] The note distinguishes documentation-inferred from observed.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- **Making the path async requires restructuring the codegen callback.** It
  should not — `mode-dev.ts:68` is already async. If it does, something else is
  going on.
- **A caller cannot become async** without changing a message contract the
  Inspect or lint path depends on.
- **You are about to revert a mock to sync to make a test pass.** That is the
  exact move that hid this for a whole release.
- **Latency visibly degrades** on a node with many bound variables. Record it and
  report; the 3 s budget now covers awaited round-trips.

## Handoff / after it lands

- **Plan 011 Step 5c** becomes a confirmation of the fix. If `Variable / bound`
  still fails to emit `exact-variable`, the diagnosis was wrong and the real cause
  is elsewhere — which would be worth knowing before the pilot.
- **Plan 011's latency step** should re-measure; this adds awaited calls to the
  codegen path.
- **A reviewer should scrutinise** the cache change hardest. Caching a resolved
  value where a promise belongs produces a stampede that only shows up on nodes
  with many bound variables — exactly the nodes a design system uses.
