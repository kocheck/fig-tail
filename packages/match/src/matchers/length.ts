import type { TokenSet } from '@fig-tail/theme'
import type { MatchResult, VariableHint } from '../types'
import { applyPrefix, utilityAvailable } from '../availability'

const PROP_TO_UTIL: Record<string, { util: string; core: string; ns: 'spacing' | 'radius' | 'borderWidth' | 'size' }> = {
  'padding-top': { util: 'pt', core: 'padding', ns: 'spacing' },
  'padding-right': { util: 'pr', core: 'padding', ns: 'spacing' },
  'padding-bottom': { util: 'pb', core: 'padding', ns: 'spacing' },
  'padding-left': { util: 'pl', core: 'padding', ns: 'spacing' },
  'margin-top': { util: 'mt', core: 'margin', ns: 'spacing' },
  'margin-right': { util: 'mr', core: 'margin', ns: 'spacing' },
  'margin-bottom': { util: 'mb', core: 'margin', ns: 'spacing' },
  'margin-left': { util: 'ml', core: 'margin', ns: 'spacing' },
  gap: { util: 'gap', core: 'gap', ns: 'spacing' },
  'row-gap': { util: 'gap-y', core: 'gap', ns: 'spacing' },
  'column-gap': { util: 'gap-x', core: 'gap', ns: 'spacing' },
  width: { util: 'w', core: 'width', ns: 'size' },
  height: { util: 'h', core: 'height', ns: 'size' },
  'border-top-left-radius': { util: 'rounded-tl', core: 'borderRadius', ns: 'radius' },
  'border-top-right-radius': { util: 'rounded-tr', core: 'borderRadius', ns: 'radius' },
  'border-bottom-right-radius': { util: 'rounded-br', core: 'borderRadius', ns: 'radius' },
  'border-bottom-left-radius': { util: 'rounded-bl', core: 'borderRadius', ns: 'radius' },
  'border-radius': { util: 'rounded', core: 'borderRadius', ns: 'radius' },
  'border-width': { util: 'border', core: 'borderWidth', ns: 'borderWidth' },
}

const toPx = (value: string): number | null => {
  const px = /^(-?\d+(?:\.\d+)?)px$/i.exec(value.trim())
  if (px?.[1]) return Number(px[1])
  if (value.trim() === '0') return 0
  return null
}

const matchScale = (
  px: number,
  scale: Record<string, { px: number | null }>,
  exactTol: number,
  nearTol: number,
): { kind: 'exact' | 'nearest'; key: string; delta: number } | null => {
  let exact: { key: string; delta: number } | null = null
  let nearest: { key: string; delta: number } | null = null
  for (const [key, token] of Object.entries(scale)) {
    if (token.px === null) continue
    const delta = Math.abs(token.px - px)
    if (delta <= exactTol && (!exact || delta < exact.delta || (delta === exact.delta && key.length < exact.key.length))) {
      exact = { key, delta }
    } else if (delta <= nearTol && (!nearest || delta < nearest.delta)) {
      nearest = { key, delta }
    }
  }
  if (exact) return { kind: 'exact', key: exact.key, delta: exact.delta }
  if (nearest) return { kind: 'nearest', key: nearest.key, delta: nearest.delta }
  return null
}

const matchV4Multiplier = (
  px: number,
  basePx: number,
  exactTol: number,
  nearTol: number,
): { kind: 'exact' | 'nearest'; key: string; delta: number } | null => {
  if (basePx <= 0) return null
  const steps = px / basePx
  const roundedHalf = Math.round(steps * 2) / 2
  const exactPx = roundedHalf * basePx
  const delta = Math.abs(exactPx - px)
  const key =
    Number.isInteger(roundedHalf) || roundedHalf % 1 === 0.5
      ? String(roundedHalf)
      : null
  if (!key) return null
  if (roundedHalf > 4 && !Number.isInteger(roundedHalf)) {
    // above 4, only integers
    const intKey = String(Math.round(steps))
    const intPx = Number(intKey) * basePx
    const intDelta = Math.abs(intPx - px)
    if (intDelta <= exactTol) return { kind: 'exact', key: intKey, delta: intDelta }
    if (intDelta <= nearTol) return { kind: 'nearest', key: intKey, delta: intDelta }
    return null
  }
  if (delta <= exactTol) return { kind: 'exact', key, delta }
  if (delta <= nearTol) return { kind: 'nearest', key, delta }
  return null
}

