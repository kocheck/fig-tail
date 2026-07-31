import { readConfig } from '../storage'
import { runPipeline } from '../pipeline'
import type { LintPayload } from '../shared/messages'

const MAX_NODES = 200

/** Read-only drift linter over the current page selection/page. */
export const runLint = async (): Promise<LintPayload> => {
  const config = await readConfig()
  const roots =
    figma.currentPage.selection.length > 0
      ? figma.currentPage.selection
      : figma.currentPage.children
  const findings: LintPayload['findings'] = []
  let visited = 0
  let truncated = false

  const walk = async (node: SceneNode) => {
    if (visited >= MAX_NODES) {
      truncated = true
      return
    }
    visited += 1
    if ('getCSSAsync' in node && typeof node.getCSSAsync === 'function') {
      const css = await node.getCSSAsync()
      const output = runPipeline({ css, config })
      for (const result of output.results) {
        if (result.confidence === 'nearest' && result.nearest) {
          findings.push({
            nodeName: node.name,
            property: result.property,
            note: result.note ?? 'near miss',
            nearest: result.nearest.className,
          })
        }
      }
    }
    if ('children' in node) {
      for (const child of node.children) {
        await walk(child)
        if (truncated) return
      }
    }
  }

  for (const root of roots) {
    await walk(root)
    if (truncated) break
  }

  return { findings, truncated }
}
