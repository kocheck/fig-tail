# Release feature audit

Date: 2026-07-31 · Build: `pnpm --filter @fig-tail/plugin build` · Version target: **0.1.0**

| Feature | Automated | In-Figma | Verdict |
|---|---|---|---|
| Theme resolve v3/v4 | PASS (theme tests) | — | PASS |
| Match confidence ladder | PASS (133 tests + coverage) | — | PASS |
| Config storage contract | PASS (storage tests) | Matrix UNVERIFIED | CONDITIONAL |
| Codegen classes + prefs | PASS (unit) | Latency/matrix UNVERIFIED | CONDITIONAL |
| Inspect panel parity | PASS (consistency tests) | Discovery UNVERIFIED | CONDITIONAL |
| Drift linter | PASS (types/proposal tests) | 1k-node perf UNVERIFIED | CONDITIONAL |
| Code-syntax stamp | PASS (guardrails) | Apply matrix UNVERIFIED | CONDITIONAL |
| Subtree export | PASS (typecheck/build) | 100+ node UNVERIFIED | CONDITIONAL |
| Write-safety | PASS (eslint + bundle) | — | PASS |
| Bundle budgets | PASS (main 265 kB / ui 250 kB) | — | PASS |
| Cross-account document read | — | **UNVERIFIED** | **BLOCKER for Community** |
| CLI | Out of ship scope | — | N/A |

## Owner decisions

| Channel | Decision | Date |
|---|---|---|
| Local / team demo install | APPROVED when core matrix checked | pending owner |
| Figma Community | **BLOCKED** until cross-account PASS + explicit approval | — |
| npm `@fig-tail/theme` + `@fig-tail/match` @ 0.1.0 | Prepared (dry-run clean); **awaiting explicit approval** | — |

## Second-account checklist (Community)

Full procedure: [`packages/plugin/notes/storage-matrix.md`](../../packages/plugin/notes/storage-matrix.md).

1. Publish or share development plugin ID mapping (same ID on both accounts).
2. Account A saves document config.
3. Account B installs same plugin ID, opens file — must read shared config.
4. Record PASS/FAIL in `packages/plugin/notes/storage-matrix.md`.
5. Only on PASS: submit Community listing from `docs/community/`.

**Current:** UNVERIFIED — Community remains blocked.

## npm dry-run (prep)

| Package | Version | Tarball contents | Verdict |
|---|---|---|---|
| `@fig-tail/theme` | 0.1.0 | LICENSE, README, dist/*, package.json | CLEAN |
| `@fig-tail/match` | 0.1.0 | LICENSE, README, dist/*, package.json | CLEAN |
| `@fig-tail/cli` | 0.1.0 | private — not published | N/A |
| `@fig-tail/plugin` | 0.1.0 | private — not published | N/A |

Secret history check (plan 010 pattern): exit **1** (no match) on 2026-07-31 prep pass.
