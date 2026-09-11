import { describe, expect, it, vi } from 'vitest'
import { collectHints } from './hints'

type FakeVariable = { id: string; name: string; codeSyntax: { WEB?: string } }

const makeFigma = (variables: Record<string, FakeVariable | undefined>) => {
  const calls: string[] = []
  return {
    figma: {
      variables: {
        // Under `documentAccess: "dynamic-page"` the synchronous getter throws.
        // Modelling that is the point: a mock that quietly returns a value lets
        // production code call the wrong API and still go green.
        getVariableById: () => {
          throw new Error('dynamic-page: use getVariableByIdAsync')
        },
        getVariableByIdAsync: async (id: string) => {
          calls.push(id)
          return variables[id] ?? null
        },
      },
    },
    calls,
  }
}

const alias = (id: string) => ({ type: 'VARIABLE_ALIAS' as const, id })

describe('collectHints', () => {
  it('returns no hints when the node has no boundVariables', async () => {
    vi.stubGlobal('figma', makeFigma({}).figma)
    const node = { type: 'FRAME' } as unknown as SceneNode
    expect(await collectHints(node)).toEqual({})
  })

  it('maps a fills binding to background-color on non-text nodes', async () => {
    const { figma: mockFigma } = makeFigma({
      v1: { id: 'v1', name: 'brand/500', codeSyntax: { WEB: 'brand-500' } },
    })
    vi.stubGlobal('figma', mockFigma)
    const node = {
      type: 'FRAME',
      boundVariables: { fills: [alias('v1')] },
    } as unknown as SceneNode
    expect(await collectHints(node)).toEqual({
      'background-color': { variableId: 'v1', name: 'brand/500', codeSyntax: 'brand-500' },
    })
  })

  it('maps a fills binding to color on TEXT nodes', async () => {
    const { figma: mockFigma } = makeFigma({
      v1: { id: 'v1', name: 'ink/900', codeSyntax: {} },
    })
    vi.stubGlobal('figma', mockFigma)
    const node = {
      type: 'TEXT',
      boundVariables: { fills: [alias('v1')] },
    } as unknown as SceneNode
    expect(await collectHints(node)).toEqual({
      color: { variableId: 'v1', name: 'ink/900' },
    })
  })

  it('maps strokes to border-color', async () => {
    const { figma: mockFigma } = makeFigma({
      v2: { id: 'v2', name: 'border/default', codeSyntax: {} },
    })
    vi.stubGlobal('figma', mockFigma)
    const node = {
      type: 'FRAME',
      boundVariables: { strokes: [alias('v2')] },
    } as unknown as SceneNode
    expect(await collectHints(node)).toEqual({
      'border-color': { variableId: 'v2', name: 'border/default' },
    })
  })

  it('maps every scalar field to its CSS property', async () => {
    const { figma: mockFigma } = makeFigma({
      gap: { id: 'gap', name: 'space/4', codeSyntax: {} },
      radius: { id: 'radius', name: 'radius/lg', codeSyntax: {} },
      weight: { id: 'weight', name: 'border/1', codeSyntax: {} },
      size: { id: 'size', name: 'text/base', codeSyntax: {} },
    })
    vi.stubGlobal('figma', mockFigma)
    const node = {
      type: 'FRAME',
      boundVariables: {
        itemSpacing: alias('gap'),
        topLeftRadius: alias('radius'),
        topRightRadius: alias('radius'),
        bottomLeftRadius: alias('radius'),
        bottomRightRadius: alias('radius'),
        strokeWeight: alias('weight'),
        fontSize: [alias('size')],
      },
    } as unknown as SceneNode
    const hints = await collectHints(node)
    expect(hints.gap?.name).toBe('space/4')
    expect(hints['border-top-left-radius']?.name).toBe('radius/lg')
    expect(hints['border-top-right-radius']?.name).toBe('radius/lg')
    expect(hints['border-bottom-left-radius']?.name).toBe('radius/lg')
    expect(hints['border-bottom-right-radius']?.name).toBe('radius/lg')
    expect(hints['border-width']?.name).toBe('border/1')
    expect(hints['font-size']?.name).toBe('text/base')
  })

  it('dedupes four sides bound to the same variable into one lookup via varCache', async () => {
    const { figma: mockFigma, calls } = makeFigma({
      pad: { id: 'pad', name: 'space/6', codeSyntax: {} },
    })
    vi.stubGlobal('figma', mockFigma)
    const node = {
      type: 'FRAME',
      boundVariables: {
        paddingLeft: alias('pad'),
        paddingRight: alias('pad'),
        paddingTop: alias('pad'),
        paddingBottom: alias('pad'),
      },
    } as unknown as SceneNode
    const cache = new Map<string, Variable | null>()
    const hints = await collectHints(node, cache)
    expect(hints['padding-left']?.name).toBe('space/6')
    expect(hints['padding-right']?.name).toBe('space/6')
    expect(hints['padding-top']?.name).toBe('space/6')
    expect(hints['padding-bottom']?.name).toBe('space/6')
    expect(calls).toEqual(['pad'])
  })

  it('skips an unresolvable alias without throwing', async () => {
    const { figma: mockFigma } = makeFigma({})
    vi.stubGlobal('figma', mockFigma)
    const node = {
      type: 'FRAME',
      boundVariables: { fills: [alias('missing')] },
    } as unknown as SceneNode
    await expect(collectHints(node)).resolves.toEqual({})
  })

  // Both failure shapes must degrade to value matching. A rejection is caught by
  // a bare `.catch()`; a synchronous throw is not, and would fail the whole node
  // with `could not generate output` instead of dropping one hint.
  it.each([
    [
      'rejects',
      async () => {
        throw new Error('library unavailable')
      },
    ],
    [
      'throws synchronously',
      () => {
        throw new Error('figma.variables unavailable')
      },
    ],
  ])('skips an alias whose lookup %s', async (_label, getVariableByIdAsync) => {
    vi.stubGlobal('figma', { variables: { getVariableByIdAsync } })
    const node = {
      type: 'FRAME',
      boundVariables: { strokes: [alias('v3')] },
    } as unknown as SceneNode
    await expect(collectHints(node)).resolves.toEqual({})
  })
})
