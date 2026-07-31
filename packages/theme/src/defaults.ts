import type { DefaultThemeData } from './v3/index'
import v3Defaults from '../data/v3-default-theme.json'
import v4Defaults from '../data/v4-default-theme.json'

/** Bundled Tailwind v3 default theme dataset version. */
export const V3_DEFAULTS_VERSION = (v3Defaults as unknown as DefaultThemeData).version

/** Bundled Tailwind v4 default theme dataset version. */
export const V4_DEFAULTS_VERSION = (v4Defaults as unknown as DefaultThemeData).version

/** Load the bundled v3 default theme when the exact version matches. */
export const loadV3Defaults = (exactVersion: string | undefined): DefaultThemeData | null => {
  if (!exactVersion || exactVersion !== V3_DEFAULTS_VERSION) {
    return null
  }
  return v3Defaults as unknown as DefaultThemeData
}

/** Load the bundled v4 default theme when the exact version matches. */
export const loadV4Defaults = (exactVersion: string | undefined): DefaultThemeData | null => {
  if (!exactVersion || exactVersion !== V4_DEFAULTS_VERSION) {
    return null
  }
  return v4Defaults as unknown as DefaultThemeData
}

/** Known modules for the v3 static evaluator. */
export const knownModulesFromDefaults = (defaults: DefaultThemeData | null) => {
  const colors = defaults?.colors
    ? Object.fromEntries(
        Object.entries(defaults.colors).map(([key, token]) => {
          const parts = key.split('-')
          if (parts.length === 1) {
            return [key, token.raw ?? token.hex]
          }
          return [key, token.raw ?? token.hex]
        }),
      )
    : {}

  // Rebuild nested colour map for member access like colors.blue[500]
  const nestedColors: Record<string, unknown> = {}
  if (defaults) {
    for (const [key, token] of Object.entries(defaults.colors)) {
      const segments = key.split('-')
      let cursor: Record<string, unknown> = nestedColors
      for (let i = 0; i < segments.length; i += 1) {
        const segment = segments[i]
        if (!segment) continue
        if (i === segments.length - 1) {
          cursor[segment] = token.raw ?? token.hex
        } else {
          const existing = cursor[segment]
          if (!existing || typeof existing !== 'object') {
            cursor[segment] = {}
          }
          cursor = cursor[segment] as Record<string, unknown>
        }
      }
    }
  }

  const defaultTheme = defaults
    ? {
        colors: nestedColors,
        spacing: Object.fromEntries(
          Object.entries(defaults.spacing.scale).map(([key, token]) => [key, token.raw]),
        ),
        borderRadius: Object.fromEntries(
          Object.entries(defaults.radius).map(([key, token]) => [key, token.raw]),
        ),
        fontSize: Object.fromEntries(
          Object.entries(defaults.fontSize).map(([key, token]) => {
            if (token.lineHeight) {
              return [key, [token.raw, { lineHeight: token.lineHeight.raw }]]
            }
            return [key, token.raw]
          }),
        ),
        fontFamily: Object.fromEntries(
          Object.entries(defaults.fontFamily).map(([key, token]) => [key, token.stack]),
        ),
        fontWeight: defaults.fontWeight,
        lineHeight: Object.fromEntries(
          Object.entries(defaults.lineHeight).map(([key, token]) => [key, token.raw]),
        ),
        letterSpacing: Object.fromEntries(
          Object.entries(defaults.letterSpacing).map(([key, token]) => [key, token.raw]),
        ),
        boxShadow: Object.fromEntries(
          Object.entries(defaults.boxShadow).map(([key, token]) => [key, token.raw]),
        ),
        borderWidth: Object.fromEntries(
          Object.entries(defaults.borderWidth).map(([key, token]) => [key, token.raw]),
        ),
        opacity: defaults.opacity,
        screens: Object.fromEntries(
          Object.entries(defaults.breakpoints).map(([key, token]) => [key, token.raw]),
        ),
        zIndex: defaults.zIndex,
      }
    : {}

  return {
    'tailwindcss/defaultTheme': defaultTheme,
    'tailwindcss/colors': nestedColors,
    'tailwindcss/defaultConfig': { theme: defaultTheme },
    // keep flat map available for debugging
    __flatColors: colors,
  }
}
