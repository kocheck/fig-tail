import { resolveTheme, type ConfigProvenance, type SourceMetadata } from '@fig-tail/theme'
import { redactDiagnostics } from './shared/redact'
import type { PersistedDiagnostic } from './storage-types'

const sha256Browser = async (text: string): Promise<string> => {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const exactVersionFromPackageJson = (
  text: string | undefined,
): { exact: string; source: 'package-json' } | undefined => {
  if (!text) return undefined
  try {
    const pkg = JSON.parse(text) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const raw = pkg.dependencies?.tailwindcss ?? pkg.devDependencies?.tailwindcss
    if (!raw) return undefined
    if (/^\d+\.\d+\.\d+$/.test(raw)) {
      return { exact: raw, source: 'package-json' }
    }
    return undefined
  } catch {
    return undefined
  }
}

export type SetupResolveResult = {
  ok: boolean
  message: string
  tokens: ReturnType<typeof resolveTheme>['tokens']
  diagnostics: PersistedDiagnostic[]
  warnings: string[]
  provenance: ConfigProvenance | null
  canaryLeaked: boolean
}

/** Resolve pasted config in the UI iframe — never executes user code. */
export const resolveSetupInput = async (input: {
  configText: string
  configName: string
  packageJsonText?: string
  canary?: string
}): Promise<SetupResolveResult> => {
  const canary = input.canary ?? '__FIG_TAIL_SECRET_CANARY__'
  const version = exactVersionFromPackageJson(input.packageJsonText)
  const resolved = resolveTheme({
    sources: [{ name: input.configName, text: input.configText }],
    ...(version ? { tailwindVersion: version } : {}),
  })
  const diagnostics = redactDiagnostics(resolved.unresolved)
  const serialized = JSON.stringify({ diagnostics, warnings: resolved.warnings })
  const canaryLeaked = serialized.includes(canary) || diagnostics.some((d) => JSON.stringify(d).includes(canary))

  const sources: SourceMetadata[] = [
    {
      name: input.configName,
      sha256: await sha256Browser(input.configText),
      byteLength: new TextEncoder().encode(input.configText).length,
    },
  ]
  const inputSha256 = await sha256Browser(sources.map((s) => s.sha256).join(':'))
  const provenance: ConfigProvenance = {
    kind: 'browser',
    sources,
    resolvedAt: new Date().toISOString(),
    inputSha256,
  }

  if (!resolved.ok || !resolved.tokens) {
    return {
      ok: false,
      message: resolved.unresolved[0]?.message ?? 'Could not resolve config',
      tokens: null,
      diagnostics,
      warnings: resolved.warnings,
      provenance,
      canaryLeaked,
    }
  }

  const details: string[] = []
  if (resolved.tokens.source.defaults.status === 'confirmed') {
    details.push(`Bundled defaults confirmed for ${resolved.tokens.source.defaults.version}`)
  } else {
    details.push(`Defaults unconfirmed (${resolved.tokens.source.defaults.reason})`)
  }
  if (resolved.tokens.unknownNamespaces.length) {
    details.push(`Unknown namespaces: ${resolved.tokens.unknownNamespaces.join(', ')}`)
  }
  if (diagnostics.length) {
    details.push(`${diagnostics.length} settings could not be read`)
  }

  return {
    ok: true,
    message: details.join(' · '),
    tokens: resolved.tokens,
    diagnostics,
    warnings: resolved.warnings,
    provenance,
    canaryLeaked,
  }
}
