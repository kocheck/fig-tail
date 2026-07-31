# Plan 008: Surface Code Connect mappings and dev resources

> **Executor instructions**: Follow this plan step by step. Confirm each step's
> **Check** before moving to the next. If anything in "STOP conditions" occurs,
> stop and report — do not improvise. When done, update the status row for this
> plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat <SHA at which 004 completed>..HEAD -- packages/plugin/src`
>
> **⚠️ Step 1 is a feasibility spike that may kill half of this plan.** Do it
> first and report before building anything.

## Status

- **Priority**: P3
- **Effort**: S — assuming Step 1 comes back positive. If the Code Connect half
  is not feasible, the dev-resources half alone is XS.
- **Risk**: MED — this is the only plan in the program built on an API surface
  that has **not** been verified. See "What is not verified" below.
- **Depends on**: 004
- **Category**: dx
- **Grounded at**: the commit at which plan 004 landed.

## Why this matters

Everything fig-tail does so far answers "what classes describe this?" This plan
answers the question a developer asks immediately afterwards: **"is this already
built?"**

When a Figma component is mapped to a real code component via Code Connect,
emitting `<div class="flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2">`
is actively unhelpful — the right answer is `<Button variant="primary" />`, and
handing over the class string invites someone to rebuild a button that already
exists. Surfacing the mapping turns fig-tail from a converter into a router:
here is the component, and here are the classes only if you need them.

Dev resources — the links Figma already attaches to nodes (repo, Storybook,
ticket) — are the cheap version of the same idea, and unlike Code Connect their
API is confirmed.

This is P3 because it depends on the team having Code Connect set up, which is a
separate investment. If they do, this is the highest-value small plan in the
program. If they do not, only the dev-resources half applies.

## Context the executor needs

### What is verified

`node.getDevResourcesAsync()` exists and returns the dev resources (links)
attached to a node. Its siblings `addDevResourceAsync`, `editDevResourceAsync`,
and `deleteDevResourceAsync` also exist — **this plan uses only the read one.**

### What is NOT verified — Step 1 must establish it

**Whether the Figma *plugin* API exposes Code Connect mappings at all.**

Code Connect mappings are readable through Figma's **MCP server**
(`get_code_connect_map`) and through the Code Connect CLI, but it has not been
confirmed that a plugin running in the Dev Mode sandbox can read them. It is
entirely possible that:

- there is a plugin API for it (best case — build the feature),
- mappings surface only as dev resources of a particular kind (workable —
  detect and present them), or
- they are not exposed to plugins at all (then the Code Connect half of this
  plan is dead, and only dev resources ship).

Do not assume. Do not build against a guessed API shape. Step 1 exists to find
out, and reporting "not feasible" is a successful outcome for it.

### The component-set problem

Even with a mapping available, a Figma component has variants and properties
(`Size=Large, Variant=Primary, State=Default`) that must become code props
(`size="lg" variant="primary"`). Reading them is straightforward —
`node.componentProperties` on an `INSTANCE`, and `node.variantProperties` — but
mapping Figma property names to code prop names requires the Code Connect
definition itself, not just the fact that a mapping exists.

**Scope decision**: if Step 1 shows the mapping is available but the prop
mapping is not, emit the component name and the raw Figma properties as a
comment, not as invented props. Guessing `variant="primary"` from a Figma
property called `Variant` is usually right and occasionally wrong, and wrong
prop names in pasted code cost more than a comment does.

## Inputs & resources

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm -r typecheck` | exit 0 |
| Test | `pnpm --filter @fig-tail/plugin test` | all pass |
| Build | `pnpm --filter @fig-tail/plugin build` | `dist/main.js`, `dist/ui.html` |
| Write-safety | `pnpm --filter @fig-tail/plugin lint && pnpm --filter @fig-tail/plugin test -t write-safety` | exit 0, passes |

Needed on hand:

- Figma desktop app.
- **A Figma file with at least one Code Connect mapping**, plus the ability to
  create one. If none exists, creating one requires the Code Connect CLI and a
  codebase with components — budget time for this in Step 1, and if it cannot
  be arranged, that is a STOP condition (you cannot verify a feature you cannot
  observe).
