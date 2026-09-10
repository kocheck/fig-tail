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
  it('defaults subtree export off when the preference is absent', () => {
    // subtreeFormat is no longer declared in the manifest, so `customSettings`
    // never carries it. The branch must stay inert rather than defaulting on.
    expect(optionsFromPreferences({}).subtreeFormat).toBe('off')
    expect(optionsFromPreferences(undefined).subtreeFormat).toBe('off')
  })

  it('does not declare a subtree-export preference in the manifest', () => {
    // There is no off switch for a manifest preference — a curious developer
    // will flip the dropdown into a feature nobody has run at scale. Not
    // declaring it is the only off.
    const names = manifest.codegenPreferences.map((p: { propertyName: string }) => p.propertyName)
    expect(names).not.toContain('subtreeFormat')
    expect(names).toEqual(['openSetup', 'includeLayout', 'allowArbitrary', 'output'])
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
    const matched = [result({})]
    expect(sectionsForOutput(sections, matched, matched, classesOnly)).toHaveLength(1)
  })

  it('does not retain the notes section for routine unsupported properties', () => {
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
