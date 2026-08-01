import type { TokenSet } from '@fig-tail/theme'
import type { MatchResult, VariableHint } from '../types'
import { applyPrefix } from '../availability'

const FONT_WEIGHT_NAMES: Record<string, string> = {
  '100': 'thin',
  '200': 'extralight',
  '300': 'light',
  '400': 'normal',
  '500': 'medium',
  '600': 'semibold',
  '700': 'bold',
  '800': 'extrabold',
  '900': 'black',
}

/** Match typography declarations. */
export const matchTypography = (
  property: string,
  value: string,
  tokens: TokenSet | null,
  _hint: VariableHint | undefined,
  siblings?: Record<string, string>,
): MatchResult => {
  const provenance = { property, hintStatus: 'absent' as const }
  if (property === 'font-weight') {
    const named = FONT_WEIGHT_NAMES[value]
    if (tokens) {
      for (const [key, weight] of Object.entries(tokens.fontWeight)) {
        if (String(weight) === value || key === named) {
          return {
            property,
            className: applyPrefix(tokens, `font-${key}`),
            confidence: 'exact-value',
            provenance: { property, hintStatus: 'absent', tokenKey: key, utility: 'font' },
          }
        }
      }
    }
    if (named) {
      return {
        property,
        className: applyPrefix(tokens, `font-${named}`),
        confidence: tokens ? 'arbitrary' : 'exact-value',
        provenance,
      }
    }
    return {
      property,
      className: applyPrefix(tokens, `font-[${value}]`),
      confidence: 'arbitrary',
      provenance,
    }
  }

  if (property === 'font-family') {
    const primary = value.split(',')[0]?.trim().replace(/^["']|["']$/g, '') ?? value
    if (tokens) {
      for (const [key, token] of Object.entries(tokens.fontFamily)) {
        if (token.primary === primary || token.stack.includes(primary)) {
          return {
            property,
            className: applyPrefix(tokens, `font-${key}`),
            confidence: 'exact-value',
            provenance: { property, hintStatus: 'absent', tokenKey: key, utility: 'font' },
          }
        }
      }
    }
    return {
      property,
      className: applyPrefix(tokens, `font-['${primary}']`),
      confidence: 'arbitrary',
      provenance,
    }
  }

  if (property === 'font-size') {
    const px = /^(-?\d+(?:\.\d+)?)px$/i.exec(value)?.[1]
    const lineHeight = siblings?.['line-height']
    if (tokens && px) {
      for (const [key, token] of Object.entries(tokens.fontSize)) {
        if (token.px !== null && Math.abs(token.px - Number(px)) <= 0.5) {
          if (token.lineHeight && lineHeight) {
            const lhPx = /^(-?\d+(?:\.\d+)?)px$/i.exec(lineHeight)?.[1]
            if (lhPx && token.lineHeight.px !== null && Math.abs(token.lineHeight.px - Number(lhPx)) <= 0.5) {
              return {
                property,
                className: applyPrefix(tokens, `text-${key}`),
                confidence: 'exact-value',
                note: 'paired with line-height',
                provenance: { property, hintStatus: 'absent', tokenKey: key, utility: 'text' },
              }
            }
          }
          return {
            property,
            className: applyPrefix(tokens, `text-${key}`),
            confidence: 'exact-value',
            provenance: { property, hintStatus: 'absent', tokenKey: key, utility: 'text' },
          }
        }
      }
    }
    return {
      property,
      className: applyPrefix(tokens, `text-[${value}]`),
      confidence: 'arbitrary',
      provenance,
    }
  }

  if (property === 'line-height') {
    if (tokens) {
      for (const [key, token] of Object.entries(tokens.lineHeight)) {
        if (token.raw === value || (token.px !== null && value === `${token.px}px`)) {
          return {
            property,
            className: applyPrefix(tokens, `leading-${key}`),
            confidence: 'exact-value',
            provenance: { property, hintStatus: 'absent', tokenKey: key, utility: 'leading' },
          }
        }
      }
    }
    return {
      property,
      className: applyPrefix(tokens, `leading-[${value}]`),
      confidence: 'arbitrary',
      provenance,
    }
  }

  if (property === 'letter-spacing') {
    if (tokens) {
      for (const [key, token] of Object.entries(tokens.letterSpacing)) {
        if (token.raw === value) {
          return {
            property,
            className: applyPrefix(tokens, `tracking-${key}`),
            confidence: 'exact-value',
            provenance: { property, hintStatus: 'absent', tokenKey: key, utility: 'tracking' },
          }
        }
      }
    }
    return {
      property,
      className: applyPrefix(tokens, `tracking-[${value}]`),
      confidence: 'arbitrary',
      provenance,
    }
  }

  if (property === 'font-style') {
    if (value === 'italic') {
      return { property, className: applyPrefix(tokens, 'italic'), confidence: 'exact-value', provenance }
    }
    if (value === 'normal') {
      return { property, className: applyPrefix(tokens, 'not-italic'), confidence: 'exact-value', provenance }
    }
  }

  return {
    property,
    className: null,
    confidence: 'none',
    note: `Unsupported typography property ${property}`,
    provenance,
  }
}
