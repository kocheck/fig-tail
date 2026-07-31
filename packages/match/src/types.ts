import type { TokenSet } from '@fig-tail/theme'

/** Confidence ladder from highest to lowest. */
export type Confidence =
  | 'exact-variable'
  | 'exact-value'
  | 'name-match'
  | 'nearest'
  | 'arbitrary'
  | 'none'

/** Bound-variable hint from Figma. */
export type VariableHint = {
  variableId: string
  codeSyntax?: string
  name?: string
  collection?: string
}

/** How a hint was used. */
export type HintStatus =
  | 'absent'
  | 'applied'
  | 'stale'
  | 'unresolvable'
  | 'conflicting'
  | 'ignored-non-token'

/** Match provenance for surfaces and the linter. */
export type MatchProvenance = {
  property: string
  hintStatus: HintStatus
  tokenKey?: string
  utility?: string
}

/** Ambiguous exact-value candidates. */
export type MatchAmbiguity = {
  chosen: string
  candidates: string[]
}

/** Nearest-token report data — never a copyable class. */
export type NearestReport = {
  tokenKey: string
  className: string
  delta?: number
  deltaUnit?: 'deltaE' | 'px'
}

/** One property match result. */
export type MatchResult = {
  property: string
  className: string | null
  confidence: Confidence
  note?: string
  nearest?: NearestReport
  provenance: MatchProvenance
  ambiguity?: MatchAmbiguity
}

/** Options for matchDeclarations. */
export type MatchOptions = {
  tokens: TokenSet | null
  hints?: Record<string, VariableHint>
  colorDeltaE?: number
  lengthExactPx?: number
  lengthNearestPx?: number
}

/** Summary for UI banners. */
export type MatchSummary = {
  classes: string[]
  className: string
  results: MatchResult[]
  warnings: string[]
  hasConfig: boolean
}
