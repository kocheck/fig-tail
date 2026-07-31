import type { LengthToken } from './types'

/** Parse a CSS length into raw + px using remBasePx. */
export const toLengthToken = (raw: string, remBasePx: number): LengthToken => {
  const trimmed = raw.trim()
  if (trimmed === '0') {
    return { raw: trimmed, px: 0 }
  }
  const pxMatch = /^(-?\d+(?:\.\d+)?)px$/i.exec(trimmed)
  if (pxMatch?.[1]) {
    return { raw: trimmed, px: Number(pxMatch[1]) }
  }
  const remMatch = /^(-?\d+(?:\.\d+)?)rem$/i.exec(trimmed)
  if (remMatch?.[1]) {
    return { raw: trimmed, px: Number(remMatch[1]) * remBasePx }
  }
  const emMatch = /^(-?\d+(?:\.\d+)?)em$/i.exec(trimmed)
  if (emMatch?.[1]) {
    return { raw: trimmed, px: Number(emMatch[1]) * remBasePx }
  }
  const numberMatch = /^(-?\d+(?:\.\d+)?)$/.exec(trimmed)
  if (numberMatch?.[1]) {
    return { raw: trimmed, px: null }
  }
  return { raw: trimmed, px: null }
}

/** Flatten nested Tailwind colour/theme objects into class-name keys. */
export const flattenKeys = (
  input: unknown,
  prefix = '',
): Record<string, unknown> => {
  if (input === null || input === undefined) {
    return {}
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    if (!prefix) {
      return {}
    }
    return { [prefix]: input }
  }
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (key === 'DEFAULT') {
      if (prefix) {
        out[prefix] = value
      }
      continue
    }
    const next = prefix ? `${prefix}-${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flattenKeys(value, next))
    } else {
      out[next] = value
    }
  }
  return out
}
