import { scanDrift, findingsToMarkdown } from './scan'
import type { LintPayload } from '../shared/messages'

/** Back-compat entry used by mode-design Tools button. */
export const runLint = async (): Promise<LintPayload> => {
  const result = await scanDrift({ scope: 'selection' })
  return {
    findings: result.findings.map((f) => ({
      id: f.id,
      kind: f.kind,
      severity: f.severity,
      nodeIds: f.nodeIds,
      nodeName: f.nodeNames[0] ?? '',
      nodeNames: f.nodeNames,
      property: f.property,
      note: f.message,
      ...(f.nearestToken ? { nearest: f.nearestToken } : {}),
      ...(f.distance !== undefined ? { distance: f.distance } : {}),
    })),
    truncated: result.truncated || result.cancelled,
    markdown: findingsToMarkdown(result),
    visited: result.visited,
    durationMs: result.durationMs,
    resolutionFailures: result.resolutionFailures,
  }
}
