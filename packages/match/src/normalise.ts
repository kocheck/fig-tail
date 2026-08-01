/** Expanded longhand declaration map. */
export type DeclarationMap = Record<string, string>

const COLOR_PROPS = new Set([
  'color',
  'background',
  'background-color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'fill',
  'stroke',
])

/** Expand shorthands and canonicalise trivial colour forms. */
export const expandDeclarations = (css: Record<string, string>): DeclarationMap => {
  const out: DeclarationMap = {}
  for (const [property, value] of Object.entries(css)) {
    if (property === 'padding' || property === 'margin') {
      Object.assign(out, expandBox(property, value))
      continue
    }
    if (property === 'border') {
      Object.assign(out, expandBorder(value))
      continue
    }
    if (property === 'border-radius') {
      Object.assign(out, expandRadius(value))
      continue
    }
    if (property === 'background' && !value.includes('gradient')) {
      out['background-color'] = canonicalColour(value)
      continue
    }
    if (COLOR_PROPS.has(property)) {
      out[property] = canonicalColour(value)
      continue
    }
    out[property] = value
  }
  return out
}

const expandBox = (prefix: string, value: string): DeclarationMap => {
  const parts = value.trim().split(/\s+/)
  const [a, b, c, d] = parts
  if (!a) return {}
  if (parts.length === 1) {
    return {
      [`${prefix}-top`]: a,
      [`${prefix}-right`]: a,
      [`${prefix}-bottom`]: a,
      [`${prefix}-left`]: a,
    }
  }
  if (parts.length === 2 && b) {
    return {
      [`${prefix}-top`]: a,
      [`${prefix}-right`]: b,
      [`${prefix}-bottom`]: a,
      [`${prefix}-left`]: b,
    }
  }
  if (parts.length === 3 && b && c) {
    return {
      [`${prefix}-top`]: a,
      [`${prefix}-right`]: b,
      [`${prefix}-bottom`]: c,
      [`${prefix}-left`]: b,
    }
  }
  if (parts.length >= 4 && b && c && d) {
    return {
      [`${prefix}-top`]: a,
      [`${prefix}-right`]: b,
      [`${prefix}-bottom`]: c,
      [`${prefix}-left`]: d,
    }
  }
  return { [prefix]: value }
}

const expandBorder = (value: string): DeclarationMap => {
  const parts = value.trim().split(/\s+/)
  const width = parts.find((part) => /^\d/.test(part) || part === 'thin' || part === 'medium' || part === 'thick')
  const style = parts.find((part) =>
    ['solid', 'dashed', 'dotted', 'none', 'double', 'groove', 'ridge', 'inset', 'outset'].includes(part),
  )
  const color = parts.find((part) => part.startsWith('#') || part.startsWith('rgb') || part.startsWith('hsl') || part === 'transparent')
  const out: DeclarationMap = {}
  if (width) out['border-width'] = width
  if (style) out['border-style'] = style
  if (color) out['border-color'] = canonicalColour(color)
  return out
}

const expandRadius = (value: string): DeclarationMap => {
  const parts = value.trim().split(/\s+/)
  const [a, b, c, d] = parts
  if (!a) return {}
  if (parts.length === 1) {
    return {
      'border-top-left-radius': a,
      'border-top-right-radius': a,
      'border-bottom-right-radius': a,
      'border-bottom-left-radius': a,
    }
  }
  if (parts.length === 2 && b) {
    return {
      'border-top-left-radius': a,
      'border-top-right-radius': b,
      'border-bottom-right-radius': a,
      'border-bottom-left-radius': b,
    }
  }
  if (parts.length === 3 && b && c) {
    return {
      'border-top-left-radius': a,
      'border-top-right-radius': b,
      'border-bottom-right-radius': c,
      'border-bottom-left-radius': b,
    }
  }
  if (parts.length >= 4 && b && c && d) {
    return {
      'border-top-left-radius': a,
      'border-top-right-radius': b,
      'border-bottom-right-radius': c,
      'border-bottom-left-radius': d,
    }
  }
  return { 'border-radius': value }
}

const canonicalColour = (value: string): string => {
  const trimmed = value.trim()
  if (/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.test(trimmed)) {
    return trimmed.replace(
      /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i,
      (_, r, g, b) => `#${r}${r}${g}${g}${b}${b}`.toLowerCase(),
    )
  }
  if (/^#([0-9a-f]{6})$/i.test(trimmed)) {
    return trimmed.toLowerCase()
  }
  if (trimmed === '#FFF' || trimmed === '#fff') return '#ffffff'
  return trimmed
}

/** Collapse four equal longhands back to a shorthand class key. */
export const collapseBox = (
  results: Array<{ property: string; className: string | null; confidence: string }>,
  prefix: 'p' | 'm',
): Array<{ property: string; className: string | null; confidence: string }> | null => {
  const sides = ['top', 'right', 'bottom', 'left'].map((side) => {
    const prop = prefix === 'p' ? `padding-${side}` : `margin-${side}`
    return results.find((result) => result.property === prop)
  })
  if (sides.some((side) => !side || !side.className || side.confidence === 'nearest')) {
    return null
  }
  const values = sides.map((side) => side?.className?.replace(/^[pm][trbl]?-/, '') ?? '')
  if (values.some((value) => !value) || new Set(values).size !== 1) {
    return null
  }
  const token = values[0]
  return [
    {
      property: prefix === 'p' ? 'padding' : 'margin',
      className: `${prefix}-${token}`,
      confidence: sides[0]?.confidence ?? 'exact-value',
    },
  ]
}
