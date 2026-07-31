import type { TokenSet } from '@fig-tail/theme'
import { expandDeclarations } from './normalise'
import { matchColor } from './matchers/color'
import { matchLength } from './matchers/length'
import { matchTypography } from './matchers/typography'
import { matchLayout } from './matchers/layout'
import { matchShadow } from './matchers/shadow'
import { matchEffects } from './matchers/effects'
import { sortClasses } from './order'
import type { MatchOptions, MatchResult, VariableHint } from './types'

const COLOR_PROPS = new Set([
  'background-color',
  'background',
  'color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'fill',
  'stroke',
])

const LENGTH_PROPS = new Set([
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'gap',
  'row-gap',
  'column-gap',
  'width',
  'height',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  'border-radius',
  'border-width',
])

const TYPE_PROPS = new Set([
  'font-size',
  'font-weight',
  'font-family',
  'font-style',
  'line-height',
  'letter-spacing',
])

const LAYOUT_PROPS = new Set([
  'display',
  'flex-direction',
  'align-items',
  'justify-content',
  'align-self',
  'flex-wrap',
  'border-style',
])

const matchOne = (
  property: string,
  value: string,
  tokens: TokenSet | null,
  hint: VariableHint | undefined,
  options: MatchOptions,
  siblings: Record<string, string>,
): MatchResult => {
  if (COLOR_PROPS.has(property)) {
    return matchColor(property, value, tokens, hint, options.colorDeltaE ?? 2)
  }
  if (LENGTH_PROPS.has(property)) {
    return matchLength(
      property,
      value,
      tokens,
      hint,
      options.lengthExactPx ?? 0.5,
      options.lengthNearestPx ?? 2,
    )
  }
  if (TYPE_PROPS.has(property)) {
    return matchTypography(property, value, tokens, hint, siblings)
  }
  if (LAYOUT_PROPS.has(property)) {
    return matchLayout(property, value, tokens)
  }
  if (property === 'box-shadow') {
    return matchShadow(property, value, tokens)
  }
  if (property === 'opacity' || property === 'text-decoration' || property === 'text-decoration-line') {
    return matchEffects(property, value, tokens)
  }
  return {
    property,
    className: null,
    confidence: 'none',
    note: `Unsupported property ${property}`,
    provenance: { property, hintStatus: hint ? 'unresolvable' : 'absent' },
  }
}

const collapsePadding = (results: MatchResult[]): MatchResult[] => {
  const sides = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'].map((property) =>
    results.find((result) => result.property === property),
  )
  if (sides.some((side) => !side?.className || side.confidence === 'nearest' || side.confidence === 'none')) {
    return results
  }
  const tokens = sides.map((side) => side?.className?.replace(/^p[trbl]-/, '') ?? '')
  if (new Set(tokens).size !== 1 || !tokens[0]) {
    return results
  }
  const first = sides[0]
  if (!first) return results
  const collapsed: MatchResult = {
    property: 'padding',
    className: first.className?.replace(/^p[trbl]-/, 'p-') ?? null,
    confidence: first.confidence,
    provenance: first.provenance,
  }
  return [
    ...results.filter(
      (result) =>
        !['padding-top', 'padding-right', 'padding-bottom', 'padding-left'].includes(result.property),
    ),
    collapsed,
  ]
}

/** Match a CSS declaration map to Tailwind classes. */
export const matchDeclarations = (
  css: Record<string, string>,
  options: MatchOptions,
): MatchResult[] => {
  const expanded = expandDeclarations(css)
  const results: MatchResult[] = []
  for (const [property, value] of Object.entries(expanded)) {
    const hint = options.hints?.[property]
    results.push(matchOne(property, value, options.tokens, hint, options, expanded))
  }
  return collapsePadding(results)
}

/** Join copyable classes; nearest results are structurally excluded. */
export const toClassName = (results: MatchResult[]): string => {
  const classes = results
    .filter((result) => result.confidence !== 'nearest' && result.className)
    .map((result) => result.className as string)
  return sortClasses([...new Set(classes)]).join(' ')
}

export type { MatchResult, MatchOptions, Confidence, VariableHint, MatchSummary, MatchProvenance, MatchAmbiguity } from './types'
export { summarise } from './summarise'
