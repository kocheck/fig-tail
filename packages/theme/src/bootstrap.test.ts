import { describe, expect, it } from 'vitest'
import { TOKEN_SET_SCHEMA_VERSION } from './index'

describe('bootstrap', () => {
  it('exposes schema version 1', () => {
    expect(TOKEN_SET_SCHEMA_VERSION).toBe(1)
  })
})
