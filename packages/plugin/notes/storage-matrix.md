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
| Cross-account document read | UNVERIFIED | **Community publish blocker** — see procedure below |
| Cross-plugin isolation | UNVERIFIED | Isolation spike exists; in-product pending |

Labels used in UI (must match invariant 2):

- Document: `Using the config saved on this file`
- Personal: `Using your personal config — this file has no shared one`
- None: `No Tailwind config — generic Tailwind syntax; … Add your config for confirmed names.`

## Second-account procedure (Community gate)

Both accounts must use the **same plugin ID**. For a development plugin that means
publishing a development version / ID mapping both accounts can install — not two
separate `Import plugin from manifest` copies (those get distinct IDs).

1. **Account A** (edit access): import/build plugin, open shared file, run setup,
   Resolve, **Save on file**. Confirm UI label: document tier.
2. Share the file with **Account B** (view-only or Dev seat is enough to prove read).
3. **Account B**: install the **same** plugin ID, open the file in Dev Mode, select
   a layer. Confirm document-tier label and that classes resolve from A's config
   (not personal/none).
4. Record **PASS** or **FAIL** in the table above and copy the verdict into
   `docs/release/feature-audit.md` (Owner decisions + Cross-account row).
5. Community submit is allowed **only** on PASS + explicit owner approval.

If FAIL: keep personal-config path labelled; do not claim one-person team setup
in Community copy; local/team demo + optional npm remain available.
