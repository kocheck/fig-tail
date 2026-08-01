import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { exportTokens } from './index'

const fixture = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../fixtures/configs/v3/minimal.js',
)

describe('cli export', () => {
  it('requires the trust flag', async () => {
    await expect(
      exportTokens({
        entry: fixture,
        cwd: path.dirname(fixture),
        cliVersion: '0.0.0',
        trust: false,
      }),
    ).rejects.toThrow(/trust-project/)
  })

  it('exports tokens from a trusted checkout', async () => {
    const result = await exportTokens({
      entry: path.basename(fixture),
      cwd: path.dirname(fixture),
      cliVersion: '0.0.0',
      trust: true,
    })
    expect(result.tokens.colors['brand-500']?.hex).toBe('#3b82f6')
    expect(result.provenance.kind).toBe('cli')
  })
})
