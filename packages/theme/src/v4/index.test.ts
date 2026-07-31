import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolveTheme } from '../resolve'
import { V4_DEFAULTS_VERSION } from '../defaults'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../../fixtures/configs/v4')
const read = (name: string) => readFileSync(path.join(root, name), 'utf8')

describe('v4', () => {
  it('resolves basic @theme colours, spacing multiplier, and radius', () => {
    const result = resolveTheme({
      sources: [{ name: 'basic.css', text: read('basic.css') }],
      tailwindVersion: { exact: V4_DEFAULTS_VERSION, source: 'package-json' },
    })
    expect(result.ok).toBe(true)
    expect(result.tokens?.colors['brand-500']?.hex).toBe('#3b82f6')
    expect(result.tokens?.spacing.base).toBe('0.25rem')
    expect(result.tokens?.spacing.basePx).toBe(4)
    expect(result.tokens?.spacing.named.gutter?.px).toBe(24)
    expect(result.tokens?.radius.lg?.px).toBe(8)
    expect(result.tokens?.fontSize.sm?.lineHeight?.px).toBe(20)
  })

  it('honours --color-*: initial resets', () => {
    const result = resolveTheme({
      sources: [{ name: 'reset.css', text: read('reset.css') }],
      tailwindVersion: { exact: V4_DEFAULTS_VERSION, source: 'package-json' },
    })
    expect(result.ok).toBe(true)
    expect(result.tokens?.colors['red-500']).toBeUndefined()
    expect(result.tokens?.colors['brand-500']).toBeTruthy()
    expect(result.tokens?.colors.ink?.hex).toBe('#111827')
  })

  it('resolves var() aliases between theme entries', () => {
    const result = resolveTheme({
      sources: [{ name: 'aliased.css', text: read('aliased.css') }],
    })
    expect(result.ok).toBe(true)
    expect(result.tokens?.colors['brand-soft']?.hex).toBe('#3b82f6')
    expect(result.tokens?.radius.xl?.raw).toBe('0.5rem')
  })

  it('reports missing @config targets', () => {
    const result = resolveTheme({
      sources: [{ name: 'with-config.css', text: read('with-config.css') }],
    })
    expect(result.ok).toBe(true)
    expect(result.unresolved.some((item) => item.reason === 'missing-import')).toBe(true)
  })
})
