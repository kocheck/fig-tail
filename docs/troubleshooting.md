# Troubleshooting

## I see arbitrary values like `bg-[#3b82f6]`

Usually: no config (tier none), an unknown colour namespace, or no exact token.
Add/fix the config, or treat the arbitrary value as the honest fallback.

## Near colours/spacing never become classes

By design. Near matches are reported in drift notes only — inventing
`bg-brand-500` when the fill is slightly off would silently fail in code.

## Defaults look wrong after paste

Only an exact `x.y.z` Tailwind version in `package.json` confirms bundled
defaults. Ranges / same-major guesses are rejected; namespaces stay partial.

## Personal vs shared config

If both exist, the plugin prefers document unless you switch. The UI shows
which source is active.

## Stamping does nothing in Dev Mode

Apply is design-editor only. Run dry-run in either mode; Apply from design.

## Cross-account collaborators cannot see shared config

If private document plugin data does not cross accounts for your Figma plan,
use personal config as the labelled fallback. Community publish requires a
documented PASS on cross-account read — see `docs/release/feature-audit.md`.

## Bundle / install fails

Require Node 20+, `corepack enable`, and `pnpm@10.33.2` from `packageManager`.
