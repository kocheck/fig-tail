import { proposeVariableToken } from '../lint/variables'
import { readConfig } from '../storage'
import type { StampApplyResult, StampDiffPayload } from '../shared/messages'
import { messageOf } from '../shared/errors'

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
 * Returns structured applied / skipped-with-reasons / failed (never throws for row skips).
 */
export const applyStamp = async (request: StampApplyRequest): Promise<StampApplyResult> => {
  if (figma.editorType !== 'figma') {
    return {
      applied: [],
      skipped: [],
      failed: [{ id: '', error: 'Stamp apply is design-editor only' }],
    }
  }
  const fresh = await prepareStampDiff()
  const applied: string[] = []
  const skipped: Array<{ id: string; reason: string }> = []
  const failed: Array<{ id: string; error: string }> = []
  const overwrite = new Set(request.overwriteIds)
  const freshById = new Map(fresh.changes.map((c) => [c.variableId, c]))

  for (const id of request.selectedIds) {
    const change = freshById.get(id)
    if (!change) {
      skipped.push({ id, reason: 'stale' })
      continue
    }
    if (change.status === 'conflict' || !change.to) {
      skipped.push({ id, reason: 'conflict' })
      continue
    }
    if (change.overwriteRequired && !overwrite.has(change.variableId)) {
      skipped.push({ id, reason: 'overwrite-required' })
      continue
    }
    const variable = await figma.variables.getVariableByIdAsync(change.variableId)
    if (!variable) {
      skipped.push({ id, reason: 'missing-variable' })
      continue
    }
    try {
      // Revalidate against live config value agreement is deferred to matcher;
      // we only stamp token keys that still appear in the fresh proposal set.
      variable.setVariableCodeSyntax('WEB', change.to)
      applied.push(change.variableId)
    } catch (error) {
      failed.push({ id: change.variableId, error: messageOf(error) })
    }
  }

  return { applied, skipped, failed }
}
