import { differenceCiede2000, parse } from 'culori'
import type { ColorToken, TokenSet } from '@fig-tail/theme'
import type { MatchResult, VariableHint } from '../types'
import { applyPrefix, utilityAvailable, withKnownPrefix } from '../availability'

const deltaE = differenceCiede2000()

const COLOR_UTILS: Record<string, string> = {
  'background-color': 'bg',
  background: 'bg',
  color: 'text',
  'border-color': 'border',
  'border-top-color': 'border-t',
  'border-right-color': 'border-r',
  'border-bottom-color': 'border-b',
  'border-left-color': 'border-l',
  'outline-color': 'outline',
  fill: 'fill',
  stroke: 'stroke',
}

const CORE_FOR_UTIL: Record<string, string> = {
  bg: 'backgroundColor',
  text: 'textColor',
  border: 'borderColor',
  'border-t': 'borderColor',
  'border-r': 'borderColor',
  'border-b': 'borderColor',
  'border-l': 'borderColor',
  outline: 'outlineColor',
  fill: 'fill',
  stroke: 'stroke',
}

type Rgba = { r: number; g: number; b: number; alpha: number }

const toRgba = (value: string): Rgba | null => {
  const parsed = parse(value)
  if (!parsed) return null
  const rgb = parsed.mode === 'rgb' ? parsed : parse(value)
  // force through hex via token path when needed
  if (!rgb || rgb.mode !== 'rgb') {
    // try comparing after culori conversion by formatting through rgb channels when present
    const anyColor = parsed as { mode: string; r?: number; g?: number; b?: number; alpha?: number }
    if (anyColor.r === undefined) {
      // convert using difference against itself by reconstructing from format — fallback parse hex only
      return null
    }
  }
  const asRgb = parsed.mode === 'rgb' ? parsed : null
  if (asRgb && asRgb.r !== undefined && asRgb.g !== undefined && asRgb.b !== undefined) {
    return {
      r: Math.max(0, Math.min(255, Math.round(asRgb.r * 255))),
      g: Math.max(0, Math.min(255, Math.round(asRgb.g * 255))),
      b: Math.max(0, Math.min(255, Math.round(asRgb.b * 255))),
      alpha: asRgb.alpha ?? 1,
    }
  }
  // For oklch etc, use difference against token hex instead of failing
  return null
}

const colourEquals = (a: string, token: ColorToken): boolean => {
  const alpha = readAlpha(a)
  const left = toRgba(a)
  if (left) {
    const rgbMatch =
      left.r === token.rgb[0] &&
      left.g === token.rgb[1] &&
      left.b === token.rgb[2]
    if (alpha < 0.995) {
      return rgbMatch && Math.abs(token.alpha - 1) < 0.005
    }
    return rgbMatch && Math.abs(left.alpha - token.alpha) < 0.005
  }
  // Fallback: parse both and compare via zero deltaE + alpha
  const parsed = parse(a)
  const tokenParsed = parse(token.hex)
  if (!parsed || !tokenParsed) return false
  const delta = deltaE(parsed, tokenParsed)
  const parsedAlpha = 'alpha' in parsed && typeof parsed.alpha === 'number' ? parsed.alpha : 1
  return delta < 0.001 && Math.abs(parsedAlpha - token.alpha) < 0.005
}

const opacityModifier = (alpha: number): string => {
  if (Math.abs(alpha - 1) < 0.005) return ''
  const pct = Math.round(alpha * 100)
  const stepped = Math.round(pct / 5) * 5
  if (Math.abs(pct - stepped) === 0 && stepped >= 0 && stepped <= 100) {
    return `/${stepped}`
  }
  return `/[${alpha}]`
}

const readAlpha = (value: string): number => {
  const parsed = parse(value)
  if (parsed && 'alpha' in parsed && typeof parsed.alpha === 'number') {
    return parsed.alpha
  }
  return 1
}

