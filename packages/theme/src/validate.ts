import {
  TOKEN_SET_SCHEMA_VERSION,
  type ColorToken,
  type ConfigProvenance,
  type FontFamilyToken,
  type FontSizeToken,
  type LengthToken,
  type PrefixStatus,
  type SourceMetadata,
  type TokenSet,
  type TokenSetSource,
} from './types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isString = (value: unknown): value is string => typeof value === 'string'

const push = (errors: string[], message: string) => {
  errors.push(message)
}

const isSemver = (value: string): boolean =>
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value)

const isBasename = (value: string): boolean =>
  value.length > 0 && !value.includes('/') && !value.includes('\\') && !value.includes(':')

const isRelativePath = (value: string): boolean =>
  value.length > 0 && !value.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(value)

const isSha256 = (value: string): boolean => /^[a-f0-9]{64}$/.test(value)

const validateLength = (
  errors: string[],
  path: string,
  value: unknown,
): value is LengthToken => {
  if (!isRecord(value)) {
    push(errors, `${path} must be an object`)
    return false
  }
  if (!isString(value.raw)) {
    push(errors, `${path}.raw must be a string`)
  }
  if (value.px !== null && typeof value.px !== 'number') {
    push(errors, `${path}.px must be a number or null`)
  }
  return true
}

const validateColor = (
  errors: string[],
  path: string,
  value: unknown,
): value is ColorToken => {
  if (!isRecord(value)) {
    push(errors, `${path} must be an object`)
    return false
  }
  if (!isString(value.hex)) {
    push(errors, `${path}.hex must be a string`)
  }
  if (!Array.isArray(value.rgb) || value.rgb.length !== 3) {
    push(errors, `${path}.rgb must be a 3-tuple`)
  } else if (!value.rgb.every((n) => typeof n === 'number')) {
    push(errors, `${path}.rgb channels must be numbers`)
  }
  if (typeof value.alpha !== 'number') {
    push(errors, `${path}.alpha must be a number`)
  }
  if (value.raw !== undefined && !isString(value.raw)) {
    push(errors, `${path}.raw must be a string when present`)
  }
  return true
}

const validateFontSize = (
  errors: string[],
  path: string,
  value: unknown,
): value is FontSizeToken => {
  if (!isRecord(value)) {
    push(errors, `${path} must be an object`)
    return false
  }
  const lineHeight = value.lineHeight
  if (!validateLength(errors, path, value)) {
    return false
  }
  if (lineHeight !== undefined) {
    validateLength(errors, `${path}.lineHeight`, lineHeight)
  }
  return true
}

const validateFontFamily = (
  errors: string[],
  path: string,
  value: unknown,
): value is FontFamilyToken => {
  if (!isRecord(value)) {
    push(errors, `${path} must be an object`)
    return false
  }
  if (!Array.isArray(value.stack) || !value.stack.every(isString)) {
    push(errors, `${path}.stack must be string[]`)
  }
  if (!isString(value.primary)) {
    push(errors, `${path}.primary must be a string`)
  }
  return true
}

const validatePrefix = (errors: string[], prefix: unknown): prefix is PrefixStatus => {
  if (!isRecord(prefix) || !isString(prefix.status)) {
    push(errors, 'source.prefix.status is required')
    return false
  }
  if (prefix.status === 'none' || prefix.status === 'unknown') {
    return true
  }
  if (prefix.status !== 'known') {
    push(errors, 'source.prefix.status is invalid')
    return false
  }
  if (prefix.style === 'v3-string') {
    if (!isString(prefix.value) || prefix.value.length === 0) {
      push(errors, 'known v3 prefix requires a non-empty value including its dash')
    }
    return true
  }
  if (prefix.style === 'v4-variant') {
    if (!isString(prefix.value) || prefix.value.includes(':')) {
      push(errors, 'known v4 prefix must not contain ":"')
    }
    return true
  }
  push(errors, 'source.prefix.style is invalid')
  return false
}

