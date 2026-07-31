import { describe, expect, it } from 'vitest'
import {
  formatStorageFailure,
  meaningfulStorageFailures,
  storageFailureMessages,
  writeFailureSeverity,
} from './errors'
import type { StorageFailure } from '../storage-types'

const failure = (overrides: Partial<StorageFailure> & Pick<StorageFailure, 'tier' | 'reason'>): StorageFailure => ({
  detail: overrides.detail ?? overrides.reason,
  ...overrides,
})

describe('meaningfulStorageFailures', () => {
  it('drops pure missing tiers', () => {
    expect(
      meaningfulStorageFailures([
        failure({ tier: 'document', reason: 'missing' }),
        failure({ tier: 'user', reason: 'checksum' }),
      ]),
    ).toEqual([failure({ tier: 'user', reason: 'checksum' })])
  })
})

describe('storageFailureMessages', () => {
  it('explains document corrupt → personal fallback', () => {
    expect(
      storageFailureMessages(
        [
          failure({ tier: 'document', reason: 'checksum' }),
          failure({ tier: 'user', reason: 'missing' }),
        ],
        'user',
      ),
    ).toEqual(['Shared config unreadable (checksum) — using personal'])
  })

  it('surfaces unreadable configs when nothing is active', () => {
    const messages = storageFailureMessages(
      [
        failure({ tier: 'document', reason: 'parse' }),
        failure({ tier: 'user', reason: 'schema' }),
      ],
      null,
    )
    expect(messages).toEqual([
      'Shared config unreadable (parse)',
      'Personal config unreadable (schema)',
    ])
  })

  it('formats a single failure', () => {
    expect(formatStorageFailure(failure({ tier: 'document', reason: 'no-access' }))).toBe(
      'Shared config unavailable (no access)',
    )
  })
})

describe('writeFailureSeverity', () => {
  it('maps reasons to banner severity', () => {
    expect(writeFailureSeverity('no-edit-access')).toBe('no-edit')
    expect(writeFailureSeverity('quota')).toBe('warn')
    expect(writeFailureSeverity('validation')).toBe('danger')
    expect(writeFailureSeverity('write-failed')).toBe('danger')
  })
})
