import { describe, expect, it, vi } from 'vitest'
import { findingsToMarkdown, scanDrift } from './scan'

describe('scanDrift resolutionFailures', () => {
  it('counts nodes that fail to resolve', async () => {
    vi.stubGlobal('figma', {
      editorType: 'figma',
      root: { getPluginData: () => '', setPluginData: () => {} },
      clientStorage: { getAsync: async () => undefined, setAsync: async () => {} },
      currentPage: {
        selection: [{ id: 'n1', name: 'One', visible: true, children: [] }],
        children: [],
      },
      getNodeByIdAsync: async () => null,
    })
    const result = await scanDrift({ scope: 'selection', deadlineMs: 2000 })
    expect(result.resolutionFailures).toBe(1)
    expect(result.findings).toEqual([])
    expect(findingsToMarkdown(result)).toContain('Skipped 1 layer')
  })
})
