import type { TokenSet } from '@fig-tail/theme'
import type { MatchResult } from '../types'
import { applyPrefix } from '../availability'

/** Match effects like opacity and text-decoration. */
export const matchEffects = (
  property: string,
  value: string,
  tokens: TokenSet | null,
): MatchResult => {
  const provenance = { property, hintStatus: 'absent' as const }
  if (property === 'opacity') {
    const num = Number(value)
    if (tokens) {
      for (const [key, token] of Object.entries(tokens.opacity)) {
        if (Math.abs(token - num) < 0.005 || Math.abs(token - num / 100) < 0.005) {
          return {
            property,
            className: applyPrefix(tokens, `opacity-${key}`),
            confidence: 'exact-value',
            provenance: { property, hintStatus: 'absent', tokenKey: key, utility: 'opacity' },
          }
        }
      }
    }
    return {
      property,
      className: applyPrefix(tokens, `opacity-[${value}]`),
      confidence: 'arbitrary',
      provenance,
    }
  }
  if (property === 'text-decoration' || property === 'text-decoration-line') {
    if (value === 'none') {
      return {
        property,
        className: applyPrefix(tokens, 'no-underline'),
        confidence: 'exact-value',
        provenance,
      }
    }
    if (value.includes('underline')) {
      return {
        property,
        className: applyPrefix(tokens, 'underline'),
        confidence: 'exact-value',
        provenance,
      }
    }
  }
  return {
    property,
    className: null,
    confidence: 'none',
    note: `Unsupported effects property ${property}`,
    provenance,
  }
}
