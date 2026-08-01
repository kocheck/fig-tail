import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')

describe('stamp guardrails', () => {
  it('has exactly one setVariableCodeSyntax call site in src', () => {
    const apply = readFileSync(path.join(root, 'src/stamp/apply.ts'), 'utf8')
    const others = [
      'src/stamp/stamp.ts',
      'src/mode-design.ts',
      'src/mode-dev.ts',
      'src/main.ts',
      'src/pipeline.ts',
      'src/storage.ts',
    ]
    expect(apply.match(/setVariableCodeSyntax/g)?.length ?? 0).toBe(1)
    for (const rel of others) {
      const text = readFileSync(path.join(root, rel), 'utf8')
      expect(text.includes('setVariableCodeSyntax')).toBe(false)
    }
  })

  it('never assigns variable.name', () => {
    const apply = readFileSync(path.join(root, 'src/stamp/apply.ts'), 'utf8')
    expect(apply).not.toMatch(/\.name\s*=/)
  })

  it('passes WEB platform', () => {
    const apply = readFileSync(path.join(root, 'src/stamp/apply.ts'), 'utf8')
    expect(apply).toContain("setVariableCodeSyntax('WEB'")
  })
})
