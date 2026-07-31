import type { MatchProvenance, MatchResult } from '@fig-tail/match'

/** Finding severity — higher sorts first. */
export type Severity = 'high' | 'medium' | 'low'

/** Finding kinds from the drift linter. */
export type FindingKind =
  | 'nearest'
  | 'drift'
  | 'off-system'
  | 'unbound'
  | 'unmapped-variable'

/** Explicit variable → token proposal for stamping (plan 007). */
export type VariableProposal = {
  variableId: string
  variableName: string
  tokenKey: string | null
  status: 'high' | 'medium' | 'conflict' | 'skipped'
  reason: string
  evidence: 'value' | 'name' | 'code-syntax' | 'none'
  existingWebSyntax: string | null
}

export type Finding = {
  id: string
  kind: FindingKind
  severity: Severity
  nodeIds: string[]
  nodeNames: string[]
  property: string
  message: string
  nearestToken?: string
  distance?: number
  provenance?: MatchProvenance
  proposal?: VariableProposal
}

export type ScanResult = {
  findings: Finding[]
  visited: number
  truncated: boolean
  cancelled: boolean
  durationMs: number
  /** Nodes that failed to resolve (deadline, missing, or resolve error). */
  resolutionFailures: number
}

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 }

/** Sort findings by severity, then node count descending, then message. */
export const sortFindings = (findings: Finding[]): Finding[] =>
  [...findings].sort((a, b) => {
    const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    if (sev !== 0) return sev
    const nodes = b.nodeIds.length - a.nodeIds.length
    if (nodes !== 0) return nodes
    return a.message.localeCompare(b.message)
  })

/** Classify a match result into a finding kind + severity, or null if clean. */
export const classifyResult = (
  result: MatchResult,
): { kind: FindingKind; severity: Severity } | null => {
  if (result.confidence === 'nearest' && result.nearest) {
    return { kind: 'nearest', severity: 'high' }
  }
  if (result.confidence === 'arbitrary' && result.className) {
    return { kind: 'off-system', severity: 'medium' }
  }
  if (result.confidence === 'none') {
    return { kind: 'drift', severity: 'low' }
  }
  if (result.provenance.hintStatus === 'unresolvable') {
    return { kind: 'unbound', severity: 'medium' }
  }
  if (result.provenance.hintStatus === 'stale') {
    return { kind: 'unmapped-variable', severity: 'high' }
  }
  return null
}

/** Stable finding id for dismissal. */
export const findingHash = (finding: Omit<Finding, 'id' | 'nodeIds' | 'nodeNames'> & {
  property: string
  kind: FindingKind
  message: string
}): string => `${finding.kind}:${finding.property}:${finding.message}`
