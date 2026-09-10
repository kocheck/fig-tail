# Plan 014: Restore variable matching (and stop the tests concealing it)

> **Executor instructions**: Follow each step and confirm its **Check**. Step 3's
> mock work is not cleanup — skipping it leaves the suite asserting the contract
> that hid this bug for a whole release.

## Status

- **Priority**: P0
- **Effort**: S
- **Risk**: MED — small diff, but it adds awaited round-trips inside a 3 s budget
- **Depends on**: 013 (GO)
- **Category**: bug
- **Grounded at**: `abb2c1b` — 2026-09-10 (no file under `packages/` has changed since)
- **Serves**: [GOAL-developer-adoption.md](GOAL-developer-adoption.md) condition 3

## Why this matters

`packages/plugin/src/codegen/hints.ts:47-53` calls the **synchronous**
`figma.variables.getVariableById(id)` inside a catch that swallows everything:

```ts
  let variable: Variable | null = null
  try {
    variable = figma.variables.getVariableById(id)
  } catch {
    // Variable may be from an unavailable library — fall through to value matching.
    variable = null
  }
```

`packages/plugin/manifest.json:9` declares `"documentAccess": "dynamic-page"`.
Figma's documentation for `getVariableById` states it throws when the manifest
declares that — unconditionally, keyed off the manifest field, not off whether a
page is loaded. **That sentence was read from a search summary, not a fetched
page** (`developers.figma.com` is unreachable from the authoring environment), so
treat it as very likely and unobserved. The vendored typings
(`@figma/plugin-typings`) declare both methods with no deprecation marker and no
mention of `dynamic-page`, which is exactly why `pnpm typecheck` never flagged it.

Every other document read in this plugin already uses the async form —
`pipeline.ts:114`, `stamp/apply.ts:87`, `lint/variables.ts:108`. `hints.ts:49` is
the only straggler.

**What is actually lost if it throws** — stated precisely, because the impact is
narrower than it first looks and misreading it will mislead plan 011:

- `exact-variable` requires `hint.codeSyntax`, which requires
  `variable.codeSyntax.WEB` to be set (`hints.ts:58-63`, consumed at
  `matchers/color.ts:181` and `matchers/length.ts:130-138`). On a file whose
  variables carry no WEB code syntax, `exact-variable` was **already**
  unreachable, and the throw costs nothing there.
- What is lost on every bound node is the **name tie-break** at
  `matchers/color.ts:116-120`, which picks the token whose name matches the
  variable's when several tokens share a value. Without it, a duplicate-valued
  palette resolves to an arbitrary-but-equal token name.
- Nothing crashes. `hints.ts:78-80` returns `{}` for nodes without
  `boundVariables`, and the catch contains the rest. Output just gets quietly
  worse — which is consistent with green tests, a shipped release, and nobody
  noticing.

**And the tests are why nobody noticed.** Four plugin mocks define
`getVariableById` synchronously, asserting a contract the platform does not
provide. Worse, `eslint.config.js:41` ignores `**/*.test.ts` and both
`packages/plugin/tsconfig.sandbox.json:24` and `tsconfig.ui.json:12` exclude
them — so test files are neither linted nor typechecked, and nothing mechanical
was ever going to catch this.

**Intent, for judgment calls**: a variable-bound layer should emit the token its
variable names. A change that makes tests pass without making that true is wrong.

## Context the executor needs

### The call graph

`collectHints` is reached from exactly two production sites, covering all four
surfaces:

| Call site | Context | Passes a cache? |
|---|---|---|
| `mode-dev.ts:73` — `collectHints(event.node)` | inside `figma.codegen.on('generate', async …)` (`mode-dev.ts:68`) | **No.** This is the path with the 3 s budget. |
| `pipeline.ts:119` — `collectHints(node as SceneNode, ctx.varCache)` | inside `resolveOne`, already `async` (`pipeline.ts:112`) | Yes — shared across workers |

Inspect, lint and subtree all route through `pipeline.ts`. `mode-design.ts` needs
no change; it reaches the hint path only indirectly and asynchronously.

**No function signature has to become `async`** — both callers are already inside
async contexts. What is needed is `await` at each, plus a type change on the cache.

### The cache, and why promises

`hints.ts:43-56` caches with `cache?.has(id)` rather than `get() ?? …`, which is
deliberate: it caches a **negative** result so an unresolvable id costs one
lookup, not one per binding. Preserve that.

