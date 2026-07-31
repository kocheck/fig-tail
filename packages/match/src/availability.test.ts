import { describe, expect, it } from 'vitest'
import { applyPrefix, utilityAvailable, withKnownPrefix } from './availability'
import { baseTokenSet } from './test-helpers'

describe('availability', () => {
  it('allows all utilities when corePlugins mode is all', () => {
    const tokens = baseTokenSet()
    expect(utilityAvailable(tokens, 'backgroundColor')).toBe(true)
  })

  it('denies utilities when corePlugins mode is unknown', () => {
    const tokens = baseTokenSet({
      source: {
        ...baseTokenSet().source,
        corePlugins: { mode: 'unknown', names: [] },
      },
    })
    expect(utilityAvailable(tokens, 'backgroundColor')).toBe(false)
  })

  it('honours allowlist corePlugins', () => {
    const tokens = baseTokenSet({
      source: {
        ...baseTokenSet().source,
        corePlugins: { mode: 'allowlist', names: ['textColor'] },
      },
    })
    expect(utilityAvailable(tokens, 'textColor')).toBe(true)
    expect(utilityAvailable(tokens, 'backgroundColor')).toBe(false)
  })

  it('honours denylist corePlugins', () => {
    const tokens = baseTokenSet({
      source: {
        ...baseTokenSet().source,
        corePlugins: { mode: 'denylist', names: ['backgroundColor'] },
      },
    })
    expect(utilityAvailable(tokens, 'backgroundColor')).toBe(false)
    expect(utilityAvailable(tokens, 'textColor')).toBe(true)
  })

  it('applies v3 string prefix', () => {
    const tokens = baseTokenSet({
      source: {
        ...baseTokenSet().source,
        prefix: { status: 'known', style: 'v3-string', value: 'tw-' },
      },
    })
    expect(applyPrefix(tokens, 'bg-brand-500')).toBe('tw-bg-brand-500')
  })

  it('applies v4 variant prefix', () => {
    const tokens = baseTokenSet({
      source: {
        ...baseTokenSet().source,
        major: 4,
        prefix: { status: 'known', style: 'v4-variant', value: 'tw' },
      },
    })
    expect(applyPrefix(tokens, 'bg-brand-500')).toBe('tw:bg-brand-500')
  })

  it('returns null for unknown prefix', () => {
    const tokens = baseTokenSet({
      source: {
        ...baseTokenSet().source,
        prefix: { status: 'unknown' },
      },
    })
    expect(applyPrefix(tokens, 'bg-brand-500')).toBeNull()
  })

  it('passes through when tokens are null', () => {
    expect(applyPrefix(null, 'flex')).toBe('flex')
  })

  it('maps unknown prefix to none confidence', () => {
    const tokens = baseTokenSet({
      source: {
        ...baseTokenSet().source,
        prefix: { status: 'unknown' },
      },
    })
    const result = withKnownPrefix(tokens, 'bg-brand-500', 'exact-value')
    expect(result.className).toBeNull()
    expect(result.confidence).toBe('none')
    expect(result.note).toMatch(/Prefix/)
  })
})
