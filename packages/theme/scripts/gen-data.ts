import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { converter, formatHex, parse } from 'culori'
import defaultTheme from 'tailwindcss-v3/defaultTheme.js'
import colors from 'tailwindcss-v3/colors.js'

const root = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(root, '../data')
const remBasePx = 16
const toRgb = converter('rgb')

const colorToken = (raw: unknown) => {
  if (typeof raw !== 'string') return null
  const parsed = parse(raw)
  if (!parsed) return null
  const rgbColor = toRgb(parsed)
  if (!rgbColor || rgbColor.r === undefined || rgbColor.g === undefined || rgbColor.b === undefined) {
    return null
  }
  const r = Math.max(0, Math.min(255, Math.round(rgbColor.r * 255)))
  const g = Math.max(0, Math.min(255, Math.round(rgbColor.g * 255)))
  const b = Math.max(0, Math.min(255, Math.round(rgbColor.b * 255)))
  const hex =
    formatHex({
      mode: 'rgb',
      r: r / 255,
      g: g / 255,
      b: b / 255,
    }) ?? '#000000'
  const token: Record<string, unknown> = {
    hex,
    rgb: [r, g, b],
    alpha: rgbColor.alpha ?? 1,
  }
  if (raw.toLowerCase() !== hex.toLowerCase()) {
    token.raw = raw
  }
  return token
}

const lengthToken = (raw: unknown) => {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  const pxMatch = /^(-?\d+(?:\.\d+)?)px$/i.exec(trimmed)
  if (pxMatch?.[1]) return { raw: trimmed, px: Number(pxMatch[1]) }
  const remMatch = /^(-?\d+(?:\.\d+)?)rem$/i.exec(trimmed)
  if (remMatch?.[1]) return { raw: trimmed, px: Number(remMatch[1]) * remBasePx }
  return { raw: trimmed, px: null }
}

