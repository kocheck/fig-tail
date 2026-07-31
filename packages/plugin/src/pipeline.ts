import { matchDeclarations, summarise, toClassName, type MatchResult, type VariableHint } from '@fig-tail/match'
import type { TokenSet } from '@fig-tail/theme'
import type { ReadConfigResult } from './storage-types'

export type PipelineInput = {
  css: Record<string, string>
  hints?: Record<string, VariableHint>
  config: ReadConfigResult
}

export type PipelineOutput = {
  results: MatchResult[]
  className: string
  warnings: string[]
  tierLabel: string
  tokens: TokenSet | null
}

/** Shared node → class pipeline used by codegen and inspect. */
export const runPipeline = (input: PipelineInput): PipelineOutput => {
  const tokens = input.config.config?.tokens ?? null
  const results = matchDeclarations(input.css, {
    tokens,
    ...(input.hints ? { hints: input.hints } : {}),
  })
  const summary = summarise(results, input.config.tier !== 3)
  const warnings = [...summary.warnings]
  if (input.config.config?.diagnostics.length) {
    warnings.push(
      `${input.config.config.diagnostics.length} settings in your config could not be read`,
    )
  }
  if (tokens?.unknownNamespaces.includes('colors')) {
    warnings.push('fig-tail could not read your colours; showing raw values for them')
  }
  return {
    results,
    className: toClassName(results),
    warnings: [...new Set(warnings)],
    tierLabel: input.config.label,
    tokens,
  }
}

/** Collect variable hints from a node for colour/spacing bindings. */
export const collectHints = (node: SceneNode): Record<string, VariableHint> => {
  const hints: Record<string, VariableHint> = {}
  if (!('boundVariables' in node) || !node.boundVariables) {
    return hints
  }
  const bound = node.boundVariables as {
    fills?: Array<{ id: string }>
  }
  const fill = bound.fills?.[0]
  if (!fill?.id) {
    return hints
  }
  try {
    const variable = figma.variables.getVariableById(fill.id)
    if (!variable) {
      return hints
    }
    const hint: VariableHint = {
      variableId: variable.id,
      name: variable.name,
    }
    if (variable.codeSyntax.WEB) {
      hint.codeSyntax = variable.codeSyntax.WEB
    }
    hints['background-color'] = hint
    hints.color = hint
  } catch {
    // Variable may be from an unavailable library — fall through to value matching.
  }
  return hints
}
