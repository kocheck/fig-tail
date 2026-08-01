import type { TokenSet } from '@fig-tail/theme'
import type { MatchResult } from '../types'
import { applyPrefix } from '../availability'

const normaliseShadowColour = (segment: string): string => {
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i.exec(segment)
  if (rgba) {
    const alpha = rgba[4] ?? '1'
    return `rgb(${rgba[1]} ${rgba[2]} ${rgba[3]} / ${alpha})`
  }
  const modern = /^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+))?\s*\)$/i.exec(segment)
  if (modern) {
    const alpha = modern[4] ?? '1'
    return `rgb(${modern[1]} ${modern[2]} ${modern[3]} / ${alpha})`
  }
  return segment.toLowerCase()
}

const normaliseShadow = (value: string): string =>
  value
    .replace(/\s+/g, ' ')
    .replace(/rgba?\([^)]+\)|rgb\([^)]+\)/gi, (match) => normaliseShadowColour(match))
    .replace(/\b0px\b/g, '0')
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
