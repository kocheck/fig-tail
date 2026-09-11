# Council transcript — trim the plan series, or keep verification coverage?

**Date**: 2026-09-10 · **Repo state**: `abb2c1b` (plans branch at `f4855c0`)

**Process note**: five advisors answered independently, then **three** independent
reviewers read all five anonymized responses (the standard council runs five
reviewers; three were run here). A chairman synthesized with a verified-facts
block attached so advisor errors could be corrected rather than inherited.

---

## The question

Should the fig-tail plan series be trimmed for speed, or keep its verification coverage?

fig-tail is a Figma Dev Mode plugin emitting Tailwind class names resolved against a
team's real config. Competitors emit arbitrary values (`bg-[#3b82f6]`); fig-tail
resolves against the real config and emits the real token, reporting honestly when
there is no match. v0.1.0 is fully built and unit-tested and has **never run inside
Figma** — 48 UNVERIFIED markers.

**Goal (owner-approved)**: two developers install fig-tail themselves, use it on real
work for two weeks, paste its class strings without hand-checking, and say they'd
notice if it disappeared.

**Proposed cuts**: (1) cut 011 Steps 5/7/8 — cross-plugin isolation, 1000-node linter
perf, subtree export perf, stamping matrix; (2) turn those features off rather than
verify them; (3) fold plans 014+015 into 013; (4) drop the screenshot + env-stamp
requirement per PASS row; (5) add a config-resolution smoke test as top prerequisite
(only 4/8 real-world Tailwind configs fully resolved).

---

## Verified facts supplied to the chairman

Checked directly against the repo. Where an advisor contradicts one, the fact wins.

| Fact | Status |
|---|---|
| `codegen/hints.ts:49` calls **synchronous** `getVariableById` under `documentAccess: "dynamic-page"`, inside `catch { variable = null }`, while `stamp/apply.ts:87`, `pipeline.ts:114` and `lint/variables.ts:108` all use the async form | Code fact CONFIRMED; whether it throws in product is unconfirmed but likely |
| The drift linter is **not** in the manifest — it is a button in the plugin UI. Only `subtreeFormat` is a user-flippable `codegenPreferences` dropdown | CONFIRMED (corrects the Contrarian) |
| Lint findings are fully computed and passed to the UI (`lint/run-lint.ts:8`); `ui/main.tsx:400` renders only a count. `dismissFinding` has zero callers | CONFIRMED (supports the Expansionist) |
| The `nearest` filter exists **twice** in production — `match/src/index.ts:186` and `match/src/summarise.ts:12` (Inspect) — plus a dead third copy at `normalise.ts:163` | CONFIRMED |
| All five plugin test mocks define `getVariableById` **synchronously** — the suite encodes the contract that is wrong under dynamic-page, so green tests conceal the bug | CONFIRMED |
| `plans/README.md:442` credits plan 003 with a config "staleness warning" that exists nowhere in the code; the read cache never invalidates on another session's write | CONFIRMED |

---

## Advisor responses

### The Contrarian

The framing is the flaw — you're debating verification breadth for a product that may
have nothing worth verifying. Confirmed the platform bug: sync `getVariableById` in a
bare catch under dynamic-page, so every hint silently becomes null and exact-variable
matching is dead with no error surface. Not "probable." Fix it before anyone installs
anything. Take cut 5 — it outranks the entire series. Refuse cut 2 as stated: delete
the features from the manifest, don't "turn them off." Refuse cut 4 — this repo has
already produced PASS rows nobody observed and a spike printing ISOLATION PASS while
reading keys no plugin wrote; screenshots are the antibody to that specific pathology.
Accept 1 and 3, but keep Step 5 — it's the namespace experiment, not a perf test.
`networkAccess: none` means silent abandonment reads identical to success; schedule the
week-one check-in now.

### The First Principles Thinker

You're asking a scheduling question about the wrong artifact. 011 is a
publish-readiness audit; the goal is "two people paste without hand-checking."
Trimming rows of the wrong instrument doesn't make it the right one. The goal contains
exactly one falsifiable claim — the emitted string is safe to paste unexamined — and
three facts already in hand say it's false today, none needing Figma: `index.ts:186`,
`hints.ts:49`, and 4/8 config fixtures. Order: find out if there's a product, fix the
promise, then observe it load. Config smoke on the pilot team's actual config is a hard
go/no-go — kill the program there if it fails. Accept 1, 2, 5. Fold 014/015 — you
cannot write UX plans for a product no one has seen run. Drop screenshots, keep
observed-value + SHA; that's the anti-fake-PASS mechanism. Step 5 is distribution
research, not verification — move it into 013.

