# Subtree export performance (plan 008)

| Metric | Target | Result |
|---|---|---|
| Codegen internal deadline | 2 s | `createResolutionContext({ deadlineMs: 2000 })` |
| Hard Figma budget | &lt; 3 s | Truncate with marker before timeout |
| Inspect node cap | 150 | `maxNodes` default 150 |
| Max in-flight | ≤ 8 | Shared `resolveNodes` |
| Formats | html / jsx / outline | `tree/export.ts` |
| Bundle | main &lt; 400 kB | Re-measure in `bundle-sizes.md` |

In-product 100+ node fixture: UNVERIFIED — run after local install.
