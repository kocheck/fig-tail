import type { VariableHint } from '@fig-tail/match'

/** Single-alias `boundVariables` fields (Figma's `VariableBindableNodeField`). */
type ScalarBoundVariables = {
  itemSpacing?: { id: string }
  paddingLeft?: { id: string }
  paddingRight?: { id: string }
  paddingTop?: { id: string }
  paddingBottom?: { id: string }
  topLeftRadius?: { id: string }
  topRightRadius?: { id: string }
  bottomLeftRadius?: { id: string }
  bottomRightRadius?: { id: string }
  strokeWeight?: { id: string }
}

/** Per-paint/array-alias `boundVariables` fields (fills/strokes/`VariableBindableTextField`). */
type ArrayBoundVariables = {
  fills?: Array<{ id: string }>
  strokes?: Array<{ id: string }>
  fontSize?: Array<{ id: string }>
}

type NodeBoundVariables = ScalarBoundVariables & ArrayBoundVariables

/** Single-alias fields mapped straight to a CSS property. */
const SCALAR_FIELD_TO_PROPERTY: Record<keyof ScalarBoundVariables, string> = {
  itemSpacing: 'gap',
  paddingLeft: 'padding-left',
  paddingRight: 'padding-right',
  paddingTop: 'padding-top',
  paddingBottom: 'padding-bottom',
  topLeftRadius: 'border-top-left-radius',
  topRightRadius: 'border-top-right-radius',
  bottomLeftRadius: 'border-bottom-left-radius',
  bottomRightRadius: 'border-bottom-right-radius',
  strokeWeight: 'border-width',
}

const SCALAR_FIELDS = Object.keys(SCALAR_FIELD_TO_PROPERTY) as Array<keyof ScalarBoundVariables>

/** Resolve a variable by id, using and populating `cache` when provided. */
const resolveVariable = (id: string, cache?: Map<string, Variable | null>): Variable | null => {
  if (cache?.has(id)) {
    return cache.get(id) ?? null
  }
  let variable: Variable | null = null
  try {
    variable = figma.variables.getVariableById(id)
  } catch {
    // Variable may be from an unavailable library — fall through to value matching.
    variable = null
  }
  cache?.set(id, variable)
  return variable
}

const hintFromVariable = (variable: Variable): VariableHint => {
  const hint: VariableHint = { variableId: variable.id, name: variable.name }
  if (variable.codeSyntax.WEB) {
    hint.codeSyntax = variable.codeSyntax.WEB
  }
  return hint
}

/**
 * Collect variable hints from a node's `boundVariables` for colour, border,
 * spacing, radius, and font-size bindings. Deduplicates variable lookups via
 * the optional `varCache`, which callers sharing one resolution operation
 * (see `pipeline.ts`) should pass so repeated bindings to the same variable
 * cost exactly one lookup.
 */
export const collectHints = (
  node: SceneNode,
  varCache?: Map<string, Variable | null>,
): Record<string, VariableHint> => {
  const hints: Record<string, VariableHint> = {}
  if (!('boundVariables' in node) || !node.boundVariables) {
    return hints
  }
  const bound = node.boundVariables as NodeBoundVariables

  const fillAlias = bound.fills?.[0]
  if (fillAlias?.id) {
    const variable = resolveVariable(fillAlias.id, varCache)
    if (variable) {
      const hint = hintFromVariable(variable)
      if (node.type === 'TEXT') {
        hints.color = hint
      } else {
        hints['background-color'] = hint
      }
    }
  }

  const strokeAlias = bound.strokes?.[0]
  if (strokeAlias?.id) {
    const variable = resolveVariable(strokeAlias.id, varCache)
    if (variable) {
      hints['border-color'] = hintFromVariable(variable)
    }
  }

  const fontSizeAlias = bound.fontSize?.[0]
  if (fontSizeAlias?.id) {
    const variable = resolveVariable(fontSizeAlias.id, varCache)
    if (variable) {
      hints['font-size'] = hintFromVariable(variable)
    }
  }

  for (const field of SCALAR_FIELDS) {
    const alias = bound[field]
    if (!alias?.id) continue
    const variable = resolveVariable(alias.id, varCache)
    if (!variable) continue
    const property = SCALAR_FIELD_TO_PROPERTY[field]
    if (property) {
      hints[property] = hintFromVariable(variable)
    }
  }

  return hints
}
