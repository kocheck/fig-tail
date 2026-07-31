import type { Unresolved } from '@fig-tail/theme'
import type { PersistedDiagnostic } from '../storage-types'

/** Redact unresolved snippets before persistence or messaging. */
export const redactDiagnostics = (unresolved: Unresolved[]): PersistedDiagnostic[] =>
  unresolved.map((item) => {
    const diagnostic: PersistedDiagnostic = {
      path: item.path,
      reason: item.reason,
      message: item.message,
      source: item.source,
    }
    if (item.line !== undefined) {
      diagnostic.line = item.line
    }
    return diagnostic
  })
