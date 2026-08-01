import { describe, expect, it } from 'vitest'
import { classifyResult, findingHash, sortFindings, type Finding } from './types'
import type { MatchResult } from '@fig-tail/match'

const baseResult = (overrides: Partial<MatchResult>): MatchResult => ({
  property: 'background-color',
  className: null,
  confidence: 'nearest',
  provenance: { property: 'background-color', hintStatus: 'absent' },
  ...overrides,
})

describe('lint types', () => {
  it('classifies nearest as high', () => {
    const c = classifyResult(
      baseResult({
        nearest: { tokenKey: 'brand-500', className: 'bg-brand-500', delta: 0.4, deltaUnit: 'deltaE' },
        note: 'near',
      }),
    )
    expect(c).toEqual({ kind: 'nearest', severity: 'high' })
  })

  it('sorts by severity then node count', () => {
    const findings: Finding[] = [
      {
        id: 'a',
        kind: 'drift',
        severity: 'low',
        nodeIds: ['1', '2', '3'],
        nodeNames: ['a', 'b', 'c'],
        property: 'x',
        message: 'low',
      },
      {
        id: 'b',
        kind: 'nearest',
        severity: 'high',
        nodeIds: ['1'],
        nodeNames: ['a'],
        property: 'y',
        message: 'high',
      },
      {
        id: 'c',
        kind: 'off-system',
        severity: 'medium',
        nodeIds: ['1', '2'],
        nodeNames: ['a', 'b'],
        property: 'z',
        message: 'med',
      },
    ]
    expect(sortFindings(findings).map((f) => f.id)).toEqual(['b', 'c', 'a'])
  })

  it('hashes stably', () => {
    expect(
      findingHash({
        kind: 'nearest',
        severity: 'high',
        property: 'color',
        message: 'near brand-500',
      }),
    ).toBe('nearest:color:near brand-500')
  })
})