const validateSource = (errors: string[], source: unknown): source is TokenSetSource => {
  if (!isRecord(source)) {
    push(errors, 'source must be an object')
    return false
  }
  if (source.major !== 3 && source.major !== 4) {
    push(errors, 'source.major must be 3 or 4')
  }
  if (!isString(source.entry)) {
    push(errors, 'source.entry must be a string')
  }
  validatePrefix(errors, source.prefix)
  if (!isRecord(source.corePlugins)) {
    push(errors, 'source.corePlugins is required')
  } else {
    const mode = source.corePlugins.mode
    if (
      mode !== 'all' &&
      mode !== 'denylist' &&
      mode !== 'allowlist' &&
      mode !== 'unknown'
    ) {
      push(errors, 'source.corePlugins.mode is invalid')
    }
    if (!Array.isArray(source.corePlugins.names) || !source.corePlugins.names.every(isString)) {
      push(errors, 'source.corePlugins.names must be string[]')
    }
  }
  if (typeof source.remBasePx !== 'number') {
    push(errors, 'source.remBasePx must be a number')
  }
  if (source.tailwindVersionEvidence !== null) {
    if (!isRecord(source.tailwindVersionEvidence)) {
      push(errors, 'source.tailwindVersionEvidence must be null or an object')
    } else {
      if (!isString(source.tailwindVersionEvidence.exact) || !isSemver(source.tailwindVersionEvidence.exact)) {
        push(errors, 'source.tailwindVersionEvidence.exact must be an exact semver')
      }
      if (
        source.tailwindVersionEvidence.source !== 'package-json' &&
        source.tailwindVersionEvidence.source !== 'cli-export'
      ) {
        push(errors, 'source.tailwindVersionEvidence.source is invalid')
      }
    }
  }
  if (!isRecord(source.defaults) || !isString(source.defaults.status)) {
    push(errors, 'source.defaults is required')
  } else if (source.defaults.status === 'confirmed') {
    if (!isString(source.defaults.version) || !isSemver(source.defaults.version)) {
      push(errors, 'confirmed defaults require an exact version')
    }
  } else if (source.defaults.status === 'unconfirmed') {
    if (!isString(source.defaults.reason)) {
      push(errors, 'unconfirmed defaults require a reason')
    }
  } else {
    push(errors, 'source.defaults.status is invalid')
  }
  return true
}

const NAMESPACE_MAP: Record<string, keyof TokenSet> = {
  colors: 'colors',
  spacing: 'spacing',
  radius: 'radius',
  fontSize: 'fontSize',
  fontFamily: 'fontFamily',
  fontWeight: 'fontWeight',
  lineHeight: 'lineHeight',
  letterSpacing: 'letterSpacing',
  boxShadow: 'boxShadow',
  borderWidth: 'borderWidth',
  opacity: 'opacity',
  breakpoints: 'breakpoints',
  zIndex: 'zIndex',
}

const namespaceIsEmpty = (tokens: TokenSet, ns: string): boolean => {
  if (ns === 'spacing') {
    return (
      tokens.spacing.base === null &&
      Object.keys(tokens.spacing.named).length === 0 &&
      Object.keys(tokens.spacing.scale).length === 0
    )
  }
  const key = NAMESPACE_MAP[ns]
  if (!key || key === 'spacing' || key === 'source' || key === 'schemaVersion' || key === 'generatedAt' || key === 'unsupported' || key === 'unknownNamespaces' || key === 'partialNamespaces') {
    return true
  }
  const value = tokens[key]
  return typeof value === 'object' && value !== null && Object.keys(value).length === 0
}

const validateTokenKeys = (errors: string[], map: Record<string, unknown>, label: string) => {
  for (const key of Object.keys(map)) {
    if (key.includes('.') || key.includes('/')) {
      push(errors, `${label} key "${key}" must use class-name form, not dotted or slashed`)
    }
  }
}

