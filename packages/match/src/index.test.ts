import { describe, expect, it } from 'vitest'
import { matchDeclarations, toClassName } from './index'
import { baseTokenSet } from './test-helpers'

describe('engine', () => {
  it('returns none for unsupported properties', () => {
    const results = matchDeclarations({ filter: 'blur(4px)' }, { tokens: baseTokenSet() })
    expect(results[0]?.confidence).toBe('none')
    expect(results[0]?.note).toMatch(/Unsupported property/)
  })

  it('does not collapse padding when one side is nearest', () => {
    const results = matchDeclarations(
      {
        'padding-top': '24px',
        'padding-right': '24px',
        'padding-bottom': '24px',
        'padding-left': '25px',
      },
      { tokens: baseTokenSet() },
    )
    expect(results.some((result) => result.property === 'padding')).toBe(false)
    expect(results.some((result) => result.confidence === 'nearest')).toBe(true)
  })

  it('emits every side of a near-miss shorthand as a raw value', () => {
    // `padding: 25px` expands to four sides, each a near miss against 24px.
    // collapseSides deliberately refuses to collapse a `nearest` set: the
    // collapsed result carries no per-side `nearest` metadata, so the drift
    // finding would vanish. Four raw-value sides is the accepted cost of
    // keeping the finding — and four raw values still beat the previous
    // behaviour, which emitted nothing at all for the property.
    const results = matchDeclarations({ padding: '25px' }, { tokens: baseTokenSet() })
    expect(toClassName(results)).toBe('pt-[25px] pr-[25px] pb-[25px] pl-[25px]')
    expect(results.every((r) => r.confidence === 'nearest')).toBe(true)
    expect(results.every((r) => r.nearest !== undefined)).toBe(true)
  })

  it('does not let a spaced arbitrary value shred the class string', () => {
    // Figma emits spaced values: `rgba(59, 130, 246, 0.5)`, `Helvetica Neue`.
    // toClassName joins with a space, so an unescaped value fragments into
    // several tokens and corrupts every OTHER class in the string too.
    const results = matchDeclarations(
      { 'box-shadow': '0px 7px 13px 2px rgba(11, 22, 33, 0.37)', display: 'flex' },
      { tokens: baseTokenSet() },
    )
    const className = toClassName(results)
    expect(className).toContain('shadow-[0px_7px_13px_2px_rgba(11,_22,_33,_0.37)]')
    expect(className).not.toMatch(/\s22,/)
    // The real invariant: one token per emitted class, whatever the values are.
    const emitted = results.filter((r) => r.className).length
    expect(className.split(' ')).toHaveLength(emitted)
  })

  it('does not collapse mismatched corner radii', () => {
    const tokens = baseTokenSet({
      radius: {
        lg: { raw: '0.5rem', px: 8 },
        xl: { raw: '0.75rem', px: 12 },
      },
    })
    const results = matchDeclarations(
      {
        'border-top-left-radius': '8px',
        'border-top-right-radius': '12px',
        'border-bottom-right-radius': '8px',
        'border-bottom-left-radius': '12px',
      },
      { tokens },
    )
    expect(results.some((result) => result.property === 'border-radius')).toBe(false)
    expect(toClassName(results)).toContain('rounded-tl-lg')
    expect(toClassName(results)).toContain('rounded-tr-xl')
  })

  it('routes opacity and line-height through their matchers', () => {
    const results = matchDeclarations(
      { opacity: '0.5', 'line-height': '20px' },
      { tokens: baseTokenSet() },
    )
    expect(toClassName(results)).toContain('opacity-50')
    expect(toClassName(results)).toContain('leading-5')
  })
})
