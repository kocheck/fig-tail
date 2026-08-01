import { createResolutionContext, resolveNodes, ResolutionError } from '../pipeline'

export type TreeFormat = 'html' | 'jsx' | 'outline'

export type TreeExportOptions = {
  format: TreeFormat
  maxNodes?: number
  maxDepth?: number
  deadlineMs?: number
}

type WalkNode = {
  id: string
  name: string
  depth: number
  childIds: string[]
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const collectTree = (
  root: SceneNode,
  maxNodes: number,
  maxDepth: number,
): { nodes: WalkNode[]; truncated: boolean } => {
  const nodes: WalkNode[] = []
  let truncated = false
  const visit = (node: SceneNode, depth: number): string | null => {
    if (nodes.length >= maxNodes || depth > maxDepth) {
      truncated = true
      return null
    }
    if ('visible' in node && node.visible === false) return null
    const childIds: string[] = []
    const entry: WalkNode = { id: node.id, name: node.name, depth, childIds }
    nodes.push(entry)
    if ('children' in node && depth < maxDepth) {
      for (const child of node.children) {
        const id = visit(child, depth + 1)
        if (id) childIds.push(id)
        if (truncated && nodes.length >= maxNodes) break
      }
    } else if ('children' in node && node.children.length > 0 && depth >= maxDepth) {
      truncated = true
    }
    return node.id
  }
  visit(root, 0)
  return { nodes, truncated }
}

const emitHtml = (
  nodes: WalkNode[],
  classes: Map<string, string>,
  truncated: boolean,
): string => {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const render = (id: string): string => {
    const node = byId.get(id)
    if (!node) return ''
    const indent = '  '.repeat(node.depth)
    const className = classes.get(id) ?? ''
    const open = `${indent}<div data-name="${escapeHtml(node.name)}" class="${escapeHtml(className)}">`
    if (node.childIds.length === 0) return `${open}</div>`
    const kids = node.childIds.map(render).filter(Boolean).join('\n')
    return `${open}\n${kids}\n${indent}</div>`
  }
  const root = nodes[0]
  if (!root) return '/* empty */'
  const body = render(root.id)
  return truncated ? `${body}\n<!-- truncated: node, depth, or time budget -->\n` : `${body}\n`
}

const emitJsx = (
  nodes: WalkNode[],
  classes: Map<string, string>,
  truncated: boolean,
): string => {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const render = (id: string): string => {
    const node = byId.get(id)
    if (!node) return ''
    const indent = '  '.repeat(node.depth)
    const className = classes.get(id) ?? ''
    const open = `${indent}<div data-name="${escapeHtml(node.name)}" className="${escapeHtml(className)}">`
    if (node.childIds.length === 0) return `${open}</div>`
    const kids = node.childIds.map(render).filter(Boolean).join('\n')
    return `${open}\n${kids}\n${indent}</div>`
  }
  const root = nodes[0]
  if (!root) return '/* empty */'
  const body = render(root.id)
  return truncated ? `${body}\n{/* truncated: node, depth, or time budget */}\n` : `${body}\n`
}

const emitOutline = (
  nodes: WalkNode[],
  classes: Map<string, string>,
  truncated: boolean,
): string => {
  const lines = nodes.map((node) => {
    const pad = '  '.repeat(node.depth)
    const className = classes.get(node.id) ?? ''
    return `${pad}- ${node.name}${className ? ` · ${className}` : ''}`
  })
  if (truncated) lines.push('… truncated: node, depth, or time budget')
  return `${lines.join('\n')}\n`
}

/** Export a className-annotated subtree using shared ResolutionContext. */
export const exportSubtree = async (options: TreeExportOptions = { format: 'html' }): Promise<string> => {
  const selection = figma.currentPage.selection[0]
  if (!selection) return '/* Select a root layer */'
  if (!('children' in selection) || selection.children.length === 0) {
    // Leaf — callers may hide the section; still return a single-node export.
  }

  const maxNodes = options.maxNodes ?? 150
  const maxDepth = options.maxDepth ?? 12
  const { nodes, truncated: walkTruncated } = collectTree(selection, maxNodes, maxDepth)
  if (nodes.length === 0) return '/* fig-tail could not export: empty subtree */'

  const ctx = await createResolutionContext({ deadlineMs: options.deadlineMs ?? 2000, maxInFlight: 8 })
  const resolved = await resolveNodes(
    nodes.map((n) => n.id),
    ctx,
  )
  const classes = new Map<string, string>()
  let timeTruncated = false
  let hardFailures = 0
  for (const item of resolved) {
    if (item.error === ResolutionError.DEADLINE_EXCEEDED) {
      timeTruncated = true
      continue
    }
    if (item.error) {
      hardFailures += 1
      continue
    }
    classes.set(item.nodeId, item.output?.className ?? '')
  }

  if (classes.size === 0 && (hardFailures > 0 || timeTruncated)) {
    const reason = timeTruncated
      ? 'resolution deadline exceeded'
      : `${hardFailures} layer(s) failed to resolve`
    return `/* fig-tail could not export: ${reason} */`
  }

  const truncated = walkTruncated || timeTruncated
  if (options.format === 'jsx') return emitJsx(nodes, classes, truncated)
  if (options.format === 'outline') return emitOutline(nodes, classes, truncated)
  return emitHtml(nodes, classes, truncated)
}
