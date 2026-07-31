# Storage matrix (plan 003)

Manual verification checklist for private config storage. Fill results in-product.

| Check | Result | Evidence |
|---|---|---|
| Document write + same-user reload | UNVERIFIED | Owner: save on file, reload plugin, confirm tier document |
| Document write + Figma restart | UNVERIFIED | Owner: quit Figma, reopen file |
| Personal write without edit access | UNVERIFIED | Owner: Dev Mode / view-only seat → Save personal |
| Preference switch document↔user persists | UNVERIFIED | Owner: both tiers present, toggle preference, reload |
| Stale chunks cleared on shrinking rewrite | PASS (unit) | `storage.test.ts` shrinking rewrite |
| Raw canary absent from storage/messages | PASS (unit) | `assertNoForbiddenFields` + setup canary |
| Cross-account document read | UNVERIFIED | **Community publish blocker** — second account + same plugin ID |
| Cross-plugin isolation | UNVERIFIED | Isolation spike exists; in-product pending |

Labels used in UI (must match invariant 2):

- Document: `Using the config saved on this file`
- Personal: `Using your personal config — this file has no shared one`
- None: `No Tailwind config — generic Tailwind syntax; … Add your config for confirmed names.`
