import type { TokenSet } from '@fig-tail/theme'
import type { MatchResult } from '../types'
import { applyPrefix } from '../availability'

const STATIC: Record<string, Record<string, string>> = {
  display: {
    flex: 'flex',
    'inline-flex': 'inline-flex',
    grid: 'grid',
    block: 'block',
    'inline-block': 'inline-block',
    none: 'hidden',
    contents: 'contents',
  },
  'flex-direction': {
    row: 'flex-row',
    column: 'flex-col',
    'row-reverse': 'flex-row-reverse',
    'column-reverse': 'flex-col-reverse',
  },
  'align-items': {
    'flex-start': 'items-start',
    'flex-end': 'items-end',
    center: 'items-center',
    baseline: 'items-baseline',
    stretch: 'items-stretch',
  },
  'justify-content': {
    'flex-start': 'justify-start',
    'flex-end': 'justify-end',
    center: 'justify-center',
    'space-between': 'justify-between',
    'space-around': 'justify-around',
    'space-evenly': 'justify-evenly',
  },
  'align-self': {
    auto: 'self-auto',
    'flex-start': 'self-start',
    'flex-end': 'self-end',
    center: 'self-center',
    stretch: 'self-stretch',
  },
  'flex-wrap': {
    wrap: 'flex-wrap',
    nowrap: 'flex-nowrap',
    'wrap-reverse': 'flex-wrap-reverse',
  },
  'border-style': {
    solid: 'border-solid',
    dashed: 'border-dashed',
    dotted: 'border-dotted',
    none: 'border-none',
  },
}

/** Match static layout declarations. */
export const matchLayout = (
  property: string,
  value: string,
  tokens: TokenSet | null,
): MatchResult => {
  const map = STATIC[property]
  const provenance = { property, hintStatus: 'absent' as const }
  if (!map) {
    return {
      property,
      className: null,
      confidence: 'none',
      note: `Unsupported layout property ${property}`,
      provenance,
    }
  }
  const className = map[value]
  if (!className) {
    return {
      property,
      className: null,
      confidence: 'none',
      note: `No Tailwind mapping for ${property}: ${value}`,
      provenance,
    }
  }
  return {
    property,
    className: applyPrefix(tokens, className),
    confidence: 'exact-value',
    provenance: { property, hintStatus: 'absent', utility: className },
  }
}
