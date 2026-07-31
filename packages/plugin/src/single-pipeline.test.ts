import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const srcRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '.')

const collectSourceFiles = (dir: string): string[] => {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    if (entry.name === 'node_modules') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(full))
      continue
    }
    if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
      files.push(full)
    }
  }
  return files
}

describe('single-pipeline invariant', () => {
  it('imports matchDeclarations in exactly one file (pipeline.ts)', () => {
    const files = collectSourceFiles(srcRoot)
    const importers = files.filter((file) => readFileSync(file, 'utf8').includes('matchDeclarations'))
    expect(importers).toEqual([path.join(srcRoot, 'pipeline.ts')])
  })
})
