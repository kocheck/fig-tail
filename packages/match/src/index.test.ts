import { describe, expect, it } from 'vitest'
import { matchDeclarations, toClassName } from './index'
import { baseTokenSet } from './test-helpers'

describe('engine', () => {
  it('returns none for unsupported properties', () => {
    const results = matchDeclarations({ filter: 'blur(4px)' }, { tokens: baseTokenSet() })
    expect(results[0]?.confidence).toBe('none')
    expect(results[0]?.note).toMatch(/Unsupported property/)
  })

  it('does not collapse padding when one side is nearest', () => {
    const results = matchDeclarations(
      {
        'padding-top': '24px',
        'padding-right': '24px',
        'padding-bottom': '24px',
        'padding-left': '25px',
      },
      { tokens: baseTokenSet() },
    )
    expect(results.some((result) => result.property === 'padding')).toBe(false)
    expect(results.some((result) => result.confidence === 'nearest')).toBe(true)
  })

  it('does not collapse mismatched corner radii', () => {
    const tokens = baseTokenSet({
      radius: {
        lg: { raw: '0.5rem', px: 8 },
        xl: { raw: '0.75rem', px: 12 },
      },
    })
    const results = matchDeclarations(
      {
        'border-top-left-radius': '8px',
        'border-top-right-radius': '12px',
        'border-bottom-right-radius': '8px',
        'border-bottom-left-radius': '12px',
      },
      { tokens },
    )
    expect(results.some((result) => result.property === 'border-radius')).toBe(false)
    expect(toClassName(results)).toContain('rounded-tl-lg')
    expect(toClassName(results)).toContain('rounded-tr-xl')
  })

  it('routes opacity and line-height through their matchers', () => {
    const results = matchDeclarations(
      { opacity: '0.5', 'line-height': '20px' },
      { tokens: baseTokenSet() },
    )
    expect(toClassName(results)).toContain('opacity-50')
    expect(toClassName(results)).toContain('leading-5')
  })
})