const pickExact = (
  tokens: Record<string, ColorToken>,
  value: string,
  hint?: VariableHint,
): { key: string; candidates: string[] } | null => {
  const matches = Object.entries(tokens)
    .filter(([, token]) => colourEquals(value, token))
    .map(([key]) => key)
  if (matches.length === 0) return null
  if (hint?.codeSyntax && matches.includes(hint.codeSyntax)) {
    return { key: hint.codeSyntax, candidates: matches }
  }
  if (hint?.name) {
    const fromName = hint.name.replace(/\//g, '-')
    if (matches.includes(fromName)) {
      return { key: fromName, candidates: matches }
    }
  }
  const sorted = [...matches].sort((a, b) => a.length - b.length || (a < b ? -1 : 1))
  const key = sorted[0]
  if (!key) return null
  return { key, candidates: matches }
}

/** Match a colour declaration against the token set. */
export const matchColor = (
  property: string,
  value: string,
  tokens: TokenSet | null,
  hint: VariableHint | undefined,
  deltaELimit = 2,
): MatchResult => {
  const utility = COLOR_UTILS[property]
  const provenanceBase = {
    property,
    hintStatus: hint ? ('unresolvable' as const) : ('absent' as const),
  }
  if (!utility) {
    return {
      property,
      className: null,
      confidence: 'none',
      note: `Unsupported colour property ${property}`,
      provenance: provenanceBase,
    }
  }
  if (value.includes('gradient')) {
    return {
      property,
      className: null,
      confidence: 'none',
      note: 'Gradients are not mapped to Tailwind colour utilities',
      provenance: provenanceBase,
    }
  }

  const core = CORE_FOR_UTIL[utility]
  if (tokens && core && !utilityAvailable(tokens, core)) {
    return {
      property,
      className: null,
      confidence: 'none',
      note: `Core plugin ${core} is unavailable`,
      provenance: provenanceBase,
    }
  }

  if (tokens?.unknownNamespaces.includes('colors')) {
    const arbitrary = applyPrefix(tokens, `${utility}-[${value}]`)
    return {
      property,
      className: arbitrary,
      confidence: arbitrary ? 'arbitrary' : 'none',
      note: 'fig-tail could not read your colours; showing raw values for them',
      provenance: provenanceBase,
    }
  }

  if (hint?.codeSyntax && tokens?.colors[hint.codeSyntax]) {
    const token = tokens.colors[hint.codeSyntax]
    if (token && colourEquals(value, token)) {
      const prefixed = withKnownPrefix(
        tokens,
        `${utility}-${hint.codeSyntax}${opacityModifier(readAlpha(value))}`,
        'exact-variable',
      )
      return {
        property,
        className: prefixed.className,
        confidence: prefixed.confidence,
        ...(prefixed.note !== undefined ? { note: prefixed.note } : {}),
        provenance: {
          property,
          hintStatus: 'applied',
          tokenKey: hint.codeSyntax,
          utility,
        },
      }
    }
  }

  if (!tokens) {
    return {
      property,
      className: `${utility}-[${value}]`,
      confidence: 'arbitrary',
      note: 'No Tailwind config — generic Tailwind syntax; project prefix/settings may require changes.',
      provenance: provenanceBase,
    }
  }

  const exact = pickExact(tokens.colors, value, hint)
  if (exact) {
    const prefixed = withKnownPrefix(
      tokens,
      `${utility}-${exact.key}${opacityModifier(readAlpha(value))}`,
      hint?.name && exact.key === hint.name.replace(/\//g, '-')
        ? 'name-match'
        : 'exact-value',
    )
    const result: MatchResult = {
      property,
      className: prefixed.className,
      confidence: prefixed.confidence,
      ...(prefixed.note !== undefined ? { note: prefixed.note } : {}),
      provenance: {
        property,
        hintStatus: hint ? 'applied' : 'absent',
        tokenKey: exact.key,
        utility,
      },
    }
    if (exact.candidates.length > 1) {
      result.ambiguity = { chosen: exact.key, candidates: exact.candidates }
      result.note = `Multiple tokens share this value; chose ${exact.key}`
    }
    return result
  }

  let best: { key: string; delta: number } | null = null
  const parsedValue = parse(value)
  if (parsedValue) {
    for (const [key, token] of Object.entries(tokens.colors)) {
      const tokenColor = parse(token.hex)
      if (!tokenColor) continue
      const delta = deltaE(parsedValue, tokenColor)
      if (delta > 0 && delta <= deltaELimit && (!best || delta < best.delta)) {
        best = { key, delta }
      }
    }
  }

  if (best) {
    return {
      property,
      className: null,
      confidence: 'nearest',
      nearest: {
        tokenKey: best.key,
        className: `${utility}-${best.key}`,
        delta: best.delta,
        deltaUnit: 'deltaE',
      },
      note: `no exact token; nearest is ${best.key}, ΔE ${best.delta.toFixed(1)}`,
      provenance: provenanceBase,
    }
  }

  const partialNote = tokens.partialNamespaces.includes('colors')
    ? 'Bundled default colours were withheld; showing raw values for unmatched colours'
    : undefined

  const className = applyPrefix(tokens, `${utility}-[${value}]`)
  return {
    property,
    className,
    confidence: className ? 'arbitrary' : 'none',
    ...(partialNote !== undefined ? { note: partialNote } : {}),
    provenance: provenanceBase,
  }
}
