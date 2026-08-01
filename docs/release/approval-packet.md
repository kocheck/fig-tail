# 0.1.0 approval packet

Stop gate before irreversible publish. Fill decisions below — do not tag or
submit until both rows you intend to ship are APPROVED.

## Prepared

| Item | Status |
|---|---|
| README front door + setup / troubleshooting / CONTRIBUTING | Ready |
| Version `0.1.0` on theme, match, plugin, cli | Ready |
| `@fig-tail/cli` and `@fig-tail/plugin` `"private": true` | Ready |
| Package READMEs + LICENSE in theme/match tarballs | Ready |
| CI hardened + `probe:browser` | Ready |
| `release.yml` (OIDC, theme + match only, `--provenance`) | Ready |
| npm dry-run file lists | CLEAN (dist + README + LICENSE + package.json) |
| Secret history check | Quiet (exit 1) |
| Community listing copy | Ready |
| Icon + cover | Pending (must match product UI) |
| Screenshots (devmode / inspect / setup) | Pending owner capture |
| Cross-account document read | **UNVERIFIED** (Community blocker) |
| `pnpm check` | PASS |

## Publish targets (if approved)

- npm: `@fig-tail/theme@0.1.0`, `@fig-tail/match@0.1.0`
- Figma Community: plugin via `docs/community/` (requires cross-account PASS)

## Owner decisions

| Channel | Decision (APPROVED / DEFER / REJECT) | Date | Notes |
|---|---|---|---|
| npm `@fig-tail/theme` + `@fig-tail/match` | | | Configure npm trusted publisher → repo `kocheck/fig-tail`, workflow `release.yml` before tagging `v0.1.0` |
| Figma Community | | | Only if storage-matrix cross-account = PASS |

## After approval

1. Capture screenshots into `docs/community/assets/` (see assets README).
2. Record cross-account PASS/FAIL in storage-matrix + feature-audit.
3. If npm APPROVED: configure trusted publishers → `git tag v0.1.0 && git push origin v0.1.0`.
4. If Community APPROVED + PASS: map production plugin ID → submit per publish-runbook.
5. Update `plans/README.md` with “Shipped 0.1.0” and live URLs.
