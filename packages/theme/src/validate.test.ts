import { describe, expect, it } from 'vitest'
import {
  emptySpacing,
  TOKEN_SET_SCHEMA_VERSION,
  type TokenSet,
} from './types'
import { validateConfigProvenance, validateTokenSet } from './validate'

const validTokenSet = (): TokenSet => ({
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
    'brand-500': { hex: '#3b82f6', rgb: [59, 130, 246], alpha: 1 },
  },
  spacing: {
    ...emptySpacing(),
    scale: { '4': { raw: '1rem', px: 16 } },
  },
  radius: { lg: { raw: '0.5rem', px: 8 } },
  fontSize: {
    sm: { raw: '0.875rem', px: 14, lineHeight: { raw: '1.25rem', px: 20 } },
  },
  fontFamily: { sans: { stack: ['Inter', 'ui-sans-serif'], primary: 'Inter' } },
  fontWeight: { medium: 500 },
  lineHeight: { tight: { raw: '1.25', px: null } },
  letterSpacing: { tight: { raw: '-0.025em', px: null } },
  boxShadow: { md: { raw: '0 4px 6px -1px rgb(0 0 0 / 0.1)' } },
  borderWidth: { 'DEFAULT': { raw: '1px', px: 1 } },
  opacity: { '50': 0.5 },
  breakpoints: { md: { raw: '48rem', px: 768 } },
  zIndex: { '10': '10' },
  unsupported: {},
  unknownNamespaces: [],
  partialNamespaces: [],
})

describe('schema', () => {
  it('accepts a confirmed valid TokenSet', () => {
    const result = validateTokenSet(validTokenSet())
    expect(result.ok).toBe(true)
  })

  it('accepts unconfirmed fixtures with empty defaults-derived namespaces', () => {
    const tokens = validTokenSet()
    tokens.source.defaults = { status: 'unconfirmed', reason: 'missing-exact-version' }
    tokens.source.tailwindVersionEvidence = null
    tokens.partialNamespaces = ['colors']
    const result = validateTokenSet(tokens)
    expect(result.ok).toBe(true)
  })

  it('rejects missing alpha', () => {
    const tokens = validTokenSet()
    const color = tokens.colors['brand-500']
    if (!color) throw new Error('missing color')
    const broken = { ...color } as { hex: string; rgb: [number, number, number]; alpha?: number }
    delete broken.alpha
    tokens.colors['brand-500'] = broken as typeof color
    const result = validateTokenSet(tokens)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((e) => e.includes('alpha'))).toBe(true)
  })

  it('rejects px as a string', () => {
    const tokens = validTokenSet()
    tokens.spacing.scale['4'] = { raw: '1rem', px: '16' as unknown as number }
    const result = validateTokenSet(tokens)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((e) => e.includes('px'))).toBe(true)
  })

  it('rejects a dotted key', () => {
    const tokens = validTokenSet()
    tokens.colors['brand.500'] = { hex: '#3b82f6', rgb: [59, 130, 246], alpha: 1 }
    const result = validateTokenSet(tokens)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((e) => e.includes('dotted'))).toBe(true)
  })

  it('rejects a missing schemaVersion', () => {
    const tokens = validTokenSet() as unknown as Record<string, unknown>
    delete tokens.schemaVersion
    const result = validateTokenSet(tokens)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((e) => e.includes('schemaVersion'))).toBe(true)
  })

  it('rejects a colour with two rgb channels', () => {
    const tokens = validTokenSet()
    tokens.colors['brand-500'] = {
      hex: '#3b82f6',
      rgb: [59, 130] as unknown as [number, number, number],
      alpha: 1,
    }
    const result = validateTokenSet(tokens)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((e) => e.includes('rgb'))).toBe(true)
  })

  it('rejects unknown namespace that still carries tokens', () => {
    const tokens = validTokenSet()
    tokens.unknownNamespaces = ['colors']
    const result = validateTokenSet(tokens)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.some((e) => e.includes('unknown namespace'))).toBe(true)
  })
})

describe('schema provenance', () => {
  it('accepts browser provenance', () => {
    const result = validateConfigProvenance({
      kind: 'browser',
      sources: [
        {
          name: 'tailwind.config.js',
          sha256: 'a'.repeat(64),
          byteLength: 12,
        },
      ],
      resolvedAt: '2026-07-31T00:00:00.000Z',
      inputSha256: 'b'.repeat(64),
    })
    expect(result.ok).toBe(true)
  })

  it('accepts cli provenance exact shapes', () => {
    const result = validateConfigProvenance({
      kind: 'cli',
      sources: [
        {
          name: 'tailwind.config.js',
          sha256: 'a'.repeat(64),
          byteLength: 12,
        },
      ],
      resolvedAt: '2026-07-31T00:00:00.000Z',
      inputSha256: 'b'.repeat(64),
      cliVersion: '0.0.0',
      targetTailwindVersion: '3.4.19',
      projectName: 'app',
      entry: 'tailwind.config.js',
    })
    expect(result.ok).toBe(true)
  })

  it('rejects aliases and absolute paths', () => {
    const result = validateConfigProvenance({
      kind: 'cli',
      sources: [
        {
          name: '/abs/tailwind.config.js',
          sha256: 'a'.repeat(64),
          byteLength: 12,
        },
      ],
      resolvedAt: '2026-07-31T00:00:00.000Z',
      inputSha256: 'b'.repeat(64),
      cliVersion: '0.0.0',
      targetTailwindVersion: '3.4.19',
      projectName: 'app',
      entry: 'tailwind.config.js',
      inputsSha256: 'nope',
    })
    expect(result.ok).toBe(false)
  })
})
