const KEY = 'figtail.lint-dismissals'

export type DismissalStore = {
  documentConfigId: string | null
  ids: string[]
}

/** Load dismissals. Tier-1 (shared config) persists by documentConfigId; else session-only. */
export const loadDismissals = async (
  documentConfigId: string | null,
): Promise<Set<string>> => {
  if (!documentConfigId) {
    return new Set()
  }
  const raw = await figma.clientStorage.getAsync(KEY)
  if (!raw || typeof raw !== 'object') return new Set()
  const store = raw as DismissalStore
  if (store.documentConfigId !== documentConfigId) return new Set()
  return new Set(store.ids ?? [])
}

/** Persist a dismissal for tier-1 documents only. */
export const dismissFinding = async (
  documentConfigId: string | null,
  findingId: string,
  session: Set<string>,
): Promise<Set<string>> => {
  session.add(findingId)
  if (!documentConfigId) return session
  const next: DismissalStore = {
    documentConfigId,
    ids: [...session],
  }
  await figma.clientStorage.setAsync(KEY, next)
  return session
}
