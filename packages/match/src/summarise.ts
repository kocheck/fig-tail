import type { MatchResult, MatchSummary } from './types'
import { sortClasses } from './order'

/** Summarise match results for UI banners and copyable output. */
export const summarise = (
  results: MatchResult[],
  hasConfig: boolean,
): MatchSummary => {
  const classes = sortClasses([
    ...new Set(
      results
        .filter((result) => result.confidence !== 'nearest' && result.className)
        .map((result) => result.className as string),
    ),
  ])
  const className = classes.join(' ')
  const warnings: string[] = []
  if (!hasConfig) {
    warnings.push(
      'No Tailwind config — generic Tailwind syntax; project prefix/settings may require changes. Add your config for confirmed names.',
    )
  }
  for (const result of results) {
    if (result.note && !warnings.includes(result.note)) {
      warnings.push(result.note)
    }
  }
  return { classes, className, results, warnings, hasConfig }
}
