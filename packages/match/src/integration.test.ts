import { describe, expect, it } from 'vitest'
import { resolveTheme } from '@fig-tail/theme'
import { matchDeclarations, toClassName } from './index'
import { summarise } from './summarise'

const tokensFrom = (text: string) => {
  const result = resolveTheme({
    sources: [{ name: 'tailwind.config.js', text }],
    tailwindVersion: { exact: '3.4.19', source: 'package-json' },
  })
  if (!result.tokens) throw new Error('expected tokens')
  return result.tokens
}

describe('color', () => {
  it('matches exact brand colours', () => {
    const result = resolveTheme({
      sources: [
        {
          name: 'tailwind.config.js',
          text: `module.exports = { theme: { extend: { colors: { brand: { 500: '#3b82f6' } } } } }`,
        },
      ],
    })
    if (!result.tokens) throw new Error('expected tokens')
    const results = matchDeclarations(
      { 'background-color': '#3b82f6' },
      { tokens: result.tokens },
    )
    expect(results[0]?.className).toBe('bg-brand-500')
    expect(results[0]?.confidence).toBe('exact-value')
  })

  it('reports nearest without a className', () => {
    const result = resolveTheme({
      sources: [
        {
          name: 'tailwind.config.js',
          text: `module.exports = { theme: { extend: { colors: { brand: { 500: '#3b82f6' } } } } }`,
        },
      ],
    })
    if (!result.tokens) throw new Error('expected tokens')
    const results = matchDeclarations(
      { 'background-color': '#3b82f1' },
      { tokens: result.tokens },
    )
    expect(results[0]?.confidence).toBe('nearest')
    expect(results[0]?.className).toBeNull()
    expect(toClassName(results)).toBe('')
  })
})

describe('length', () => {
  it('matches v3 spacing scale', () => {
    const tokens = tokensFrom(`module.exports = { theme: { extend: {} } }`)
    const results = matchDeclarations({ 'padding-top': '16px' }, { tokens })
    expect(results[0]?.className).toBe('pt-4')
  })

  it('matches v4 spacing multiplier', () => {
    const result = resolveTheme({
      sources: [
        {
          name: 'app.css',
          text: `@import "tailwindcss"; @theme { --spacing: 0.25rem; --color-brand-500: #3b82f6; }`,
        },
      ],
      tailwindVersion: { exact: '4.1.11', source: 'package-json' },
    })
    const results = matchDeclarations({ 'padding-top': '24px' }, { tokens: result.tokens })
    expect(results[0]?.className).toBe('pt-6')
  })
})

describe('typography', () => {
  it('matches font weight medium', () => {
    const tokens = tokensFrom(`module.exports = { theme: { extend: {} } }`)
    const results = matchDeclarations({ 'font-weight': '500' }, { tokens })
    expect(results[0]?.className).toBe('font-medium')
  })
})

describe('layout', () => {
  it('matches flex column', () => {
    const results = matchDeclarations(
      { display: 'flex', 'flex-direction': 'column', 'align-items': 'flex-start' },
      { tokens: null },
    )
    expect(toClassName(results)).toContain('flex')
    expect(toClassName(results)).toContain('flex-col')
    expect(toClassName(results)).toContain('items-start')
  })
})

describe('shadow', () => {
  it('falls back to arbitrary shadows', () => {
    const results = matchDeclarations(
      { 'box-shadow': '0px 1px 2px 0px rgba(16, 24, 40, 0.05)' },
      { tokens: null },
    )
    expect(results[0]?.confidence).toBe('arbitrary')
    expect(results[0]?.className).toContain('shadow-[')
  })
})

describe('effects', () => {
  it('maps text-decoration none', () => {
    const results = matchDeclarations({ 'text-decoration': 'none' }, { tokens: null })
    expect(results[0]?.className).toBe('no-underline')
  })
})

describe('integration', () => {
  it('builds a card class string from the fixture', () => {
    const tokens = tokensFrom(`module.exports = {
      theme: {
        extend: {
          colors: { brand: { 500: '#3b82f6' } },
        },
      },
    }`)
    const css = {
      display: 'flex',
      padding: '24px',
      'flex-direction': 'column',
      'align-items': 'flex-start',
      gap: '16px',
      'align-self': 'stretch',
      'border-radius': '12px',
      border: '1px solid #E5E7EB',
      background: '#FFF',
      'box-shadow': '0px 1px 2px 0px rgba(16, 24, 40, 0.05)',
    }
    const results = matchDeclarations(css, { tokens })
    const className = toClassName(results)
    expect(className).toContain('flex')
    expect(className).toContain('p-6')
    expect(className).not.toMatch(/nearest/)
  })
})

describe('summarise safety', () => {
  it('labels no-config arbitrary output', () => {
    const results = matchDeclarations({ 'background-color': '#3b82f6' }, { tokens: null })
    const summary = summarise(results, false)
    expect(summary.warnings[0]).toMatch(/No Tailwind config/)
    expect(summary.className).toContain('bg-[')
  })

  it('emits arbitrary for unknown colour namespaces', () => {
    const tokens = tokensFrom(`module.exports = { theme: { colors: ({ theme }) => theme('colors') } }`)
    const results = matchDeclarations({ 'background-color': '#3b82f6' }, { tokens })
    expect(results[0]?.confidence).toBe('arbitrary')
    expect(results[0]?.className).toBe('bg-[#3b82f6]')
  })
})
