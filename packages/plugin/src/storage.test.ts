import { describe, expect, it, vi } from 'vitest'
import type { ConfigProvenance, TokenSet } from '@fig-tail/theme'
import {
  assertNoForbiddenFields,
  base64ToBytes,
  bytesToBase64,
  buildStoredConfig,
  checksumOf,
  clearConfig,
  decodeBytes,
  encodeConfig,
  joinChunks,
  readConfig,
  setPreferredSource,
  splitIntoChunks,
  staleChunkClearCount,
  validateStoredConfig,
  writeConfig,
} from './storage'
import { redactDiagnostics } from './shared/redact'

const SHA_A = 'a'.repeat(64)

const makeTokenSet = (colorCount = 1): TokenSet => {
  const colors: TokenSet['colors'] = {}
  for (let i = 0; i < colorCount; i += 1) {
    const r = Math.floor(Math.random() * 256)
    const g = Math.floor(Math.random() * 256)
    const b = Math.floor(Math.random() * 256)
    const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
    colors[`c-${i}-${Math.random().toString(36).slice(2)}`] = { hex, rgb: [r, g, b], alpha: 1 }
  }
  return {
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
    colors,
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
  }
}

const makeProvenance = (): ConfigProvenance => ({
  kind: 'browser',
  sources: [{ name: 'tailwind.config.js', sha256: SHA_A, byteLength: 42 }],
  resolvedAt: new Date().toISOString(),
  inputSha256: SHA_A,
})

type MockFigma = {
  editorType: 'figma' | 'dev'
  root: { getPluginData: (key: string) => string; setPluginData: (key: string, value: string) => void }
  clientStorage: {
    getAsync: (key: string) => Promise<unknown>
    setAsync: (key: string, value: unknown) => Promise<void>
  }
}

const makeMockFigma = (options: { editorType?: 'figma' | 'dev'; failDocumentWrite?: boolean } = {}): MockFigma => {
  const pluginData = new Map<string, string>()
  const clientData = new Map<string, unknown>()
  return {
    editorType: options.editorType ?? 'figma',
    root: {
      getPluginData: (key: string) => pluginData.get(key) ?? '',
      setPluginData: (key: string, value: string) => {
        if (options.failDocumentWrite) {
          throw new Error('This function cannot be used with the current permission level')
        }
        pluginData.set(key, value)
      },
    },
    clientStorage: {
      getAsync: async (key: string) => clientData.get(key),
      setAsync: async (key: string, value: unknown) => {
        clientData.set(key, value)
      },
    },
  }
}

describe('chunk split/join', () => {
  it('splits and rejoins arbitrary bytes across a small chunk size', () => {
    const bytes = Uint8Array.from({ length: 257 }, (_, i) => i % 256)
    const chunks = splitIntoChunks(bytes, 10)
    expect(chunks.length).toBeGreaterThan(1)
    const rejoined = joinChunks(chunks)
    expect(Array.from(rejoined)).toEqual(Array.from(bytes))
  })

  it('produces exactly one (possibly empty) chunk for empty input', () => {
    const chunks = splitIntoChunks(new Uint8Array(0), 10)
    expect(chunks).toEqual([''])
    expect(joinChunks(chunks).length).toBe(0)
  })

  it('base64 round-trips arbitrary byte sequences', () => {
    const bytes = Uint8Array.from([0, 1, 2, 253, 254, 255, 128, 64, 32])
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes))
  })
})

describe('stale chunk clear count', () => {
  it('is zero when the new write uses the same or more chunks', () => {
    expect(staleChunkClearCount(2, 2)).toBe(0)
    expect(staleChunkClearCount(2, 5)).toBe(0)
  })

  it('equals the shrinkage when the new write uses fewer chunks', () => {
    expect(staleChunkClearCount(5, 2)).toBe(3)
    expect(staleChunkClearCount(1, 0)).toBe(1)
  })
})

describe('encode/decode', () => {
  it('gzip round-trips a StoredConfig', () => {
    const config = buildStoredConfig(makeTokenSet(), makeProvenance(), [], [])
    const bytes = encodeConfig(config)
    const decoded = decodeBytes(bytes)
    expect(decoded).toEqual(config)
  })

  it('checksum changes when a single byte changes', () => {
    const a = encodeConfig(buildStoredConfig(makeTokenSet(3), makeProvenance(), [], []))
    const b = new Uint8Array(a)
    b[0] = (b[0] ?? 0) ^ 0xff
    expect(checksumOf(a)).not.toBe(checksumOf(b))
  })
})

describe('canary redaction', () => {
  it('never serializes a canary that lived only in an unresolved snippet', () => {
    const canary = '__STORAGE_TEST_CANARY__'
    const diagnostics = redactDiagnostics([
      {
        path: 'theme.extend.spacing',
        reason: 'function-value',
        snippet: canary,
        source: 'tailwind.config.js',
        message: 'function value could not be evaluated',
      },
    ])
    const config = buildStoredConfig(makeTokenSet(), makeProvenance(), diagnostics, [])
    const serialized = JSON.stringify(config)
    expect(serialized).not.toContain(canary)
    expect(assertNoForbiddenFields(serialized)).toEqual([])
  })
})

describe('validateStoredConfig', () => {
  it('rejects a diagnostic carrying a snippet', () => {
    const config = buildStoredConfig(makeTokenSet(), makeProvenance(), [], [])
    const tampered = {
      ...config,
      resolution: { unresolved: [{ path: 'x', reason: 'r', message: 'm', source: 's', snippet: 'leaked' }], warnings: [] },
    }
    const result = validateStoredConfig(tampered)
    expect(result.ok).toBe(false)
  })

  it('accepts a well-formed StoredConfig', () => {
    const config = buildStoredConfig(makeTokenSet(2), makeProvenance(), [], ['note'])
    expect(validateStoredConfig(config).ok).toBe(true)
  })
})

