import { describe, expect, it, vi } from 'vitest'
import { handleUiMessage } from './mode-design'
import type { PluginMessage } from './shared/messages'

describe('handleUiMessage error boundary', () => {
  it('posts operation-error instead of throwing when a tool path fails', async () => {
    const posts: PluginMessage[] = []
    vi.stubGlobal('figma', {
      editorType: 'figma',
      showUI: () => {},
      notify: () => {},
      ui: {
        postMessage: (msg: PluginMessage) => {
          posts.push(msg)
        },
      },
      root: { getPluginData: () => '', setPluginData: () => {} },
      clientStorage: {
        getAsync: async () => undefined,
        setAsync: async () => {},
      },
      currentPage: { selection: [], children: [] },
    })

    // Force run-lint path to throw by making selection accessors blow up after ready path works.
    // Prefer-source is simpler: setPreferredSource uses clientStorage — make setAsync throw.
    vi.stubGlobal('figma', {
      editorType: 'figma',
      showUI: () => {},
      notify: () => {},
      ui: {
        postMessage: (msg: PluginMessage) => {
          posts.push(msg)
        },
      },
      root: { getPluginData: () => '', setPluginData: () => {} },
      clientStorage: {
        getAsync: async () => undefined,
        setAsync: async () => {
          throw new Error('clientStorage full')
        },
      },
    })

    await expect(
      handleUiMessage({ type: 'prefer-source', preferred: 'user' }),
    ).resolves.toBeUndefined()

    const err = posts.find((p) => p.type === 'operation-error')
    expect(err).toEqual({
      type: 'operation-error',
      operation: 'prefer-source',
      message: 'clientStorage full',
    })
  })
})
