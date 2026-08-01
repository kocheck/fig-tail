#!/usr/bin/env node
import path from 'node:path'
import { exportTokens, writeExportFile } from './index'

const args = process.argv.slice(2)
const get = (flag: string): string | undefined => {
  const index = args.indexOf(flag)
  if (index === -1) return undefined
  return args[index + 1]
}

const command = args[0]
if (command !== 'export') {
  console.error('Usage: fig-tail export --entry <file> --out <file> --trust-project [--package-json <file>]')
  process.exit(1)
}

const entry = get('--entry')
const out = get('--out')
const trust = args.includes('--trust-project')
const packageJsonPath = get('--package-json')

if (!entry || !out) {
  console.error('Missing --entry or --out')
  process.exit(1)
}

const result = await exportTokens({
  entry,
  cwd: process.cwd(),
  cliVersion: '0.0.0',
  trust,
  ...(packageJsonPath ? { packageJsonPath } : {}),
})
await writeExportFile(path.resolve(out), result)
console.log(`Wrote ${out} (${result.unresolvedCount} unresolved)`)
