# Plan-review dispositions — 2026-07-31

Review target: the complete fig-tail plan corpus at commit `7932c82`.

Every finding from the improve audit was triaged before plan edits. `ACCEPT`
means the recommendation was applied as written. `MODIFY` means the risk was
accepted but integrated in a different shape to preserve existing plan IDs or a
stronger program invariant. No finding was rejected or deferred.

| ID | Verdict | Disposition |
|---|---|---|
| F01 | ACCEPT | Remove every `acceptNearest` path. Near matches are report-only data and never enter copyable class output. |
| F02 | MODIFY | Require exact Tailwind version evidence before bundled defaults are merged. A missing or non-exact version keeps explicit config tokens but marks default-derived namespaces unconfirmed/unknown. Same-major inference is forbidden. |
| F03 | MODIFY | Store resolved data with private `setPluginData`. Persist no raw config; redact resolver snippets into a `PersistedDiagnostic` contract before the iframe boundary, and prove a canary inside an unresolved expression reaches no message or storage value. Personal storage follows the same rule. |
| F04 | ACCEPT | Move workspace bootstrap, CI baseline, and verification into plan 001; eliminate its completion dependency on plan 002. |
| F05 | ACCEPT | Define one complete `StoredConfig` / `ReadConfigResult` / `WriteResult` contract, including unresolved diagnostics and tier/read-failure provenance. |
| F06 | MODIFY | Add plan 000 as the execution-first platform preflight and make plan 002 consume its real CSS captures. Existing plan IDs stay stable while the new prerequisite sorts first. |
| F07 | ACCEPT | Add typed match provenance and deterministic duplicate-value tie resolution. Variable proposer status is carried explicitly rather than inferred from confidence. |
| F08 | MODIFY | Make stamping a design-editor-only apply route. Dev Mode may hand off an untrusted pending selection, but design mode re-reads and revalidates before showing Apply. |
| F09 | ACCEPT | Split plugin sandbox and iframe TypeScript configs; DOM types exist only in the iframe config. |
| F10 | MODIFY | Pin pnpm via `packageManager`, commit the lockfile, add CI in plan 001, enforce active coverage thresholds, and replace unmaintained tsup with tsdown for library packages. |
| F11 | ACCEPT | Every bundle-inspection test depends on a fresh build in the same command/task. |
| F12 | ACCEPT | Introduce bounded concurrency, deadline/cancellation, and per-operation caches in plan 005 before the page linter; plan 008 reuses rather than invents them. |
| F13 | ACCEPT | Status-row edits are a universal plan exception. Verification-only tasks write durable evidence notes and use a documentation commit rather than an empty commit. |
| F14 | ACCEPT | Core resolver copy is independent of the optional CLI. CLI guidance appears only when plan 009 is actually shipped. |
| F15 | MODIFY | Plan 009 starts with a version-bounded v4 compiler/package API spike and explicitly verifies package `bin`, shebang, target resolution, and trust-flag behaviour before implementation. |

## Cold-review dispositions after revision

The substantially revised corpus received a fresh read-only contract review.
All eight material findings were accepted and integrated; none was rejected or
deferred.

| ID | Verdict | Disposition |
|---|---|---|
| CR01 | ACCEPT | Strip `Unresolved.snippet` before messaging or persistence; use a typed redacted diagnostic and an unresolved-expression canary. |
| CR02 | ACCEPT | Define `ConfigProvenance` once in plan 001 and make browser storage, CLI export, and CLI import use its exact field names. Remove the parallel `importProvenance` concept. |
| CR03 | ACCEPT | Export named `MatchProvenance` and `MatchAmbiguity` contracts from plan 002 for plans 004–006. |
| CR04 | ACCEPT | Permit and scope a disposable second development-plugin identity in plan 000 solely for the cross-plugin isolation proof. |
| CR05 | ACCEPT | Replace plan 004's obsolete bare-null storage mock with a complete tier-3 `ReadConfigResult`. |
| CR06 | ACCEPT | Carry `partialNamespaces` and redacted diagnostics through plan 005's shared/iframe result and surface withheld-default state distinctly from unknown namespaces. |
| CR07 | ACCEPT | Give plan 009 explicit ownership of the contextual CLI action; core plan-001 copy remains independent of the optional feature. |
| CR08 | ACCEPT | Make the plugin test script build current source unconditionally before Vitest and standardize build-before-test gates across implementation plans and CI. |

## Class-level fixes applied

- Platform assumptions now have an execution-first evidence owner (plan 000).
- Cross-plan types are named contracts, not prose fragments reconstructed later.
- Every safety assertion has an executable failing check or an in-product matrix.
- Optional features cannot leak into core copy or minimum-slice verification.
- The new prerequisite is plan 000, preserving existing plan IDs while keeping
  filenames and the index in recommended execution order.