/** Match length-like declarations (spacing, radius, border width, size). */
export const matchLength = (
  property: string,
  value: string,
  tokens: TokenSet | null,
  hint: VariableHint | undefined,
  exactTol = 0.5,
  nearTol = 2,
): MatchResult => {
  const mapping = PROP_TO_UTIL[property]
  const provenance = {
    property,
    hintStatus: hint ? ('unresolvable' as const) : ('absent' as const),
  }
  if (!mapping) {
    return {
      property,
      className: null,
      confidence: 'none',
      note: `Unsupported length property ${property}`,
      provenance,
    }
  }
  if (tokens && !utilityAvailable(tokens, mapping.core)) {
    return {
      property,
      className: null,
      confidence: 'none',
      note: `Core plugin ${mapping.core} is unavailable`,
      provenance,
    }
  }

  const px = toPx(value)
  if (px === null) {
    const className = applyPrefix(tokens, `${mapping.util}-[${value}]`)
    return {
      property,
      className,
      confidence: className ? 'arbitrary' : 'none',
      provenance,
    }
  }

  if (hint?.codeSyntax && tokens) {
    const named = tokens.spacing.named[hint.codeSyntax] ?? tokens.spacing.scale[hint.codeSyntax] ?? tokens.radius[hint.codeSyntax]
    if (named?.px !== null && named && Math.abs((named.px ?? NaN) - px) <= exactTol) {
      const className = applyPrefix(tokens, `${mapping.util}-${hint.codeSyntax}`)
      return {
        property,
        className,
        confidence: 'exact-variable',
        provenance: { property, hintStatus: 'applied', tokenKey: hint.codeSyntax, utility: mapping.util },
      }
    }
  }

  if (!tokens) {
    return {
      property,
      className: `${mapping.util}-[${value}]`,
      confidence: 'arbitrary',
      note: 'No Tailwind config — generic Tailwind syntax; project prefix/settings may require changes.',
      provenance,
    }
  }

  if (tokens.unknownNamespaces.includes(mapping.ns === 'size' ? 'spacing' : mapping.ns)) {
    const className = applyPrefix(tokens, `${mapping.util}-[${value}]`)
    return {
      property,
      className,
      confidence: className ? 'arbitrary' : 'none',
      note: `fig-tail could not read your ${mapping.ns}; showing raw values`,
      provenance,
    }
  }

  if (mapping.ns === 'spacing' || mapping.ns === 'size') {
    const namedHit = matchScale(px, tokens.spacing.named, exactTol, nearTol)
    if (namedHit?.kind === 'exact') {
      const className = applyPrefix(tokens, `${mapping.util}-${namedHit.key}`)
      return {
        property,
        className,
        confidence: 'exact-value',
        provenance: { property, hintStatus: 'absent', tokenKey: namedHit.key, utility: mapping.util },
      }
    }
    if (tokens.spacing.basePx !== null) {
      const step = matchV4Multiplier(px, tokens.spacing.basePx, exactTol, nearTol)
      if (step?.kind === 'exact') {
        const className = applyPrefix(tokens, `${mapping.util}-${step.key}`)
        return {
          property,
          className,
          confidence: 'exact-value',
          provenance: { property, hintStatus: 'absent', tokenKey: step.key, utility: mapping.util },
        }
      }
      if (step?.kind === 'nearest') {
        return {
          property,
          className: null,
          confidence: 'nearest',
          nearest: {
            tokenKey: step.key,
            className: `${mapping.util}-${step.key}`,
            delta: step.delta,
            deltaUnit: 'px',
          },
          note: `no exact token; nearest is ${mapping.util}-${step.key}`,
          provenance,
        }
      }
    }
    const scaleHit = matchScale(px, tokens.spacing.scale, exactTol, nearTol)
    if (scaleHit?.kind === 'exact') {
      const className = applyPrefix(tokens, `${mapping.util}-${scaleHit.key}`)
      return {
        property,
        className,
        confidence: 'exact-value',
        provenance: { property, hintStatus: 'absent', tokenKey: scaleHit.key, utility: mapping.util },
      }
    }
    if (scaleHit?.kind === 'nearest') {
      return {
        property,
        className: null,
        confidence: 'nearest',
        nearest: {
          tokenKey: scaleHit.key,
          className: `${mapping.util}-${scaleHit.key}`,
          delta: scaleHit.delta,
          deltaUnit: 'px',
        },
        note: `no exact token; nearest is ${mapping.util}-${scaleHit.key}`,
        provenance,
      }
    }
    if (namedHit?.kind === 'nearest') {
      return {
        property,
        className: null,
        confidence: 'nearest',
        nearest: {
          tokenKey: namedHit.key,
          className: `${mapping.util}-${namedHit.key}`,
          delta: namedHit.delta,
          deltaUnit: 'px',
        },
        note: `no exact token; nearest is ${mapping.util}-${namedHit.key}`,
        provenance,
      }
    }
  }

  if (mapping.ns === 'radius') {
    const hit = matchScale(px, tokens.radius, exactTol, nearTol)
    if (hit?.kind === 'exact') {
      const key = hit.key === 'DEFAULT' ? '' : `-${hit.key}`
      const className = applyPrefix(tokens, `${mapping.util === 'rounded' ? 'rounded' : mapping.util}${key}`)
      return {
        property,
        className,
        confidence: 'exact-value',
        provenance: { property, hintStatus: 'absent', tokenKey: hit.key, utility: mapping.util },
      }
    }
    if (hit?.kind === 'nearest') {
      return {
        property,
        className: null,
        confidence: 'nearest',
        nearest: {
          tokenKey: hit.key,
          className: `rounded-${hit.key}`,
          delta: hit.delta,
          deltaUnit: 'px',
        },
        provenance,
      }
    }
  }

  if (mapping.ns === 'borderWidth') {
    const hit = matchScale(px, tokens.borderWidth, exactTol, nearTol)
    if (hit?.kind === 'exact') {
      const className = applyPrefix(
        tokens,
        hit.key === 'DEFAULT' ? 'border' : `border-${hit.key}`,
      )
      return {
        property,
        className,
        confidence: 'exact-value',
        provenance: { property, hintStatus: 'absent', tokenKey: hit.key, utility: mapping.util },
      }
    }
  }

  const className = applyPrefix(tokens, `${mapping.util}-[${value}]`)
  return {
    property,
    className,
    confidence: className ? 'arbitrary' : 'none',
    provenance,
  }
}
