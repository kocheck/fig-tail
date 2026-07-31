import { readConfig } from '../storage'
import type { StampDiffPayload } from '../shared/messages'

type Pending = { variableId: string; tokenKey: string; name: string; from: string | null }

let pending: Pending[] = []

/** Build a dry-run stamp diff from local variables vs token keys. */
export const prepareStampDiff = async (): Promise<StampDiffPayload> => {
  const config = await readConfig()
  const tokens = config.config?.tokens
  if (!tokens) {
    return { changes: [], canApply: false }
  }
  const variables = await figma.variables.getLocalVariablesAsync()
  pending = []
  const changes: StampDiffPayload['changes'] = []
  for (const variable of variables) {
    if (variable.resolvedType !== 'COLOR' && variable.resolvedType !== 'FLOAT') continue
    const tokenKey = variable.name.replace(/\//g, '-')
    if (!tokens.colors[tokenKey] && !tokens.spacing.scale[tokenKey] && !tokens.spacing.named[tokenKey]) {
      continue
    }
    const from = variable.codeSyntax.WEB ?? null
    if (from === tokenKey) continue
    pending.push({ variableId: variable.id, tokenKey, name: variable.name, from })
    changes.push({ variableId: variable.id, name: variable.name, from, to: tokenKey })
  }
  return {
    changes,
    canApply: figma.editorType === 'figma' && changes.length > 0,
  }
}

/** Apply previously prepared stamp diff after revalidation in design mode. */
export const applyStamp = async (): Promise<void> => {
  if (figma.editorType !== 'figma') {
    throw new Error('Stamp apply is design-editor only')
  }
  const fresh = await prepareStampDiff()
  if (!fresh.canApply) return
  for (const change of fresh.changes) {
    const variable = await figma.variables.getVariableByIdAsync(change.variableId)
    if (!variable) continue
    variable.setVariableCodeSyntax('WEB', change.to)
  }
  pending = []
}
