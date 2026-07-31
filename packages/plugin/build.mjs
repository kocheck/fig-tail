import * as esbuild from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(root, 'dist')
await mkdir(dist, { recursive: true })

await esbuild.build({
  entryPoints: [path.join(root, 'src/main.ts')],
  outfile: path.join(dist, 'main.js'),
  bundle: true,
  platform: 'neutral',
  format: 'iife',
  target: 'es2020',
  logLevel: 'info',
})

const uiResult = await esbuild.build({
  entryPoints: [path.join(root, 'src/ui/main.tsx')],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2020',
  write: false,
  logLevel: 'info',
})

const js = uiResult.outputFiles?.[0]?.text ?? ''
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
