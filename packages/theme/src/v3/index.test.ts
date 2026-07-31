import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolveTheme } from '../resolve'
import { V3_DEFAULTS_VERSION } from '../defaults'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../../fixtures/configs/v3')

const read = (name: string) => readFileSync(path.join(root, name), 'utf8')

describe('v3', () => {
  it('resolves minimal extend colours and spacing', () => {
    const result = resolveTheme({
      sources: [{ name: 'minimal.js', text: read('minimal.js') }],
      tailwindVersion: { exact: V3_DEFAULTS_VERSION, source: 'package-json' },
    })
    expect(result.ok).toBe(true)
    expect(result.tokens?.colors['brand-500']?.hex).toBe('#3b82f6')
    expect(result.tokens?.spacing.scale['18']?.px).toBe(72)
    expect(result.tokens?.source.defaults.status).toBe('confirmed')
  })

  it('merges theme.extend.colors without wiping defaults when confirmed', () => {
    const result = resolveTheme({
      sources: [{ name: 'starter.js', text: read('starter.js') }],
      tailwindVersion: { exact: V3_DEFAULTS_VERSION, source: 'package-json' },
    })
    expect(result.ok).toBe(true)
    expect(result.tokens?.colors['blue-500']?.hex).toBe('#3b82f6')
    expect(result.tokens?.colors['brand-500']?.hex).toBe('#3b82f6')
    expect(result.tokens?.fontFamily.sans?.stack[0]).toBe('Inter')
  })

  it('marks replacing theme.colors as unknown when it is a function', () => {
    const result = resolveTheme({
      sources: [
        {
          name: 'replace.js',
          text: `module.exports = { theme: { colors: ({ theme }) => theme('colors') } }`,
        },
      ],
      tailwindVersion: { exact: V3_DEFAULTS_VERSION, source: 'package-json' },
    })
    expect(result.ok).toBe(true)
    expect(result.tokens?.unknownNamespaces).toContain('colors')
    expect(Object.keys(result.tokens?.colors ?? {})).toHaveLength(0)
    expect(result.unresolved.some((item) => item.reason === 'function-value')).toBe(true)
  })

  it('reports unknown requires and still resolves explicit tokens', () => {
    const result = resolveTheme({
      sources: [{ name: 'with-plugins.js', text: read('with-plugins.js') }],
      tailwindVersion: { exact: V3_DEFAULTS_VERSION, source: 'package-json' },
    })
    expect(result.ok).toBe(true)
    expect(result.tokens?.colors['brand-500']?.hex).toBe('#8b5cf6')
    expect(result.unresolved.some((item) => item.reason === 'unknown-module')).toBe(true)
  })

  it('resolves typed.ts via the TypeScript pre-pass', () => {
    const result = resolveTheme({
      sources: [{ name: 'typed.ts', text: read('typed.ts') }],
      tailwindVersion: { exact: V3_DEFAULTS_VERSION, source: 'package-json' },
    })
    expect(result.ok).toBe(true)
    expect(result.tokens?.colors['brand-500']?.hex).toBe('#3b82f6')
  })

  it('records a known v3 prefix', () => {
    const result = resolveTheme({
      sources: [{ name: 'with-prefix.js', text: read('with-prefix.js') }],
    })
    expect(result.ok).toBe(true)
    expect(result.tokens?.source.prefix).toEqual({
      status: 'known',
      style: 'v3-string',
      value: 'tw-',
    })
  })

  it('reports presets without failing the whole config', () => {
    const result = resolveTheme({
      sources: [{ name: 'with-preset.js', text: read('with-preset.js') }],
    })
    expect(result.ok).toBe(true)
    expect(result.tokens?.colors['accent-500']?.hex).toBe('#22c55e')
    expect(result.unresolved.some((item) => item.reason === 'preset' || item.reason === 'unknown-module')).toBe(
      true,
    )
  })

  it('does not merge bundled defaults when version evidence is missing', () => {
    const result = resolveTheme({
      sources: [{ name: 'minimal.js', text: read('minimal.js') }],
    })
    expect(result.ok).toBe(true)
    expect(result.tokens?.source.defaults.status).toBe('unconfirmed')
    expect(result.tokens?.colors['blue-500']).toBeUndefined()
    expect(result.tokens?.colors['brand-500']?.hex).toBe('#3b82f6')
    expect(result.tokens?.partialNamespaces.length).toBeGreaterThan(0)
  })

  it('does not merge bundled defaults when patch version is skewed', () => {
    const result = resolveTheme({
      sources: [{ name: 'minimal.js', text: read('minimal.js') }],
      tailwindVersion: { exact: '3.4.18', source: 'package-json' },
    })
    expect(result.ok).toBe(true)
    expect(result.tokens?.source.defaults.status).toBe('unconfirmed')
    expect(result.tokens?.colors['blue-500']).toBeUndefined()
  })
})
