import type { TokenSet } from '@fig-tail/theme'
import type { Confidence } from './types'

/** Whether a core utility is available given TokenSet.corePlugins. */
export const utilityAvailable = (tokens: TokenSet, corePlugin: string): boolean => {
  const { mode, names } = tokens.source.corePlugins
  if (mode === 'unknown') return false
  if (mode === 'all') return true
  if (mode === 'allowlist') return names.includes(corePlugin)
  if (mode === 'denylist') return !names.includes(corePlugin)
  return false
}

/** Apply configured prefix; return null when prefix is unknown. */
export const applyPrefix = (tokens: TokenSet | null, className: string): string | null => {
  if (!tokens) return className
  const prefix = tokens.source.prefix
  if (prefix.status === 'unknown') return null
  if (prefix.status === 'none') return className
  if (prefix.style === 'v3-string') return `${prefix.value}${className}`
  if (prefix.style === 'v4-variant') return `${prefix.value}:${className}`
  return className
}

/**
 * Build a Tailwind arbitrary-value class from a raw CSS value, then prefix it.
 *
 * Spaces become underscores, which is Tailwind's own escape inside brackets.
 * Without it a value like `rgba(59, 130, 246, 0.5)` splits into four tokens the
 * moment the class string is joined with spaces — corrupting every *other*
 * class in the string, not just its own. Same for `font-['Helvetica Neue']`.
 *
 * (A literal underscore in a CSS value would need `\_`; that is vanishingly
 * rare outside custom-property names and is left alone.)
 */
export const arbitrary = (
  tokens: TokenSet | null,
  utility: string,
  value: string,
): string | null => applyPrefix(tokens, `${utility}-[${value.replace(/\s+/g, '_')}]`)

/** Map a prefixed class to none-confidence when prefix is unknown. */
export const withKnownPrefix = (
  tokens: TokenSet | null,
  className: string,
  confidence: Confidence,
): { className: string | null; confidence: Confidence; note?: string } => {
  const prefixed = applyPrefix(tokens, className)
  if (tokens && prefixed === null) {
    return {
      className: null,
      confidence: 'none',
      note: 'Prefix could not be resolved',
    }
  }
  return { className: prefixed, confidence }
}