The reason to cache promises is **not** repeated ids within one node —
`collectHints` resolves bindings sequentially (`hints.ts:85, 98, 106, 115` and the
loop at `:112-121`), so each `await` settles before the next begins and a value
cache would already be warm. The real stampede is one level up: `resolveNodes`
runs up to **8 workers concurrently** against one shared `ctx.varCache`
(`pipeline.ts:52, 167-168`). Eight sibling nodes bound to the same variable all
miss a value cache in the same tick and fire eight round-trips. On a
design-system page that is the common case.

### The deadline is start-gated

`pipeline.ts:154` checks `isExpired()` **before** calling `resolveOne`, not
during it. So a node that starts at 1.99 s runs its `getCSSAsync` plus up to 13
variable awaits before returning. Adding awaits inside `resolveOne` widens the
overshoot rather than being clipped by it.

Worst case per node is **13 lookups**: fills (`hints.ts:83`), strokes (`:96`),
fontSize (`:104`), plus 10 `SCALAR_FIELDS` (`:27-40`).

## Inputs & resources

| Purpose | Command | Expected |
|---|---|---|
| Full gate | `pnpm check` | exit 0 |
| Plugin tests | `pnpm --filter @fig-tail/plugin test` | all pass |
| Baseline | `pnpm --filter @fig-tail/plugin exec vitest run src/codegen/hints.test.ts` | 8 passed |
| Find sync mocks | `grep -rn "getVariableById\b" packages/plugin/src --include=*.test.ts` | **4** hits |

The unqualified grep `getVariableById` returns 5 because it also matches
`stamp/apply.test.ts:73`, which is **already** `getVariableByIdAsync` and correct.
Use the `\b` form.

## Scope

**In scope**:
- `packages/plugin/src/codegen/hints.ts` — the call, the signature, the cache, and
  the doc comment at `:66-72` that promises one lookup per unique id.
- `packages/plugin/src/pipeline.ts` — the `await` at `:119`, the `varCache` element
  type at `:62`, and the doc comment at `:132-140`.
- `packages/plugin/src/mode-dev.ts` — the `await` at `:73` **and passing a cache**.
- `packages/plugin/src/codegen/hints.test.ts` — both mocks and all 8 call sites.
- `packages/plugin/src/pipeline.test.ts`, `pipeline.consistency.test.ts` — the two
  remaining sync mocks, plus one new test with a real `boundVariables` node.
- `packages/plugin/notes/platform-preflight.md`.

**Out of scope**:
- **`stamp/apply.test.ts`.** Already async and mocking an already-correct site.
- **The other three async call sites.** Already correct.
- **Removing the catch.** An unavailable-library variable is a real case; what
  changes is that it stops swallowing a platform-contract error.
- **Matching logic.** This restores an input; it does not change what the matcher
  does with it.

## Steps

### Step 1: Write a mock that models the platform, not the mistake

Do **not** simply make the existing mock `async`. That produces a failure — the
production code gets a Promise, `hints.ts:60` reads `.WEB` off it and throws a
`TypeError` outside the try/catch — but it proves nothing except that a mock no
longer matches its caller. It is circular.

Instead, mock what the documentation says the platform does:

```ts
getVariableById: () => { throw new Error('dynamic-page: use getVariableByIdAsync') },
getVariableByIdAsync: async (id: string) => variables[id] ?? null,
```

Against today's code that fails with empty hints — `expected {} to equal { … }` —
which is **the exact production symptom**: the swallowing catch turning a platform
throw into no hints at all. That is a regression test worth keeping.

**Check**: `pnpm --filter @fig-tail/plugin exec vitest run src/codegen/hints.test.ts`
fails with a hint-mismatch (not a `TypeError`), and the failure message is
recorded in the commit. Commit red.

### Step 2: Make the hint path async

- `hints.ts` — call `getVariableByIdAsync`, and cache the **promise**:

  ```ts
  const p = figma.variables.getVariableByIdAsync(id).catch(() => null)
  cache?.set(id, p)
  return p
  ```

  Attach `.catch` **before** caching. A rejecting promise sitting in a Map with no
  handler is an unhandled rejection, and it would move the catch semantics to
  every caller. This is the single most likely way to ship a regression here.
- `pipeline.ts:119` — `await`. Note the ternary types as `Promise<…> | {}` and will
  not compile as-is; restructure to `'boundVariables' in node ? await collectHints(…) : {}`.
- `pipeline.ts:62` — `varCache` becomes `Map<string, Promise<Variable | null>>`.
- `mode-dev.ts:73` — `await`, **and pass a fresh `new Map()`**. Today it passes no
  cache at all, so every binding is an independent lookup. Left alone, the
  codegen path — the only one with a hard 3 s budget — would go from 13 free sync
  calls to 13 sequential awaited round-trips where 6 would do, while the headline
  cache work benefits only the other surfaces.

