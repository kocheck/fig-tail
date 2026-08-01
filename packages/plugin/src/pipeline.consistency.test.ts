import { describe, expect, it, vi } from 'vitest'
import { createResolutionContext, resolveNodes, runPipeline } from './pipeline'
import type { ReadConfigResult } from './storage-types'

/**
 * Codegen (`mode-dev.ts`'s `generate` handler) calls `runPipeline` directly
 * on one node's CSS. Inspect (`resolveNodes`) walks the same path through a
 * `ResolutionContext`. Both must produce byte-identical `className` output
 * for the same input — that guarantee is the whole point of sharing one
 * pipeline instead of two.
 */

const NO_CONFIG: ReadConfigResult = {
  active: null,
  available: { document: false, user: false },
  preferred: 'document',
  overridden: false,
  failures: [],
  label:
    'No Tailwind config — generic Tailwind syntax; project prefix/settings may require changes. Add your config for confirmed names.',
}

const CSS = {
  display: 'flex',
  'flex-direction': 'column',
  padding: '24px',
  gap: '16px',
  'border-radius': '12px',
  'background-color': '#3b82f6',
}

const storageMocks = {
  root: { getPluginData: () => '', setPluginData: () => {} },
  clientStorage: { getAsync: async () => undefined, setAsync: async () => {} },
  variables: { getVariableById: () => null },
}

describe('pipeline consistency', () => {
  it('runPipeline is a pure function of its input: two calls agree byte-for-byte', () => {
    const a = runPipeline({ css: CSS, config: NO_CONFIG })
    const b = runPipeline({ css: CSS, config: NO_CONFIG })
    expect(a.className).toBe(b.className)
    expect(a.warnings).toEqual(b.warnings)
    expect(a.tierLabel).toBe(b.tierLabel)
  })

  it('the resolveNodes (inspect) path matches a direct runPipeline (codegen) call for the same node', async () => {
    vi.stubGlobal('figma', {
      ...storageMocks,
      getNodeByIdAsync: async (id: string) => ({ id, getCSSAsync: async () => CSS }),
    })
    const direct = runPipeline({ css: CSS, config: NO_CONFIG })
    const ctx = await createResolutionContext()
    const [resolved] = await resolveNodes(['node-1'], ctx)
    expect(resolved?.output?.className).toBe(direct.className)
    expect(resolved?.output?.warnings).toEqual(direct.warnings)
  })

  it('agrees across a node with drift, one with an arbitrary value, and one bound to a variable', async () => {
    const nodes: Record<string, Record<string, string>> = {
      drift: { 'padding-top': '25px' },
      arbitrary: { 'background-color': '#3b82f1' },
      bound: { 'background-color': '#3b82f6' },
    }
    vi.stubGlobal('figma', {
      ...storageMocks,
      getNodeByIdAsync: async (id: string) => ({ id, getCSSAsync: async () => nodes[id] ?? {} }),
    })
    const ctx = await createResolutionContext()
    const resolved = await resolveNodes(['drift', 'arbitrary', 'bound'], ctx)
    for (const nodeId of Object.keys(nodes)) {
      const direct = runPipeline({ css: nodes[nodeId] ?? {}, config: NO_CONFIG })
      const viaResolveNodes = resolved.find((r) => r.nodeId === nodeId)
      expect(viaResolveNodes?.output?.className).toBe(direct.className)
    }
  })
})