- A node with dev resources attached (add one by hand: right-click a node in
  Dev Mode → add link).
- Reference: Figma Code Connect docs, and `node.getDevResourcesAsync()` in the
  plugin API docs.

## Scope

**In scope**:

- `packages/plugin/src/connect/**` — reading mappings (if feasible) and dev
  resources
- `packages/plugin/src/render.ts` — a "Component" section above the Tailwind
  section when a mapping exists
- `packages/plugin/manifest.json` — a preference to toggle the section
- `packages/plugin/spike/code-connect-FINDINGS.md` — Step 1's output
- Tests and a README section

**Out of scope**:

- **Creating or editing Code Connect mappings.** Read-only. Mapping is done in
  the codebase with the Code Connect CLI, where it belongs.
- **Adding, editing, or deleting dev resources.** `addDevResourceAsync` and
  friends are document writes and are forbidden by the program's write-safety
  invariant. Read only.
- **Inventing prop names** from Figma variant properties without a mapping. See
  "The component-set problem".
- **Anything requiring network access.** The manifest stays
  `allowedDomains: ["none"]`. If reading mappings needs a network call to
  Figma's API, that is a STOP condition, not a manifest change.
- Substituting components into plan 007's subtree output — a follow-up once both
  plans have landed and this one is known to work.
- Publishing — plan 009.

## Working approach

- Branch as instructed. Commit per step, prefixed `008-N:`.
- **Step 1 gates everything.** Do not write feature code before its findings are
  written down and reported.

## Steps

### Step 1: Spike Code Connect readability from a plugin

**Produces findings and a go/no-go, not shipped code.**

On a file with a known Code Connect mapping, write
`packages/plugin/spike/code-connect.ts` and answer, in
`packages/plugin/spike/code-connect-FINDINGS.md`, with pasted evidence:

1. Is there any `figma.*` plugin API that returns Code Connect mappings? Search
   the current `@figma/plugin-typings` for `codeConnect` / `CodeConnect`
   (`grep -ri codeconnect node_modules/@figma/plugin-typings/`) and paste what
   you find, including the absence of results.
2. Does `node.getDevResourcesAsync()` on a Code-Connected component return
   anything mapping-shaped? Paste the raw output for a mapped component, an
   unmapped component, and a plain frame.
3. What do `node.componentProperties` and `node.variantProperties` return on a
   real instance? Paste them.
4. For an `INSTANCE`, can you reach the main component
   (`await node.getMainComponentAsync()`) and its parent `COMPONENT_SET`? Paste
   the names.
5. Does anything reach Code Connect **without** network access?

Then write a **go/no-go** with a reason:

- **Go** — a usable mapping source exists; build Steps 2–4.
- **Partial** — no mapping, but dev resources and component identity are
  readable; build Steps 3–4 only, and mark Step 2 REJECTED in
  `plans/README.md` with the reason.
- **No-go** — none of it is reachable; ship nothing and mark the plan REJECTED
  with the findings as the rationale.

**Check**: `code-connect-FINDINGS.md` answers all five questions with pasted
evidence and states a go/no-go with a reason. **Report the outcome before
proceeding** — a Partial or No-go changes what the rest of this plan is.

### Step 2: Render the Code Connect section *(only if Step 1 says Go)*

Emit a new `CodegenResult` section, **placed above** the Tailwind section, since
"this already exists" outranks "here are the classes":

```
Title:    "Component"
Language: "TYPESCRIPT"
Code:     <Button />
          // Figma: Button / Primary / Large
          // Properties: Variant=Primary, Size=Large, State=Default
          // Source: src/components/Button.tsx
```

Include real props **only** if Step 1 established a reliable prop mapping.
Otherwise emit the component name and the Figma properties as comments, exactly
as above.

**Check**: on a mapped component, the section appears with the right component
name and source path. On an unmapped component and on a plain frame, it is
absent — not present-and-empty.

### Step 3: Render the dev resources section

When `getDevResourcesAsync()` returns anything, emit:

```
Title:    "Links"
Language: "PLAINTEXT"
Code:     Storybook — https://storybook.example.com/?path=/story/button
          Repo      — https://github.com/example/app/blob/main/src/Button.tsx
```

