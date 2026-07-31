import { describe, expect, it, vi } from 'vitest'
import { createResolutionContext, resolveNodes, ResolutionError } from './pipeline'

const CSS = { display: 'flex', padding: '24px' }

const storageMocks = {
  root: { getPluginData: () => '', setPluginData: () => {} },
  clientStorage: {
    getAsync: async () => undefined,
    setAsync: async () => {},
  },
  variables: { getVariableById: () => null },
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('createResolutionContext', () => {
  it('reads storage exactly once and defaults maxInFlight to 8', async () => {
    let reads = 0
    vi.stubGlobal('figma', {
      ...storageMocks,
      clientStorage: {
        getAsync: async () => {
          reads += 1
          return undefined
        },
        setAsync: async () => {},
      },
    })
    const ctx = await createResolutionContext()
    expect(ctx.maxInFlight).toBe(8)
    expect(ctx.config.active).toBeNull()
    // readConfig checks two clientStorage keys (personal config + preferred source).
    expect(reads).toBe(2)
  })
})

describe('resolveNodes', () => {
  it('preserves input order regardless of completion order', async () => {
    const nodeIds = ['slow', 'fast']
    vi.stubGlobal('figma', {
      ...storageMocks,
      getNodeByIdAsync: async (id: string) => ({
        id,
        getCSSAsync: async () => {
          if (id === 'slow') await delay(20)
          return CSS
        },
      }),
    })
    const ctx = await createResolutionContext()
    const results = await resolveNodes(nodeIds, ctx)
    expect(results.map((r) => r.nodeId)).toEqual(['slow', 'fast'])
    expect(results.every((r) => r.output !== null)).toBe(true)
  })

  it('never exceeds ctx.maxInFlight concurrent CSS reads', async () => {
    let concurrent = 0
    let peak = 0
    const nodeIds = Array.from({ length: 16 }, (_, i) => `n${i}`)
    vi.stubGlobal('figma', {
      ...storageMocks,
      getNodeByIdAsync: async (id: string) => ({
        id,
        getCSSAsync: async () => {
          concurrent += 1
          peak = Math.max(peak, concurrent)
          await delay(5)
          concurrent -= 1
          return CSS
        },
      }),
    })
    const ctx = await createResolutionContext({ maxInFlight: 4 })
    const results = await resolveNodes(nodeIds, ctx)
    expect(results).toHaveLength(16)
    expect(peak).toBeLessThanOrEqual(4)
  })

  it('deduplicates CSS fetches by node id via the shared cssCache', async () => {
    let calls = 0
    vi.stubGlobal('figma', {
      ...storageMocks,
      getNodeByIdAsync: async (id: string) => ({
        id,
        getCSSAsync: async () => {
          calls += 1
          return CSS
        },
      }),
    })
    const ctx = await createResolutionContext()
    const results = await resolveNodes(['dup', 'dup', 'dup'], ctx)
    expect(calls).toBe(1)
    expect(results).toHaveLength(3)
    expect(results.every((r) => r.output?.className !== undefined)).toBe(true)
  })

  it('returns a labelled partial result once the deadline elapses', async () => {
    vi.stubGlobal('figma', {
      ...storageMocks,
      getNodeByIdAsync: async (id: string) => ({
        id,
        getCSSAsync: async () => {
          await delay(15)
          return CSS
        },
      }),
    })
    const ctx = await createResolutionContext({ deadlineMs: 10, maxInFlight: 1 })
    const results = await resolveNodes(['first', 'second', 'third'], ctx)
    expect(results[0]?.output).not.toBeNull()
    const laterResults = results.slice(1)
    expect(laterResults.some((r) => r.error === ResolutionError.DEADLINE_EXCEEDED)).toBe(true)
  })

  it('stops starting new work once signal.cancelled is set', async () => {
    const signal = { cancelled: true }
    vi.stubGlobal('figma', {
      ...storageMocks,
      getNodeByIdAsync: async (id: string) => ({ id, getCSSAsync: async () => CSS }),
    })
    const ctx = await createResolutionContext({ signal })
    const results = await resolveNodes(['a', 'b'], ctx)
    expect(results.every((r) => r.error === ResolutionError.DEADLINE_EXCEEDED)).toBe(true)
  })

  it('reports a readable error instead of throwing when a node cannot be found', async () => {
    vi.stubGlobal('figma', {
      ...storageMocks,
      getNodeByIdAsync: async () => null,
    })
    const ctx = await createResolutionContext()
    const [result] = await resolveNodes(['missing'], ctx)
    expect(result?.output).toBeNull()
    expect(result?.error).toBe(ResolutionError.NODE_NOT_FOUND)
    expect(result?.detail).toBe('Node not found')
  })

  it('reports a readable error instead of throwing when getCSSAsync rejects', async () => {
    vi.stubGlobal('figma', {
      ...storageMocks,
      getNodeByIdAsync: async (id: string) => ({
        id,
        getCSSAsync: async () => {
          throw new Error('boom')
        },
      }),
    })
    const ctx = await createResolutionContext()
    const [result] = await resolveNodes(['broken'], ctx)
    expect(result?.output).toBeNull()
    expect(result?.error).toBe(ResolutionError.RESOLVE_FAILED)
    expect(result?.detail).toBe('boom')
  })
})
