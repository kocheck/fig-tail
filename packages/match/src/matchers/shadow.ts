import type { TokenSet } from '@fig-tail/theme'
import type { MatchResult } from '../types'
import { applyPrefix } from '../availability'

const normaliseShadow = (value: string): string =>
  value
    .replace(/\s+/g, ' ')
    .replace(/rgba?\(([^)]+)\)/gi, (full) => full.toLowerCase())
    .trim()

/** Match box-shadow declarations. */
export const matchShadow = (
  property: string,
  value: string,
  tokens: TokenSet | null,
): MatchResult => {
  const provenance = { property, hintStatus: 'absent' as const }
  if (property !== 'box-shadow') {
    return {
      property,
      className: null,
      confidence: 'none',
      provenance,
    }
  }
  if (value === 'none') {
    return {
      property,
      className: applyPrefix(tokens, 'shadow-none'),
      confidence: 'exact-value',
      provenance,
    }
  }
  if (tokens) {
    const needle = normaliseShadow(value)
    for (const [key, token] of Object.entries(tokens.boxShadow)) {
      if (normaliseShadow(token.raw) === needle) {
        const className = applyPrefix(tokens, key === 'DEFAULT' ? 'shadow' : `shadow-${key}`)
        return {
          property,
          className,
          confidence: 'exact-value',
          provenance: { property, hintStatus: 'absent', tokenKey: key, utility: 'shadow' },
        }
      }
    }
  }
  return {
    property,
    className: applyPrefix(tokens, `shadow-[${value}]`),
    confidence: 'arbitrary',
    provenance,
  }
}
