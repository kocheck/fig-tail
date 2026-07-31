import { describe, expect, it } from 'vitest'
import { matchShadow } from './shadow'
import { baseTokenSet } from '../test-helpers'

describe('shadow', () => {
  it('matches exact shadow tokens', () => {
    const result = matchShadow(
      'box-shadow',
      '0px 1px 2px 0px rgba(16, 24, 40, 0.05)',
      baseTokenSet(),
    )
    expect(result.confidence).toBe('exact-value')
    expect(result.className).toBe('shadow-xs')
  })

  it('matches when colour notation differs', () => {
    const result = matchShadow(
      'box-shadow',
      '0 1px 2px 0 rgb(16 24 40 / 0.05)',
      baseTokenSet(),
    )
    expect(result.confidence).toBe('exact-value')
    expect(result.className).toBe('shadow-xs')
  })

  it('matches exact shadow tokens without a theme', () => {
    const result = matchShadow('box-shadow', 'none', null)
    expect(result.className).toBe('shadow-none')
  })

  it('matches token shadows when theme is present', () => {
    const result = matchShadow('box-shadow', '0px 8px 16px rgba(0,0,0,0.2)', baseTokenSet())
    expect(result.confidence).toBe('arbitrary')
    expect(result.className).toContain('shadow-[')
  })

  it('matches default shadow token key', () => {
    const tokens = baseTokenSet({
      boxShadow: {
        DEFAULT: { raw: '0 1px 2px 0 rgb(16 24 40 / 0.05)' },
      },
    })
    const result = matchShadow(
      'box-shadow',
      '0px 1px 2px 0px rgba(16, 24, 40, 0.05)',
      tokens,
    )
    expect(result.className).toBe('shadow')
  })

  it('returns none for non box-shadow properties', () => {
    const result = matchShadow('filter', 'blur(4px)', baseTokenSet())
    expect(result.confidence).toBe('none')
    expect(result.className).toBeNull()
  })
})
