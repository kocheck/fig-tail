import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate'
import {
  validateConfigProvenance,
  validateTokenSet,
  type ConfigProvenance,
  type TokenSet,
} from '@fig-tail/theme'
import type {
  PersistedDiagnostic,
  ReadConfigResult,
  StorageFailure,
  StoredConfig,
  WriteResult,
} from './storage-types'

export { redactDiagnostics } from './shared/redact'

/**
 * Write-safety note (plan 003): `figma.root.setPluginData` below is one of
 * exactly two document-write APIs permitted anywhere in this codebase (the
 * other is variable WEB code-syntax stamping in plan 007). It writes
 * only under the `figtail`-prefixed keys defined here, never a node name,
 * style, or variable value.
 */
const PREFIX = 'figtail'
const META_KEY = `${PREFIX}.meta`
const PAYLOAD_PREFIX = `${PREFIX}.payload.`
const DOCUMENT_ID_KEY = `${PREFIX}.document-id`
const CLIENT_CONFIG_KEY = `${PREFIX}.user-config`
const CLIENT_PREFERRED_KEY = `${PREFIX}.preferred`
const CHUNK_BYTES = 80_000
const STALE_CLEAR_FLOOR = 8

// ---------------------------------------------------------------------------
// Pure helpers — no `figma` global, safe to unit test directly.
// ---------------------------------------------------------------------------

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='

export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] ?? 0)
  }
  let output = ''
  let i = 0
  while (i < binary.length) {
    const a = binary.charCodeAt(i++)
    const b = i < binary.length ? binary.charCodeAt(i++) : Number.NaN
    const c = i < binary.length ? binary.charCodeAt(i++) : Number.NaN
    const bitmap = (a << 16) | ((Number.isNaN(b) ? 0 : b) << 8) | (Number.isNaN(c) ? 0 : c)
    output += BASE64_CHARS.charAt((bitmap >> 18) & 63)
    output += BASE64_CHARS.charAt((bitmap >> 12) & 63)
    output += Number.isNaN(b) ? '=' : BASE64_CHARS.charAt((bitmap >> 6) & 63)
    output += Number.isNaN(c) ? '=' : BASE64_CHARS.charAt(bitmap & 63)
  }
  return output
}

export const base64ToBytes = (value: string): Uint8Array => {
  const str = value.replace(/[^A-Za-z0-9+/=]/g, '')
  const output: number[] = []
  let i = 0
  while (i < str.length) {
    const a = BASE64_CHARS.indexOf(str.charAt(i++))
    const b = BASE64_CHARS.indexOf(str.charAt(i++))
    const c = BASE64_CHARS.indexOf(str.charAt(i++))
    const d = BASE64_CHARS.indexOf(str.charAt(i++))
    const bitmap = (a << 18) | (b << 12) | ((c & 63) << 6) | (d & 63)
    output.push((bitmap >> 16) & 255)
    if (c !== 64) output.push((bitmap >> 8) & 255)
    if (d !== 64) output.push(bitmap & 255)
  }
  return Uint8Array.from(output)
}

/** Split gzipped bytes into ≤`chunkBytes` base64 strings, `figtail.payload.<i>`. */
export const splitIntoChunks = (bytes: Uint8Array, chunkBytes: number = CHUNK_BYTES): string[] => {
  if (bytes.length === 0) return ['']
  const chunks: string[] = []
  let offset = 0
  while (offset < bytes.length) {
    chunks.push(bytesToBase64(bytes.slice(offset, offset + chunkBytes)))
    offset += chunkBytes
  }
  return chunks
}

/** Rejoin base64 chunk strings back into the original byte stream. */
export const joinChunks = (chunks: string[]): Uint8Array => {
  const parts: number[] = []
  for (const chunk of chunks) {
    const bytes = base64ToBytes(chunk)
    for (let i = 0; i < bytes.length; i += 1) {
      parts.push(bytes[i] ?? 0)
    }
  }
  return Uint8Array.from(parts)
}

/** How many stale chunk keys must be cleared on a shrinking rewrite. */
export const staleChunkClearCount = (previousChunks: number, nextChunks: number): number =>
  Math.max(previousChunks - nextChunks, 0)

