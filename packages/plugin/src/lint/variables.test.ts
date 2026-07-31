import { describe, expect, it } from 'vitest'
import { proposeVariableToken } from './variables'
import { TOKEN_SET_SCHEMA_VERSION, type TokenSet } from '@fig-tail/theme'

const tokens = (): TokenSet =>
  ({
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
    },
    spacing: { base: null, basePx: null, named: {}, scale: { '4': { raw: '1rem', px: 16 } } },
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
    unknownNamespaces: [],
    partialNamespaces: [],
  }) as TokenSet

describe('variable proposals', () => {
  it('proposes high when name maps to a token', () => {
    const p = proposeVariableToken(
      { id: '1', name: 'brand/500', resolvedType: 'COLOR', codeSyntax: {} },
      tokens(),
    )
    expect(p.status).toBe('high')
    expect(p.tokenKey).toBe('brand-500')
  })

  it('conflicts when existing syntax differs from name key', () => {
    const p = proposeVariableToken(
      {
        id: '1',
        name: 'brand/500',
        resolvedType: 'COLOR',
        codeSyntax: { WEB: 'gray-200' },
      },
      {
        ...tokens(),
        colors: {
          ...tokens().colors,
          'gray-200': { hex: '#e5e7eb', rgb: [229, 231, 235], alpha: 1, raw: '#e5e7eb' },
        },
      },
    )
    expect(p.status).toBe('conflict')
    expect(p.tokenKey).toBeNull()
  })

  it('skips when no token matches', () => {
    const p = proposeVariableToken(
      { id: '1', name: 'mystery', resolvedType: 'COLOR', codeSyntax: {} },
      tokens(),
    )
    expect(p.status).toBe('skipped')
  })
})
