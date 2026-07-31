import { matchDeclarations, summarise, toClassName, type MatchResult, type VariableHint } from '@fig-tail/match'
import type { TokenSet } from '@fig-tail/theme'
import { collectHints } from './codegen/hints'
import { readConfig } from './storage'
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
  const tokens = input.config.active?.config.tokens ?? null
  const results = matchDeclarations(input.css, {
    tokens,
    ...(input.hints ? { hints: input.hints } : {}),
  })
  const summary = summarise(results, input.config.active !== null)
  const warnings = [...summary.warnings]
  const unresolved = input.config.active?.config.resolution.unresolved ?? []
  if (unresolved.length) {
    warnings.push(`${unresolved.length} settings in your config could not be read`)
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

// ---------------------------------------------------------------------------
// Bounded, cached multi-node resolution — shared by codegen and inspect so
// neither surface re-reads storage or re-fetches CSS/variables independently.
// ---------------------------------------------------------------------------

const DEFAULT_DEADLINE_MS = 2000
const DEFAULT_MAX_IN_FLIGHT = 8

export type ResolutionContext = {
  /** Loaded once per context, shared across every node it resolves. */
  config: ReadConfigResult
  deadlineMs: number
  signal?: { cancelled: boolean }
  /** Bounded worker count; never an unbounded `Promise.all`. */
  maxInFlight: number
  cssCache: Map<string, Record<string, string>>
  varCache: Map<string, Variable | null>
}

/** Stable resolution failure codes — consumers must not string-compare free text. */
export const ResolutionError = {
  NODE_NOT_FOUND: 'node-not-found',
  DEADLINE_EXCEEDED: 'deadline-exceeded',
  RESOLVE_FAILED: 'resolve-failed',
} as const

export type ResolutionErrorCode = (typeof ResolutionError)[keyof typeof ResolutionError]

/** One node's resolution outcome — `output` is `null` only when `error` is set. */
export type ResolvedNode = {
  nodeId: string
  output: PipelineOutput | null
  error?: ResolutionErrorCode
  detail?: string
}

/** Create a resolution context. Reads storage exactly once for the whole operation. */
export const createResolutionContext = async (opts?: {
  deadlineMs?: number
  signal?: { cancelled: boolean }
  maxInFlight?: number
}): Promise<ResolutionContext> => ({
  config: await readConfig(),
  deadlineMs: opts?.deadlineMs ?? DEFAULT_DEADLINE_MS,
  ...(opts?.signal ? { signal: opts.signal } : {}),
  maxInFlight: opts?.maxInFlight ?? DEFAULT_MAX_IN_FLIGHT,
  cssCache: new Map(),
  varCache: new Map(),
})

const getCachedCss = async (
  node: BaseNode,
  ctx: ResolutionContext,
): Promise<Record<string, string>> => {
  const cached = ctx.cssCache.get(node.id)
  if (cached) return cached
  if (!('getCSSAsync' in node) || typeof (node as SceneNode).getCSSAsync !== 'function') {
    const empty: Record<string, string> = {}
    ctx.cssCache.set(node.id, empty)
    return empty
  }
  const css = await (node as SceneNode).getCSSAsync()
  ctx.cssCache.set(node.id, css)
  return css
}

const resolveOne = async (nodeId: string, ctx: ResolutionContext): Promise<ResolvedNode> => {
  try {
    const node = await figma.getNodeByIdAsync(nodeId)
    if (!node) {
      return { nodeId, output: null, error: ResolutionError.NODE_NOT_FOUND, detail: 'Node not found' }
    }
    const css = await getCachedCss(node, ctx)
    const hints = 'boundVariables' in node ? collectHints(node as SceneNode, ctx.varCache) : {}
    const output = runPipeline({ css, hints, config: ctx.config })
    return { nodeId, output }
  } catch (error) {
    return {
      nodeId,
      output: null,
      error: ResolutionError.RESOLVE_FAILED,
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Resolve many nodes with bounded concurrency (`ctx.maxInFlight`, default 8),
 * a deadline, and per-operation CSS/variable caches. Duplicate node ids are
 * collapsed to a single resolution up front — a selection of 100 nodes
 * sharing one variable, or a caller passing the same id twice, costs exactly
 * one `getCSSAsync`/variable lookup per unique id. Preserves input order; a
 * node started after the deadline (or after `ctx.signal.cancelled`) gets a
 * labelled partial result instead of being silently dropped.
 */
export const resolveNodes = async (nodeIds: string[], ctx: ResolutionContext): Promise<ResolvedNode[]> => {
  const startedAt = Date.now()
  const uniqueIds = [...new Set(nodeIds)]
  const resolvedById = new Map<string, ResolvedNode>()
  let cursor = 0
  const isExpired = () => Boolean(ctx.signal?.cancelled) || Date.now() - startedAt > ctx.deadlineMs

  const worker = async () => {
    while (cursor < uniqueIds.length) {
      const index = cursor
      cursor += 1
      const nodeId = uniqueIds[index]
      if (nodeId === undefined) continue
      if (isExpired()) {
        resolvedById.set(nodeId, {
          nodeId,
          output: null,
          error: ResolutionError.DEADLINE_EXCEEDED,
          detail: 'Resolution deadline exceeded',
        })
        continue
      }
      resolvedById.set(nodeId, await resolveOne(nodeId, ctx))
    }
  }

  const workerCount = Math.max(1, Math.min(ctx.maxInFlight, uniqueIds.length || 1))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))

  return nodeIds.map(
    (nodeId) =>
      resolvedById.get(nodeId) ?? {
        nodeId,
        output: null,
        error: ResolutionError.DEADLINE_EXCEEDED,
        detail: 'Resolution deadline exceeded',
      },
  )
}

export { collectHints } from './codegen/hints'