/** Deterministic-enough 32-bit hash used as a cheap partial-write checksum. */
export const checksumOf = (bytes: Uint8Array): string => {
  let hash = 0x811c9dc5
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= bytes[i] ?? 0
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

const generateId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`

/** gzip + JSON-serialize a `StoredConfig` — the only bytes ever persisted. */
export const encodeConfig = (config: StoredConfig): Uint8Array => gzipSync(strToU8(JSON.stringify(config)))

class DecodeError extends Error {
  reason: 'decompress' | 'parse'
  constructor(reason: 'decompress' | 'parse', detail: string) {
    super(detail)
    this.reason = reason
  }
}

/** gunzip + JSON.parse, distinguishing decompress failures from parse failures. */
export const decodeBytes = (bytes: Uint8Array): unknown => {
  let json: string
  try {
    json = strFromU8(gunzipSync(bytes))
  } catch (error) {
    throw new DecodeError('decompress', messageOf(error))
  }
  try {
    return JSON.parse(json)
  } catch (error) {
    throw new DecodeError('parse', messageOf(error))
  }
}

/** Keys that must never appear in a serialized `StoredConfig`. */
const FORBIDDEN_SERIALIZED_KEYS = ['"sourceText"', '"snippet"', '"text"']

/** Defense-in-depth: assert the serialized payload carries no raw source. */
export const assertNoForbiddenFields = (serialized: string): string[] =>
  FORBIDDEN_SERIALIZED_KEYS.filter((key) => serialized.includes(key))

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Validate the full persisted envelope, including tokens and provenance. */
export const validateStoredConfig = (
  value: unknown,
): { ok: true; value: StoredConfig } | { ok: false; errors: string[] } => {
  const errors: string[] = []
  if (!isRecord(value)) {
    return { ok: false, errors: ['StoredConfig must be an object'] }
  }
  if (value.formatVersion !== 1) {
    errors.push('formatVersion must be 1')
  }
  const tokenResult = validateTokenSet(value.tokens)
  if (!tokenResult.ok) {
    errors.push(...tokenResult.errors.map((e) => `tokens.${e}`))
  }
  const provenanceResult = validateConfigProvenance(value.provenance)
  if (!provenanceResult.ok) {
    errors.push(...provenanceResult.errors.map((e) => `provenance.${e}`))
  }
  if (!isRecord(value.resolution)) {
    errors.push('resolution must be an object')
  } else {
    const resolution = value.resolution
    if (!Array.isArray(resolution.unresolved)) {
      errors.push('resolution.unresolved must be an array')
    } else {
      resolution.unresolved.forEach((item, index) => {
        if (!isRecord(item)) {
          errors.push(`resolution.unresolved[${index}] must be an object`)
          return
        }
        if (typeof item.path !== 'string') errors.push(`resolution.unresolved[${index}].path must be a string`)
        if (typeof item.reason !== 'string') errors.push(`resolution.unresolved[${index}].reason must be a string`)
        if (typeof item.message !== 'string') errors.push(`resolution.unresolved[${index}].message must be a string`)
        if (typeof item.source !== 'string') errors.push(`resolution.unresolved[${index}].source must be a string`)
        if (item.line !== undefined && typeof item.line !== 'number') {
          errors.push(`resolution.unresolved[${index}].line must be a number`)
        }
        if (item.snippet !== undefined) {
          errors.push(`resolution.unresolved[${index}].snippet must never be persisted`)
        }
      })
    }
    if (!Array.isArray(resolution.warnings) || !resolution.warnings.every((w) => typeof w === 'string')) {
      errors.push('resolution.warnings must be string[]')
    }
  }
  if (typeof value.storedAt !== 'string') {
    errors.push('storedAt must be an ISO string')
  }
  if (typeof value.documentConfigId !== 'string') {
    errors.push('documentConfigId must be a string')
  }
  if (errors.length > 0) {
    return { ok: false, errors }
  }
  return { ok: true, value: value as StoredConfig }
}

/** Build a draft `StoredConfig`; `writeConfig` overwrites `storedAt`/`documentConfigId`. */
export const buildStoredConfig = (
  tokens: TokenSet,
  provenance: ConfigProvenance,
  unresolved: PersistedDiagnostic[],
  warnings: string[],
): StoredConfig => ({
  formatVersion: 1,
  tokens,
  provenance,
  resolution: { unresolved, warnings },
  storedAt: new Date().toISOString(),
  documentConfigId: '',
})

// ---------------------------------------------------------------------------
// `figma`-touching helpers. Read helpers never throw past their call site;
// write helpers throw and are caught by the exported write/clear functions.
// ---------------------------------------------------------------------------

type StorageMeta = {
  formatVersion: 1
  chunks: number
  byteLength: number
  checksum: string
  storedAt: string
  documentConfigId: string
}

type RawTierRead = { ok: true; config: StoredConfig } | { ok: false; failure: StorageFailure }

let cachedDocument: RawTierRead | null = null
let cachedUser: RawTierRead | null = null

const invalidateCache = () => {
  cachedDocument = null
  cachedUser = null
}

const readDocumentId = (): string | null => {
  try {
    const existing = figma.root.getPluginData(DOCUMENT_ID_KEY)
    return existing || null
  } catch {
    return null
  }
}

const ensureDocumentId = (): string => {
  const existing = readDocumentId()
  if (existing) return existing
  const id = generateId('doc')
  // Write-safety exception (plan 003): private, fig-tail-prefixed document metadata only.
  figma.root.setPluginData(DOCUMENT_ID_KEY, id)
  return id
}

const parseMeta = (raw: string): StorageMeta | null => {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) return null
    if (parsed.formatVersion !== 1 || typeof parsed.chunks !== 'number') return null
    return parsed as StorageMeta
  } catch {
    return null
  }
}

const readDocumentTier = (): RawTierRead => {
  let metaRaw: string
  try {
    metaRaw = figma.root.getPluginData(META_KEY)
  } catch (error) {
    return { ok: false, failure: { tier: 'document', reason: 'no-access', detail: messageOf(error) } }
  }
  if (!metaRaw) {
    return { ok: false, failure: { tier: 'document', reason: 'missing', detail: 'no document config stored' } }
  }
  const meta = parseMeta(metaRaw)
  if (!meta) {
    return { ok: false, failure: { tier: 'document', reason: 'invalid-meta', detail: 'meta is not valid' } }
  }
  const chunkStrings: string[] = []
  for (let i = 0; i < meta.chunks; i += 1) {
    let chunk: string
    try {
      chunk = figma.root.getPluginData(`${PAYLOAD_PREFIX}${i}`)
    } catch (error) {
      return { ok: false, failure: { tier: 'document', reason: 'no-access', detail: messageOf(error) } }
    }
    if (!chunk) {
      return { ok: false, failure: { tier: 'document', reason: 'missing-chunk', detail: `chunk ${i} missing` } }
    }
    chunkStrings.push(chunk)
  }
  const bytes = joinChunks(chunkStrings)
  if (checksumOf(bytes) !== meta.checksum) {
    return { ok: false, failure: { tier: 'document', reason: 'checksum', detail: 'checksum mismatch' } }
  }
  return decodeAndValidate(bytes, 'document')
}

const readUserTier = async (): Promise<RawTierRead> => {
  let raw: unknown
  try {
    raw = await figma.clientStorage.getAsync(CLIENT_CONFIG_KEY)
  } catch (error) {
    return { ok: false, failure: { tier: 'user', reason: 'no-access', detail: messageOf(error) } }
  }
  if (!raw || !Array.isArray(raw)) {
    return { ok: false, failure: { tier: 'user', reason: 'missing', detail: 'no personal config stored' } }
  }
  const bytes = Uint8Array.from(raw as number[])
  return decodeAndValidate(bytes, 'user')
}

const decodeAndValidate = (bytes: Uint8Array, tier: 'document' | 'user'): RawTierRead => {
  let parsed: unknown
  try {
    parsed = decodeBytes(bytes)
  } catch (error) {
    const reason = error instanceof DecodeError ? error.reason : 'parse'
    return { ok: false, failure: { tier, reason, detail: messageOf(error) } }
  }
  const validation = validateStoredConfig(parsed)
  if (!validation.ok) {
    return { ok: false, failure: { tier, reason: 'schema', detail: validation.errors.join('; ') } }
  }
  return { ok: true, config: validation.value }
}

const getPreferred = async (): Promise<'document' | 'user'> => {
  try {
    const raw = await figma.clientStorage.getAsync(CLIENT_PREFERRED_KEY)
    return raw === 'user' ? 'user' : 'document'
  } catch {
    return 'document'
  }
}

const labelFor = (
  activeTier: 'document' | 'user' | null,
  overridden: boolean,
): string => {
  if (activeTier === 'document') {
    return 'Using the config saved on this file'
  }
  if (activeTier === 'user') {
    return overridden
      ? "Using your personal config — overriding this file's shared config"
      : 'Using your personal config — this file has no shared one'
  }
  return 'No Tailwind config — generic Tailwind syntax; project prefix/settings may require changes. Add your config for confirmed names.'
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Read config across the document/user ladder. Always returns a complete result. */
export const readConfig = async (): Promise<ReadConfigResult> => {
  if (!cachedDocument) {
    cachedDocument = readDocumentTier()
  }
  if (!cachedUser) {
    cachedUser = await readUserTier()
  }
  const failures: StorageFailure[] = []
  if (!cachedDocument.ok) failures.push(cachedDocument.failure)
  if (!cachedUser.ok) failures.push(cachedUser.failure)

  const available = { document: cachedDocument.ok, user: cachedUser.ok }
  const preferred = await getPreferred()

  let activeTier: 'document' | 'user' | null = null
  if (preferred === 'document' && available.document) {
    activeTier = 'document'
  } else if (preferred === 'user' && available.user) {
    activeTier = 'user'
  } else if (available.document) {
    activeTier = 'document'
  } else if (available.user) {
    activeTier = 'user'
  }

  const overridden = available.document && available.user && preferred === 'user'
  const label = labelFor(activeTier, overridden)

  if (!activeTier) {
    return { active: null, available, preferred, overridden, failures, label }
  }
  const tierRead = activeTier === 'document' ? cachedDocument : cachedUser
  if (!tierRead.ok) {
    return { active: null, available, preferred, overridden, failures, label }
  }
  return {
    active: {
      config: tierRead.config,
      tier: activeTier,
      documentConfigId: tierRead.config.documentConfigId || null,
    },
    available,
    preferred,
    overridden,
    failures,
    label,
  }
}

/** Write resolved config to the requested tier. Never silently changes scope. */
export const writeConfig = async (
  payload: StoredConfig,
  options: { target: 'document' | 'user' },
): Promise<WriteResult> => {
  const validation = validateStoredConfig(payload)
  if (!validation.ok) {
    return {
      ok: false,
      writtenTo: null,
      reason: 'validation',
      needsPersonalConfirmation: false,
      errors: validation.errors,
    }
  }

  if (options.target === 'document') {
    try {
      const documentConfigId = ensureDocumentId()
      const finalConfig: StoredConfig = {
        ...validation.value,
        storedAt: new Date().toISOString(),
        documentConfigId,
      }
      const serialized = JSON.stringify(finalConfig)
      const forbidden = assertNoForbiddenFields(serialized)
      if (forbidden.length > 0) {
        return {
          ok: false,
          writtenTo: null,
          reason: 'validation',
          needsPersonalConfirmation: false,
          errors: [`serialized config must not contain ${forbidden.join(', ')}`],
        }
      }
      writeDocumentChunks(finalConfig)
      invalidateCache()
      return { ok: true, writtenTo: 'document', documentConfigId }
    } catch (error) {
      return {
        ok: false,
        writtenTo: null,
        reason: classifyWriteError(error),
        needsPersonalConfirmation: true,
        errors: [messageOf(error)],
      }
    }
  }

  try {
    const documentConfigId = readDocumentId() ?? generateId('personal')
    const finalConfig: StoredConfig = {
      ...validation.value,
      storedAt: new Date().toISOString(),
      documentConfigId,
    }
    const serialized = JSON.stringify(finalConfig)
    const forbidden = assertNoForbiddenFields(serialized)
    if (forbidden.length > 0) {
      return {
        ok: false,
        writtenTo: null,
        reason: 'validation',
        needsPersonalConfirmation: false,
        errors: [`serialized config must not contain ${forbidden.join(', ')}`],
      }
    }
    const bytes = encodeConfig(finalConfig)
    await figma.clientStorage.setAsync(CLIENT_CONFIG_KEY, Array.from(bytes))
    invalidateCache()
    return { ok: true, writtenTo: 'user', documentConfigId }
  } catch (error) {
    const reason = /quota|limit|exceed/i.test(messageOf(error)) ? 'quota' : 'write-failed'
    return { ok: false, writtenTo: null, reason, needsPersonalConfirmation: false, errors: [messageOf(error)] }
  }
}

const classifyWriteError = (error: unknown): 'no-edit-access' | 'quota' | 'write-failed' => {
  const message = messageOf(error)
  if (/quota|limit|exceed|100 ?kb|100000/i.test(message)) return 'quota'
  if (/permission|edit access|read-?only|cannot be used/i.test(message)) return 'no-edit-access'
  return 'no-edit-access'
}

const writeDocumentChunks = (config: StoredConfig) => {
  const bytes = encodeConfig(config)
  const chunks = splitIntoChunks(bytes)
  const previousMeta = parseMeta(figma.root.getPluginData(META_KEY))
  const previousChunks = previousMeta?.chunks ?? 0

  // Write-safety exception (plan 003): private, fig-tail-prefixed document metadata only.
  chunks.forEach((chunk, index) => {
    figma.root.setPluginData(`${PAYLOAD_PREFIX}${index}`, chunk)
  })

  const staleCount = staleChunkClearCount(previousChunks, chunks.length)
  for (let i = 0; i < staleCount; i += 1) {
    figma.root.setPluginData(`${PAYLOAD_PREFIX}${chunks.length + i}`, '')
  }

  const meta: StorageMeta = {
    formatVersion: 1,
    chunks: chunks.length,
    byteLength: bytes.length,
    checksum: checksumOf(bytes),
    storedAt: config.storedAt,
    documentConfigId: config.documentConfigId,
  }
  // Meta is written LAST — its presence is what makes a partial write detectable.
  // Write-safety exception (plan 003): private, fig-tail-prefixed document metadata only.
  figma.root.setPluginData(META_KEY, JSON.stringify(meta))
}

const clearDocumentChunks = () => {
  const previousMeta = parseMeta(figma.root.getPluginData(META_KEY))
  const bound = Math.max(previousMeta?.chunks ?? 0, STALE_CLEAR_FLOOR)
  // Write-safety exception (plan 003): private, fig-tail-prefixed document metadata only.
  for (let i = 0; i < bound; i += 1) {
    figma.root.setPluginData(`${PAYLOAD_PREFIX}${i}`, '')
  }
  figma.root.setPluginData(META_KEY, '')
}

/** Clear the requested tier. */
export const clearConfig = async (target: 'document' | 'user'): Promise<WriteResult> => {
  if (target === 'document') {
    try {
      clearDocumentChunks()
      invalidateCache()
      return { ok: true, writtenTo: 'document', documentConfigId: null }
    } catch (error) {
      return {
        ok: false,
        writtenTo: null,
        reason: classifyWriteError(error),
        needsPersonalConfirmation: true,
        errors: [messageOf(error)],
      }
    }
  }
  try {
    await figma.clientStorage.setAsync(CLIENT_CONFIG_KEY, undefined)
    invalidateCache()
    return { ok: true, writtenTo: 'user', documentConfigId: null }
  } catch (error) {
    return { ok: false, writtenTo: null, reason: 'write-failed', needsPersonalConfirmation: false, errors: [messageOf(error)] }
  }
}

/** Persist which tier the user prefers when both are available. */
export const setPreferredSource = async (preferred: 'document' | 'user'): Promise<void> => {
  await figma.clientStorage.setAsync(CLIENT_PREFERRED_KEY, preferred)
}
