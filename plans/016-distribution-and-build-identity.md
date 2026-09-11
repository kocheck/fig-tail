# Plan 016: Get the plugin onto two other machines, and keep it identifiable

> **Executor instructions**: Step 1 is an experiment whose result decides whether
> Steps 2–3 run at all. Do not skip ahead. If a step is BLOCKED, record why and
> continue — several outcomes here are legitimately "cannot be done on this plan
> tier", and saying so is the deliverable.

## Status

- **Priority**: P0
- **Effort**: M
- **Risk**: MED — the plugin-ID question could invalidate the shared-config story
- **Depends on**: 013 (GO), 011 Step 0
- **Category**: dx, process
- **Grounded at**: `abb2c1b` — 2026-09-10
- **Serves**: [GOAL-developer-adoption.md](GOAL-developer-adoption.md) conditions 1, 2

## Why this matters

The goal says two developers **install it themselves**. Today that means: clone
the repo, `corepack enable && pnpm install`,
`pnpm --filter @fig-tail/plugin build`, open Figma **desktop**, Plugins →
Development → Import plugin from manifest (`docs/setup.md:5-10`). `dist` is
gitignored (`.gitignore:2`), so there is no artifact to hand anyone — every
developer runs the toolchain.

A front-end developer can do that. Whether they *will*, unprompted, for a tool
they have not used yet, is exactly what condition 1 tests — and it is the most
likely place the goal fails for reasons that say nothing about whether the product
is good.

Underneath that sits a question nobody has tested. `setPluginData` is namespaced
per plugin ID (fact 7, `plans/README.md:97`).
`packages/plugin/notes/storage-matrix.md:24-26` asserts, uncited:

> Both accounts must use the **same plugin ID**. For a development plugin that
> means publishing a development version / ID mapping both accounts can install —
> not two separate `Import plugin from manifest` copies (those get distinct IDs).

If that is right, two developers importing the manifest separately get separate
storage namespaces, cannot read a shared config, and the product's headline
promise — *a designer drops the config once, developers just read classes* — is
unavailable on this path. Each developer would configure their own copy, and two
developers could silently disagree about what `bg-brand-500` means with no
mechanism to find out.

If it is wrong — if the hand-written `"id": "fig-tail-dev"`
(`packages/plugin/manifest.json:3`) is the namespace key for a locally imported
development plugin — then two accounts importing the *same* manifest file share
one namespace, and the whole cross-account gate clears with no publish, no
organization, and no escape hatch.

**Nobody has ever tested which.** It is the single highest-leverage unknown in
the program, and the experiment is cheap.

## The route B decision (carried over from plan 011)

