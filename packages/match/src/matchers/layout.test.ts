import { describe, expect, it } from 'vitest'
import { matchLayout } from './layout'
import { baseTokenSet } from '../test-helpers'

describe('layout', () => {
  it('matches flex column', () => {
    const result = matchLayout('display', 'flex', null)
    expect(result.className).toBe('flex')
    expect(result.confidence).toBe('exact-value')
  })

  it('matches flex-direction column', () => {
    const result = matchLayout('flex-direction', 'column', null)
    expect(result.className).toBe('flex-col')
  })

  it('matches align-items flex-start', () => {
    const result = matchLayout('align-items', 'flex-start', null)
    expect(result.className).toBe('items-start')
  })

  it('matches justify-content space-between', () => {
    const result = matchLayout('justify-content', 'space-between', null)
    expect(result.className).toBe('justify-between')
  })

  it('matches align-self stretch', () => {
    const result = matchLayout('align-self', 'stretch', null)
    expect(result.className).toBe('self-stretch')
  })

  it('matches border-style solid', () => {
    const result = matchLayout('border-style', 'solid', null)
    expect(result.className).toBe('border-solid')
  })

  it('returns none for unsupported layout values', () => {
    const result = matchLayout('display', 'table-caption', null)
    expect(result.confidence).toBe('none')
    expect(result.className).toBeNull()
  })

  it('returns none for unsupported layout properties', () => {
    const result = matchLayout('grid-template-columns', '1fr 1fr', null)
    expect(result.confidence).toBe('none')
  })

  it('matches flex-wrap nowrap', () => {
    const result = matchLayout('flex-wrap', 'nowrap', null)
    expect(result.className).toBe('flex-nowrap')
  })

  it('matches display hidden', () => {
    const result = matchLayout('display', 'none', null)
    expect(result.className).toBe('hidden')
  })

  it('matches dashed borders', () => {
    const result = matchLayout('border-style', 'dashed', null)
    expect(result.className).toBe('border-dashed')
  })

  it('applies prefix for layout utilities', () => {
    const tokens = baseTokenSet({
      source: {
        ...baseTokenSet().source,
        prefix: { status: 'known', style: 'v3-string', value: 'tw-' },
      },
    })
    const result = matchLayout('display', 'flex', tokens)
    expect(result.className).toBe('tw-flex')
  })
})
