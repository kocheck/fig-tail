# Community publish runbook

**Status:** BLOCKED on cross-account private storage PASS.

## Prerequisites

- [ ] `pnpm check` green on release commit
- [ ] `docs/release/feature-audit.md` filled
- [ ] Bundle budgets met (`notes/bundle-sizes.md`)
- [ ] Second-account cross-account read = **PASS** in `notes/storage-matrix.md`
- [ ] Owner APPROVED Community in feature-audit

## Steps

1. Map `fig-tail-dev` → production plugin ID in Figma.
2. Build: `pnpm --filter @fig-tail/plugin build`
3. Submit listing using copy from `docs/community/listing.md` (shipped features only).
4. Install from Community on account B; confirm shared document config reads.
5. Record live URL + date in feature-audit.

## If cross-account is FAIL

Ship as local/team install only. Do not claim team sharing. Personal config
fallback remains labelled and supported.
