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