const flatten = (input: unknown, prefix = ''): Record<string, unknown> => {
  if (input === null || input === undefined) return {}
  if (typeof input !== 'object' || Array.isArray(input)) {
    return prefix ? { [prefix]: input } : {}
  }
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (key === 'DEFAULT') {
      if (prefix) out[prefix] = value
      continue
    }
    const next = prefix ? `${prefix}-${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, next))
    } else {
      out[next] = value
    }
  }
  return out
}

const buildV3 = () => {
  const colorMap = flatten(colors)
  const colorsOut: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(colorMap)) {
    const token = colorToken(value)
    if (token) colorsOut[key] = token
  }

  const spacingScale: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(defaultTheme.spacing ?? {})) {
    const token = lengthToken(value)
    if (token) spacingScale[key] = token
  }

  const radius: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(defaultTheme.borderRadius ?? {})) {
    const flatKey = key === 'DEFAULT' ? 'DEFAULT' : key
    const token = lengthToken(value)
    if (token) radius[flatKey] = token
  }

  const fontSize: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(defaultTheme.fontSize ?? {})) {
    if (Array.isArray(value)) {
      const size = lengthToken(value[0])
      if (!size) continue
      const meta = value[1]
      if (meta && typeof meta === 'object' && meta !== null && 'lineHeight' in meta) {
        const lh = lengthToken((meta as { lineHeight: string }).lineHeight)
        fontSize[key] = lh ? { ...size, lineHeight: lh } : size
      } else {
        fontSize[key] = size
      }
    } else {
      const size = lengthToken(value)
      if (size) fontSize[key] = size
    }
  }

  const fontFamily: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(defaultTheme.fontFamily ?? {})) {
    const stack = Array.isArray(value) ? value.map(String) : [String(value)]
    fontFamily[key] = { stack, primary: stack[0] ?? '' }
  }

  const fontWeight: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(defaultTheme.fontWeight ?? {})) {
    fontWeight[key] = Number(value)
  }

  const lineHeight: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(defaultTheme.lineHeight ?? {})) {
    const token = lengthToken(String(value))
    if (token) lineHeight[key] = token
  }

  const letterSpacing: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(defaultTheme.letterSpacing ?? {})) {
    const token = lengthToken(String(value))
    if (token) letterSpacing[key] = token
  }

  const boxShadow: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(defaultTheme.boxShadow ?? {})) {
    const flatKey = key === 'DEFAULT' ? 'DEFAULT' : key
    boxShadow[flatKey] = { raw: String(value) }
  }

  const borderWidth: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(defaultTheme.borderWidth ?? {})) {
    const flatKey = key === 'DEFAULT' ? 'DEFAULT' : key
    const token = lengthToken(String(value))
    if (token) borderWidth[flatKey] = token
  }

  const opacity: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(defaultTheme.opacity ?? {})) {
    opacity[key] = Number(value)
  }

  const breakpoints: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(defaultTheme.screens ?? {})) {
    if (typeof value === 'string') {
      const token = lengthToken(value)
      if (token) breakpoints[key] = token
    }
  }

  const zIndex: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(defaultTheme.zIndex ?? {})) {
    zIndex[key] = String(value)
  }

  return {
    version: '3.4.19',
    colors: colorsOut,
    spacing: { base: null, basePx: null, named: {}, scale: spacingScale },
    radius,
    fontSize,
    fontFamily,
    fontWeight,
    lineHeight,
    letterSpacing,
    boxShadow,
    borderWidth,
    opacity,
    breakpoints,
    zIndex,
  }
}

const parseThemeCss = (css: string) => {
  const colors: Record<string, unknown> = {}
  const namedSpacing: Record<string, unknown> = {}
  const radius: Record<string, unknown> = {}
  const fontSize: Record<string, unknown> = {}
  const fontFamily: Record<string, unknown> = {}
  const fontWeight: Record<string, unknown> = {}
  const lineHeight: Record<string, unknown> = {}
  const letterSpacing: Record<string, unknown> = {}
  const boxShadow: Record<string, unknown> = {}
  const borderWidth: Record<string, unknown> = {}
  const opacity: Record<string, unknown> = {}
  const breakpoints: Record<string, unknown> = {}
  const zIndex: Record<string, unknown> = {}
  let spacingBase: string | null = null

  const decls = [...css.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)]
  for (const match of decls) {
    const name = match[1]
    const value = match[2]?.trim()
    if (!name || !value) continue
    if (name === 'spacing') {
      spacingBase = value
      continue
    }
    if (name.startsWith('color-')) {
      const token = colorToken(value)
      if (token) colors[name.slice('color-'.length)] = token
      continue
    }
    if (name.startsWith('spacing-')) {
      const token = lengthToken(value)
      if (token) namedSpacing[name.slice('spacing-'.length)] = token
      continue
    }
    if (name.startsWith('radius-')) {
      const token = lengthToken(value)
      if (token) radius[name.slice('radius-'.length)] = token
      continue
    }
    if (name.startsWith('text-') && !name.includes('--')) {
      const token = lengthToken(value)
      if (token) fontSize[name.slice('text-'.length)] = token
      continue
    }
    if (name.startsWith('font-weight-')) {
      fontWeight[name.slice('font-weight-'.length)] = Number(value)
      continue
    }
    if (name.startsWith('font-')) {
      const stack = value.split(',').map((part) => part.trim().replace(/^["']|["']$/g, ''))
      fontFamily[name.slice('font-'.length)] = { stack, primary: stack[0] ?? '' }
      continue
    }
    if (name.startsWith('leading-')) {
      const token = lengthToken(value)
      if (token) lineHeight[name.slice('leading-'.length)] = token
      continue
    }
    if (name.startsWith('tracking-')) {
      const token = lengthToken(value)
      if (token) letterSpacing[name.slice('tracking-'.length)] = token
      continue
    }
    if (name.startsWith('shadow-')) {
      boxShadow[name.slice('shadow-'.length)] = { raw: value }
      continue
    }
    if (name.startsWith('border-width-')) {
      const token = lengthToken(value)
      if (token) borderWidth[name.slice('border-width-'.length)] = token
      continue
    }
    if (name.startsWith('opacity-')) {
      opacity[name.slice('opacity-'.length)] = Number(value)
      continue
    }
    if (name.startsWith('breakpoint-')) {
      const token = lengthToken(value)
      if (token) breakpoints[name.slice('breakpoint-'.length)] = token
      continue
    }
    if (name.startsWith('z-index-')) {
      zIndex[name.slice('z-index-'.length)] = value
    }
  }

  const basePx = spacingBase ? lengthToken(spacingBase)?.px ?? null : null
  return {
    version: '4.1.11',
    colors,
    spacing: {
      base: spacingBase,
      basePx,
      named: namedSpacing,
      scale: {},
    },
    radius,
    fontSize,
    fontFamily,
    fontWeight,
    lineHeight,
    letterSpacing,
    boxShadow,
    borderWidth,
    opacity,
    breakpoints,
    zIndex,
  }
}

const writeCompact = async (file: string, data: unknown) => {
  const json = JSON.stringify(data)
  await writeFile(file, json)
  return createHash('sha256').update(json).digest('hex')
}

await mkdir(dataDir, { recursive: true })

const v3 = buildV3()
const v3Path = path.join(dataDir, 'v3-default-theme.json')
const v3Hash = await writeCompact(v3Path, v3)

const themeCssPath = path.join(
  root,
  '../node_modules/tailwindcss-v4/theme.css',
)
let themeCss: string
try {
  themeCss = await readFile(themeCssPath, 'utf8')
} catch {
  const alt = path.join(
    root,
    '../../../node_modules/.pnpm/node_modules/tailwindcss-v4/theme.css',
  )
  try {
    themeCss = await readFile(alt, 'utf8')
  } catch {
    // Tailwind v4 may nest theme under dist
    const candidates = [
      path.join(root, '../node_modules/tailwindcss-v4/dist/theme.css'),
      path.join(root, '../node_modules/tailwindcss-v4/index.css'),
    ]
    let found: string | null = null
    for (const candidate of candidates) {
      try {
        found = await readFile(candidate, 'utf8')
        break
      } catch {
        // continue
      }
    }
    if (!found) {
      throw new Error('Could not locate tailwindcss-v4 theme.css')
    }
    themeCss = found
  }
}

const v4 = parseThemeCss(themeCss)
const v4Path = path.join(dataDir, 'v4-default-theme.json')
const v4Hash = await writeCompact(v4Path, v4)

console.log(`gen:data v3=${v3.version} sha=${v3Hash.slice(0, 12)} colors=${Object.keys(v3.colors).length}`)
console.log(`gen:data v4=${v4.version} sha=${v4Hash.slice(0, 12)} colors=${Object.keys(v4.colors).length}`)
