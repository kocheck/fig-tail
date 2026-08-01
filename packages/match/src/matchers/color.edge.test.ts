import { describe, expect, it } from 'vitest'
import { matchColor } from './color'
import { baseTokenSet } from '../test-helpers'

describe('color edge cases', () => {
  it('matches hsl values via parsed fallback equality', () => {
    const tokens = baseTokenSet({
      colors: {
        white: { hex: '#ffffff', rgb: [255, 255, 255], alpha: 1, raw: '#ffffff' },
      },
    })
    const result = matchColor('background-color', 'hsl(0, 0%, 100%)', tokens, undefined)
    expect(result.confidence).toBe('exact-value')
    expect(result.className).toBe('bg-white')
  })

  it('prefers codeSyntax hint over other exact matches', () => {
    const tokens = baseTokenSet({
      colors: {
        'brand-500': { hex: '#3b82f6', rgb: [59, 130, 246], alpha: 1, raw: '#3b82f6' },
        'blue-500': { hex: '#3b82f6', rgb: [59, 130, 246], alpha: 1, raw: '#3b82f6' },
      },
    })
    const result = matchColor('background-color', '#3b82f6', tokens, {
      variableId: 'v1',
      codeSyntax: 'blue-500',
    })
    expect(result.confidence).toBe('exact-variable')
    expect(result.className).toBe('bg-blue-500')
  })

  it('uses arbitrary opacity modifiers off the 5% steps', () => {
    const tokens = baseTokenSet()
    const result = matchColor('background-color', 'rgba(59,130,246,0.33)', tokens, undefined)
    expect(result.className).toBe('bg-brand-500/[0.33]')
  })

  it('returns none for unsupported colour properties', () => {
    const result = matchColor('caret-color', '#3b82f6', baseTokenSet(), undefined)
    expect(result.confidence).toBe('none')
    expect(result.className).toBeNull()
  })

  it('falls back when codeSyntax hint is stale', () => {
    const result = matchColor('background-color', '#a1b2c3', baseTokenSet(), {
      variableId: 'v1',
      codeSyntax: 'brand-500',
    })
    expect(result.confidence).toBe('arbitrary')
    expect(result.provenance.hintStatus).toBe('unresolvable')
  })
})
