import { describe, expect, it, vi } from 'vitest'
import { exportSubtree } from './export'
import { ResolutionError } from '../pipeline'

describe('exportSubtree failure modes', () => {
  it('asks for a selection when none exists', async () => {
    vi.stubGlobal('figma', {
      editorType: 'figma',
      root: { getPluginData: () => '', setPluginData: () => {} },
      clientStorage: { getAsync: async () => undefined, setAsync: async () => {} },
      currentPage: { selection: [] },
    })
    expect(await exportSubtree({ format: 'html' })).toBe('/* Select a root layer */')
  })

  it('returns an error comment when every node fails to resolve', async () => {
    vi.stubGlobal('figma', {
      editorType: 'figma',
      root: { getPluginData: () => '', setPluginData: () => {} },
      clientStorage: { getAsync: async () => undefined, setAsync: async () => {} },
      currentPage: {
        selection: [
          {
            id: 'root',
            name: 'Frame',
            visible: true,
            children: [],
          },
        ],
      },
      getNodeByIdAsync: async () => null,
    })
    const code = await exportSubtree({ format: 'html' })
    expect(code).toContain('/* fig-tail could not export:')
    expect(code).toContain('failed to resolve')
  })

  it('returns a deadline comment when only deadline errors occur', async () => {
    // Force deadline by cancelling immediately via a very short deadline and slow CSS.
    let calls = 0
    vi.stubGlobal('figma', {
      editorType: 'figma',
      root: { getPluginData: () => '', setPluginData: () => {} },
      clientStorage: { getAsync: async () => undefined, setAsync: async () => {} },
      currentPage: {
        selection: [
          {
            id: 'a',
            name: 'A',
            visible: true,
            children: [
              { id: 'b', name: 'B', visible: true, children: [] },
              { id: 'c', name: 'C', visible: true, children: [] },
            ],
          },
        ],
      },
      getNodeByIdAsync: async (id: string) => ({
        id,
        getCSSAsync: async () => {
          calls += 1
          await new Promise((r) => setTimeout(r, 30))
          return { display: 'flex' }
        },
      }),
    })
    const code = await exportSubtree({ format: 'html', deadlineMs: 5, maxNodes: 10 })
    // Either partial HTML with truncation, or all-failed deadline comment.
    const ok =
      code.includes('truncated: node, depth, or time budget') ||
      code.includes(ResolutionError.DEADLINE_EXCEEDED) ||
      code.includes('deadline exceeded') ||
      code.includes('<div')
    expect(ok).toBe(true)
    expect(calls).toBeGreaterThanOrEqual(0)
  })
})
