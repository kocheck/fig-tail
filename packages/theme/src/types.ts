/** Schema version for TokenSet persistence. */
export const TOKEN_SET_SCHEMA_VERSION = 1 as const

/** One named config/CSS source passed to the resolver. */
export type ResolveSource = {
  name: string
  text: string
}

/** Exact Tailwind version evidence from package.json or CLI export. */
export type TailwindVersionEvidence = {
  exact: string
  source: 'package-json' | 'cli-export'
}

/** Resolver input contract shared by plugin and CLI. */
export type ResolveInput = {
  sources: ResolveSource[]
  flavour?: 'v3' | 'v4'
  tailwindVersion?: TailwindVersionEvidence
  options?: { pruneDefaults?: boolean; remBasePx?: number }
}

/** Hash metadata for one input source file. */
export type SourceMetadata = {
  name: string
  sha256: string
  byteLength: number
}

/** How a token set was produced — shared by storage and CLI. */
export type ConfigProvenance =
  | {
      kind: 'browser'
      sources: SourceMetadata[]
      resolvedAt: string
      inputSha256: string
    }
  | {
      kind: 'cli'
      sources: SourceMetadata[]
      resolvedAt: string
      inputSha256: string
      cliVersion: string
      targetTailwindVersion: string
      projectName: string
      entry: string
    }

/** A config construct the static evaluator could not resolve. */
export type Unresolved = {
  path: string
  reason:
    | 'function-value'
    | 'unknown-module'
    | 'preset'
    | 'dynamic-expression'
    | 'parse-error'
    | 'missing-import'
    | 'unsupported-syntax'
  snippet: string
  source: string
  line?: number
  message: string
}

/** Result of resolveTheme — never throws. */
export type ResolveResult = {
  ok: boolean
  tokens: TokenSet | null
  unresolved: Unresolved[]
  warnings: string[]
}

/** Canonical sRGB colour token. */
export type ColorToken = {
  hex: string
  rgb: [number, number, number]
  alpha: number
  raw?: string
}

/** Length token with raw CSS and optional px. */
export type LengthToken = {
  raw: string
  px: number | null
}

/** Font-size token, optionally paired with line-height. */
export type FontSizeToken = LengthToken & {
  lineHeight?: LengthToken
}

/** Font-family token. */
export type FontFamilyToken = {
  stack: string[]
  primary: string
}

/** Prefix status for class emission. */
export type PrefixStatus =
  | { status: 'none' }
  | { status: 'known'; style: 'v3-string'; value: string }
  | { status: 'known'; style: 'v4-variant'; value: string }
  | { status: 'unknown' }

/** Core-plugin availability for utility suppression. */
export type CorePluginsStatus = {
  mode: 'all' | 'denylist' | 'allowlist' | 'unknown'
  names: string[]
}

/** Bundled-default merge status. */
export type DefaultsStatus =
  | { status: 'confirmed'; version: string }
  | { status: 'unconfirmed'; reason: string }

/** TokenSet source metadata. */
export type TokenSetSource = {
  major: 3 | 4
  entry: string
  prefix: PrefixStatus
  corePlugins: CorePluginsStatus
  remBasePx: number
  tailwindVersionEvidence: TailwindVersionEvidence | null
  defaults: DefaultsStatus
}

/** Spacing namespace (v3 scale and/or v4 multiplier). */
export type SpacingTokens = {
  base: string | null
  basePx: number | null
  named: Record<string, LengthToken>
  scale: Record<string, LengthToken>
}

/** Resolved Tailwind theme as plain JSON. */
export type TokenSet = {
  schemaVersion: typeof TOKEN_SET_SCHEMA_VERSION
  generatedAt: string
  source: TokenSetSource
  colors: Record<string, ColorToken>
  spacing: SpacingTokens
  radius: Record<string, LengthToken>
  fontSize: Record<string, FontSizeToken>
  fontFamily: Record<string, FontFamilyToken>
  fontWeight: Record<string, number>
  lineHeight: Record<string, LengthToken>
  letterSpacing: Record<string, LengthToken>
  boxShadow: Record<string, { raw: string }>
  borderWidth: Record<string, LengthToken>
  opacity: Record<string, number>
  breakpoints: Record<string, LengthToken>
  zIndex: Record<string, string>
  unsupported: Record<string, number>
  unknownNamespaces: string[]
  partialNamespaces: string[]
}

/** Empty spacing scaffold. */
export const emptySpacing = (): SpacingTokens => ({
  base: null,
  basePx: null,
  named: {},
  scale: {},
})
