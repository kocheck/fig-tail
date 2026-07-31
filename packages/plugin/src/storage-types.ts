import type { ConfigProvenance, TokenSet } from '@fig-tail/theme'

/**
 * Redacted diagnostic safe to persist and message across the iframe.
 * `reason` widens `Unresolved['reason']` from `@fig-tail/theme` to `string` for
 * storage; `snippet` is a compile-time guard proving raw resolver snippets
 * never cross the iframe boundary or land in persisted storage.
 */
export type PersistedDiagnostic = {
  path: string
  reason: string
  message: string
  source: string
  line?: number
  snippet?: never
}

/** Stored config payload — never includes raw Tailwind source. */
export type StoredConfig = {
  formatVersion: 1
  tokens: TokenSet
  resolution: { unresolved: PersistedDiagnostic[]; warnings: string[] }
  provenance: ConfigProvenance
  storedAt: string
  documentConfigId: string
}

/** One typed, non-throwing read failure for a single storage tier. */
export type StorageFailure = {
  tier: 'document' | 'user'
  reason:
    | 'missing'
    | 'no-access'
    | 'invalid-meta'
    | 'missing-chunk'
    | 'checksum'
    | 'decompress'
    | 'parse'
    | 'schema'
  detail: string
}

/** Result of reading config across the two-tier ladder. Never throws. */
export type ReadConfigResult = {
  active: null | {
    config: StoredConfig
    tier: 'document' | 'user'
    documentConfigId: string | null
  }
  available: { document: boolean; user: boolean }
  preferred: 'document' | 'user'
  overridden: boolean
  failures: StorageFailure[]
  /** Convenience label for UI/codegen */
  label: string
}

/** Result of writing or clearing config for one tier. */
export type WriteResult =
  | { ok: true; writtenTo: 'document' | 'user'; documentConfigId: string | null }
  | {
      ok: false
      writtenTo: null
      reason: 'no-edit-access' | 'validation' | 'quota' | 'write-failed'
      needsPersonalConfirmation: boolean
      errors: string[]
    }
