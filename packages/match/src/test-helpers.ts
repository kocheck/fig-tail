import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveTheme, TOKEN_SET_SCHEMA_VERSION, type TokenSet } from '@fig-tail/theme'

export const emptySpacing = () => ({
  base: null as string | null,
  basePx: null as number | null,
  named: {} as TokenSet['spacing']['named'],
  scale: {} as TokenSet['spacing']['scale'],
})

const fixturesRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../fixtures/configs')

export const readConfig = (major: 'v3' | 'v4', name: string): string =>
  readFileSync(path.join(fixturesRoot, major, name), 'utf8')

export const tokensFromConfig = (
  major: 'v3' | 'v4',
  name: string,
  tailwindVersion?: { exact: string; source: 'package-json' },
): TokenSet => {
  const result = resolveTheme({
    sources: [{ name, text: readConfig(major, name) }],
    ...(tailwindVersion !== undefined ? { tailwindVersion } : {}),
  })
  if (!result.tokens) throw new Error(`expected tokens from ${major}/${name}`)
  return result.tokens
}

export const baseTokenSet = (overrides: Partial<TokenSet> = {}): TokenSet => ({
  schemaVersion: TOKEN_SET_SCHEMA_VERSION,
  generatedAt: '2026-07-31T00:00:00.000Z',
  source: {
    major: 3,
    entry: 'tailwind.config.js',
    prefix: { status: 'none' },
    corePlugins: { mode: 'all', names: [] },
    remBasePx: 16,
    tailwindVersionEvidence: { exact: '3.4.19', source: 'package-json' },
    defaults: { status: 'confirmed', version: '3.4.19' },
  },
  colors: {
    'brand-500': { hex: '#3b82f6', rgb: [59, 130, 246], alpha: 1, raw: '#3b82f6' },
    'gray-200': { hex: '#e5e7eb', rgb: [229, 231, 235], alpha: 1, raw: '#e5e7eb' },
    white: { hex: '#ffffff', rgb: [255, 255, 255], alpha: 1, raw: '#ffffff' },
  },
  spacing: {
    ...emptySpacing(),
    basePx: null,
    scale: {
      '4': { raw: '1rem', px: 16 },
      '6': { raw: '1.5rem', px: 24 },
    },
    named: {},
  },
  radius: {
    xl: { raw: '0.75rem', px: 12 },
  },
  fontSize: {
    sm: { raw: '0.875rem', px: 14, lineHeight: { raw: '1.25rem', px: 20 } },
  },
  fontFamily: {
    sans: { stack: ['Inter', 'ui-sans-serif'], primary: 'Inter' },
  },
  fontWeight: { medium: 500 },
  lineHeight: {
    '5': { raw: '1.25rem', px: 20 },
    '6': { raw: '1.5rem', px: 24 },
  },
  letterSpacing: {
    tight: { raw: '-0.025em', px: null },
  },
  boxShadow: {
    xs: { raw: '0 1px 2px 0 rgb(16 24 40 / 0.05)' },
    sm: { raw: '0 1px 2px 0 rgb(0 0 0 / 0.05)' },
  },
  borderWidth: {
    DEFAULT: { raw: '1px', px: 1 },
    '2': { raw: '2px', px: 2 },
  },
  opacity: {
    '50': 0.5,
    '75': 0.75,
  },
  breakpoints: { md: { raw: '48rem', px: 768 } },
  zIndex: { '10': '10' },
  unsupported: {},
  unknownNamespaces: [],
  partialNamespaces: [],
  ...overrides,
})
