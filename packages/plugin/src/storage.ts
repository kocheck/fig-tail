import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate'
import { validateConfigProvenance, validateTokenSet, type TokenSet, type ConfigProvenance } from '@fig-tail/theme'
import type { PersistedDiagnostic, ReadConfigResult, StoredConfig, WriteResult } from './storage-types'

export { redactDiagnostics } from './shared/redact'

const META_KEY = 'fig-tail:meta'
const CHUNK_PREFIX = 'fig-tail:chunk:'
const CLIENT_KEY = 'fig-tail:personal-config'
const CHUNK_BUDGET = 80_000

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] ?? 0)
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
  let output = ''
  let i = 0
  while (i < binary.length) {
    const a = binary.charCodeAt(i++)
    const b = i < binary.length ? binary.charCodeAt(i++) : Number.NaN
    const c = i < binary.length ? binary.charCodeAt(i++) : Number.NaN
    const bitmap =
      (a << 16) | ((Number.isNaN(b) ? 0 : b) << 8) | (Number.isNaN(c) ? 0 : c)
    output += chars.charAt((bitmap >> 18) & 63)
    output += chars.charAt((bitmap >> 12) & 63)
    output += Number.isNaN(b) ? '=' : chars.charAt((bitmap >> 6) & 63)
    output += Number.isNaN(c) ? '=' : chars.charAt(bitmap & 63)
  }
  return output
}

const base64ToBytes = (value: string): Uint8Array => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
  const str = value.replace(/[^A-Za-z0-9+/=]/g, '')
  const output: number[] = []
  let i = 0
  while (i < str.length) {
    const a = chars.indexOf(str.charAt(i++))
    const b = chars.indexOf(str.charAt(i++))
    const c = chars.indexOf(str.charAt(i++))
    const d = chars.indexOf(str.charAt(i++))
    const bitmap = (a << 18) | (b << 12) | ((c & 63) << 6) | (d & 63)
    output.push((bitmap >> 16) & 255)
    if (c !== 64) output.push((bitmap >> 8) & 255)
    if (d !== 64) output.push(bitmap & 255)
  }
  return Uint8Array.from(output)
}

type Meta = {
  schemaVersion: 1
  chunks: number
  savedAt: string
  documentId: string
  byteLength: number
}

const stableDocumentId = (): string => {
  const existing = figma.root.getPluginData('fig-tail:document-id')
  if (existing) return existing
  const id = `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
  figma.root.setPluginData('fig-tail:document-id', id)
  return id
}

const encodePayload = (config: StoredConfig): Uint8Array => {
  const json = JSON.stringify(config)
  return gzipSync(strToU8(json))
}

const decodePayload = (bytes: Uint8Array): StoredConfig | null => {
  try {
    const json = strFromU8(gunzipSync(bytes))
    const parsed: unknown = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') return null
    const record = parsed as Record<string, unknown>
    const tokens = validateTokenSet(record.tokens)
    const provenance = validateConfigProvenance(record.provenance)
    if (!tokens.ok || !provenance.ok) return null
    return parsed as StoredConfig
  } catch {
    return null
  }
}

const clearDocumentChunks = (count: number) => {
  for (let i = 0; i < Math.max(count, 8); i += 1) {
    figma.root.setPluginData(`${CHUNK_PREFIX}${i}`, '')
  }
  figma.root.setPluginData(META_KEY, '')
}

/** Write resolved config to private document storage (tier 1). */
export const writeDocumentConfig = (
  tokens: TokenSet,
  provenance: ConfigProvenance,
  diagnostics: PersistedDiagnostic[],
  warnings: string[],
): WriteResult => {
  try {
    const documentId = stableDocumentId()
    const config: StoredConfig = {
      schemaVersion: 1,
      tokens,
      provenance,
      diagnostics,
      warnings,
      savedAt: new Date().toISOString(),
      documentId,
    }
    const bytes = encodePayload(config)
    const chunks: string[] = []
    let offset = 0
    while (offset < bytes.length) {
      const slice = bytes.slice(offset, offset + CHUNK_BUDGET)
      chunks.push(bytesToBase64(slice))
      offset += CHUNK_BUDGET
    }
    clearDocumentChunks(chunks.length + 2)
    chunks.forEach((chunk, index) => {
      figma.root.setPluginData(`${CHUNK_PREFIX}${index}`, chunk)
    })
    const meta: Meta = {
      schemaVersion: 1,
      chunks: chunks.length,
      savedAt: config.savedAt,
      documentId,
      byteLength: bytes.length,
    }
    figma.root.setPluginData(META_KEY, JSON.stringify(meta))
    return { ok: true, tier: 1, bytes: bytes.length, chunks: chunks.length }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Write resolved config to personal clientStorage (tier 2). */
export const writePersonalConfig = async (
  tokens: TokenSet,
  provenance: ConfigProvenance,
  diagnostics: PersistedDiagnostic[],
  warnings: string[],
): Promise<WriteResult> => {
  try {
    const config: StoredConfig = {
      schemaVersion: 1,
      tokens,
      provenance,
      diagnostics,
      warnings,
      savedAt: new Date().toISOString(),
      documentId: 'personal',
    }
    const bytes = encodePayload(config)
    await figma.clientStorage.setAsync(CLIENT_KEY, Array.from(bytes))
    return { ok: true, tier: 2, bytes: bytes.length, chunks: 1 }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

const readDocumentConfig = (): StoredConfig | null => {
  const metaRaw = figma.root.getPluginData(META_KEY)
  if (!metaRaw) return null
  try {
    const meta = JSON.parse(metaRaw) as Meta
    const parts: number[] = []
    for (let i = 0; i < meta.chunks; i += 1) {
      const chunk = figma.root.getPluginData(`${CHUNK_PREFIX}${i}`)
      if (!chunk) return null
      const bytes = base64ToBytes(chunk)
      for (let j = 0; j < bytes.length; j += 1) {
        parts.push(bytes[j] ?? 0)
      }
    }
    return decodePayload(Uint8Array.from(parts))
  } catch {
    return null
  }
}

const readPersonalConfig = async (): Promise<StoredConfig | null> => {
  const raw = await figma.clientStorage.getAsync(CLIENT_KEY)
  if (!raw || !Array.isArray(raw)) return null
  return decodePayload(Uint8Array.from(raw as number[]))
}

/** Read config using the 3-tier ladder. */
export const readConfig = async (): Promise<ReadConfigResult> => {
  const documentConfig = readDocumentConfig()
  if (documentConfig) {
    return {
      tier: 1,
      config: documentConfig,
      label: 'Using the config saved on this file',
    }
  }
  const personal = await readPersonalConfig()
  if (personal) {
    return {
      tier: 2,
      config: personal,
      label: 'Using your personal config — this file has no shared one',
    }
  }
  return {
    tier: 3,
    config: null,
    label:
      'No Tailwind config — generic Tailwind syntax; project prefix/settings may require changes. Add your config for confirmed names.',
    reason: 'missing',
  }
}

/** Remove document or personal config. */
export const removeConfig = async (tier: 1 | 2): Promise<void> => {
  if (tier === 1) {
    clearDocumentChunks(16)
    return
  }
  await figma.clientStorage.setAsync(CLIENT_KEY, undefined)
}
