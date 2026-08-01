import { describe, expect, it } from 'vitest'
import { matchColor } from './color'
import { baseTokenSet, tokensFromConfig } from '../test-helpers'

describe('color', () => {
  it('matches exact-value for theme colours', () => {
    const result = matchColor('background-color', '#3b82f6', baseTokenSet(), undefined)
    expect(result.className).toBe('bg-brand-500')
    expect(result.confidence).toBe('exact-value')
  })

  it('matches exact-variable from codeSyntax hint', () => {
    const result = matchColor('background-color', '#3b82f6', baseTokenSet(), {
      variableId: 'v1',
      codeSyntax: 'brand-500',
    })
    expect(result.className).toBe('bg-brand-500')
    expect(result.confidence).toBe('exact-variable')
    expect(result.provenance.hintStatus).toBe('applied')
  })

  it('matches name-match from variable name hint', () => {
    const result = matchColor('background-color', '#3b82f6', baseTokenSet(), {
      variableId: 'v1',
      name: 'brand/500',
    })
    expect(result.className).toBe('bg-brand-500')
    expect(result.confidence).toBe('name-match')
  })

  it('reports nearest without a className', () => {
    const result = matchColor('background-color', '#3b82f1', baseTokenSet(), undefined)
    expect(result.confidence).toBe('nearest')
    expect(result.className).toBeNull()
    expect(result.nearest?.tokenKey).toBe('brand-500')
    expect(result.nearest?.deltaUnit).toBe('deltaE')
  })

  it('falls back to arbitrary for unknown colours', () => {
    const result = matchColor('background-color', '#a1b2c3', baseTokenSet(), undefined)
    expect(result.confidence).toBe('arbitrary')
    expect(result.className).toBe('bg-[#a1b2c3]')
  })

  it('maps alpha to opacity modifier', () => {
    const tokens = baseTokenSet()
    const result = matchColor('background-color', 'rgba(59,130,246,0.5)', tokens, undefined)
    expect(result.className).toBe('bg-brand-500/50')
    expect(result.confidence).toBe('exact-value')
  })

  it('uses arbitrary for unknown namespace even when tokens exist', () => {
    const tokens = baseTokenSet({ unknownNamespaces: ['colors'] })
    const result = matchColor('background-color', '#3b82f6', tokens, undefined)
    expect(result.confidence).toBe('arbitrary')
    expect(result.className).toBe('bg-[#3b82f6]')
    expect(result.className).not.toContain('brand-500')
    expect(result.note).toMatch(/could not read your colours/)
  })

  it('returns none when backgroundColor core plugin is disabled', () => {
    const tokens = baseTokenSet({
      unknownNamespaces: ['colors'],
      source: {
        ...baseTokenSet().source,
        corePlugins: { mode: 'denylist', names: ['backgroundColor'] },
      },
    })
    const result = matchColor('background-color', '#3b82f6', tokens, undefined)
    expect(result.confidence).toBe('none')
    expect(result.className).toBeNull()
  })

  it('labels partial namespace arbitrary output', () => {
    const tokens = baseTokenSet({ partialNamespaces: ['colors'] })
    const result = matchColor('background-color', '#111827', tokens, undefined)
    expect(result.confidence).toBe('arbitrary')
    expect(result.note).toMatch(/withheld/)
  })

  it('matches explicit project tokens under partial namespace', () => {
    const tokens = tokensFromConfig('v3', 'minimal.js')
    const result = matchColor('background-color', '#3b82f6', tokens, undefined)
    expect(result.confidence).toBe('exact-value')
    expect(result.className).toBe('bg-brand-500')
  })

  it('returns none for gradients', () => {
    const result = matchColor('background', 'linear-gradient(red, blue)', baseTokenSet(), undefined)
    expect(result.confidence).toBe('none')
    expect(result.className).toBeNull()
  })

  it('returns none for unknown prefix', () => {
    const tokens = baseTokenSet({
      source: {
        ...baseTokenSet().source,
        prefix: { status: 'unknown' },
      },
    })
    const result = matchColor('background-color', '#3b82f6', tokens, undefined)
    expect(result.className).toBeNull()
    expect(result.confidence).toBe('none')
  })

  it('reports ambiguity when multiple tokens share a value', () => {
    const tokens = baseTokenSet({
      colors: {
        'brand-500': { hex: '#3b82f6', rgb: [59, 130, 246], alpha: 1, raw: '#3b82f6' },
        'blue-500': { hex: '#3b82f6', rgb: [59, 130, 246], alpha: 1, raw: '#3b82f6' },
      },
    })
    const result = matchColor('background-color', '#3b82f6', tokens, undefined)
    expect(result.ambiguity?.candidates).toHaveLength(2)
    expect(result.note).toMatch(/Multiple tokens/)
  })

  it('returns none for unknown prefix on arbitrary fallback', () => {
    const tokens = baseTokenSet({
      source: {
        ...baseTokenSet().source,
        prefix: { status: 'unknown' },
      },
    })
    const result = matchColor('background-color', '#a1b2c3', tokens, undefined)
    expect(result.className).toBeNull()
    expect(result.confidence).toBe('none')
  })

  it('maps side-specific border colours', () => {
    const result = matchColor('border-top-color', '#e5e7eb', baseTokenSet(), undefined)
    expect(result.className).toBe('border-t-gray-200')
    expect(result.confidence).toBe('exact-value')
  })

  it('uses no-config arbitrary output', () => {
    const result = matchColor('background-color', '#3b82f6', null, undefined)
    expect(result.confidence).toBe('arbitrary')
    expect(result.className).toBe('bg-[#3b82f6]')
    expect(result.note).toMatch(/No Tailwind config/)
  })
})