### The Expansionist

Take every cut except one, and the one you refuse is the one everyone calls dead
weight. Refuse cut 2 for the drift linter — not verify it, *fix the display* and make
it the pilot's second question. Codegen plugins are a commodity with four competitors
and a ceiling of "saves me 30 seconds per component"; nobody switches over that, and
"I'd notice if it disappeared" is a weak claim for a time-saver. But "your design file
contains 41 colours your config can't name" is a report nobody else can produce,
because nobody else resolves against the real config — a second product hiding inside
this one, with a different buyer (design-system owners), a different cadence (weekly
audit), and a much stickier verdict. And it's cheap: findings are already computed,
just never rendered. The pilot should test two hypotheses, not one.

### The Outsider

Three things stop me cold, none about which steps to cut. Nobody has opened it in
Figma — and the proposed response is a 10-step runbook with build SHAs and
screenshots. Why isn't the response: one person installs it this afternoon and uses it
for an hour? You cannot write a good runbook for software you've never watched run.
Cut #5 is not a cut — it's the only item answering "does this product do anything at
all," and you should test the pilot team's config, not eight generic ones. Twenty
minutes, today. Two of your "features" aren't broken, they're false advertising: a
Markdown export the README promises that never renders, a linter whose findings are
never shown, a class string the README calls "safe to paste" that silently drops
properties. The real work is deleting the claims. For two colleagues, 011 as written is
aviation certification for a paper airplane.

### The Executor

The `hints.ts`/`apply.ts` inconsistency inside a silent catch is the bug, not a
hypothesis. Figma's codegen callback can be async — make `resolveVariable` async, await
the Async variant, cache promises. An hour, not a plan. Monday AM: fix `hints.ts`, then
012 — both code, both testable at your desk, both invalidate any verification run done
before them. Never run an L-effort human runbook against a build you're about to
change. Monday PM: config smoke on the pilot team's actual config, from the CLI, no
Figma needed. Tuesday: build the nine-node fixture — it doesn't exist, it's the real
long pole, nobody scheduled it. Wednesday: 011 Steps 1–4, 6, 9, 10; keep Step 5. Refuse
cut 4 — screenshots cost ~20 seconds a row and you already shipped fake PASS rows; drop
the env stamp per row and stamp once per session.

---

## Peer reviews

Anonymization mapping: **A** = Executor, **B** = Contrarian, **C** = Outsider,
**D** = First Principles, **E** = Expansionist.

