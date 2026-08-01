import { describe, expect, it } from 'vitest'
import { classOrdinal, sortClasses } from './order'

describe('order', () => {
  it('sorts classes in canonical order', () => {
    expect(sortClasses(['bg-white', 'flex', 'p-6', 'items-start'])).toEqual([
      'flex',
      'items-start',
      'p-6',
      'bg-white',
    ])
  })

  it('falls back to lexicographic order for unknown prefixes', () => {
    expect(classOrdinal('custom-a')).toBeGreaterThan(classOrdinal('flex'))
    expect(sortClasses(['custom-b', 'custom-a'])).toEqual(['custom-a', 'custom-b'])
  })
})
