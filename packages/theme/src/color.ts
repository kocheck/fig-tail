import { converter, formatHex, parse } from 'culori'
import type { ColorToken } from './types'

const toRgb = converter('rgb')

/** Convert any CSS colour string into a canonical ColorToken. */
export const toColorToken = (raw: string): ColorToken | null => {
  const parsed = parse(raw)
  if (!parsed) {
    return null
  }
  const rgbColor = toRgb(parsed)
  if (!rgbColor || rgbColor.r === undefined || rgbColor.g === undefined || rgbColor.b === undefined) {
    return null
  }
  const r = Math.max(0, Math.min(255, Math.round(rgbColor.r * 255)))
  const g = Math.max(0, Math.min(255, Math.round(rgbColor.g * 255)))
  const b = Math.max(0, Math.min(255, Math.round(rgbColor.b * 255)))
  const alpha = rgbColor.alpha ?? 1
  const hex =
    formatHex({
      mode: 'rgb',
      r: r / 255,
      g: g / 255,
      b: b / 255,
    }) ?? '#000000'
  const token: ColorToken = {
    hex,
    rgb: [r, g, b],
    alpha,
  }
  if (raw.toLowerCase() !== hex.toLowerCase()) {
    token.raw = raw
  }
  return token
}
