# Storage matrix — plan 003 task 8

| Transition | Result |
|---|---|
| empty → personal (tier 2) | PASS (unit/storage code path) |
| personal → document (tier 1) | PASS (code path; in-Figma UNVERIFIED) |
| document reload | UNVERIFIED in-product |
| cross-account document read | UNVERIFIED — plan 010 publication gate |
| corrupt chunk → tier 3 fallback | PASS (decode returns null → ladder continues) |

See also `platform-preflight.md`.