/** Validate an unknown value as a TokenSet. */
export const validateTokenSet = (
  value: unknown,
): { ok: true; value: TokenSet } | { ok: false; errors: string[] } => {
  const errors: string[] = []
  if (!isRecord(value)) {
    return { ok: false, errors: ['TokenSet must be an object'] }
  }
  if (value.schemaVersion !== TOKEN_SET_SCHEMA_VERSION) {
    push(errors, 'schemaVersion must be 1')
  }
  if (!isString(value.generatedAt)) {
    push(errors, 'generatedAt must be an ISO string')
  }
  validateSource(errors, value.source)

  if (!isRecord(value.colors)) {
    push(errors, 'colors must be an object')
  } else {
    validateTokenKeys(errors, value.colors, 'colors')
    for (const [key, token] of Object.entries(value.colors)) {
      validateColor(errors, `colors.${key}`, token)
    }
  }

  if (!isRecord(value.spacing)) {
    push(errors, 'spacing must be an object')
  } else {
    if (value.spacing.base !== null && !isString(value.spacing.base)) {
      push(errors, 'spacing.base must be string or null')
    }
    if (value.spacing.basePx !== null && typeof value.spacing.basePx !== 'number') {
      push(errors, 'spacing.basePx must be number or null')
    }
    if (!isRecord(value.spacing.named) || !isRecord(value.spacing.scale)) {
      push(errors, 'spacing.named and spacing.scale must be objects')
    } else {
      for (const [key, token] of Object.entries(value.spacing.named)) {
        validateLength(errors, `spacing.named.${key}`, token)
      }
      for (const [key, token] of Object.entries(value.spacing.scale)) {
        validateLength(errors, `spacing.scale.${key}`, token)
      }
    }
  }

  const lengthMaps: Array<[string, unknown]> = [
    ['radius', value.radius],
    ['lineHeight', value.lineHeight],
    ['letterSpacing', value.letterSpacing],
    ['borderWidth', value.borderWidth],
    ['breakpoints', value.breakpoints],
  ]
  for (const [label, map] of lengthMaps) {
    if (!isRecord(map)) {
      push(errors, `${label} must be an object`)
      continue
    }
    validateTokenKeys(errors, map, label)
    for (const [key, token] of Object.entries(map)) {
      validateLength(errors, `${label}.${key}`, token)
    }
  }

  if (!isRecord(value.fontSize)) {
    push(errors, 'fontSize must be an object')
  } else {
    validateTokenKeys(errors, value.fontSize, 'fontSize')
    for (const [key, token] of Object.entries(value.fontSize)) {
      validateFontSize(errors, `fontSize.${key}`, token)
    }
  }

  if (!isRecord(value.fontFamily)) {
    push(errors, 'fontFamily must be an object')
  } else {
    for (const [key, token] of Object.entries(value.fontFamily)) {
      validateFontFamily(errors, `fontFamily.${key}`, token)
    }
  }

  if (!isRecord(value.fontWeight)) {
    push(errors, 'fontWeight must be an object')
  } else {
    for (const [key, weight] of Object.entries(value.fontWeight)) {
      if (typeof weight !== 'number') {
        push(errors, `fontWeight.${key} must be a number`)
      }
    }
  }

  if (!isRecord(value.boxShadow)) {
    push(errors, 'boxShadow must be an object')
  } else {
    for (const [key, token] of Object.entries(value.boxShadow)) {
      if (!isRecord(token) || !isString(token.raw)) {
        push(errors, `boxShadow.${key}.raw must be a string`)
      }
    }
  }

  if (!isRecord(value.opacity)) {
    push(errors, 'opacity must be an object')
  } else {
    for (const [key, opacity] of Object.entries(value.opacity)) {
      if (typeof opacity !== 'number') {
        push(errors, `opacity.${key} must be a number`)
      }
    }
  }

  if (!isRecord(value.zIndex)) {
    push(errors, 'zIndex must be an object')
  } else {
    for (const [key, z] of Object.entries(value.zIndex)) {
      if (!isString(z)) {
        push(errors, `zIndex.${key} must be a string`)
      }
    }
  }

  if (!isRecord(value.unsupported)) {
    push(errors, 'unsupported must be an object')
  }
  if (!Array.isArray(value.unknownNamespaces) || !value.unknownNamespaces.every(isString)) {
    push(errors, 'unknownNamespaces must be string[]')
  }
  if (!Array.isArray(value.partialNamespaces) || !value.partialNamespaces.every(isString)) {
    push(errors, 'partialNamespaces must be string[]')
  }

  if (errors.length === 0) {
    const tokens = value as TokenSet
    for (const ns of tokens.unknownNamespaces) {
      if (!namespaceIsEmpty(tokens, ns)) {
        push(errors, `unknown namespace "${ns}" must be empty in token maps`)
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }
  return { ok: true, value: value as TokenSet }
}

const validateSourceMetadata = (
  errors: string[],
  path: string,
  value: unknown,
): value is SourceMetadata => {
  if (!isRecord(value)) {
    push(errors, `${path} must be an object`)
    return false
  }
  if (!isString(value.name) || !isRelativePath(value.name)) {
    push(errors, `${path}.name must be a relative path`)
  }
  if (!isString(value.sha256) || !isSha256(value.sha256)) {
    push(errors, `${path}.sha256 must be a 64-char hex digest`)
  }
  if (typeof value.byteLength !== 'number') {
    push(errors, `${path}.byteLength must be a number`)
  }
  return true
}

/** Validate ConfigProvenance used by storage and CLI. */
export const validateConfigProvenance = (
  value: unknown,
): { ok: true; value: ConfigProvenance } | { ok: false; errors: string[] } => {
  const errors: string[] = []
  if (!isRecord(value)) {
    return { ok: false, errors: ['ConfigProvenance must be an object'] }
  }
  if ('inputsSha256' in value || 'importProvenance' in value || 'tailwindVersion' in value) {
    push(errors, 'rejected alias fields; use inputSha256 / ConfigProvenance / targetTailwindVersion')
  }
  if (value.kind !== 'browser' && value.kind !== 'cli') {
    push(errors, 'kind must be browser or cli')
  }
  if (!Array.isArray(value.sources)) {
    push(errors, 'sources must be an array')
  } else {
    value.sources.forEach((source, index) => {
      validateSourceMetadata(errors, `sources[${index}]`, source)
    })
  }
  if (!isString(value.resolvedAt) || Number.isNaN(Date.parse(value.resolvedAt))) {
    push(errors, 'resolvedAt must be an ISO timestamp')
  }
  if (!isString(value.inputSha256) || !isSha256(value.inputSha256)) {
    push(errors, 'inputSha256 must be a 64-char hex digest')
  }
  if (value.kind === 'cli') {
    if (!isString(value.cliVersion) || !isSemver(value.cliVersion)) {
      push(errors, 'cliVersion must be exact semver')
    }
    if (!isString(value.targetTailwindVersion) || !isSemver(value.targetTailwindVersion)) {
      push(errors, 'targetTailwindVersion must be exact semver')
    }
    if (!isString(value.projectName) || !isBasename(value.projectName)) {
      push(errors, 'projectName must be a basename only')
    }
    if (!isString(value.entry) || !isRelativePath(value.entry)) {
      push(errors, 'entry must be a relative path')
    }
  }
  if (errors.length > 0) {
    return { ok: false, errors }
  }
  return { ok: true, value: value as ConfigProvenance }
}