Absent when there are no resources. Truncate a URL list over 10 entries with a
count.

**Check**: attach two dev resources to a node by hand in Dev Mode; the section
lists both with their names. Remove them; the section disappears. Confirm the
plugin **did not** modify them — `getDevResourcesAsync()` returns the same
values after the plugin has run as before.

### Step 4: Add the preference and document

Add a `bool` codegen preference, "Show component and link sections"
(default `true`). Write a README section covering what is shown, that Code
Connect must be set up in the codebase for the Component section to appear,
that fig-tail only reads and never writes mappings or links, and — if Step 1
came back Partial — what is *not* shown and why.

**Check**: toggling the preference hides and shows both sections without a
plugin reload. A developer reading the README can tell whether they need Code
Connect set up and what they would get if they did.

## Validation plan

- **Step 1's findings document** — the primary artefact of this plan, and the
  thing that justifies whatever ships.
- **Unit tests** (mocked `figma`): section emitted when a mapping/resources
  exist, absent when not; the >10 resources truncation; graceful handling when
  `getDevResourcesAsync()` rejects (a section must never break codegen).
- **Manual matrix**: a mapped component (Component + Links + Tailwind), an
  unmapped component (Tailwind only), a node with links (Links + Tailwind), a
  plain frame (Tailwind only).
- **Read-only assertion**: dev resources and mappings are byte-identical before
  and after running the plugin.
- **Write-safety regression**: plan 003's guards pass with **no new allowlist
  entries**. `addDevResourceAsync` / `editDevResourceAsync` /
  `deleteDevResourceAsync` must appear nowhere in the bundle — add that to the
  bundle test's banned list.

## Done criteria

ALL must hold. (If Step 1 returned Partial, criteria marked *(Go only)* are
skipped and the reason is recorded in `plans/README.md`.)

- [ ] `pnpm -r typecheck && pnpm -r lint && pnpm -r test` → exit 0
- [ ] `code-connect-FINDINGS.md` answers all five questions with evidence and
      states a go/no-go
- [ ] *(Go only)* The Component section appears for mapped components with the
      correct name and source, and is absent otherwise
- [ ] *(Go only)* Props are emitted only when reliably mapped; otherwise Figma
      properties appear as comments
- [ ] The Links section lists dev resources and is absent when there are none
- [ ] Sections never break codegen when their API call rejects
- [ ] The preference toggles both sections live
- [ ] Dev resources and mappings are unchanged after running the plugin
- [ ] `addDevResourceAsync`, `editDevResourceAsync`, `deleteDevResourceAsync`
      appear nowhere in the bundle (asserted by the write-safety test)
- [ ] Plan 003's write-safety guards pass with no new allowlist entries
- [ ] No files outside the in-scope list were changed
- [ ] `plans/README.md` status row for 008 updated (including REJECTED sub-steps
      with their rationale, if any)

## STOP conditions

Stop and report back — do not improvise — if:

- **Step 1 returns No-go.** Report the findings; do not build a workaround.
- Reading Code Connect mappings requires network access. The manifest's
  `allowedDomains: ["none"]` is a program-wide decision; changing it is the
  owner's call and would need a security rethink, not a manifest edit.
- **No Figma file with a Code Connect mapping can be obtained.** You cannot
  verify this feature without one, and shipping unverified is not acceptable
  here.
- Prop mapping requires guessing Figma property names into code prop names.
  Emit comments instead — and if that seems insufficient, report rather than
  guess.
- Any part of this requires writing to the document.
- A step's check fails twice after a reasonable attempt.

## Handoff / after it lands

- **A natural follow-up**: substitute mapped components for `<div>`s in plan
  007's subtree output. Deliberately not in this plan — it should only be built
  once this one has proven the mapping data is reliable in practice.
- **What a reviewer should scrutinise most**: Step 1's findings. This whole plan
  rests on an API question that was open when it was written, and the findings
  document is the record of how it was answered.
- **Deliberately deferred**: writing mappings from the plugin (belongs in the
  codebase with the Code Connect CLI), and adding dev resources from the plugin
  (a document write, forbidden by the program invariant).
