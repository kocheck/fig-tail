# Changelog

## Unreleased

### Fixed

- A near-miss match no longer drops the property from the copyable class string.
  It emits the design's raw value (`bg-[#3b82f1]`) with the near token reported
  as a note. **`@fig-tail/match`'s `toClassName` and `summarise` output changes
  shape**: results with `confidence: 'nearest'` now carry a `className`.
- Variable hints resolve via `getVariableByIdAsync`; the synchronous getter
  throws under `documentAccess: "dynamic-page"` and its failure was swallowed.
- Arbitrary values containing spaces (`box-shadow`, quoted font families) no
  longer fragment and corrupt the whole class string; spaces are escaped as `_`.
- `pnpm check` builds before typechecking, so it works from a clean checkout.

## 0.1.0

### Added

- In-plugin Tailwind v3/v4 theme resolver (`@fig-tail/theme`)
- CSS→Tailwind matching engine with confidence ladder (`@fig-tail/match`)
- Figma plugin: dual codegen + Inspect, private config storage, setup UI
- Read-only drift linter, opt-in variable WEB code-syntax stamping, subtree export
- Docs: README front door, setup, troubleshooting, contributing, release feature audit
- CI + tag-triggered npm release workflow for `@fig-tail/theme` and `@fig-tail/match`

### Notes

- CLI escape hatch (plan 009) deferred — plugin-only ship; `@fig-tail/cli` is private
- Figma Community publish gated on cross-account private storage PASS
- Plugin ships via Community or local manifest install — not npm
