import { describe, expect, it } from 'vitest'
import type { MatchResult } from './types'

describe('types contract', () => {
  it('allows exact results to carry a class while nearest must be null', () => {
    const exact: MatchResult = {
      property: 'background-color',
      className: 'bg-brand-500',
      confidence: 'exact-value',
      provenance: { property: 'background-color', hintStatus: 'absent' },
    }
    const nearest: MatchResult = {
      property: 'background-color',
      className: null,
      confidence: 'nearest',
      nearest: { tokenKey: 'brand-500', className: 'bg-brand-500', delta: 0.4, deltaUnit: 'deltaE' },
      provenance: { property: 'background-color', hintStatus: 'absent' },
    }
    expect(exact.className).toBeTruthy()
    expect(nearest.className).toBeNull()
  })
})
