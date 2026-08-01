import { describe, expect, it } from 'vitest'
import { expandDeclarations, collapseBox } from './normalise'

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

  it('expands margin shorthands', () => {
    expect(expandDeclarations({ margin: '8px 16px' })['margin-top']).toBe('8px')
  })

  it('expands border shorthand', () => {
    const out = expandDeclarations({ border: '1px solid #E5E7EB' })
    expect(out['border-width']).toBe('1px')
    expect(out['border-style']).toBe('solid')
    expect(out['border-color']).toBe('#e5e7eb')
  })

  it('expands border-radius shorthand', () => {
    const out = expandDeclarations({ 'border-radius': '12px' })
    expect(out['border-top-left-radius']).toBe('12px')
    expect(out['border-bottom-right-radius']).toBe('12px')
  })

  it('maps background colour shorthand', () => {
    expect(expandDeclarations({ background: '#FFF' })['background-color']).toBe('#ffffff')
  })

  it('canonicalises short hex colours', () => {
    expect(expandDeclarations({ color: '#FFF' }).color).toBe('#ffffff')
    expect(expandDeclarations({ color: '#abc' }).color).toBe('#aabbcc')
    expect(expandDeclarations({ color: '#AABBCC' }).color).toBe('#aabbcc')
  })

  it('leaves gradients on background', () => {
    expect(expandDeclarations({ background: 'linear-gradient(red, blue)' }).background).toBe(
      'linear-gradient(red, blue)',
    )
  })
})

describe('collapseBox', () => {
  it('collapses four equal padding sides', () => {
    const collapsed = collapseBox(
      [
        { property: 'padding-top', className: 'pt-6', confidence: 'exact-value' },
        { property: 'padding-right', className: 'pr-6', confidence: 'exact-value' },
        { property: 'padding-bottom', className: 'pb-6', confidence: 'exact-value' },
        { property: 'padding-left', className: 'pl-6', confidence: 'exact-value' },
      ],
      'p',
    )
    expect(collapsed).toEqual([{ property: 'padding', className: 'p-6', confidence: 'exact-value' }])
  })

  it('does not collapse when one side misses', () => {
    const input = [
      { property: 'padding-top', className: 'pt-6', confidence: 'exact-value' },
      { property: 'padding-right', className: 'pr-6', confidence: 'exact-value' },
      { property: 'padding-bottom', className: 'pb-6', confidence: 'exact-value' },
      { property: 'padding-left', className: null, confidence: 'nearest' },
    ]
    expect(collapseBox(input, 'p')).toBeNull()
  })

  it('returns null when side values differ', () => {
    const input = [
      { property: 'padding-top', className: 'pt-6', confidence: 'exact-value' },
      { property: 'padding-right', className: 'pr-4', confidence: 'exact-value' },
      { property: 'padding-bottom', className: 'pb-6', confidence: 'exact-value' },
      { property: 'padding-left', className: 'pl-6', confidence: 'exact-value' },
    ]
    expect(collapseBox(input, 'p')).toBeNull()
  })

  it('expands 2-value border-radius', () => {
    const out = expandDeclarations({ 'border-radius': '8px 12px' })
    expect(out['border-top-left-radius']).toBe('8px')
    expect(out['border-bottom-left-radius']).toBe('12px')
  })

  it('expands 3-value border-radius', () => {
    const out = expandDeclarations({ 'border-radius': '1px 2px 3px' })
    expect(out['border-bottom-right-radius']).toBe('3px')
  })

  it('leaves invalid padding shorthand empty', () => {
    expect(expandDeclarations({ padding: '' })).toEqual({})
  })

  it('expands 4-value border-radius', () => {
    const out = expandDeclarations({ 'border-radius': '1px 2px 3px 4px' })
    expect(out['border-bottom-left-radius']).toBe('4px')
  })
})