### Reviewer 1
Strongest: **A** — the only one that both diagnoses and prescribes at file level, and
its sequencing rule ("never run an L-effort human runbook against a build you're about
to change") is the actual answer to the question asked. Biggest blind spot: **B** —
refuses cut 2 on a false premise; the manifest exposes no lint preference, so the
dropdown it wants deleted doesn't exist, and its line cite was off by two. Confident
file-level claims that don't hold are exactly the pathology it warns about. All five
missed: the `nearest` filter exists twice, and every unit test mocks
`getVariableById` synchronously — green tests actively conceal the bug.

### Reviewer 2
Strongest: **D** — the only one naming the wrong-instrument problem precisely and
reducing the debate to one falsifiable claim with a hard go/no-go that can kill the
program before more plans get written. It also splits cut 4 correctly. Biggest blind
spot: **B**, same false premise, and it missed that findings are computed and thrown
away at the UI, making lint nearly free to expose. All five missed **the mid-pilot
update loop**: nobody costed how a new build reaches two developers who imported a
local manifest, or how — with `networkAccess: none` — you know which build a PASS row
or a pilot complaint refers to.

### Reviewer 3
Strongest: **B** — the only one whose refusals are backed by verifiable artifacts;
`subtreeFormat` is a manifest dropdown a pilot developer will flip into broken output,
so deletion is the only real off switch. Biggest blind spot: **E** — proposes a second
product for software no human has watched load, and accepts cut 4 despite the
documented fake-PASS history. All five missed **the pilot itself**: nobody asks whether
the two developers exist, have agreed, hold Dev Mode seats (the owner's two accounts
prove nothing about theirs), have a file with local variables, or when the two-week
clock starts. That, plus gitignored `dist`, is the actual critical path.

---

## Chairman's verdict

### Where the council agrees

**Five for five**: the config-resolution smoke test is not a cut — it is the gate.
Everyone independently promoted it to first position, and four of five specified it
should run against the *pilot team's actual* config, not eight generic fixtures.

**Four of five**: 012 ships before any human runbook. "Safe to paste unexamined" is the
entire product claim, and a string that silently loses a property falsifies it by
construction.

**Four of five**: fold 014+015 into 013 — you cannot write UX plans for software nobody
has watched load.

**Three of five**, the Executor stating it best: *never run an L-effort human runbook
against a build you are about to change.* That sequencing rule, not the trim list, is
the actual answer to the question asked.

### Where the council clashes

**Screenshots.** Contrarian and Executor refuse to drop them, citing this repo's own
fake-PASS history. First Principles and Expansionist drop them, keeping observed-value
+ SHA as the anti-fake mechanism. Both are right about the pathology and differ only on
dosage; the Outsider splits it correctly — screenshots on the four or five rows that
gate the pilot, not on routine rows.

**Scope.** The Expansionist's design-system audit report is a genuinely better product
than a 30-second-per-component time-saver, and nearly free. But both reviewers who
flagged it are right that you cannot propose a second product for software no human has
seen run. Render the findings — a display fix, not a product bet — and let the pilot
report which of the two people actually use.

**A verified fact settles cut 2.** The Contrarian refused it because "the manifest ships
subtreeFormat and lint as codegenPreferences." Half wrong: only `subtreeFormat` is a
dropdown; the linter is not in the manifest at all. Reviewers 1 and 2 caught this;
Reviewer 3, who ranked the Contrarian strongest, did not. The underlying instinct
survives — a manifest dropdown is not something you "turn off," deletion is the only
real off switch — but it applies to one feature, not two.

### Blind spots the council caught

1. The `nearest` filter exists twice in production; 012 as originally scoped fixed one
   and left the Inspect panel lying.
2. All five test mocks define `getVariableById` synchronously — green tests are actively
   concealing the `hints.ts:49` bug. Fixing the code without the mocks re-locks it in.
3. The pilot is unplanned in every proposed order. Do the two developers exist, have
   they agreed, do they hold Dev Mode seats, do they have files with local variables,
   when does the clock start? And with `networkAccess: none` plus a gitignored `dist`,
   nobody costed how a new build reaches them mid-pilot.

### Verdict on each cut

| Cut | Verdict | Reasoning |
|---|---|---|
| 1 — cut Steps 5/7/8 | **MODIFY** | Cut 7 and 8 (perf runs; no users to be slow for). Keep Step 5 but move it into 013 — it is the distribution/namespace question, not verification. |
| 2 — features off | **MODIFY** | "Off" is not achievable for `subtreeFormat` — delete it from the manifest. Nothing to turn off for lint; render the findings it already computes. |
| 3 — fold 014+015 | **ACCEPT** | Unmodified. |
| 4 — drop evidence | **MODIFY** | Keep observed-value + build SHA on every row. Env stamp once per session. Screenshots only on pilot-gating rows. |
| 5 — config smoke test | **ACCEPT, and promote** | Not a cut. It is the go/no-go, run from the CLI against the real config, today. |

### The recommendation

Trim hard — not because speed matters, but because 011 is the wrong instrument aimed at
an unproven product.

1. Pilot team's real config through the resolver, CLI. Fails → stop the program.
2. Same day, 60 minutes: open v0.1.0 in Figma and use it.
3. Fix `hints.ts:49` to the async variant — **and all five mocks**, or the suite
   re-conceals it.
4. Fix V1 in `index.ts:186` **and** `summarise.ts:12`; delete `normalise.ts:163`.
5. Strip `subtreeFormat` from the manifest; render lint findings; rewrite the README to
   describe what exists.
6. Build the nine-node fixture — the unscheduled long pole.
7. Write 011 from what you observed in step 2: Steps 1–4, 6, 9, 10, plus one row proving
   a variable-bound node emits the token, not a hex.
8. 013: install path, build identity visible in-UI, mid-pilot update mechanics.
9. Confirm the pilot exists — two named devs, Dev Mode seats, variable-bearing files, a
   start date — before step 7, not after.

### The one thing to do first

Today, from the CLI, run the pilot team's actual `tailwind.config` through fig-tail's
resolver and read the output. Everything else is contingent on what comes back.
