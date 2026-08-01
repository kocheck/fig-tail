# Changelog

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
