# Goal: two developers adopt fig-tail

Set 2026-09-10. This is the goal plans 011–017 serve. Every plan in the series
is justified by a line in here; anything that isn't, doesn't belong in the series.

## The goal

> **Two developers Kyle works with install fig-tail themselves, use it on real
> work for two weeks, paste the class strings it produces without hand-checking
> them against the config, and say at the end that they would notice if it
> disappeared.**

Four conditions, each independently observable:

| # | Condition | How it's observed |
|---|---|---|
| 1 | **Self-install** | Each developer completes installation without Kyle touching their machine or walking them through it live. |
| 2 | **Real use** | Two weeks, on work they were doing anyway — not a demo file, not a scheduled trial session. |
| 3 | **Trust** | They paste class strings without opening the Tailwind config to check them. Asked directly at the end; corroborated by whether they ever report drift the plugin surfaced. |
| 4 | **Retention** | Each answers yes to "would you notice if this disappeared tomorrow?" |

## Why this bar

Condition 3 is the whole product. A plugin whose output gets hand-checked every
time is worse than no plugin — it adds a step. Condition 4 is the cheapest honest
proxy for value: enthusiasm during a demo means nothing, and "would you miss it"
is hard to answer politely.

Conditions 1 and 2 exist to stop the goal being satisfied by Kyle's own
enthusiasm. A tool the author installs, configures and demonstrates has not been
adopted; it has been shown.

## What this goal makes true about the work

- **V1 becomes a blocker, not a polish item.** A near-miss currently drops the
  property from the class string with no signal
  (`packages/match/src/index.ts:186` — and again at `summarise.ts:12`, which feeds
  the Inspect panel, plus a dead third copy at `normalise.ts:163`; see
  `docs/release/ux-findings-2026-09-10.md`).
  A developer who pastes a string and gets an unstyled box learns to hand-check
  everything. Condition 3 cannot hold while V1 holds.
- **The Figma Community listing is not on the critical path.** Two named
  developers do not need a public listing. It stays deferred.
- **Distribution becomes a first-class problem.** See the conflict below.
- **Polish that doesn't serve conditions 1–4 is out.** Nice-to-haves get recorded
  in the UX findings and stay there.

## The conflict this goal exposes

Route B (decided earlier today, before this goal existed) ships 0.1.0 as a local
manifest install. That decision is now in tension with the goal, in two places.

**1. Self-install is currently a build.** `docs/setup.md:5-10` documents the only
install path: use Figma desktop, `corepack enable && pnpm install`,
`pnpm --filter @fig-tail/plugin build`, then **Plugins → Development → Import
plugin from manifest…**. A front-end developer can do this. Whether they *will*,
unprompted, for a tool they haven't used yet, is exactly what condition 1 tests —
and it is the single most likely place the goal fails.

**2. The shared-config story does not work across separate manifest imports.**
`packages/plugin/notes/storage-matrix.md:24-26`, verbatim:

> Both accounts must use the **same plugin ID**. For a development plugin that
> means publishing a development version / ID mapping both accounts can install —
> not two separate `Import plugin from manifest` copies (those get distinct IDs).

`setPluginData` is namespaced per plugin ID. Two developers importing the manifest
separately get two IDs, two storage namespaces, and cannot read a document-tier
config saved by anyone else. The product's headline promise — *a designer drops
the config once, developers just read classes* — is unavailable on this path.

**What still works**: the personal tier. `clientStorage` is per-user per-plugin,
so each developer can drop the config themselves and save personally. The goal is
reachable that way. But conditions 1 and 2 then include "each developer also
sources and configures the team's Tailwind config," and the shared-config promise
goes untested in the one pilot that could have tested it.

This is a decision, not a detail, and it determines whether plan 013 exists and
what plan 016 can claim. It is plan 016 Step 1 — an experiment nobody has run, and the highest-leverage unknown in the program.

## The series

| Plan | Title | Serves | Status |
|---|---|---|---|
| 013 | Find out whether fig-tail can read the pilot team's config | the gate — all four conditions are void if it fails | drafted |
| 014 | Restore variable matching | condition 3 — `exact-variable` is unreachable if the hint path is dead | drafted |
| 012 | Make the class string safe to paste unchecked | condition 3 | drafted, two decisions open |
| 015 | Make the product tell the truth about itself | conditions 1, 3, 4 | drafted |
| 011 | Verify fig-tail inside Figma (trimmed) | all — nothing is trustworthy until the build is known to work | drafted |
| 016 | Distribution, install path and build identity | conditions 1, 2 | drafted |
| 017 | Run the pilot and read it honestly | measures all four | drafted |

**Order** (not plan-number order): 013 → 011 Step 0 → 014 → 012 → 015 → 011 rest → 016 → 017.

**The series was restructured on 2026-09-10** after a five-advisor council review
(`docs/council/council-transcript-2026-09-10-plan-trim.md`). What changed: the
config check was promoted from a deferred contingency to the gate; the 1,000-node
linter, subtree performance and stamping-matrix steps were cut from 011 as
serving a Community publish already deferred; plugin identity, cross-account read
and cross-plugin isolation moved from 011 to 016 as distribution questions rather
than verification; the two UX plans were folded into one; and 011 gained a Step 0
exploratory hour, on the grounds that you cannot write a good runbook for software
nobody has watched run.

## Explicitly not in this series

- **Figma Community publish.** Deferred; two named developers don't need it.
- **The optional CLI** (plan 009). REJECTED for this ship and unrelated to the goal.
- **Widening resolver coverage** past what the pilot's real config needs. Plan 001
  landed at 4/8 wild fixtures fully resolved. If the pilot team's config resolves,
  that is sufficient for this goal; if it doesn't, that becomes a plan with a real
  reason to exist rather than a speculative one.
- **Everything in `docs/release/ux-findings-2026-09-10.md` that no condition
  needs.** Recorded, not scheduled.
