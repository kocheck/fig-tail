import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const pkg = path.join(root, '..')
const maxBytes = 65536

const build = spawnSync('pnpm', ['build'], { cwd: pkg, encoding: 'utf8', shell: true })
if (build.status !== 0) {
  console.error(build.stdout)
  console.error(build.stderr)
  process.exit(build.status ?? 1)
}

const outfile = path.join(pkg, 'dist/index.js')
const code = await readFile(outfile, 'utf8')
const bytes = Buffer.byteLength(code, 'utf8')
if (bytes > maxBytes) {
  throw new Error(`browser bundle ${bytes} exceeds ${maxBytes}`)
}
for (const banned of ['eval(', 'new Function', 'node:fs', 'node:path']) {
  if (code.includes(banned)) {
    throw new Error(`banned pattern ${banned}`)
  }
}
console.log(`probe:browser ok bytes=${bytes} (fresh tsdown dist)`)
