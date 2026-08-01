# Linter performance (plan 006)

| Metric | Target | Result |
|---|---|---|
| Max in-flight | ≤ 8 | Enforced via `createResolutionContext({ maxInFlight: 8 })` |
| 1,000 nodes | &lt; 10 s | UNVERIFIED in-product — run on a large Community file |
| Cancel | Partial results | Supported via `signal.cancelled` |
| Document mutations | Zero | Scan uses only `getCSSAsync` / reads through pipeline |
| Bundle after 006 | main &lt; 400 kB | See `bundle-sizes.md` (re-measure after build) |

## How to measure

1. Duplicate a large Community UI kit (~1k layers).
2. Load a Tailwind config on the file.
3. Run **Lint drift** from fig-tail Tools.
4. Record `visited`, `durationMs`, truncated/cancelled from the UI payload.
5. Paste numbers into this table and commit.
