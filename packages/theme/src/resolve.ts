import type { ResolveInput, ResolveResult, Unresolved } from './types'
import { validateTokenSet } from './validate'
import { knownModulesFromDefaults, loadV3Defaults, loadV4Defaults } from './defaults'
import { resolveV3 } from './v3/index'
import { resolveV4 } from './v4/index'
import type { KnownModules } from './v3/evaluate'

const detectFlavour = (
  sources: ResolveInput['sources'],
  override?: 'v3' | 'v4',
): { flavour: 'v3' | 'v4' | null; warnings: string[]; unresolved: Unresolved[] } => {
  if (override) {
    return { flavour: override, warnings: [], unresolved: [] }
  }
  const texts = sources.map((source) => ({ name: source.name, text: source.text }))
  const hasV4 = texts.some(
    (source) =>
      /@theme\b/.test(source.text) || /@import\s+["']tailwindcss["']/.test(source.text),
  )
  const hasV3 = texts.some(
    (source) =>
      /module\.exports/.test(source.text) ||
      /export\s+default/.test(source.text) ||
      /tailwind\.config/.test(source.name),
  )
  if (hasV4 && hasV3) {
    const other = texts.find(
      (source) => /module\.exports/.test(source.text) || /export\s+default/.test(source.text),
    )
    return {
      flavour: 'v4',
      warnings: [
        other
          ? `Both v4 CSS and a JS config were provided; resolving as v4. The JS file "${other.name}" is ignored unless referenced via @config.`
          : 'Both v4 and v3 markers were present; resolving as v4.',
      ],
      unresolved: [],
    }
  }
  if (hasV4) return { flavour: 'v4', warnings: [], unresolved: [] }
  if (hasV3) return { flavour: 'v3', warnings: [], unresolved: [] }
  return {
    flavour: null,
    warnings: [],
    unresolved: [
      {
        path: '(root)',
        reason: 'parse-error',
        snippet: sources[0]?.text.slice(0, 120) ?? '',
        source: sources[0]?.name ?? '(none)',
        message:
          'Could not detect a Tailwind config. Provide a v3 tailwind.config.js/ts (module.exports / export default) or a v4 CSS file with @theme / @import "tailwindcss".',
      },
    ],
  }
}

const majorFromVersion = (exact: string | undefined): 3 | 4 | null => {
  if (!exact) return null
  if (exact.startsWith('3.')) return 3
  if (exact.startsWith('4.')) return 4
  return null
}

/** Resolve one or more Tailwind sources into a TokenSet without throwing. */
export const resolveTheme = (input: ResolveInput): ResolveResult => {
  try {
    if (!input.sources || input.sources.length === 0) {
      return {
        ok: false,
        tokens: null,
        unresolved: [
          {
            path: '(root)',
            reason: 'parse-error',
            snippet: '',
            source: '(none)',
            message: 'No sources were provided.',
          },
        ],
        warnings: [],
      }
    }

    const versionMajor = majorFromVersion(input.tailwindVersion?.exact)
    if (input.tailwindVersion?.exact && versionMajor === null) {
      return {
        ok: false,
        tokens: null,
        unresolved: [
          {
            path: 'tailwindVersion',
            reason: 'unsupported-syntax',
            snippet: input.tailwindVersion.exact,
            source: 'package.json',
            message: `Unrecognised Tailwind major in version ${input.tailwindVersion.exact}. fig-tail will not claim confirmed classes for this major.`,
          },
        ],
        warnings: [],
      }
    }

    const detected = detectFlavour(input.sources, input.flavour)
    if (!detected.flavour) {
      return {
        ok: false,
        tokens: null,
        unresolved: detected.unresolved,
        warnings: detected.warnings,
      }
    }

    if (detected.flavour === 'v3') {
      const source =
        input.sources.find((item) => /\.(js|cjs|mjs|ts)$/.test(item.name)) ?? input.sources[0]
      if (!source) {
        return { ok: false, tokens: null, unresolved: detected.unresolved, warnings: detected.warnings }
      }
      const defaults = loadV3Defaults(input.tailwindVersion?.exact)
      const known = knownModulesFromDefaults(defaults) as KnownModules
      const resolved = resolveV3(input, source.name, source.text, defaults, known)
      if (!resolved.tokens) {
        return {
          ok: false,
          tokens: null,
          unresolved: resolved.unresolved,
          warnings: [...detected.warnings, ...resolved.warnings],
        }
      }
      const validated = validateTokenSet(resolved.tokens)
      if (!validated.ok) {
        return {
          ok: false,
          tokens: null,
          unresolved: [
            ...resolved.unresolved,
            {
              path: '(tokens)',
              reason: 'parse-error',
              snippet: validated.errors.join('; ').slice(0, 120),
              source: source.name,
              message: 'Resolved tokens failed validation.',
            },
          ],
          warnings: [...detected.warnings, ...resolved.warnings],
        }
      }
      return {
        ok: true,
        tokens: validated.value,
        unresolved: resolved.unresolved,
        warnings: [...detected.warnings, ...resolved.warnings],
      }
    }

    const cssSource =
      input.sources.find((item) => item.name.endsWith('.css') || /@theme/.test(item.text)) ??
      input.sources[0]
    if (!cssSource) {
      return { ok: false, tokens: null, unresolved: detected.unresolved, warnings: detected.warnings }
    }
    const defaults = loadV4Defaults(input.tailwindVersion?.exact)
    const resolved = resolveV4(input, cssSource.name, cssSource.text, defaults)

    if (resolved.configPath) {
      const configPath = resolved.configPath
      const nested = input.sources.find(
        (item) =>
          item.name === configPath ||
          item.name.endsWith(`/${configPath}`) ||
          item.name === configPath.replace(/^\.\//, ''),
      )
      if (!nested) {
        resolved.unresolved.push({
          path: `@config ${configPath}`,
          reason: 'missing-import',
          snippet: `@config "${configPath}"`,
          source: cssSource.name,
          message: `Referenced config "${configPath}" was not provided.`,
        })
      } else {
        const v3Defaults = loadV3Defaults(input.tailwindVersion?.exact)
        const known = knownModulesFromDefaults(v3Defaults) as KnownModules
        const nestedResolved = resolveV3(input, nested.name, nested.text, v3Defaults, known)
        if (nestedResolved.tokens && resolved.tokens) {
          resolved.tokens = {
            ...resolved.tokens,
            colors: { ...nestedResolved.tokens.colors, ...resolved.tokens.colors },
            spacing: {
              ...resolved.tokens.spacing,
              scale: {
                ...nestedResolved.tokens.spacing.scale,
                ...resolved.tokens.spacing.scale,
              },
              named: {
                ...nestedResolved.tokens.spacing.named,
                ...resolved.tokens.spacing.named,
              },
            },
            radius: { ...nestedResolved.tokens.radius, ...resolved.tokens.radius },
            fontSize: { ...nestedResolved.tokens.fontSize, ...resolved.tokens.fontSize },
            fontFamily: { ...nestedResolved.tokens.fontFamily, ...resolved.tokens.fontFamily },
          }
          resolved.unresolved.push(...nestedResolved.unresolved)
        }
      }
    }

    if (!resolved.tokens) {
      return {
        ok: false,
        tokens: null,
        unresolved: resolved.unresolved,
        warnings: [...detected.warnings, ...resolved.warnings],
      }
    }
    const validated = validateTokenSet(resolved.tokens)
    if (!validated.ok) {
      return {
        ok: false,
        tokens: null,
        unresolved: [
          ...resolved.unresolved,
          {
            path: '(tokens)',
            reason: 'parse-error',
            snippet: validated.errors.join('; ').slice(0, 120),
            source: cssSource.name,
            message: 'Resolved tokens failed validation.',
          },
        ],
        warnings: [...detected.warnings, ...resolved.warnings],
      }
    }
    return {
      ok: true,
      tokens: validated.value,
      unresolved: resolved.unresolved,
      warnings: [...detected.warnings, ...resolved.warnings],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      tokens: null,
      unresolved: [
        {
          path: '(root)',
          reason: 'parse-error',
          snippet: message.slice(0, 120),
          source: input.sources[0]?.name ?? '(none)',
          message: `Internal resolver failure: ${message}`,
        },
      ],
      warnings: [],
    }
  }
}
