import type {
  ColorToken,
  FontFamilyToken,
  FontSizeToken,
  LengthToken,
  PrefixStatus,
  ResolveInput,
  TokenSet,
  Unresolved,
} from '../types'
import { emptySpacing, TOKEN_SET_SCHEMA_VERSION } from '../types'
import { toColorToken } from '../color'
import { flattenKeys, toLengthToken } from '../length'
import { evaluateConfigModule, type KnownModules } from './evaluate'
import { applyThemeConfig } from './merge'

export type DefaultThemeData = {
  version: string
  colors: Record<string, ColorToken>
  spacing: TokenSet['spacing']
  radius: Record<string, LengthToken>
  fontSize: Record<string, FontSizeToken>
  fontFamily: Record<string, FontFamilyToken>
  fontWeight: Record<string, number>
  lineHeight: Record<string, LengthToken>
  letterSpacing: Record<string, LengthToken>
  boxShadow: Record<string, { raw: string }>
  borderWidth: Record<string, LengthToken>
  opacity: Record<string, number>
  breakpoints: Record<string, LengthToken>
  zIndex: Record<string, string>
}

const nsMap: Record<string, string> = {
  colors: 'colors',
  spacing: 'spacing',
  borderRadius: 'radius',
  fontSize: 'fontSize',
  fontFamily: 'fontFamily',
  fontWeight: 'fontWeight',
  lineHeight: 'lineHeight',
  letterSpacing: 'letterSpacing',
  boxShadow: 'boxShadow',
  borderWidth: 'borderWidth',
  opacity: 'opacity',
  screens: 'breakpoints',
  zIndex: 'zIndex',
}

const toColors = (value: unknown): Record<string, ColorToken> => {
  const flat = flattenKeys(value)
  const out: Record<string, ColorToken> = {}
  for (const [key, raw] of Object.entries(flat)) {
    if (typeof raw !== 'string') continue
    const token = toColorToken(raw)
    if (token) out[key] = token
  }
  return out
}

const toLengths = (value: unknown, remBasePx: number): Record<string, LengthToken> => {
  const flat = flattenKeys(value)
  const out: Record<string, LengthToken> = {}
  for (const [key, raw] of Object.entries(flat)) {
    if (typeof raw !== 'string' && typeof raw !== 'number') continue
    out[key === 'DEFAULT' ? 'DEFAULT' : key] = toLengthToken(String(raw), remBasePx)
  }
  return out
}

const toFontSizes = (value: unknown, remBasePx: number): Record<string, FontSizeToken> => {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, FontSizeToken> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === 'string' || typeof entry === 'number') {
      out[key] = toLengthToken(String(entry), remBasePx)
      continue
    }
    if (Array.isArray(entry)) {
      const size = toLengthToken(String(entry[0]), remBasePx)
      const meta = entry[1]
      if (meta && typeof meta === 'object' && meta !== null && 'lineHeight' in meta) {
        out[key] = {
          ...size,
          lineHeight: toLengthToken(String((meta as { lineHeight: unknown }).lineHeight), remBasePx),
        }
      } else {
        out[key] = size
      }
    }
  }
  return out
}

const toFontFamilies = (value: unknown): Record<string, FontFamilyToken> => {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, FontFamilyToken> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const stack = Array.isArray(entry) ? entry.map(String) : [String(entry)]
    out[key] = { stack, primary: stack[0] ?? '' }
  }
  return out
}

const defaultsAsThemeObject = (data: DefaultThemeData): Record<string, unknown> => ({
  colors: Object.fromEntries(
    Object.entries(data.colors).map(([key, token]) => [key, token.raw ?? token.hex]),
  ),
  spacing: Object.fromEntries(
    Object.entries(data.spacing.scale).map(([key, token]) => [key, token.raw]),
  ),
  borderRadius: Object.fromEntries(
    Object.entries(data.radius).map(([key, token]) => [key, token.raw]),
  ),
  fontSize: Object.fromEntries(
    Object.entries(data.fontSize).map(([key, token]) => {
      if (token.lineHeight) {
        return [key, [token.raw, { lineHeight: token.lineHeight.raw }]]
      }
      return [key, token.raw]
    }),
  ),
  fontFamily: Object.fromEntries(
    Object.entries(data.fontFamily).map(([key, token]) => [key, token.stack]),
  ),
  fontWeight: { ...data.fontWeight },
  lineHeight: Object.fromEntries(
    Object.entries(data.lineHeight).map(([key, token]) => [key, token.raw]),
  ),
  letterSpacing: Object.fromEntries(
    Object.entries(data.letterSpacing).map(([key, token]) => [key, token.raw]),
  ),
  boxShadow: Object.fromEntries(
    Object.entries(data.boxShadow).map(([key, token]) => [key, token.raw]),
  ),
  borderWidth: Object.fromEntries(
    Object.entries(data.borderWidth).map(([key, token]) => [key, token.raw]),
  ),
  opacity: { ...data.opacity },
  screens: Object.fromEntries(
    Object.entries(data.breakpoints).map(([key, token]) => [key, token.raw]),
  ),
  zIndex: { ...data.zIndex },
})

