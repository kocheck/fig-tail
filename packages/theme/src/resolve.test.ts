import { describe, expect, it } from 'vitest'
import { resolveTheme } from './resolve'
import { V3_DEFAULTS_VERSION } from './defaults'

describe('resolve guarantees', () => {
  it('never throws on garbage input', () => {
    expect(() =>
      resolveTheme({
        sources: [{ name: 'nope.txt', text: '@@@ not a config' }],
      }),
    ).not.toThrow()
    const result = resolveTheme({
      sources: [{ name: 'nope.txt', text: '@@@ not a config' }],
    })
    expect(result.ok).toBe(false)
    expect(result.tokens).toBeNull()
    expect(result.unresolved.length).toBeGreaterThan(0)
  })

  it('returns partial results with unresolved entries', () => {
    const result = resolveTheme({
      sources: [
        {
          name: 'partial.js',
          text: `module.exports = {
            theme: {
              extend: {
                colors: { brand: { 500: '#3b82f6' } },
                spacing: ({ theme }) => theme('spacing'),
              },
            },
            plugins: [require('left-pad')],
          }`,
        },
      ],
      tailwindVersion: { exact: V3_DEFAULTS_VERSION, source: 'package-json' },
    })
    expect(result.ok).toBe(true)
    expect(result.tokens?.colors['brand-500']?.hex).toBe('#3b82f6')
    expect(result.unresolved.length).toBeGreaterThan(0)
  })

  it('rejects unknown majors without claiming confirmed tokens', () => {
    const result = resolveTheme({
      sources: [
        {
          name: 'tailwind.config.js',
          text: `module.exports = { theme: { extend: { colors: { brand: { 500: '#3b82f6' } } } } }`,
        },
      ],
      tailwindVersion: { exact: '5.0.0', source: 'package-json' },
    })
    expect(result.ok).toBe(false)
    expect(result.tokens).toBeNull()
  })
})
