import type { MatchResult } from '@fig-tail/match'

/** One titled, copyable Dev Mode Code-section entry. */
export type CodegenSection = { title: string; language: 'PLAINTEXT'; code: string }

const ATTENTION_CONFIDENCE = new Set(['nearest', 'arbitrary', 'none'])

const needsAttention = (result: MatchResult): boolean => ATTENTION_CONFIDENCE.has(result.confidence)

const formatAttentionLine = (result: MatchResult): string => {
  const headline = `${result.property}: ${result.note ?? result.confidence}`
  if (!result.nearest) return headline
  const delta =
    result.nearest.delta !== undefined
      ? ` (Δ${result.nearest.delta}${result.nearest.deltaUnit ? result.nearest.deltaUnit : ''})`
      : ''
  return `${headline}\n  nearest: ${result.nearest.className}${delta}`
}

/** The primary, copyable class string — nothing else belongs in this body. */
export const renderCodegenPrimary = (className: string): string => className || '/* no classes */'

/**
 * A second, separate section reporting the config tier, any warnings, and
 * per-property drift (`nearest` / `arbitrary` / `none`). Returns `null` when
 * there is genuinely nothing to say, so the panel never shows a permanent
 * empty section.
 */
export const renderCodegenDrift = (
  results: MatchResult[],
  warnings: string[],
  tierLabel: string,
): string | null => {
  const lines: string[] = []
  if (tierLabel) {
    lines.push(tierLabel)
  }
  for (const warning of warnings) {
    if (!lines.includes(warning)) {
      lines.push(warning)
    }
  }
  const attention = results.filter(needsAttention)
  if (attention.length > 0) {
    if (lines.length > 0) lines.push('')
    lines.push(`Needs attention (${attention.length})`)
    for (const result of attention) {
      lines.push(formatAttentionLine(result))
    }
  }
  return lines.length > 0 ? lines.join('\n') : null
}

/**
 * Full set of Code-section entries for one node: the primary "Tailwind"
 * section always first, plus an optional second section — titled "Drift"
 * when there is per-property drift to report, or "Notes" when there is only
 * tier/warning context to show.
 */
export const renderCodegenSections = (
  results: MatchResult[],
  className: string,
  warnings: string[],
  tierLabel: string,
): CodegenSection[] => {
  const sections: CodegenSection[] = [
    { title: 'Tailwind', language: 'PLAINTEXT', code: renderCodegenPrimary(className) },
  ]
  const drift = renderCodegenDrift(results, warnings, tierLabel)
  if (drift) {
    const title = results.some(needsAttention) ? 'Drift' : 'Notes'
    sections.push({ title, language: 'PLAINTEXT', code: drift })
  }
  return sections
}
