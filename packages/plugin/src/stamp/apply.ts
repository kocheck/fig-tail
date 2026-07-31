import { proposeVariableToken } from '../lint/variables'
import { readConfig } from '../storage'
import type { StampDiffPayload } from '../shared/messages'

export type StampApplyRequest = {
  selectedIds: string[]
  overwriteIds: string[]
}

/**
 * Build a dry-run stamp diff. Rows start unselected.
 * Conflict proposals are listed but cannot be selected for apply.
 */
export const prepareStampDiff = async (): Promise<StampDiffPayload> => {
  const config = await readConfig()
  const tokens = config.active?.config.tokens
  if (!tokens) {
    return { changes: [], canApply: false, editorType: figma.editorType }
  }
  const variables = await figma.variables.getLocalVariablesAsync()
  const changes: StampDiffPayload['changes'] = []
  for (const variable of variables) {
    const proposal = proposeVariableToken(
      {
        id: variable.id,
        name: variable.name,
        resolvedType: variable.resolvedType,
        codeSyntax: variable.codeSyntax,
      },
      tokens,
    )
    if (proposal.status === 'skipped' && !proposal.tokenKey) continue
    if (!proposal.tokenKey && proposal.status !== 'conflict') continue
    changes.push({
      variableId: variable.id,
      name: variable.name,
      from: proposal.existingWebSyntax,
      to: proposal.tokenKey ?? '',
      status: proposal.status,
      reason: proposal.reason,
      selected: false,
      overwriteRequired: Boolean(proposal.existingWebSyntax),
    })
  }
  return {
    changes,
    canApply: figma.editorType === 'figma' && changes.some((c) => c.status === 'high' || c.status === 'medium'),
    editorType: figma.editorType,
  }
}

/**
 * Apply selected stamp rows after re-reading config and revalidating.
 * Single write site for WEB code syntax — design editor only.
 */
export const applyStamp = async (request: StampApplyRequest): Promise<{ applied: number; skipped: number }> => {
  if (figma.editorType !== 'figma') {
    throw new Error('Stamp apply is design-editor only')
  }
  const fresh = await prepareStampDiff()
  let applied = 0
  let skipped = 0
  const selected = new Set(request.selectedIds)
  const overwrite = new Set(request.overwriteIds)

  for (const change of fresh.changes) {
    if (!selected.has(change.variableId)) {
      skipped += 1
      continue
    }
    if (change.status === 'conflict' || !change.to) {
      skipped += 1
      continue
    }
    if (change.overwriteRequired && !overwrite.has(change.variableId)) {
      skipped += 1
      continue
    }
    const variable = await figma.variables.getVariableByIdAsync(change.variableId)
    if (!variable) {
      skipped += 1
      continue
    }
    // Revalidate against live config value agreement is deferred to matcher;
    // we only stamp token keys that still appear in the fresh proposal set.
    variable.setVariableCodeSyntax('WEB', change.to)
    applied += 1
  }
  return { applied, skipped }
}
