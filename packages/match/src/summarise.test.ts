import { describe, expect, it } from 'vitest'
import { resolveTheme } from '@fig-tail/theme'
import { matchDeclarations, toClassName } from './index'
import { summarise } from './summarise'
import { baseTokenSet, tokensFromConfig } from './test-helpers'
import cardFixture from '../fixtures/css/card-exact.json'

describe('summarise', () => {
  it('labels no-config arbitrary output', () => {
    const results = matchDeclarations(
      { 'background-color': '#3b82f6' },
      { tokens: null },
    )
    const summary = summarise(results, false)
    expect(summary.warnings[0]).toMatch(/No Tailwind config/)
    expect(summary.className).toContain('bg-[')
    expect(summary.hasConfig).toBe(false)
  })

  it('dedupes notes in warnings', () => {
    const results = matchDeclarations(
      { 'padding-top': '99px', 'padding-right': '99px' },
      { tokens: baseTokenSet({ partialNamespaces: ['spacing'] }) },
    )
    const summary = summarise(results, true)
    const withheld = summary.warnings.filter((warning) => warning.includes('withheld'))
    expect(withheld.length).toBeLessThanOrEqual(1)
  })

  it('excludes nearest results from className', () => {
    const results = matchDeclarations(
      { 'background-color': '#3b82f1' },
      { tokens: baseTokenSet() },
    )
    expect(toClassName(results)).toBe('')
    const summary = summarise(results, true)
    expect(summary.className).toBe('')
  })

  it('summarises configured matches without the no-config banner', () => {
    const results = matchDeclarations({ display: 'flex' }, { tokens: baseTokenSet() })
    const summary = summarise(results, true)
    expect(summary.hasConfig).toBe(true)
    expect(summary.warnings.some((warning) => warning.includes('No Tailwind config'))).toBe(false)
  })
})

describe('no-config', () => {
  it('resolves layout utilities without tokens', () => {
    const results = matchDeclarations({ display: 'flex', 'flex-direction': 'column' }, { tokens: null })
    expect(toClassName(results)).toBe('flex flex-col')
  })

  it('never throws for supported CSS with null tokens', () => {
    expect(() =>
      matchDeclarations(cardFixture as Record<string, string>, { tokens: null }),
    ).not.toThrow()
  })
})

describe('unknown-namespace', () => {
  it('emits arbitrary for unknown colour namespaces', () => {
    const result = resolveTheme({
      sources: [
        {
          name: 'replace.js',
          text: `module.exports = { theme: { colors: ({ theme }) => theme('colors') } }`,
        },
      ],
      tailwindVersion: { exact: '3.4.19', source: 'package-json' },
    })
    if (!result.tokens) throw new Error('expected tokens')
    const results = matchDeclarations({ 'background-color': '#3b82f6' }, { tokens: result.tokens })
    expect(results[0]?.confidence).toBe('arbitrary')
    expect(results[0]?.className).toBe('bg-[#3b82f6]')
  })
})

describe('partialNamespaces', () => {
  it('matches project tokens but not withheld defaults', () => {
    const tokens = tokensFromConfig('v3', 'minimal.js')
    const brand = matchDeclarations({ 'background-color': '#3b82f6' }, { tokens })
    expect(brand[0]?.confidence).toBe('exact-value')
    expect(brand[0]?.className).toBe('bg-brand-500')

    const gray = matchDeclarations({ 'background-color': '#111827' }, { tokens })
    expect(gray[0]?.confidence).toBe('arbitrary')
    expect(gray[0]?.note).toMatch(/withheld/)
  })
})

describe('prefix and availability integration', () => {
  it('applies v3 prefix from resolved config', () => {
    const tokens = tokensFromConfig('v3', 'with-prefix.js')
    const results = matchDeclarations({ display: 'flex' }, { tokens })
    expect(results[0]?.className).toBe('tw-flex')
  })

  it('returns null className for unknown prefix', () => {
    const tokens = baseTokenSet({
      source: {
        ...baseTokenSet().source,
        prefix: { status: 'unknown' },
      },
    })
    const results = matchDeclarations({ display: 'flex' }, { tokens })
    expect(results[0]?.className).toBeNull()
    expect(results[0]?.confidence).toBe('exact-value')
  })

  it('applies v4 variant prefix from token metadata', () => {
    const tokens = baseTokenSet({
      source: {
        ...baseTokenSet().source,
        major: 4,
        prefix: { status: 'known', style: 'v4-variant', value: 'tw' },
      },
    })
    const results = matchDeclarations({ display: 'flex' }, { tokens })
    expect(results[0]?.className).toBe('tw:flex')
  })

  it('suppresses disabled backgroundColor but keeps textColor', () => {
    const tokens = baseTokenSet({
      unknownNamespaces: ['colors'],
      source: {
        ...baseTokenSet().source,
        corePlugins: { mode: 'denylist', names: ['backgroundColor'] },
      },
    })
    const bg = matchDeclarations({ 'background-color': '#3b82f6' }, { tokens })
    const text = matchDeclarations({ color: '#3b82f6' }, { tokens })
    expect(bg[0]?.confidence).toBe('none')
    expect(text[0]?.confidence).toBe('arbitrary')
  })
})
