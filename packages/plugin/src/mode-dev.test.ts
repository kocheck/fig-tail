import { describe, expect, it } from 'vitest'
import type { MatchResult } from '@fig-tail/match'
import { applyCodegenFilters, optionsFromPreferences, sectionsForOutput } from './mode-dev'
import manifest from '../manifest.json'

const result = (over: Partial<MatchResult>): MatchResult => ({
  property: 'background-color',
  className: 'bg-[#3b82f1]',
  confidence: 'nearest',
  provenance: { property: 'background-color', hintStatus: 'absent' },
  ...over,
})

const sections = [
  { title: 'Tailwind', language: 'PLAINTEXT' as const, code: 'bg-[#3b82f1]' },
  { title: 'Drift', language: 'PLAINTEXT' as const, code: 'Needs attention (1)' },
]

describe('optionsFromPreferences', () => {
  it('maps exactly the preferences the manifest declares', () => {
    const names = manifest.codegenPreferences.map((p: { propertyName: string }) => p.propertyName)
    expect(names).toEqual(['openSetup', 'includeLayout', 'allowArbitrary', 'output'])
    expect(optionsFromPreferences(undefined)).toEqual({
      includeLayout: true,
      allowArbitrary: true,
      outputNotes: true,
    })
  })
})

describe('applyCodegenFilters', () => {
  it('keeps a near-miss raw value when arbitrary values are allowed', () => {
    const [out] = applyCodegenFilters([result({})], optionsFromPreferences({}))
    expect(out?.className).toBe('bg-[#3b82f1]')
  })

  it('drops a near-miss class when arbitrary values are off, keeping its metadata', () => {
    const nearest = { tokenKey: 'brand-500', className: 'bg-brand-500', delta: 0.8 }
    const [out] = applyCodegenFilters(
      [result({ nearest })],
      optionsFromPreferences({ allowArbitrary: 'no' }),
    )
    // The class goes; confidence and `nearest` stay, so the drift linter and the
    // drift section still report it.
    expect(out?.className).toBeNull()
    expect(out?.confidence).toBe('nearest')
    expect(out?.nearest).toEqual(nearest)
  })
})

describe('sectionsForOutput', () => {
  const classesOnly = optionsFromPreferences({ output: 'classes' })

  it('shows the notes section under Classes when a class was filtered away', () => {
    const matched = [result({})]
    const filtered = [result({ className: null })]
    expect(sectionsForOutput(sections, matched, filtered, classesOnly)).toHaveLength(2)
  })

  it('shows only the class string when nothing was filtered away', () => {
    // `none` results are every property Figma volunteers that no matcher covers.
    // Retaining on those would make the Classes preference a no-op.
    const matched = [result({ className: null, confidence: 'none', property: 'position' })]
    expect(sectionsForOutput(sections, matched, matched, classesOnly)).toHaveLength(1)
  })

  it('always shows every section when notes are on', () => {
    const matched = [result({})]
    expect(sectionsForOutput(sections, matched, matched, optionsFromPreferences({}))).toHaveLength(2)
  })
})
