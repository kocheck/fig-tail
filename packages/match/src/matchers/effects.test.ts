import { describe, expect, it } from 'vitest'
import { matchEffects } from './effects'
import { baseTokenSet } from '../test-helpers'

describe('effects', () => {
  it('maps text-decoration none', () => {
    const result = matchEffects('text-decoration', 'none', null)
    expect(result.className).toBe('no-underline')
    expect(result.confidence).toBe('exact-value')
  })

  it('maps underline', () => {
    const result = matchEffects('text-decoration-line', 'underline', null)
    expect(result.className).toBe('underline')
  })

  it('matches opacity tokens', () => {
    const result = matchEffects('opacity', '0.5', baseTokenSet())
    expect(result.className).toBe('opacity-50')
    expect(result.confidence).toBe('exact-value')
  })

  it('uses arbitrary opacity when no token matches', () => {
    const result = matchEffects('opacity', '0.33', baseTokenSet())
    expect(result.confidence).toBe('arbitrary')
    expect(result.className).toBe('opacity-[0.33]')
  })

  it('matches opacity percentage values', () => {
    const result = matchEffects('opacity', '50', baseTokenSet())
    expect(result.className).toBe('opacity-50')
  })

  it('returns none for unsupported effects properties', () => {
    const result = matchEffects('filter', 'blur(4px)', baseTokenSet())
    expect(result.confidence).toBe('none')
    expect(result.className).toBeNull()
  })
})
