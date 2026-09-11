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
- A plain-JavaScript config using `colors: { ...colors, brand: '#f00' }` (or any
  object value the TypeScript pre-pass mistook for a type annotation) resolves
  instead of failing to parse. The pre-pass now runs only when the source is not
  valid JavaScript, and its pattern no longer spans commas or braces.
- A TypeScript config ending in `} satisfies Config` keeps its `export default`;
  the `satisfies` rule previously consumed the rest of the file.
- The Inspect panel renders lint findings and the review Markdown table; before,
  only the finding count reached it. Confidence badges now have a rule for every
  confidence value — the three highest-confidence ones previously matched no rule.
- The Inspect result row shows the near token alongside the raw value, instead of
  only one of the two.
- A stamp dry-run or a failed operation no longer leaves the previous feature's
  output in the panel (and no longer lets **Copy output** copy it).
- A near-miss `border-radius` reports `rounded-tl-xl` rather than `rounded-xl`,
  and a `DEFAULT` radius token reports `rounded` rather than the non-existent
  `rounded-DEFAULT`. Report-only fields; the emitted class is unaffected.

### Removed

- The **Subtree export** codegen preference. It ran a whole-subtree walk inside
  the codegen callback's 3 s budget, on top of config read, CSS and variable
  resolution. Subtree export stays available from the Tools panel — but only as
  HTML: the JSX and outline formats had no other entry point and are currently
  unreachable.

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
