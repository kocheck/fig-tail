import { describe, expect, it } from 'vitest'
import { matchDeclarations, toClassName } from './index'
import { baseTokenSet, tokensFromConfig } from './test-helpers'
import cardFixture from '../fixtures/css/card-exact.json'

describe('integration', () => {
  it('builds the card class string from the fixture in canonical order', () => {
    const tokens = baseTokenSet()
    const results = matchDeclarations(cardFixture as Record<string, string>, { tokens })
    const className = toClassName(results)
    expect(className).toBe(
      'flex flex-col items-start self-stretch gap-4 p-6 rounded-xl border border-gray-200 border-solid bg-white shadow-xs',
    )
  })

  it('never promotes nearest results into toClassName', () => {
    const tokens = tokensFromConfig('v3', 'starter.js', {
      exact: '3.4.19',
      source: 'package-json',
    })
    const css = {
      ...cardFixture,
      'background-color': '#3b82f1',
    } as Record<string, string>
    const results = matchDeclarations(css, { tokens })
    expect(results.some((result) => result.confidence === 'nearest')).toBe(true)
    expect(toClassName(results)).not.toContain('brand-500')
  })
})
