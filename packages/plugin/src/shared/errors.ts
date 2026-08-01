import type { StorageFailure, WriteResult } from '../storage-types'

/** Failures that matter to the user — pure `missing` is the normal empty tier. */
export const meaningfulStorageFailures = (failures: StorageFailure[]): StorageFailure[] =>
  failures.filter((failure) => failure.reason !== 'missing')

/** Human-readable line for one storage failure. */
export const formatStorageFailure = (failure: StorageFailure): string => {
  const tier = failure.tier === 'document' ? 'Shared' : 'Personal'
  switch (failure.reason) {
    case 'checksum':
    case 'decompress':
    case 'parse':
    case 'schema':
    case 'invalid-meta':
    case 'missing-chunk':
      return `${tier} config unreadable (${failure.reason})`
    case 'no-access':
      return `${tier} config unavailable (no access)`
    default:
      return failure.detail || `${tier} config unavailable`
  }
}

/**
 * Banner lines for storage degradation. When a lower tier is active after a
 * corrupt higher tier, state the fallback plainly.
 */
export const storageFailureMessages = (
  failures: StorageFailure[],
  activeTier: 'document' | 'user' | null,
): string[] => {
  const meaningful = meaningfulStorageFailures(failures)
  if (meaningful.length === 0) return []

  const documentFail = meaningful.find((f) => f.tier === 'document')
  const userFail = meaningful.find((f) => f.tier === 'user')

  if (documentFail && activeTier === 'user') {
    const messages = [`Shared config unreadable (${documentFail.reason}) — using personal`]
    if (userFail) {
      // Unusual: active is user but user also has a failure entry — surface it.
      messages.push(formatStorageFailure(userFail))
    }
    return messages
  }

  return meaningful.map(formatStorageFailure)
}

export type WriteFailureReason = Extract<WriteResult, { ok: false }>['reason']

/** Map write/clear failure reason to setup banner severity. */
export const writeFailureSeverity = (
  reason: WriteFailureReason,
): 'danger' | 'warn' | 'no-edit' => {
  if (reason === 'no-edit-access') return 'no-edit'
  if (reason === 'quota') return 'warn'
  return 'danger'
}

export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
