import { describe, expect, it } from 'vitest'
import { matchTypography } from './typography'
import { baseTokenSet } from '../test-helpers'

describe('typography', () => {
  it('matches font weight medium', () => {
    const result = matchTypography('font-weight', '500', baseTokenSet(), undefined)
    expect(result.className).toBe('font-medium')
    expect(result.confidence).toBe('exact-value')
  })

  it('matches font weight by named token without theme', () => {
    const result = matchTypography('font-weight', '500', null, undefined)
    expect(result.className).toBe('font-medium')
    expect(result.confidence).toBe('exact-value')
  })

  it('matches font-family primary stack entry', () => {
    const result = matchTypography('font-family', 'Inter, sans-serif', baseTokenSet(), undefined)
    expect(result.className).toBe('font-sans')
    expect(result.confidence).toBe('exact-value')
  })

  it('pairs font-size with line-height when token defines both', () => {
    const siblings = { 'line-height': '20px' }
    const result = matchTypography('font-size', '14px', baseTokenSet(), undefined, siblings)
    expect(result.className).toBe('text-sm')
    expect(result.note).toBe('paired with line-height')
  })

  it('matches font-size alone when line-height differs', () => {
    const siblings = { 'line-height': '24px' }
    const result = matchTypography('font-size', '14px', baseTokenSet(), undefined, siblings)
    expect(result.className).toBe('text-sm')
  })

  it('matches standalone line-height tokens', () => {
    const result = matchTypography('line-height', '20px', baseTokenSet(), undefined)
    expect(result.className).toBe('leading-5')
  })

  it('matches letter-spacing tokens', () => {
    const result = matchTypography('letter-spacing', '-0.025em', baseTokenSet(), undefined)
    expect(result.className).toBe('tracking-tight')
  })

  it('maps font-style normal to not-italic', () => {
    const result = matchTypography('font-style', 'normal', baseTokenSet(), undefined)
    expect(result.className).toBe('not-italic')
  })

  it('maps font-style italic', () => {
    const result = matchTypography('font-style', 'italic', baseTokenSet(), undefined)
    expect(result.className).toBe('italic')
  })

  it('uses arbitrary for unknown font sizes', () => {
    const result = matchTypography('font-size', '99px', baseTokenSet(), undefined)
    expect(result.confidence).toBe('arbitrary')
    expect(result.className).toBe('text-[99px]')
  })

  it('uses arbitrary for unknown font families', () => {
    const result = matchTypography('font-family', 'Comic Sans', baseTokenSet(), undefined)
    expect(result.confidence).toBe('arbitrary')
    expect(result.className).toBe("font-['Comic Sans']")
  })

  it('uses arbitrary font weight without a named fallback token', () => {
    const result = matchTypography('font-weight', '550', baseTokenSet(), undefined)
    expect(result.confidence).toBe('arbitrary')
    expect(result.className).toBe('font-[550]')
  })

  it('matches line-height raw tokens', () => {
    const tokens = baseTokenSet({
      lineHeight: {
        snug: { raw: '1.375', px: null },
      },
    })
    const result = matchTypography('line-height', '1.375', tokens, undefined)
    expect(result.className).toBe('leading-snug')
  })

  it('returns none for unsupported typography properties', () => {
    const result = matchTypography('font-variant', 'small-caps', baseTokenSet(), undefined)
    expect(result.confidence).toBe('none')
    expect(result.className).toBeNull()
  })

  it('uses arbitrary line-height when unmatched', () => {
    const result = matchTypography('line-height', '99px', baseTokenSet(), undefined)
    expect(result.confidence).toBe('arbitrary')
    expect(result.className).toBe('leading-[99px]')
  })

  it('uses arbitrary letter-spacing when unmatched', () => {
    const result = matchTypography('letter-spacing', '0.2em', baseTokenSet(), undefined)
    expect(result.className).toBe('tracking-[0.2em]')
  })
})
