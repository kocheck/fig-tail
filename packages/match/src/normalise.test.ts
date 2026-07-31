import { describe, expect, it } from 'vitest'
import { expandDeclarations } from './normalise'

describe('expand', () => {
  it('expands 1-value padding', () => {
    expect(expandDeclarations({ padding: '24px' })).toEqual({
      'padding-top': '24px',
      'padding-right': '24px',
      'padding-bottom': '24px',
      'padding-left': '24px',
    })
  })

  it('expands 2-value padding', () => {
    expect(expandDeclarations({ padding: '16px 24px' })['padding-left']).toBe('24px')
  })

  it('expands 3-value padding', () => {
    expect(expandDeclarations({ padding: '1px 2px 3px' })['padding-bottom']).toBe('3px')
  })

  it('expands 4-value padding', () => {
    expect(expandDeclarations({ padding: '1px 2px 3px 4px' })['padding-left']).toBe('4px')
  })

  it('expands border shorthand', () => {
    const out = expandDeclarations({ border: '1px solid #E5E7EB' })
    expect(out['border-width']).toBe('1px')
    expect(out['border-style']).toBe('solid')
    expect(out['border-color']).toBe('#e5e7eb')
  })

  it('canonicalises short hex colours', () => {
    expect(expandDeclarations({ color: '#FFF' }).color).toBe('#ffffff')
  })
})
