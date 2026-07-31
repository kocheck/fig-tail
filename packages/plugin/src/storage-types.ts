import type { ConfigProvenance, TokenSet, Unresolved } from '@fig-tail/theme'

/** Redacted diagnostic safe to persist and message across the iframe. */
export type PersistedDiagnostic = {
  path: string
  reason: Unresolved['reason']
  message: string
  source: string
  line?: number
}

/** Stored config payload — never includes raw Tailwind source. */
export type StoredConfig = {
  schemaVersion: 1
  tokens: TokenSet
  provenance: ConfigProvenance
  diagnostics: PersistedDiagnostic[]
  warnings: string[]
  savedAt: string
  documentId: string
}

/** Result of reading config across the 3-tier ladder. */
export type ReadConfigResult =
  | {
      tier: 1
      config: StoredConfig
      label: 'Using the config saved on this file'
    }
  | {
      tier: 2
      config: StoredConfig
      label: 'Using your personal config — this file has no shared one'
    }
  | {
      tier: 3
      config: null
      label: 'No Tailwind config — generic Tailwind syntax; project prefix/settings may require changes. Add your config for confirmed names.'
      reason?: 'missing' | 'corrupt' | 'read-failure'
    }

/** Result of writing config. */
export type WriteResult =
  | { ok: true; tier: 1 | 2; bytes: number; chunks: number }
  | { ok: false; error: string }
