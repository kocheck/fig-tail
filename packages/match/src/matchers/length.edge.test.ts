import { describe, expect, it } from 'vitest'
import { matchLength } from './length'
import { baseTokenSet } from '../test-helpers'

describe('length edge cases', () => {
  it('reports nearest radius matches', () => {
    const result = matchLength('border-radius', '11px', baseTokenSet(), undefined)
    expect(result.confidence).toBe('nearest')
    expect(result.className).toBeNull()
    expect(result.nearest?.tokenKey).toBe('xl')
  })

  it('matches non-default border widths from tokens', () => {
    const result = matchLength('border-width', '2px', baseTokenSet(), undefined)
    expect(result.className).toBe('border-2')
    expect(result.confidence).toBe('exact-value')
  })

  it('matches v3 scale nearest misses', () => {
    const tokens = baseTokenSet({
      spacing: {
        base: null,
        basePx: null,
        named: {},
        scale: { '4': { raw: '1rem', px: 16 } },
      },
    })
    const result = matchLength('padding-top', '17px', tokens, undefined)
    expect(result.confidence).toBe('nearest')
    expect(result.nearest?.tokenKey).toBe('4')
  })

  it('matches radius DEFAULT token key', () => {
    const tokens = baseTokenSet({
      radius: {
        DEFAULT: { raw: '0.25rem', px: 4 },
      },
    })
    const result = matchLength('border-radius', '4px', tokens, undefined)
    expect(result.className).toBe('rounded')
  })

  it('returns none for unsupported length properties', () => {
    const result = matchLength('min-width', '320px', baseTokenSet(), undefined)
    expect(result.confidence).toBe('none')
  })

  it('uses v4 integer fallback above multiplier 4', () => {
    const tokens = baseTokenSet({
      spacing: {
        base: '0.25rem',
        basePx: 4,
        named: {},
        scale: {},
      },
    })
    const result = matchLength('padding-top', '26px', tokens, undefined)
    expect(result.confidence).toBe('nearest')
    expect(result.nearest?.tokenKey).toBe('7')
  })

  it('reports nearest named spacing tokens', () => {
    const tokens = baseTokenSet({
      spacing: {
        base: null,
        basePx: null,
        named: { gutter: { raw: '1.5rem', px: 24 } },
        scale: {},
      },
    })
    const result = matchLength('padding-top', '25px', tokens, undefined)
    expect(result.confidence).toBe('nearest')
    expect(result.nearest?.tokenKey).toBe('gutter')
  })

  it('falls through when v4 multiplier matching fails completely', () => {
    const tokens = baseTokenSet({
      spacing: {
        base: '0.25rem',
        basePx: 4,
        named: {},
        scale: {},
      },
    })
    const result = matchLength('padding-top', '85px', tokens, undefined)
    expect(result.confidence).toBe('nearest')
    expect(result.className).toBeNull()
    expect(result.nearest?.tokenKey).toBe('21')
  })

  it('matches exact v4 half steps below multiplier 4', () => {
    const tokens = baseTokenSet({
      spacing: {
        base: '0.25rem',
        basePx: 4,
        named: {},
        scale: {},
      },
    })
    const result = matchLength('padding-top', '10px', tokens, undefined)
    expect(result.className).toBe('pt-2.5')
    expect(result.confidence).toBe('exact-value')
  })

  it('matches width and height utilities', () => {
    const tokens = baseTokenSet()
    expect(matchLength('width', '24px', tokens, undefined).className).toBe('w-6')
    expect(matchLength('height', '16px', tokens, undefined).className).toBe('h-4')
  })

  it('matches axis-specific gap utilities', () => {
    const tokens = baseTokenSet()
    expect(matchLength('row-gap', '16px', tokens, undefined).className).toBe('gap-y-4')
    expect(matchLength('column-gap', '16px', tokens, undefined).className).toBe('gap-x-4')
  })

  it('ignores stale spacing hints', () => {
    const tokens = baseTokenSet()
    const result = matchLength('padding-top', '16px', tokens, {
      variableId: 'v1',
      codeSyntax: 'missing',
    })
    expect(result.className).toBe('pt-4')
    expect(result.confidence).toBe('exact-value')
  })
})
