import * as esbuild from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(root, 'dist')
await mkdir(dist, { recursive: true })

/**
 * Figma's plugin sandbox (SES) rejects source that *looks like* a dynamic
 * `import(` via a coarse regex. Bundled Acorn (theme resolver) contains the
 * string `import()` in error messages and trips that check. Escape the
 * opening paren so the source no longer matches, while remaining valid JS.
 * @see https://github.com/figma/plugin-typings/issues/312
 */
const evadeSesImportCensor = (code) => code.replace(/import\(/g, 'import\\u0028')

await esbuild.build({
  entryPoints: [path.join(root, 'src/main.ts')],
  outfile: path.join(dist, 'main.js'),
  bundle: true,
  minify: true,
  platform: 'neutral',
  format: 'iife',
  target: 'es2020',
  logLevel: 'info',
})

const mainPath = path.join(dist, 'main.js')
await writeFile(mainPath, evadeSesImportCensor(await readFile(mainPath, 'utf8')))

const uiResult = await esbuild.build({
  entryPoints: [path.join(root, 'src/ui/main.tsx')],
  bundle: true,
  minify: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2020',
  write: false,
  logLevel: 'info',
})

const js = evadeSesImportCensor(uiResult.outputFiles?.[0]?.text ?? '')
const css = await readFile(path.join(root, 'src/ui/styles.css'), 'utf8').catch(() => '')
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>fig-tail</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js}</script>
</body>
</html>
`
await writeFile(path.join(dist, 'ui.html'), html)
console.log('plugin build ok')
