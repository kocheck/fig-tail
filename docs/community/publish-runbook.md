# Community publish runbook

**Status:** BLOCKED on cross-account private storage PASS.

## Prerequisites

- [x] `pnpm check` path + browser probes on release commit (CI)
- [x] `docs/release/feature-audit.md` filled
- [x] Bundle budgets met (`packages/plugin/notes/bundle-sizes.md`)
- [ ] Second-account cross-account read = **PASS** in `packages/plugin/notes/storage-matrix.md`
- [ ] Owner APPROVED Community in feature-audit
- [ ] Listing copy under `docs/community/` (copy ready; visuals pending)
- [ ] Icon + cover that match the product UI
- [ ] Screenshots: `devmode-codegen.png`, `inspect.png`, `setup.png` captured

## Steps

1. Map `fig-tail-dev` → production plugin ID in Figma.
2. Build: `pnpm --filter @fig-tail/plugin build`
3. Submit listing using copy from `docs/community/listing.md` and assets from `docs/community/assets/` (shipped features only).
4. Install from Community on account B; confirm shared document config reads.
5. Record live URL + date in feature-audit.

## If cross-account is FAIL

Ship as local/team install only. Do not claim team sharing. Personal config
fallback remains labelled and supported.