**Check**: Step 1's test passes. `pnpm check` exits 0.

### Step 3: Fix the remaining mocks — and the assertions that go vacuous

Convert the two remaining sync mocks (`pipeline.test.ts:12`,
`pipeline.consistency.test.ts:35`).

Both are currently **dead**: no mocked node in either file carries
`boundVariables`, so `pipeline.ts:119`'s guard is always false and `collectHints`
is never reached. Converting them alone verifies nothing. So also **add one node
with `boundVariables` to `pipeline.test.ts`** and assert that N sibling nodes
sharing one variable produce **one** lookup. That is the only test that would
actually exercise the promise cache, the concurrency and the shared context — the
three things this change puts at risk — and there is no such test today.

Then fix the two assertions that this change silently guts.
`hints.test.ts:132` and `:148` read:

```ts
expect(() => collectHints(node)).not.toThrow()
```

Once `collectHints` is async, that is **vacuously true forever** — an async
function returns a rejected promise instead of throwing — and it leaves an
unhandled rejection behind. Rewrite as
`await expect(collectHints(node)).resolves.toEqual({})`.

Note that neither ESLint nor `tsc` will catch this: test files are excluded from
both (`eslint.config.js:41`, `tsconfig.sandbox.json:24`, `tsconfig.ui.json:12`).
Nothing mechanical protects this step; read it yourself.

**Check**: `grep -rn "getVariableById\b" packages/plugin/src --include=*.test.ts`
returns only throwing or async definitions. No `not.toThrow` remains on an async
call. The new shared-cache test passes and fails if the cache stores values.

### Step 4: Record what is known and what is not

In `packages/plugin/notes/platform-preflight.md`: the sync call was found and
replaced; it was concealed by sync mocks in files that are neither linted nor
typechecked; the throw itself was **inferred from documentation and never
observed**.

Do not write that the bug was confirmed in Figma. Nobody has looked.

**Check**: the note distinguishes inferred from observed, in those words.

## Validation plan

- **Unit**: Step 1's platform-shaped mock, plus Step 3's shared-cache test.
- **Whole gate**: `pnpm check` → exit 0.
- **In-product** (plan 011 Step 5c): select `Variable / bound` with a config
  loaded. **Record the variable's `codeSyntax.WEB` alongside the confidence** — if
  it is unset, `exact-variable` is unreachable by design and a result of
  `exact-value` says nothing about whether this fix worked.
- **Honesty check**: this plan can make the code correct and the tests truthful.
  It **cannot** confirm the original bug was real. The async form is correct under
  `dynamic-page` either way.

## Done criteria

- [ ] `hints.ts` uses `getVariableByIdAsync`, awaited, with `.catch` before caching.
- [ ] `pipeline.ts:62`'s cache type holds promises; `:119` awaits.
- [ ] `mode-dev.ts:73` awaits **and passes a cache**.
- [ ] All four sync mocks are gone; `stamp/apply.test.ts` untouched.
- [ ] No `not.toThrow` remains on an async call.
- [ ] A test exercises `collectHints` through `resolveNodes` with shared bindings.
- [ ] Both "one lookup per unique id" doc comments are true.
- [ ] `pnpm check` exits 0; the note separates inferred from observed.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- **A caller cannot become async** without changing a message contract. It should
  not — both are already in async contexts.
- **You are about to revert a mock to sync** to make a test pass. That is the move
  that hid this for a release.
- **Subtree export overshoots its deadline.** `pipeline.ts:154` gates on expiry
  *before* `resolveOne`, so 150 nodes × up to 13 awaits extends the overshoot past
  the 2 s internal deadline rather than being clipped by it. Measure before and
  after on a large subtree; if it worsens materially, report rather than tuning.
- **Codegen latency approaches 3 s** on a node with many bound variables.

## Handoff / after it lands

- **Plan 011 Step 5c** becomes a confirmation of the fix — but only if the fixture
  variable carries WEB code syntax. Check that first, or the step produces a false
  negative and the handoff note ("if it still fails, the diagnosis was wrong")
  would mislead.
- **Plan 011's latency step** should re-measure; this adds awaited round-trips to
  the codegen path.
- **A reviewer should scrutinise** the cache change hardest: a resolved value
  cached where a promise belongs produces a stampede visible only on nodes with
  many shared bindings — exactly the nodes a design system uses, and exactly what
  Step 3's new test exists to catch.