describe('readConfig / writeConfig ladder', () => {
  it('returns tier-3 (active: null) with no config in either tier', async () => {
    vi.stubGlobal('figma', makeMockFigma())
    await clearConfig('document')
    await clearConfig('user')
    const result = await readConfig()
    expect(result.active).toBeNull()
    expect(result.available).toEqual({ document: false, user: false })
    expect(result.label).toMatch(/No Tailwind config/)
  })

  it('writes to document and reads it back as the active tier', async () => {
    vi.stubGlobal('figma', makeMockFigma())
    await clearConfig('document')
    await clearConfig('user')
    const draft = buildStoredConfig(makeTokenSet(2), makeProvenance(), [], [])
    const written = await writeConfig(draft, { target: 'document' })
    expect(written.ok).toBe(true)

    const result = await readConfig()
    expect(result.active?.tier).toBe('document')
    expect(result.label).toBe('Using the config saved on this file')
    expect(result.available).toEqual({ document: true, user: false })
    expect(result.overridden).toBe(false)
  })

  it('falls back to the user tier and labels it as personal-without-shared', async () => {
    vi.stubGlobal('figma', makeMockFigma())
    await clearConfig('document')
    await clearConfig('user')
    const draft = buildStoredConfig(makeTokenSet(1), makeProvenance(), [], [])
    const written = await writeConfig(draft, { target: 'user' })
    expect(written.ok).toBe(true)

    const result = await readConfig()
    expect(result.active?.tier).toBe('user')
    expect(result.label).toBe('Using your personal config — this file has no shared one')
  })

  it('prefers document by default when both tiers exist, and honours an explicit user override', async () => {
    vi.stubGlobal('figma', makeMockFigma())
    await clearConfig('document')
    await clearConfig('user')
    await writeConfig(buildStoredConfig(makeTokenSet(1), makeProvenance(), [], []), { target: 'document' })
    await writeConfig(buildStoredConfig(makeTokenSet(1), makeProvenance(), [], []), { target: 'user' })

    const defaultResult = await readConfig()
    expect(defaultResult.active?.tier).toBe('document')
    expect(defaultResult.overridden).toBe(false)

    await setPreferredSource('user')
    const overriddenResult = await readConfig()
    expect(overriddenResult.active?.tier).toBe('user')
    expect(overriddenResult.overridden).toBe(true)
    expect(overriddenResult.label).toMatch(/overriding/)
  })

  it('reports no-edit-access with needsPersonalConfirmation when the document write throws', async () => {
    vi.stubGlobal('figma', makeMockFigma({ failDocumentWrite: true }))
    const draft = buildStoredConfig(makeTokenSet(1), makeProvenance(), [], [])
    const result = await writeConfig(draft, { target: 'document' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('no-edit-access')
      expect(result.needsPersonalConfirmation).toBe(true)
    }
  })

  it('rejects writing an invalid TokenSet without touching figma', async () => {
    const mockFigma = makeMockFigma()
    vi.stubGlobal('figma', mockFigma)
    await clearConfig('document')
    const invalid = { ...buildStoredConfig(makeTokenSet(), makeProvenance(), [], []), tokens: { not: 'a token set' } }
    const result = await writeConfig(invalid as never, { target: 'document' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('validation')
    }
    expect(mockFigma.root.getPluginData('figtail.meta')).toBe('')
  })

  it('clears stale chunks on a shrinking document rewrite', async () => {
    const mockFigma = makeMockFigma()
    vi.stubGlobal('figma', mockFigma)
    await clearConfig('document')

    let bigTokens = makeTokenSet(1)
    let bigConfig = buildStoredConfig(bigTokens, makeProvenance(), [], [])
    let bigResult = await writeConfig(bigConfig, { target: 'document' })
    let metaAfterBig = JSON.parse(mockFigma.root.getPluginData('figtail.meta')) as { chunks: number }
    let attempts = 0
    while (metaAfterBig.chunks < 2 && attempts < 6) {
      bigTokens = makeTokenSet(4000 * (attempts + 1))
      bigConfig = buildStoredConfig(bigTokens, makeProvenance(), [], [])
      bigResult = await writeConfig(bigConfig, { target: 'document' })
      metaAfterBig = JSON.parse(mockFigma.root.getPluginData('figtail.meta')) as { chunks: number }
      attempts += 1
    }
    expect(bigResult.ok).toBe(true)
    expect(metaAfterBig.chunks).toBeGreaterThan(1)

    const smallConfig = buildStoredConfig(makeTokenSet(1), makeProvenance(), [], [])
    const smallResult = await writeConfig(smallConfig, { target: 'document' })
    expect(smallResult.ok).toBe(true)
    const metaAfterSmall = JSON.parse(mockFigma.root.getPluginData('figtail.meta')) as { chunks: number }
    expect(metaAfterSmall.chunks).toBeLessThan(metaAfterBig.chunks)
    expect(mockFigma.root.getPluginData(`figtail.payload.${metaAfterSmall.chunks}`)).toBe('')

    const result = await readConfig()
    expect(result.active?.tier).toBe('document')
  })

  it('clearConfig removes a tier so the ladder falls through', async () => {
    vi.stubGlobal('figma', makeMockFigma())
    await clearConfig('document')
    await clearConfig('user')
    await writeConfig(buildStoredConfig(makeTokenSet(1), makeProvenance(), [], []), { target: 'document' })
    expect((await readConfig()).active?.tier).toBe('document')

    await clearConfig('document')
    const result = await readConfig()
    expect(result.active).toBeNull()
  })
})
