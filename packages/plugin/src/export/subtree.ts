import { readConfig } from '../storage'
import { runPipeline } from '../pipeline'

const MAX_NODES = 150
const DEADLINE_MS = 2000

/** Export a className-annotated subtree skeleton. */
export const exportSubtree = async (): Promise<string> => {
  const selection = figma.currentPage.selection[0]
  if (!selection) return '/* Select a root layer */'
  const config = await readConfig()
  const started = Date.now()
  let visited = 0
  let truncated = false

  const walk = async (node: SceneNode, depth: number): Promise<string> => {
    if (visited >= MAX_NODES || Date.now() - started > DEADLINE_MS) {
      truncated = true
      return `${'  '.repeat(depth)}<!-- truncated -->`
    }
    visited += 1
    let className = ''
    if ('getCSSAsync' in node && typeof node.getCSSAsync === 'function') {
      const css = await node.getCSSAsync()
      className = runPipeline({ css, config }).className
    }
    const indent = '  '.repeat(depth)
    const open = `${indent}<div data-name="${node.name.replace(/"/g, '')}" class="${className}">`
    if (!('children' in node) || node.children.length === 0) {
      return `${open}</div>`
    }
    const kids: string[] = []
    for (const child of node.children) {
      if ('visible' in child && child.visible === false) continue
      kids.push(await walk(child, depth + 1))
      if (truncated) break
    }
    return `${open}\n${kids.join('\n')}\n${indent}</div>`
  }

  const body = await walk(selection, 0)
  const note = truncated ? '\n<!-- truncated: node or time budget -->' : ''
  return `${body}${note}\n`
}
