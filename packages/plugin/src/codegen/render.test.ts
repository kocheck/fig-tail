import { describe, expect, it } from 'vitest'
import type { MatchResult } from '@fig-tail/match'
import { renderCodegenDrift, renderCodegenPrimary, renderCodegenSections } from './render'

const result = (overrides: Partial<MatchResult>): MatchResult => ({
  property: 'background-color',
  className: 'bg-brand-500',
  confidence: 'exact-variable',
  provenance: { property: 'background-color', hintStatus: 'applied' },
  ...overrides,
})

describe('renderCodegenPrimary', () => {
  it('returns the class string unchanged when non-empty', () => {
    expect(renderCodegenPrimary('flex gap-4')).toBe('flex gap-4')
  })

  it('renders a comment placeholder when there are no classes', () => {
    expect(renderCodegenPrimary('')).toBe('/* no classes */')
  })
})

describe('renderCodegenDrift', () => {
  it('returns null when there is nothing to report', () => {
    expect(renderCodegenDrift([result({})], [], '')).toBeNull()
  })

  it('includes the tier label and warnings even with no drift', () => {
    const drift = renderCodegenDrift([result({})], ['1 setting could not be read'], 'Using the config saved on this file')
    expect(drift).toContain('Using the config saved on this file')
    expect(drift).toContain('1 setting could not be read')
    expect(drift).not.toContain('Needs attention')
  })

  it('lists nearest/arbitrary/none results under "Needs attention"', () => {
    const results: MatchResult[] = [
      result({ property: 'background-color' }),
      result({
        property: 'padding-top',
        className: null,
        confidence: 'nearest',
        note: 'no exact token',
        nearest: { tokenKey: 'p-6', className: 'p-6', delta: 1, deltaUnit: 'px' },
        provenance: { property: 'padding-top', hintStatus: 'absent' },
      }),
      result({
        property: 'background-color',
        className: 'bg-[#3b82f1]',
        confidence: 'arbitrary',
        note: 'no exact token',
        provenance: { property: 'background-color', hintStatus: 'absent' },
      }),
      result({
        property: 'filter',
        className: null,
        confidence: 'none',
        note: 'not expressible in Tailwind',
        provenance: { property: 'filter', hintStatus: 'absent' },
      }),
    ]
    const drift = renderCodegenDrift(results, [], 'tier')
    expect(drift).toContain('Needs attention (3)')
    expect(drift).toContain('padding-top: no exact token')
    expect(drift).toContain('nearest: p-6 (Δ1px)')
    expect(drift).toContain('background-color: no exact token')
    expect(drift).toContain('filter: not expressible in Tailwind')
  })
})

describe('renderCodegenSections', () => {
  it('emits only the Tailwind section when there is nothing else to report', () => {
    const sections = renderCodegenSections([result({})], 'bg-brand-500', [], '')
    expect(sections).toHaveLength(1)
    expect(sections[0]).toEqual({ title: 'Tailwind', language: 'PLAINTEXT', code: 'bg-brand-500' })
  })

  it('titles the second section "Notes" when there is only tier/warning context', () => {
    const sections = renderCodegenSections(
      [result({})],
      'bg-brand-500',
      [],
      'Using the config saved on this file',
    )
    expect(sections).toHaveLength(2)
    expect(sections[1]?.title).toBe('Notes')
  })

  it('titles the second section "Drift" when there is per-property drift', () => {
    const results: MatchResult[] = [
      result({}),
      result({
        property: 'padding-top',
        className: null,
        confidence: 'nearest',
        note: 'no exact token',
        nearest: { tokenKey: 'p-6', className: 'p-6', delta: 1, deltaUnit: 'px' },
        provenance: { property: 'padding-top', hintStatus: 'absent' },
      }),
    ]
    const sections = renderCodegenSections(results, 'bg-brand-500', [], '')
    expect(sections).toHaveLength(2)
    expect(sections[1]?.title).toBe('Drift')
  })
})
