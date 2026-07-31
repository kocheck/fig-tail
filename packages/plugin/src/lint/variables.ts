import type { TokenSet } from '@fig-tail/theme'
import type { VariableProposal } from './types'

const toTokenKey = (name: string): string => name.replace(/\//g, '-')

/**
 * Propose a reusable token key for a Figma variable.
 * Never invents property-specific utilities — only token keys like `brand-500`.
 */
export const proposeVariableToken = (
  variable: {
    id: string
    name: string
    resolvedType: string
    codeSyntax: { WEB?: string }
  },
  tokens: TokenSet,
): VariableProposal => {
  const existing = variable.codeSyntax.WEB ?? null
  const nameKey = toTokenKey(variable.name)

  const inColors = Boolean(tokens.colors[nameKey])
  const inSpacing =
    Boolean(tokens.spacing.scale[nameKey]) || Boolean(tokens.spacing.named[nameKey])
  const inRadius = Boolean(tokens.radius[nameKey])
  const known = inColors || inSpacing || inRadius

  if (existing) {
    const existingKnown =
      Boolean(tokens.colors[existing]) ||
      Boolean(tokens.spacing.scale[existing]) ||
      Boolean(tokens.spacing.named[existing]) ||
      Boolean(tokens.radius[existing])
    if (existingKnown && existing === nameKey) {
      return {
        variableId: variable.id,
        variableName: variable.name,
        tokenKey: null,
        status: 'skipped',
        reason: 'Already stamped with a valid matching token key',
        evidence: 'code-syntax',
        existingWebSyntax: existing,
      }
    }
    if (existingKnown && known && existing !== nameKey) {
      return {
        variableId: variable.id,
        variableName: variable.name,
        tokenKey: null,
        status: 'conflict',
        reason: `Existing WEB syntax ${existing} conflicts with name-derived ${nameKey}`,
        evidence: 'code-syntax',
        existingWebSyntax: existing,
      }
    }
    if (!existingKnown) {
      return {
        variableId: variable.id,
        variableName: variable.name,
        tokenKey: known ? nameKey : null,
        status: known ? 'medium' : 'skipped',
        reason: known
          ? 'Existing WEB syntax is stale; name matches a token'
          : 'Existing WEB syntax is stale and name does not match a token',
        evidence: known ? 'name' : 'none',
        existingWebSyntax: existing,
      }
    }
  }

  if (!known) {
    return {
      variableId: variable.id,
      variableName: variable.name,
      tokenKey: null,
      status: 'skipped',
      reason: 'No matching token key in the resolved theme',
      evidence: 'none',
      existingWebSyntax: existing,
    }
  }

  if (variable.resolvedType !== 'COLOR' && variable.resolvedType !== 'FLOAT') {
    return {
      variableId: variable.id,
      variableName: variable.name,
      tokenKey: null,
      status: 'skipped',
      reason: `Unsupported variable type ${variable.resolvedType}`,
      evidence: 'none',
      existingWebSyntax: existing,
    }
  }

  return {
    variableId: variable.id,
    variableName: variable.name,
    tokenKey: nameKey,
    status: 'high',
    reason: 'Name maps to a configured token key',
    evidence: 'name',
    existingWebSyntax: existing,
  }
}

/** Build proposals for all local colour/float variables. */
export const proposeAllVariables = async (tokens: TokenSet): Promise<VariableProposal[]> => {
  const variables = await figma.variables.getLocalVariablesAsync()
  return variables
    .filter((v) => v.resolvedType === 'COLOR' || v.resolvedType === 'FLOAT')
    .map((v) =>
      proposeVariableToken(
        {
          id: v.id,
          name: v.name,
          resolvedType: v.resolvedType,
          codeSyntax: v.codeSyntax,
        },
        tokens,
      ),
    )
}
