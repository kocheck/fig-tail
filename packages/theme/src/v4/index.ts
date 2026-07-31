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
import { toLengthToken } from '../length'
import type { DefaultThemeData } from '../v3/index'

type ThemeMaps = {
  colors: Record<string, ColorToken>
  spacingBase: string | null
  spacingNamed: Record<string, LengthToken>
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
  unsupported: Record<string, number>
}

const emptyMaps = (): ThemeMaps => ({
  colors: {},
  spacingBase: null,
  spacingNamed: {},
  radius: {},
  fontSize: {},
  fontFamily: {},
  fontWeight: {},
  lineHeight: {},
  letterSpacing: {},
  boxShadow: {},
  borderWidth: {},
  opacity: {},
  breakpoints: {},
  zIndex: {},
  unsupported: {},
})

const extractThemeBlocks = (css: string): string[] => {
  const blocks: string[] = []
  const re = /@theme(?:\s+[a-z]+)?\s*\{/g
  let match: RegExpExecArray | null
  while ((match = re.exec(css)) !== null) {
    void match
    let depth = 1
    let i = re.lastIndex
    while (i < css.length && depth > 0) {
      const ch = css[i]
      if (ch === '{') depth += 1
      if (ch === '}') depth -= 1
      i += 1
    }
    blocks.push(css.slice(re.lastIndex, i - 1))
    re.lastIndex = i
  }
  return blocks
}

const resolveVars = (value: string, vars: Record<string, string>): string => {
  let current = value
  for (let i = 0; i < 8; i += 1) {
    const next = current.replace(/var\((--[a-z0-9-]+)\)/gi, (_, name: string) => {
      return vars[name] ?? `var(${name})`
    })
    if (next === current) break
    current = next
  }
  return current
}

const applyDecl = (
  maps: ThemeMaps,
  name: string,
  value: string,
  remBasePx: number,
  vars: Record<string, string>,
) => {
  const resolved = resolveVars(value, vars)
  if (name === '*' && resolved === 'initial') {
    Object.assign(maps, emptyMaps())
    return
  }
  if (name.endsWith('-*') && resolved === 'initial') {
    const prefix = name.slice(0, -2)
    if (prefix === 'color') maps.colors = {}
    if (prefix === 'spacing') {
      maps.spacingBase = null
      maps.spacingNamed = {}
    }
    if (prefix === 'radius') maps.radius = {}
    return
  }
  if (name === 'spacing') {
    maps.spacingBase = resolved
    return
  }
  if (name.startsWith('color-')) {
    const token = toColorToken(resolved)
    if (token) maps.colors[name.slice(6)] = token
    return
  }
  if (name.startsWith('spacing-')) {
    maps.spacingNamed[name.slice(8)] = toLengthToken(resolved, remBasePx)
    return
  }
  if (name.startsWith('radius-')) {
    maps.radius[name.slice(7)] = toLengthToken(resolved, remBasePx)
    return
  }
  if (name.startsWith('text-')) {
    maps.fontSize[name.slice(5)] = toLengthToken(resolved, remBasePx)
    return
  }
  if (name.startsWith('font-weight-')) {
    maps.fontWeight[name.slice(12)] = Number(resolved)
    return
  }
  if (name.startsWith('font-')) {
    const stack = resolved.split(',').map((part) => part.trim().replace(/^["']|["']$/g, ''))
    maps.fontFamily[name.slice(5)] = { stack, primary: stack[0] ?? '' }
    return
  }
  if (name.startsWith('leading-')) {
    maps.lineHeight[name.slice(8)] = toLengthToken(resolved, remBasePx)
    return
  }
  if (name.startsWith('tracking-')) {
    maps.letterSpacing[name.slice(9)] = toLengthToken(resolved, remBasePx)
    return
  }
  if (name.startsWith('shadow-')) {
    maps.boxShadow[name.slice(7)] = { raw: resolved }
    return
  }
  if (name.startsWith('border-width-')) {
    maps.borderWidth[name.slice(13)] = toLengthToken(resolved, remBasePx)
    return
  }
  if (name.startsWith('opacity-')) {
    maps.opacity[name.slice(8)] = Number(resolved)
    return
  }
  if (name.startsWith('breakpoint-')) {
    maps.breakpoints[name.slice(11)] = toLengthToken(resolved, remBasePx)
    return
  }
  if (name.startsWith('z-index-')) {
    maps.zIndex[name.slice(8)] = resolved
    return
  }
  const ns = name.split('-')[0] ?? name
  maps.unsupported[ns] = (maps.unsupported[ns] ?? 0) + 1
}

const readPrefix = (css: string): PrefixStatus => {
  const match = /@import\s+["']tailwindcss["']\s+prefix\(([^)]+)\)/i.exec(css)
  if (!match?.[1]) {
    return { status: 'none' }
  }
  return { status: 'known', style: 'v4-variant', value: match[1].trim() }
}

/** Resolve v4 @theme CSS into a TokenSet. */
export const resolveV4 = (
  input: ResolveInput,
  sourceName: string,
  sourceText: string,
  defaults: DefaultThemeData | null,
): { tokens: TokenSet | null; unresolved: Unresolved[]; warnings: string[]; configPath?: string } => {
  const remBasePx = input.options?.remBasePx ?? 16
  const unresolved: Unresolved[] = []
  const warnings: string[] = []

  const configMatch = /@config\s+["']([^"']+)["']/i.exec(sourceText)
  const configPath = configMatch?.[1]

  const importRe = /@import\s+["']([^"']+)["']/gi
  let importMatch: RegExpExecArray | null
  while ((importMatch = importRe.exec(sourceText))) {
    const spec = importMatch[1]
    if (!spec || spec === 'tailwindcss' || spec.startsWith('tailwindcss/')) continue
    const provided = input.sources.some(
      (source) => source.name === spec || source.name.endsWith(`/${spec}`) || source.name === spec.replace(/^\.\//, ''),
    )
    if (!provided) {
      unresolved.push({
        path: `@import ${spec}`,
        reason: 'missing-import',
        snippet: importMatch[0],
        source: sourceName,
        message: `Imported file "${spec}" was not provided. Drop it into fig-tail setup to resolve those tokens.`,
      })
    }
  }

  const exactVersion = input.tailwindVersion?.exact
  const defaultsConfirmed = Boolean(defaults && exactVersion && exactVersion === defaults.version)
  const maps = emptyMaps()
  const partialNamespaces = new Set<string>()

  if (defaultsConfirmed && defaults) {
    maps.colors = { ...defaults.colors }
    maps.spacingBase = defaults.spacing.base
    maps.spacingNamed = { ...defaults.spacing.named }
    maps.radius = { ...defaults.radius }
    maps.fontSize = { ...defaults.fontSize }
    maps.fontFamily = { ...defaults.fontFamily }
    maps.fontWeight = { ...defaults.fontWeight }
    maps.lineHeight = { ...defaults.lineHeight }
    maps.letterSpacing = { ...defaults.letterSpacing }
    maps.boxShadow = { ...defaults.boxShadow }
    maps.borderWidth = { ...defaults.borderWidth }
    maps.opacity = { ...defaults.opacity }
    maps.breakpoints = { ...defaults.breakpoints }
    maps.zIndex = { ...defaults.zIndex }
  } else {
    for (const ns of [
      'colors',
      'spacing',
      'radius',
      'fontSize',
      'fontFamily',
      'fontWeight',
      'lineHeight',
      'letterSpacing',
      'boxShadow',
      'borderWidth',
      'opacity',
      'breakpoints',
      'zIndex',
    ]) {
      partialNamespaces.add(ns)
    }
  }

  const blocks = extractThemeBlocks(sourceText)
  if (blocks.length === 0 && !configPath) {
    unresolved.push({
      path: '@theme',
      reason: 'parse-error',
      snippet: sourceText.slice(0, 120),
      source: sourceName,
      message: `No @theme block found in ${sourceName}.`,
    })
  }

  for (const block of blocks) {
    const vars: Record<string, string> = {}
    const decls = [...block.matchAll(/--([a-z0-9*-]+)\s*:\s*([^;]+);/gi)]
    for (const decl of decls) {
      const name = decl[1]
      const value = decl[2]?.trim()
      if (!name || !value) continue
      vars[`--${name}`] = value
    }
    for (const decl of decls) {
      const name = decl[1]
      const value = decl[2]?.trim()
      if (!name || !value) continue
      applyDecl(maps, name, value, remBasePx, vars)
    }
  }

  // Pair line-height companions: --text-sm--line-height
  for (const block of blocks) {
    const companions = [...block.matchAll(/--text-([a-z0-9-]+)--line-height\s*:\s*([^;]+);/gi)]
    for (const companion of companions) {
      const key = companion[1]
      const value = companion[2]?.trim()
      if (!key || !value) continue
      const existing = maps.fontSize[key]
      if (existing) {
        maps.fontSize[key] = {
          ...existing,
          lineHeight: toLengthToken(value, remBasePx),
        }
      }
    }
  }

  const basePx = maps.spacingBase ? toLengthToken(maps.spacingBase, remBasePx).px : null

  const tokens: TokenSet = {
    schemaVersion: TOKEN_SET_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    source: {
      major: 4,
      entry: sourceName,
      prefix: readPrefix(sourceText),
      corePlugins: { mode: 'all', names: [] },
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
    colors: maps.colors,
    spacing: {
      ...emptySpacing(),
      base: maps.spacingBase,
      basePx,
      named: maps.spacingNamed,
    },
    radius: maps.radius,
    fontSize: maps.fontSize,
    fontFamily: maps.fontFamily,
    fontWeight: maps.fontWeight,
    lineHeight: maps.lineHeight,
    letterSpacing: maps.letterSpacing,
    boxShadow: maps.boxShadow,
    borderWidth: maps.borderWidth,
    opacity: maps.opacity,
    breakpoints: maps.breakpoints,
    zIndex: maps.zIndex,
    unsupported: maps.unsupported,
    unknownNamespaces: [],
    partialNamespaces: [...partialNamespaces].sort(),
  }

  const result: {
    tokens: TokenSet | null
    unresolved: Unresolved[]
    warnings: string[]
    configPath?: string
  } = { tokens, unresolved, warnings }
  if (configPath) {
    result.configPath = configPath
  }
  return result
}
