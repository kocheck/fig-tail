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

/**
 * Resolve a variable by id, using and populating `cache` when provided.
 *
 * `getVariableByIdAsync` is required under `documentAccess: "dynamic-page"` —
 * the synchronous getter throws there, and a swallowed throw silently disables
 * every variable hint. The cache holds the *promise*, so concurrent workers
 * sharing one context (`pipeline.ts`) collapse to a single lookup per id. The
 * `.catch` is attached before caching, both to keep a failed lookup cached as
 * `null` rather than retried and so a rejection can never escape to a caller.
 */
const resolveVariable = (
  id: string,
  cache?: Map<string, Promise<Variable | null>>,
): Promise<Variable | null> => {
  const cached = cache?.get(id)
  if (cached) return cached
  // A variable from an unavailable library resolves to null and falls through
  // to value matching, exactly as before.
  const pending = figma.variables.getVariableByIdAsync(id).catch(() => null)
  cache?.set(id, pending)
  return pending
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
export const collectHints = async (
  node: SceneNode,
  varCache?: Map<string, Promise<Variable | null>>,
): Promise<Record<string, VariableHint>> => {
  const hints: Record<string, VariableHint> = {}
  if (!('boundVariables' in node) || !node.boundVariables) {
    return hints
  }
  const bound = node.boundVariables as NodeBoundVariables

  const fillAlias = bound.fills?.[0]
  if (fillAlias?.id) {
    const variable = await resolveVariable(fillAlias.id, varCache)
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
    const variable = await resolveVariable(strokeAlias.id, varCache)
    if (variable) {
      hints['border-color'] = hintFromVariable(variable)
    }
  }

  const fontSizeAlias = bound.fontSize?.[0]
  if (fontSizeAlias?.id) {
    const variable = await resolveVariable(fontSizeAlias.id, varCache)
    if (variable) {
      hints['font-size'] = hintFromVariable(variable)
    }
  }

  for (const field of SCALAR_FIELDS) {
    const alias = bound[field]
    if (!alias?.id) continue
    const variable = await resolveVariable(alias.id, varCache)
    if (!variable) continue
    const property = SCALAR_FIELD_TO_PROPERTY[field]
    if (property) {
      hints[property] = hintFromVariable(variable)
    }
  }

  return hints
}