const readPrefix = (
  config: Record<string, unknown>,
  unresolved: Unresolved[],
  sourceName: string,
): PrefixStatus => {
  if (!('prefix' in config)) {
    return { status: 'none' }
  }
  const prefix = config.prefix
  if (typeof prefix === 'string') {
    return { status: 'known', style: 'v3-string', value: prefix }
  }
  unresolved.push({
    path: 'prefix',
    reason: 'dynamic-expression',
    snippet: String(prefix),
    source: sourceName,
    message:
      'prefix could not be read as a string. fig-tail will not emit classes for this config until prefix is a plain string.',
  })
  return { status: 'unknown' }
}

const readCorePlugins = (
  config: Record<string, unknown>,
): TokenSet['source']['corePlugins'] => {
  if (!('corePlugins' in config)) {
    return { mode: 'all', names: [] }
  }
  const value = config.corePlugins
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return { mode: 'allowlist', names: value }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const names = Object.entries(value as Record<string, unknown>)
      .filter(([, enabled]) => enabled === false)
      .map(([name]) => name)
    return { mode: 'denylist', names }
  }
  return { mode: 'unknown', names: [] }
}

/** Resolve a v3 Tailwind config source into a TokenSet. */
export const resolveV3 = (
  input: ResolveInput,
  sourceName: string,
  sourceText: string,
  defaults: DefaultThemeData | null,
  known: KnownModules,
): { tokens: TokenSet | null; unresolved: Unresolved[]; warnings: string[] } => {
  const remBasePx = input.options?.remBasePx ?? 16
  const evaluated = evaluateConfigModule(sourceText, sourceName, known)
  const unresolved = [...evaluated.unresolved]
  const warnings: string[] = []

  if (!evaluated.ok || !evaluated.value || typeof evaluated.value !== 'object') {
    return { tokens: null, unresolved, warnings }
  }

  const config = evaluated.value as Record<string, unknown>
  if (Array.isArray(config.presets) && config.presets.length > 0) {
    unresolved.push({
      path: 'presets',
      reason: 'preset',
      snippet: 'presets: [...]',
      source: sourceName,
      message:
        'presets reference external modules that fig-tail cannot load in-browser. Explicit theme values still resolve; preset-only tokens will be missing.',
    })
  }

  const theme =
    config.theme && typeof config.theme === 'object' && !Array.isArray(config.theme)
      ? (config.theme as Record<string, unknown>)
      : undefined

  const exactVersion = input.tailwindVersion?.exact
  const defaultsConfirmed = Boolean(
    defaults && exactVersion && exactVersion === defaults.version,
  )
  const baseTheme = defaultsConfirmed && defaults ? defaultsAsThemeObject(defaults) : {}

  const applied = applyThemeConfig(baseTheme, theme)

  for (const key of applied.unresolvableReplace) {
    unresolved.push({
      path: `theme.${key}`,
      reason: 'dynamic-expression',
      snippet: `theme.${key}`,
      source: sourceName,
      message: `theme.${key} could not be evaluated. That namespace is marked unknown so fig-tail will not invent default tokens.`,
    })
  }
  for (const key of applied.unresolvableExtend) {
    unresolved.push({
      path: `theme.extend.${key}`,
      reason: 'dynamic-expression',
      snippet: `theme.extend.${key}`,
      source: sourceName,
      message: `theme.extend.${key} could not be evaluated.`,
    })
  }

  // Track function-valued keys already reported by evaluator via path theme.extend.*
  const unknownNamespaces = new Set<string>()
  const partialNamespaces = new Set<string>()

  for (const key of applied.unresolvableReplace) {
    const ns = nsMap[key] ?? key
    unknownNamespaces.add(ns)
  }

  // If theme.colors was explicitly set to undefined due to function, evaluator
  // already created unresolved entries; detect replacing keys that are missing
  // from merged because they were functions (not present on theme object).
  if (theme) {
    for (const entry of unresolved) {
      const replaceMatch =
        /(^|\.)theme\.([^.]+)$/.exec(entry.path) ||
        /^module\.exports\.theme\.([^.]+)$/.exec(entry.path) ||
        /^export default\.theme\.([^.]+)$/.exec(entry.path)
      if (replaceMatch && entry.reason === 'function-value') {
        const key = replaceMatch[2] ?? replaceMatch[1]
        if (key && key !== 'extend') {
          const ns = nsMap[key] ?? key
          unknownNamespaces.add(ns)
        }
      }
      const extendMatch = /theme\.extend\.([^.]+)/.exec(entry.path)
      if (extendMatch?.[1] && entry.reason === 'function-value') {
        const ns = nsMap[extendMatch[1]] ?? extendMatch[1]
        if (!defaultsConfirmed) {
          partialNamespaces.add(ns)
        }
      }
    }
  }

  // Replacing keys that were skipped (function values leave the key absent)
  if (theme) {
    for (const entry of unresolved) {
      const match = /theme\.([^.]+)$/.exec(entry.path)
      if (match?.[1] && match[1] !== 'extend' && entry.reason === 'function-value') {
        unknownNamespaces.add(nsMap[match[1]] ?? match[1])
      }
    }
  }

  if (!defaultsConfirmed) {
    for (const ns of Object.values(nsMap)) {
      if (!unknownNamespaces.has(ns)) {
        partialNamespaces.add(ns)
      }
    }
  }

  const merged = applied.merged
  const colors = unknownNamespaces.has('colors') ? {} : toColors(merged.colors)
  const spacingScale = unknownNamespaces.has('spacing')
    ? {}
    : toLengths(merged.spacing, remBasePx)

  const tokens: TokenSet = {
    schemaVersion: TOKEN_SET_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    source: {
      major: 3,
      entry: sourceName,
      prefix: readPrefix(config, unresolved, sourceName),
      corePlugins: readCorePlugins(config),
      remBasePx,
      tailwindVersionEvidence: input.tailwindVersion ?? null,
      defaults: defaultsConfirmed && defaults
        ? { status: 'confirmed', version: defaults.version }
        : {
            status: 'unconfirmed',
            reason: exactVersion
              ? `no-bundled-dataset-for-${exactVersion}`
              : 'missing-exact-version',
          },
    },
    colors,
    spacing: {
      ...emptySpacing(),
      scale: spacingScale,
    },
    radius: unknownNamespaces.has('radius') ? {} : toLengths(merged.borderRadius, remBasePx),
    fontSize: unknownNamespaces.has('fontSize')
      ? {}
      : toFontSizes(merged.fontSize, remBasePx),
    fontFamily: unknownNamespaces.has('fontFamily') ? {} : toFontFamilies(merged.fontFamily),
    fontWeight: unknownNamespaces.has('fontWeight')
      ? {}
      : Object.fromEntries(
          Object.entries((merged.fontWeight as Record<string, unknown>) ?? {}).map(
            ([key, value]) => [key, Number(value)],
          ),
        ),
    lineHeight: unknownNamespaces.has('lineHeight')
      ? {}
      : toLengths(merged.lineHeight, remBasePx),
    letterSpacing: unknownNamespaces.has('letterSpacing')
      ? {}
      : toLengths(merged.letterSpacing, remBasePx),
    boxShadow: unknownNamespaces.has('boxShadow')
      ? {}
      : Object.fromEntries(
          Object.entries((merged.boxShadow as Record<string, unknown>) ?? {})
            .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
            .map(([key, value]) => [key === 'DEFAULT' ? 'DEFAULT' : key, { raw: String(value) }]),
        ),
    borderWidth: unknownNamespaces.has('borderWidth')
      ? {}
      : toLengths(merged.borderWidth, remBasePx),
    opacity: unknownNamespaces.has('opacity')
      ? {}
      : Object.fromEntries(
          Object.entries((merged.opacity as Record<string, unknown>) ?? {}).map(
            ([key, value]) => [key, Number(value)],
          ),
        ),
    breakpoints: unknownNamespaces.has('breakpoints')
      ? {}
      : toLengths(merged.screens, remBasePx),
    zIndex: unknownNamespaces.has('zIndex')
      ? {}
      : Object.fromEntries(
          Object.entries((merged.zIndex as Record<string, unknown>) ?? {}).map(
            ([key, value]) => [key, String(value)],
          ),
        ),
    unsupported: {},
    unknownNamespaces: [...unknownNamespaces].sort(),
    partialNamespaces: [...partialNamespaces].filter((ns) => !unknownNamespaces.has(ns)).sort(),
  }

  if (input.options?.pruneDefaults && defaultsConfirmed && defaults) {
    // keep explicit tokens only — already true when defaults unconfirmed
  }

  return { tokens, unresolved, warnings }
}
