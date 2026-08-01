import { describe, expect, it } from 'vitest'
import { matchLength } from './length'
import { baseTokenSet, emptySpacing, tokensFromConfig } from '../test-helpers'

describe('length', () => {
  it('matches v3 spacing scale', () => {
    const tokens = tokensFromConfig('v3', 'starter.js', {
      exact: '3.4.19',
      source: 'package-json',
    })
    const result = matchLength('padding-top', '16px', tokens, undefined)
    expect(result.className).toBe('pt-4')
    expect(result.confidence).toBe('exact-value')
  })

  it('matches v4 spacing multiplier', () => {
    const tokens = tokensFromConfig('v4', 'basic.css', {
      exact: '4.1.11',
      source: 'package-json',
    })
    const result = matchLength('padding-top', '16px', tokens, undefined)
    expect(result.className).toBe('pt-4')
  })

  it('matches v4 fractional spacing', () => {
    const tokens = tokensFromConfig('v4', 'basic.css', {
      exact: '4.1.11',
      source: 'package-json',
    })
    const result = matchLength('padding-top', '2px', tokens, undefined)
    expect(result.className).toBe('pt-0.5')
  })

  it('reports nearest length misses', () => {
    const tokens = tokensFromConfig('v4', 'basic.css', {
      exact: '4.1.11',
      source: 'package-json',
    })
    const result = matchLength('padding-top', '25px', tokens, undefined)
    expect(result.confidence).toBe('nearest')
    expect(result.className).toBeNull()
    expect(result.nearest?.delta).toBe(1)
    expect(result.nearest?.deltaUnit).toBe('px')
  })

  it('prefers named spacing tokens', () => {
    const tokens = baseTokenSet({
      spacing: {
        ...emptySpacing(),
        named: { gutter: { raw: '1.5rem', px: 24 } },
        scale: { '6': { raw: '1.5rem', px: 24 } },
      },
    })
    const result = matchLength('padding-top', '24px', tokens, undefined)
    expect(result.className).toBe('pt-gutter')
  })

  it('matches exact-variable from spacing hint', () => {
    const tokens = baseTokenSet({
      spacing: {
        ...emptySpacing(),
        named: { gutter: { raw: '1.5rem', px: 24 } },
        scale: {},
      },
    })
    const result = matchLength('padding-top', '24px', tokens, {
      variableId: 'v1',
      codeSyntax: 'gutter',
    })
    expect(result.confidence).toBe('exact-variable')
    expect(result.className).toBe('pt-gutter')
  })

  it('maps 1px border width to border', () => {
    const result = matchLength('border-width', '1px', baseTokenSet(), undefined)
    expect(result.className).toBe('border')
    expect(result.confidence).toBe('exact-value')
  })

  it('matches border-radius tokens', () => {
    const result = matchLength('border-radius', '12px', baseTokenSet(), undefined)
    expect(result.className).toBe('rounded-xl')
  })

  it('uses arbitrary for unknown spacing namespace', () => {
    const tokens = baseTokenSet({ unknownNamespaces: ['spacing'] })
    const result = matchLength('padding-top', '16px', tokens, undefined)
    expect(result.confidence).toBe('arbitrary')
    expect(result.className).toBe('pt-[16px]')
  })

  it('returns none when padding core plugin is disabled', () => {
    const tokens = baseTokenSet({
      source: {
        ...baseTokenSet().source,
        corePlugins: { mode: 'denylist', names: ['padding'] },
      },
    })
    const result = matchLength('padding-top', '16px', tokens, undefined)
    expect(result.confidence).toBe('none')
    expect(result.className).toBeNull()
  })

  it('labels partial namespace arbitrary lengths', () => {
    const tokens = baseTokenSet({ partialNamespaces: ['spacing'] })
    const result = matchLength('padding-top', '99px', tokens, undefined)
    expect(result.confidence).toBe('arbitrary')
    expect(result.note).toMatch(/withheld/)
  })

  it('uses no-config arbitrary output', () => {
    const result = matchLength('padding-top', '24px', null, undefined)
    expect(result.confidence).toBe('arbitrary')
    expect(result.className).toBe('pt-[24px]')
  })

  it('uses arbitrary for non-px values', () => {
    const result = matchLength('width', '100%', baseTokenSet(), undefined)
    expect(result.confidence).toBe('arbitrary')
    expect(result.className).toBe('w-[100%]')
  })
})
