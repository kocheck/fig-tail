/** Sandbox ↔ UI message contract. */
export type PluginMessage =
  | { type: 'ready' }
  | { type: 'open-setup' }
  | { type: 'setup-state'; state: SetupUiState }
  | { type: 'resolve-config'; configText: string; configName: string; packageJsonText?: string }
  | { type: 'resolve-result'; ok: boolean; message: string }
  | { type: 'save-config'; tier: 1 | 2 }
  | { type: 'remove-config'; tier: 1 | 2 }
  | { type: 'inspect-result'; payload: InspectPayload }
  | { type: 'run-lint' }
  | { type: 'lint-result'; payload: LintPayload }
  | { type: 'export-subtree' }
  | { type: 'export-result'; code: string }
  | { type: 'stamp-prepare' }
  | { type: 'stamp-diff'; payload: StampDiffPayload }
  | { type: 'stamp-apply' }

/** Setup UI state machine. */
export type SetupUiState =
  | { kind: 'empty' }
  | { kind: 'loading' }
  | { kind: 'ready'; label: string; details: string[]; canWriteDocument: boolean }
  | { kind: 'partial'; label: string; details: string[]; warnings: string[]; canWriteDocument: boolean }
  | { kind: 'error'; message: string }
  | { kind: 'no-edit'; label: string; details: string[] }

/** Inspect panel payload. */
export type InspectPayload = {
  className: string
  warnings: string[]
  results: Array<{ property: string; className: string | null; confidence: string; note?: string }>
  tierLabel: string
}

/** Drift lint payload. */
export type LintPayload = {
  findings: Array<{ nodeName: string; property: string; note: string; nearest?: string }>
  truncated: boolean
}

/** Stamp dry-run diff. */
export type StampDiffPayload = {
  changes: Array<{ variableId: string; name: string; from: string | null; to: string }>
  canApply: boolean
}
