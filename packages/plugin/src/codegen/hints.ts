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

/** Array-alias fields mapped to a CSS property. `fills` becomes `color` on TEXT nodes. */
const ARRAY_FIELD_TO_PROPERTY: Record<keyof ArrayBoundVariables, string> = {
  fills: 'background-color',
  strokes: 'border-color',
  fontSize: 'font-size',
}

/**
 * Resolve a variable by id, using and populating `cache` when provided.
 *
 * `getVariableByIdAsync` is required under `documentAccess: "dynamic-page"` —
 * the synchronous getter throws there, and a swallowed throw silently disables
 * every variable hint. The cache holds the *promise*, so concurrent workers
 * sharing one context (`pipeline.ts`) collapse to a single lookup per id. The
 * `.catch` is attached before caching, both to keep a failed lookup cached as
 * `null` rather than retried and so a failure can never escape to a caller.
 * The call is wrapped in `Promise.resolve().then` so a *synchronous* throw
 * (a malformed id, or `figma.variables` missing) becomes a rejection too and
 * still degrades to value matching, rather than failing the whole node.
 */
const resolveVariable = (
  id: string,
  cache?: Map<string, Promise<Variable | null>>,
): Promise<Variable | null> => {
  const cached = cache?.get(id)
  if (cached) return cached
  const pending = Promise.resolve()
    .then(() => figma.variables.getVariableByIdAsync(id))
    .catch(() => null)
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

  // Every binding is looked up concurrently: a node with a dozen bound
  // variables would otherwise cost a dozen serial round-trips against the 3s
  // codegen budget. The promise cache keeps duplicate ids to one lookup.
  await Promise.all([
    ...(Object.entries(ARRAY_FIELD_TO_PROPERTY) as Array<[keyof ArrayBoundVariables, string]>).map(
      async ([field, property]) => {
        const alias = bound[field]?.[0]
        if (!alias?.id) return
        const variable = await resolveVariable(alias.id, varCache)
        if (!variable) return
        hints[field === 'fills' && node.type === 'TEXT' ? 'color' : property] =
          hintFromVariable(variable)
      },
    ),
    ...(Object.entries(SCALAR_FIELD_TO_PROPERTY) as Array<[keyof ScalarBoundVariables, string]>).map(
      async ([field, property]) => {
        const alias = bound[field]
        if (!alias?.id) return
        const variable = await resolveVariable(alias.id, varCache)
        if (!variable) return
        hints[property] = hintFromVariable(variable)
      },
    ),
  ])

  return hints
}
