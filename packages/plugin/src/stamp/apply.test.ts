import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ConfigProvenance, TokenSet } from '@fig-tail/theme'
import { applyStamp, prepareStampDiff } from './apply'
import { buildStoredConfig, writeConfig } from '../storage'

const SHA = 'a'.repeat(64)

const makeTokenSet = (): TokenSet => ({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    major: 3,
    entry: 'tailwind.config.js',
    prefix: { status: 'none' },
    corePlugins: { mode: 'all', names: [] },
    remBasePx: 16,
    tailwindVersionEvidence: null,
    defaults: { status: 'unconfirmed', reason: 'no package.json evidence' },
  },
  colors: {
    'brand-500': { hex: '#3b82f6', rgb: [59, 130, 246], alpha: 1 },
  },
  spacing: { base: null, basePx: null, named: {}, scale: {} },
  radius: {},
  fontSize: {},
  fontFamily: {},
  fontWeight: {},
  lineHeight: {},
  letterSpacing: {},
  boxShadow: {},
  borderWidth: {},
  opacity: {},
  breakpoints: {},
  zIndex: {},
  unsupported: {},
  unknownNamespaces: [],
  partialNamespaces: [],
})

const makeProvenance = (): ConfigProvenance => ({
  kind: 'browser',
  sources: [{ name: 'tailwind.config.js', sha256: SHA, byteLength: 42 }],
  resolvedAt: new Date().toISOString(),
  inputSha256: SHA,
})

const makeMockFigma = (variables: Array<{
  id: string
  name: string
  resolvedType: string
  codeSyntax: Record<string, string>
  setVariableCodeSyntax?: (platform: string, value: string) => void
}>) => {
  const pluginData = new Map<string, string>()
  const clientData = new Map<string, unknown>()
  const byId = new Map(variables.map((v) => [v.id, v]))
  return {
    editorType: 'figma' as const,
    root: {
      getPluginData: (key: string) => pluginData.get(key) ?? '',
      setPluginData: (key: string, value: string) => {
        pluginData.set(key, value)
      },
    },
    clientStorage: {
      getAsync: async (key: string) => clientData.get(key),
      setAsync: async (key: string, value: unknown) => {
        clientData.set(key, value)
      },
    },
    variables: {
      getLocalVariablesAsync: async () => variables,
      getVariableByIdAsync: async (id: string) => byId.get(id) ?? null,
    },
  }
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('applyStamp', () => {
  it('returns design-editor-only failure without throwing', async () => {
    vi.stubGlobal('figma', { ...makeMockFigma([]), editorType: 'dev' })
    const result = await applyStamp({ selectedIds: ['v1'], overwriteIds: [] })
    expect(result.applied).toEqual([])
    expect(result.failed[0]?.error).toMatch(/design-editor only/i)
  })

  it('skips stale selected ids with a reason', async () => {
    vi.stubGlobal('figma', makeMockFigma([]))
    await writeConfig(buildStoredConfig(makeTokenSet(), makeProvenance(), [], []), { target: 'document' })
    const result = await applyStamp({ selectedIds: ['VariableID:gone'], overwriteIds: [] })
    expect(result.skipped).toEqual([{ id: 'VariableID:gone', reason: 'stale' }])
    expect(result.applied).toEqual([])
  })

  it('applies WEB syntax and reports applied ids', async () => {
    const setSyntax = vi.fn()
    vi.stubGlobal(
      'figma',
      makeMockFigma([
        {
          id: 'VariableID:1',
          name: 'brand/500',
          resolvedType: 'COLOR',
          codeSyntax: {},
          setVariableCodeSyntax: setSyntax,
        },
      ]),
    )
    await writeConfig(buildStoredConfig(makeTokenSet(), makeProvenance(), [], []), { target: 'document' })
    const result = await applyStamp({ selectedIds: ['VariableID:1'], overwriteIds: [] })
    expect(result.applied).toEqual(['VariableID:1'])
    expect(result.skipped).toEqual([])
    expect(result.failed).toEqual([])
    expect(setSyntax).toHaveBeenCalledWith('WEB', 'brand-500')
  })

  it('records failed writes with errors', async () => {
    const setSyntax = vi.fn(() => {
      throw new Error('library variable')
    })
    vi.stubGlobal(
      'figma',
      makeMockFigma([
        {
          id: 'VariableID:1',
          name: 'brand/500',
          resolvedType: 'COLOR',
          codeSyntax: {},
          setVariableCodeSyntax: setSyntax,
        },
      ]),
    )
    await writeConfig(buildStoredConfig(makeTokenSet(), makeProvenance(), [], []), { target: 'document' })
    const result = await applyStamp({ selectedIds: ['VariableID:1'], overwriteIds: [] })
    expect(result.applied).toEqual([])
    expect(result.failed).toEqual([{ id: 'VariableID:1', error: 'library variable' }])
  })

  it('skips conflict rows', async () => {
    vi.stubGlobal(
      'figma',
      makeMockFigma([
        {
          id: 'VariableID:1',
          name: 'brand/500',
          resolvedType: 'COLOR',
          codeSyntax: { WEB: 'other-token' },
          setVariableCodeSyntax: vi.fn(),
        },
      ]),
    )
    const tokens = makeTokenSet()
    tokens.colors['other-token'] = { hex: '#000000', rgb: [0, 0, 0], alpha: 1 }
    await writeConfig(buildStoredConfig(tokens, makeProvenance(), [], []), { target: 'document' })
    const result = await applyStamp({ selectedIds: ['VariableID:1'], overwriteIds: ['VariableID:1'] })
    expect(result.skipped.some((s) => s.reason === 'conflict')).toBe(true)
  })
})

describe('prepareStampDiff', () => {
  it('returns empty changes without tokens', async () => {
    vi.stubGlobal('figma', makeMockFigma([]))
    const diff = await prepareStampDiff()
    expect(diff.changes).toEqual([])
    expect(diff.canApply).toBe(false)
  })
})
