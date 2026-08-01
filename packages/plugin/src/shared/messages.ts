import type { ConfigProvenance, TokenSet } from '@fig-tail/theme'
import type { PersistedDiagnostic, StorageFailure, WriteResult } from '../storage-types'

/** Sandbox ↔ UI message contract. */
export type PluginMessage =
  | { type: 'ready' }
  | { type: 'open-setup' }
  | { type: 'setup-state'; state: SetupUiState }
  | {
      type: 'save-resolved'
      target: 'document' | 'user'
      tokens: TokenSet
      provenance: ConfigProvenance
      diagnostics: PersistedDiagnostic[]
      warnings: string[]
    }
  | {
      type: 'resolve-result'
      ok: boolean
      message: string
      reason?: Extract<WriteResult, { ok: false }>['reason']
    }
  | { type: 'operation-error'; operation: string; message: string }
  | { type: 'remove-config'; target: 'document' | 'user' }
  | { type: 'prefer-source'; preferred: 'document' | 'user' }
  | { type: 'inspect-result'; payload: InspectPayload }
  | { type: 'run-lint' }
  | { type: 'lint-result'; payload: LintPayload }
  | { type: 'export-subtree'; format?: 'html' | 'jsx' | 'outline' }
  | { type: 'export-result'; code: string }
  | { type: 'stamp-prepare' }
  | { type: 'stamp-diff'; payload: StampDiffPayload }
  | { type: 'stamp-apply'; selectedIds: string[]; overwriteIds: string[] }
  | { type: 'stamp-result'; payload: StampApplyResult }

/** Setup UI state machine. */
export type SetupUiState =
  | { kind: 'empty'; storageFailures?: StorageFailure[] }
  | { kind: 'loading' }
  | {
      kind: 'configured'
      label: string
      tier: 'document' | 'user'
      details: string[]
      warnings: string[]
      available: { document: boolean; user: boolean }
      preferred: 'document' | 'user'
      overridden: boolean
      canWriteDocument: boolean
      storageFailures?: StorageFailure[]
    }
  | { kind: 'error'; message: string }
  | {
      kind: 'no-edit'
      label: string
      details: string[]
      available: { document: boolean; user: boolean }
    }
  | {
      kind: 'write-warn'
      label: string
      details: string[]
    }

/** Inspect panel payload. */
export type InspectPayload = {
  className: string
  warnings: string[]
  results: Array<{ property: string; className: string | null; confidence: string; note?: string }>
  tierLabel: string
  activeTier?: 'document' | 'user' | null
  unknownNamespaces?: string[]
  partialNamespaces?: string[]
  storageFailures?: StorageFailure[]
  selectionCount: number
  empty: boolean
}

/** Drift lint payload. */
export type LintPayload = {
  findings: Array<{
    id: string
    kind: string
    severity: string
    nodeIds: string[]
    nodeName: string
    nodeNames: string[]
    property: string
    note: string
    nearest?: string
    distance?: number
  }>
  truncated: boolean
  markdown: string
  visited: number
  durationMs: number
  resolutionFailures: number
}

/** Stamp dry-run diff. */
export type StampDiffPayload = {
  changes: Array<{
    variableId: string
    name: string
    from: string | null
    to: string
    status: 'high' | 'medium' | 'conflict' | 'skipped'
    reason: string
    selected: boolean
    overwriteRequired: boolean
  }>
  canApply: boolean
  editorType: string
}

/** Stamp apply outcome with per-row skip/fail reasons. */
export type StampApplyResult = {
  applied: string[]
  skipped: Array<{ id: string; reason: string }>
  failed: Array<{ id: string; error: string }>
}