Publishing a plugin privately to an organization requires **Organization or
Enterprise** ([Figma help](https://help.figma.com/hc/en-us/articles/4404228629655-Create-private-organization-plugins)).
This project is on **Professional**, so the owner decided on 2026-09-10 to ship
0.1.0 as a **local/team manifest install** and defer Community publish to 0.2.0.

That decision stands unless Step 1 changes the facts under it. Publishing to
Community — including any unlisted or link-only variant, which is still a publish
— remains out of scope and needs a fresh owner decision.

## Context the executor needs

- Two spikes exist with different hand-written manifest ids:
  `spikes/figma-platform` (`fig-tail-platform-spike`) and
  `spikes/figma-platform-isolation` (`fig-tail-platform-isolation`).
- **The isolation spike reads the wrong keys.**
  `spikes/figma-platform-isolation/main.js:3` reads
  `['ft.spike.meta', 'ft.spike.chunk.0', 'ft.spike.chunk.1']` — the *capture
  spike's* keys. fig-tail writes `figtail.meta`, `figtail.payload.*` and
  `figtail.document-id` (`packages/plugin/src/storage.ts:25-30`). Run unchanged it
  prints `ISOLATION PASS` regardless of whether namespacing works.
- `getPluginData(key)` returns `''` for an unknown key, a cleared key, and a key
  in another plugin's namespace. A key-by-key read cannot distinguish isolation
  from absence; `figma.root.getPluginDataKeys()` enumerates and can.
- The plugin has **no version or build identifier anywhere in its UI** — grep
  `ui/main.tsx` for a version string and you find none. With `networkAccess:
  ["none"]` and no console output, a pilot bug report cannot name a build.

## Scope

**In scope**: `spikes/figma-platform-isolation/main.js` (Step 1 only),
`packages/plugin/manifest.json` (version/id fields only, if Step 4 requires),
`packages/plugin/src/ui/` (build identity display), `docs/setup.md`,
`packages/plugin/notes/storage-matrix.md`, `packages/plugin/notes/platform-preflight.md`,
a new `docs/install.md`, and `plans/README.md`.

**Out of scope**:
- **Publishing anything** — Community, unlisted, or npm.
- **Matching, codegen or UI behaviour** beyond showing a build identifier.
- **The pilot itself** — plan 017.
- **Automating distribution** (a release pipeline, a hosted build). If Step 4
  concludes that is needed, it becomes a plan.

## Steps

### Step 1: Settle the plugin-identity question

Run in the design editor on a throwaway file, in one sitting.

1. **Fix the instrument.** Change `KEYS` in
   `spikes/figma-platform-isolation/main.js` to fig-tail's real keys
   (`figtail.meta`, `figtail.payload.0`, `figtail.document-id`). Fix the toast
   text, which currently says "spike data" and would contradict any screenshot.
2. **Positive control.** Have the isolation spike write and read back one key of
   its own. If that read is empty, the reader is broken and everything after it is
   meaningless — **STOP**.
3. **Negative control on the fig-tail side.** In the same session, immediately
   before the isolation read, confirm fig-tail shows
   `Using the config saved on this file` on that file. Without it, an empty read
   is indistinguishable from "no config here".
4. **Enumerate, both namespaces.** Call `figma.root.getPluginDataKeys()` from the
   isolation spike: it should return exactly its own control key and none of
   `figtail.*`. **Also call `figma.root.getSharedPluginDataKeys('figtail')`** and
   record it empty — that is the evidence behind the shipped privacy claim, since
   `grep -rn setSharedPluginData packages/plugin/src/` returns nothing and nobody
   has confirmed it in product.

   While here, replace the stale verdict at
   `packages/plugin/notes/platform-preflight.md:49` —
   `PASS (by documented private-plugin-data semantics); in-product UNVERIFIED`,
   the exact "PASS (code path)" pattern this project has been burned by — and
   reconcile it with `storage-matrix.md:14`, which says UNVERIFIED for the same
   check. The two records disagree and no other plan touches either.

5. **Then the real question**, which needs its own controls — sub-steps 1–4 test
   isolation between two *different* ids and do not control this at all.

   **Before B reads anything**: confirm both installs report the same
   `figma.pluginId`. **Clear B's personal config** (`Remove personal config`), or
   the tier you read is B's own. **Run in Dev Mode, not the design editor** —
   `mode-design.ts:21-29` posts `kind: 'empty'` with no tier string when there is
   no config, so there is no reading to take. Have B open the file **after** A
   saves: `readConfig` caches at module level and clears only on its own writes
   (`storage.ts:246-252`).

   Then: A saves a config on the file, B opens it in Dev Mode, B reads the label.

**How to score the label — this is easy to get backwards.** `storage.ts:400` is
`const overridden = available.document && available.user && preferred === 'user'`,
so the "overriding" label **requires the document tier to have been readable**:

| Label B sees | Means |
|---|---|
| `Using the config saved on this file` | **Shared.** B read A's document config. |
| `Using your personal config — overriding this file's shared config` | **Also shared** — `overridden` cannot be true unless `available.document` is true. B simply also has a personal config, which is why you were told to clear it. |
| `Using your personal config — this file has no shared one` | **Not shared** — after ruling out the four confounds above. |
| `No Tailwind config — …` | **Not shared**, same caveat. |

Scoring the second row as "a lower tier" would kill the shared-config story on
evidence that proves the opposite.

**Check**: `packages/plugin/notes/storage-matrix.md` gains a "Plugin identity"
section recording both `figma.pluginId` values, the positive control, the
fig-tail-side negative control, both enumerations, confirmation that B's personal
config was cleared, the verbatim label B saw, and its reading from the table
above. State plainly what it implies about whether a manifest `id` is the
namespace key.

### Step 2: Cross-account document read — if Step 1 says it is possible

Step 1.5 **is** the cross-account read. Do not re-record it here as though it were
an independent confirmation — one observation written into two documents reads to
a later reviewer as two, and this is the row that flips
`docs/release/feature-audit.md:17` from `**BLOCKER for Community**` to PASS.

What this step adds is **replication**: run the procedure at
`packages/plugin/notes/storage-matrix.md:28-39` again, on a different file, after
a Figma restart on both accounts. If the second run disagrees with the first, that
is the finding.

If Step 1 showed they do not, record
`BLOCKED — separate imports get separate namespaces; see plan 016 Step 1` and go
to Step 3. Do not improvise a substitute.

**Check**: the cross-account row in `storage-matrix.md` and
`docs/release/feature-audit.md` reads PASS, FAIL, or BLOCKED with the Step 1
reason. The Community-publish blocker line is updated to match.

### Step 3: Decide what the pilot's config story actually is

Step 1 and 2 determine which of two products the pilot tests:

- **Shared** — a designer configures once, developers read it. The promise as written.
- **Per-developer** — each developer sources the team's `tailwind.config.js` and
  `package.json` and configures their own copy via the personal tier
  (`clientStorage`, per-user per-plugin, so it works regardless of namespace).

If it is per-developer, write down the consequence nobody has stated: each
developer holds their own token set, resolved from their own copy, at their own
moment. Two developers can silently disagree about what `bg-brand-500` means, and
nothing tells either of them. Decide whether the pilot pins a single config file
version to remove that variable.

**Check**: `docs/install.md` states which story the pilot uses and, if
per-developer, how config drift between the two is prevented or accepted.

### Step 4: Make the install something a busy person completes

**Start from a known defect.** `docs/setup.md:5-10`'s step 2
(`pnpm --filter @fig-tail/plugin build`) **fails on a clean clone** — finding V10
in `docs/release/ux-findings-2026-09-10.md`, reproduced from empty `dist/`:
`Could not resolve "@fig-tail/match"`, and `packages/plugin/dist/` is left empty
so there is nothing to import into Figma. The verified working order is theme →
match → plugin, or `pnpm -r build`.

That single wrong line is the most likely cause of a condition-1 failure in the
whole programme, and it says nothing about whether the product is good.

Write `docs/install.md` for a developer who has not seen this repo: prerequisites,
the exact commands **in an order that works from a fresh clone**, the Figma
desktop path, what "success" looks like on first run, and what to do when it does
not. Correct `docs/setup.md` too, or delete it in favour of the new file.

Then decide the artifact question. `dist` is gitignored, so today every developer
builds. Options, with the cost stated rather than assumed: commit a built `dist`
on a release branch or tag; attach a zip to a GitHub release; or keep
build-from-source and accept the friction. Pick one and say why.

**Check**: on a machine (or container) with **no `dist/` present**, the commands
in `docs/install.md` run clean and produce `packages/plugin/dist/main.js` and
`ui.html`. Then someone who has not seen the repo follows it end to end without
asking a question, and says where they got stuck if they did. That person is the
check — not a re-read by the author — and **must not be one of the two pilot
developers**, or plan 017 measures condition 1 on a rehearsed install.

### Step 5: Make a bug report nameable

Add a build identifier to the plugin UI — the short commit SHA and a build date,
somewhere unobtrusive but copyable. With `networkAccess: ["none"]`, no telemetry
and no console output, this is the only way a mid-pilot report can say which build
it is about, and the only way to tell a fixed bug from a stale install.

Also write down the update loop: when a fix lands during the pilot, what exactly
do the two developers do, and how do they confirm they are on the new build? A
local manifest import does not update itself.

**Check**: the build identifier is visible in the plugin and a test asserts it is
rendered. `docs/install.md` has an "updating" section naming the steps.

## Validation plan

- Step 1's conclusion is stated as an inference from an observation, with the
  observation quoted — not as a restatement of the uncited claim it replaces.
- Step 4's check is performed by a person who is not the author.
- `docs/install.md` is followed literally, once, on a machine that has never had
  the plugin.
- **Acceptance**: two developers could be handed `docs/install.md` and nothing
  else. Confirmed by the owner.

## Done criteria

- [ ] The isolation spike reads fig-tail's real keys and has both controls.
- [ ] The plugin-identity question has a recorded answer with the evidence.
- [ ] The cross-account row reads PASS, FAIL, or BLOCKED-with-reason.
- [ ] The pilot's config story (shared vs per-developer) is decided and written.
- [ ] `docs/install.md` exists and has been followed by someone else.
- [ ] The plugin UI shows a build identifier; a test asserts it.
- [ ] The update loop is documented.
- [ ] Nothing was published anywhere.
- [ ] `plans/README.md` status row updated.

## STOP conditions

- **Step 1's positive control fails** — the reader cannot see its own data.
- **`figma.pluginId` differs between the two installs, or you cannot read it.** A
  shared or unshared read then proves nothing; report rather than assuming.
- **Anyone proposes publishing to Community** to solve the distribution problem.
  That reverses an owner decision.
- **The install requires more than the documented steps** and you are tempted to
  add "just also do X" verbally rather than to the doc.

## Handoff / after it lands

- **Plan 017 depends on Step 3's answer.** A per-developer config story changes
  what the pilot can claim, and 017 must say so rather than reporting a
  personal-tier pilot as evidence for the shared-config promise.
- **If Step 1 clears the namespace question**, the Community-publish blocker in
  `docs/community/publish-runbook.md` may be closable — but publishing is still a
  separate owner decision for 0.2.0, **and the evidence does not carry over
  unchanged**: a Community publish assigns a Figma-issued plugin ID, so the
  *mechanism* conclusion survives while every config stored under `fig-tail-dev`
  becomes unreadable. Restate that wherever the blocker is closed.
- **A reviewer should scrutinise** Step 1's inference hardest. It replaces an
  uncited claim that has shaped the entire program, and replacing one confident
  unverified sentence with another would be the worst outcome available.
