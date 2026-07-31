import { createResolutionContext, resolveNodes } from '../pipeline'
import { loadDismissals } from './dismiss'
import {
  classifyResult,
  findingHash,
  sortFindings,
  type Finding,
  type ScanResult,
} from './types'

export type ScanOptions = {
  scope: 'selection' | 'page'
  signal?: { cancelled: boolean }
  maxNodes?: number
  deadlineMs?: number
}

const collectNodeIds = (roots: readonly SceneNode[], maxNodes: number): { ids: string[]; names: Map<string, string>; truncated: boolean } => {
  const ids: string[] = []
  const names = new Map<string, string>()
  const stack = [...roots]
  let truncated = false
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) continue
    if (ids.length >= maxNodes) {
      truncated = true
      break
    }
    if ('visible' in node && node.visible === false) continue
    ids.push(node.id)
    names.set(node.id, node.name)
    if ('children' in node) {
      for (let i = node.children.length - 1; i >= 0; i -= 1) {
        const child = node.children[i]
        if (child) stack.push(child)
      }
    }
  }
  return { ids, names, truncated }
}

/**
 * Read-only page/selection scan. Uses plan-005 `resolveNodes` (max 8 in flight).
 * Never writes to the document.
 */
export const scanDrift = async (options: ScanOptions): Promise<ScanResult> => {
  const started = Date.now()
  const maxNodes = options.maxNodes ?? 1000
  const roots =
    options.scope === 'selection' && figma.currentPage.selection.length > 0
      ? figma.currentPage.selection
      : figma.currentPage.children

  const { ids, names, truncated: walkTruncated } = collectNodeIds([...roots], maxNodes)
  const ctx = await createResolutionContext({
    deadlineMs: options.deadlineMs ?? 10_000,
    ...(options.signal ? { signal: options.signal } : {}),
    maxInFlight: 8,
  })

  const resolved = await resolveNodes(ids, ctx)
  const documentConfigId = ctx.config.active?.documentConfigId ?? null
  const dismissed = await loadDismissals(documentConfigId)

  const buckets = new Map<string, Finding>()
  for (const item of resolved) {
    if (options.signal?.cancelled) break
    if (!item.output) continue
    for (const result of item.output.results) {
      const classified = classifyResult(result)
      if (!classified) continue
      const base = {
        kind: classified.kind,
        severity: classified.severity,
        property: result.property,
        message: result.note ?? `${classified.kind} on ${result.property}`,
        ...(result.nearest?.tokenKey ? { nearestToken: result.nearest.tokenKey } : {}),
        ...(result.nearest?.delta !== undefined ? { distance: result.nearest.delta } : {}),
        provenance: result.provenance,
      }
      const id = findingHash(base)
      if (dismissed.has(id)) continue
      const existing = buckets.get(id)
      if (existing) {
        if (!existing.nodeIds.includes(item.nodeId)) {
          existing.nodeIds.push(item.nodeId)
          existing.nodeNames.push(names.get(item.nodeId) ?? item.nodeId)
        }
      } else {
        buckets.set(id, {
          id,
          ...base,
          nodeIds: [item.nodeId],
          nodeNames: [names.get(item.nodeId) ?? item.nodeId],
        })
      }
    }
  }

  const cancelled = Boolean(options.signal?.cancelled)
  return {
    findings: sortFindings([...buckets.values()]),
    visited: ids.length,
    truncated: walkTruncated || resolved.some((r) => r.error === 'Resolution deadline exceeded'),
    cancelled,
    durationMs: Date.now() - started,
  }
}

/** Markdown table for clipboard export. */
export const findingsToMarkdown = (result: ScanResult): string => {
  const header = '| Severity | Kind | Nodes | Property | Message |\n|---|---|---|---|---|'
  const rows = result.findings.map(
    (f) =>
      `| ${f.severity} | ${f.kind} | ${f.nodeNames.join(', ')} | ${f.property} | ${f.message.replace(/\|/g, '/')} |`,
  )
  return [header, ...rows].join('\n')
}
