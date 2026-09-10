# Plan 017: Run the two-week pilot and read the result honestly

> **Executor instructions**: Step 1 is a gate. If the pilot does not exist —
> named people who have agreed, with the access they need — there is nothing to
> run, and discovering that in week one is the expensive way to learn it.
>
> Write down how you will read the result **before** it starts. That is Step 2,
> and it exists so a mixed outcome is not interpreted by the person most invested
> in it.

## Status

- **Priority**: P0
- **Effort**: M (mostly elapsed time, not work)
- **Risk**: MED
- **Depends on**: 013 (GO), 012, 014, 016. 011 and 015 strongly recommended.
- **Category**: research
- **Grounded at**: `abb2c1b` — 2026-09-10
- **Serves**: [GOAL-developer-adoption.md](GOAL-developer-adoption.md) — this plan
  is the measurement of all four conditions

## Why this matters

Every plan before this one is an input. This is the only one that produces the
answer, and it is the only one where a wrong result is expensive in someone
else's time rather than yours.

A council reviewing this program found that every proposed schedule ended at
"pilot" as an unplanned step. That is how a pilot becomes a vibe: two colleagues
try a thing, everyone is polite about it, and the verdict is whatever the author
already believed.

**Intent**: produce a result you would believe if it went against you.

## Context the executor needs

### What is not measurable, by design

`plans/README.md` invariant 5 makes no-telemetry permanent, and
`packages/plugin/manifest.json:10` sets `networkAccess: { allowedDomains: ["none"] }`.
The plugin emits no console output either. **Nothing automatically records that a
developer used fig-tail, on what, or how often.**

So conditions 2 and 3 are attested, not observed, and the instrument has to be
designed rather than assumed. Do not write a plan that pretends otherwise.

### The conditions, and the honest instrument for each

| # | Condition | Instrument |
|---|---|---|
| 1 | Self-install | Directly observable: did they complete `docs/install.md` unaided? Record where each got stuck. |
| 2 | Real use, two weeks | Attested. A short weekly check-in, plus counting *handoffs*, not days — three handoffs in two weeks is n=3, and calling it "two weeks of use" flatters it. |
| 3 | Paste without hand-checking | An unobservable negative — you cannot watch someone not check. Ask directly at the end, and corroborate with a behavioural proxy agreed in Step 2. |
| 4 | Would notice if it vanished | One question, asked at the end. Better: take it away for three days and see who asks. |

### The known live risk

Even after plan 015, the config-staleness problem is unsolved: the read cache
never invalidates on another session's write (`storage.ts:246-252, 376-381`), so a
developer with the plugin open serves stale classes indefinitely after the config
changes. Over two weeks on a live design system, that will happen. It is the most
likely way condition 3 dies quietly — the developer sees a wrong class, fixes it,
and stops trusting the output without ever filing anything.

## Steps

### Step 1: Confirm the pilot exists

Before anything else, in writing:

- **Two named developers** who have agreed — not "would probably be up for it".
- **Dev Mode access.** Codegen plugins run in Dev Mode, which requires a paid
  seat. The owner's two accounts prove nothing about a colleague's. If a seat has
  to be bought, that is a cost and a decision, not a footnote.
- **Real design handoffs scheduled** in the window. No handoffs, no pastes, no
  pilot.
- **A file with local variables**, if the variable path is to be exercised at all.
- **A start date and an end date.**
- **Which config story applies** — shared or per-developer, from plan 016 Step 3.

**Check**: all six are recorded in `docs/release/pilot-<start-date>.md`. Any
missing item is a STOP, not a note.

### Step 2: Pre-register how you will read the result

Write down, before the pilot starts, what each outcome means:

- What result means **ship** — keep using it, tell others.
- What result means **fix** — a specific defect class, then re-run.
- What result means **stop** — the product does not earn its place.
- **The split case.** Four conditions across two people will almost certainly
  return something mixed. Decide now how dev A yes / dev B no is read. Without
  this, the mixed result gets interpreted afterwards by whoever wants it most.

Also agree the behavioural proxy for condition 3 — something that would show up
if they *were* hand-checking, chosen with the developers rather than sprung on
them.

**Check**: the pre-registration is committed **before** the start date, and its
commit timestamp proves it.

### Step 3: Onboard, and watch the install without helping

Hand each developer `docs/install.md` and nothing else. Watch if you can. Do not
help unless they are truly stuck — the friction is the measurement, and every
hint you give deletes data.

Record for each: completed unaided or not, time taken, where they stopped, what
they asked.

**Check**: two install records in the pilot file, including failures.

### Step 4: Run the two weeks

Keep it light — the pilot should cost the developers almost nothing.

- **A shared place to report surprises**, agreed in Step 1. Every report should
  name the build identifier from plan 016 Step 5; without it a report cannot be
  reproduced.
- **One weekly check-in each**, ten minutes, same three questions both weeks.
- **When a fix ships mid-pilot**, follow plan 016's update loop and record who
  updated and when. A developer on a stale build reporting a fixed bug is a
  data-quality problem, not a bug.
- **Do not sell it.** Enthusiasm from the author contaminates conditions 3 and 4
  more than any other factor here.

**Check**: the pilot file has both weekly check-ins per developer and every
surprise report with its build identifier.

### Step 5: Read it against Step 2, then decide

Answer all four conditions per developer, with the evidence. Then read the result
against the pre-registration — **not** against what you hoped.

Write the verdict, including the parts that went against you. If the honest
answer is "condition 3 held for one and not the other, and here is why", that is
a better result than a clean yes, because it names the next thing to fix.

**Check**: `docs/release/pilot-<start-date>.md` carries a verdict per condition
per developer, plus one overall call matching a branch of Step 2's
pre-registration. `plans/README.md` and the goal document are updated with the
outcome.

## Validation plan

- The pre-registration commit predates the start date.
- Every claim in the verdict traces to a check-in note, an install record, or a
  surprise report — not to recollection.
- **Acceptance**: someone who was not involved reads the verdict and can say what
  happens next without asking a question.

## Done criteria

- [ ] All six Step 1 items recorded before the pilot started.
- [ ] Pre-registration committed before the start date.
- [ ] Two install records, including where each developer got stuck.
- [ ] Two weekly check-ins per developer.
- [ ] Every surprise report names a build identifier.
- [ ] A verdict per condition per developer, with evidence.
- [ ] One overall call matching a pre-registered branch.
- [ ] `plans/README.md` and `GOAL-developer-adoption.md` updated with the outcome.

## STOP conditions

- **Fewer than two developers have actually agreed**, or either lacks Dev Mode
  access. Do not start and count it as a pilot.
- **No design handoffs land in the window.** Reschedule rather than stretching
  what "real work" means.
- **A developer stops using it and does not say why.** With no telemetry, silent
  abandonment reads identical to quiet success. Ask — that is the single most
  important question in the pilot.
- **You are about to help with an install** you meant to observe.
- **The result is mixed and Step 2 did not anticipate that branch.** Stop and get
  the owner to read it, rather than interpreting it yourself.

## Handoff / after it lands

- **On ship**: the follow-up is Community publish (0.2.0), which reopens plan
  016's route B decision with real evidence behind it.
- **On fix**: the defects the pilot names become plans with the strongest possible
  grounding — a real user hit them on real work.
- **On stop**: write down why, plainly. A tool that resolves against the real
  config is a good idea whether or not this build earned its place, and the next
  attempt deserves to know what actually failed.
- **Whatever happens**, the config-staleness problem is still unsolved and is the
  most likely silent failure. If condition 3 came out weak, look there first.
