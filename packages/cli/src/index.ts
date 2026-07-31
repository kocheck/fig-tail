import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { resolveTheme, type ConfigProvenance, type TokenSet } from '@fig-tail/theme'

export type CliExportResult = {
  tokens: TokenSet
  provenance: ConfigProvenance
  unresolvedCount: number
}

/** Export a resolved token set from a trusted local checkout. */
export const exportTokens = async (input: {
  entry: string
  cwd: string
  cliVersion: string
  trust: boolean
  packageJsonPath?: string
}): Promise<CliExportResult> => {
  if (!input.trust) {
    throw new Error('Refusing to read project files without --trust-project')
  }
  const absolute = path.resolve(input.cwd, input.entry)
  const text = await readFile(absolute, 'utf8')
  let exact: string | undefined
  if (input.packageJsonPath) {
    const pkg = JSON.parse(await readFile(path.resolve(input.cwd, input.packageJsonPath), 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const raw = pkg.dependencies?.tailwindcss ?? pkg.devDependencies?.tailwindcss
    if (raw && /^\d+\.\d+\.\d+$/.test(raw)) exact = raw
  }
  const resolved = resolveTheme({
    sources: [{ name: path.basename(input.entry), text }],
    ...(exact ? { tailwindVersion: { exact, source: 'package-json' as const } } : {}),
  })
  if (!resolved.tokens) {
    throw new Error(resolved.unresolved[0]?.message ?? 'resolve failed')
  }
  const sha = createHash('sha256').update(text).digest('hex')
  const provenance: ConfigProvenance = {
    kind: 'cli',
    sources: [
      {
        name: path.basename(input.entry),
        sha256: sha,
        byteLength: Buffer.byteLength(text),
      },
    ],
    resolvedAt: new Date().toISOString(),
    inputSha256: sha,
    cliVersion: input.cliVersion,
    targetTailwindVersion: exact ?? '0.0.0',
    projectName: path.basename(input.cwd),
    entry: input.entry,
  }
  return {
    tokens: resolved.tokens,
    provenance,
    unresolvedCount: resolved.unresolved.length,
  }
}

/** Write a fig-tail token JSON for plugin import. */
export const writeExportFile = async (
  outPath: string,
  result: CliExportResult,
): Promise<void> => {
  await writeFile(
    outPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        tokens: result.tokens,
        provenance: result.provenance,
        unresolvedCount: result.unresolvedCount,
      },
      null,
      2,
    ),
  )
}
