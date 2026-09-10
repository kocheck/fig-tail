#!/usr/bin/env node
/**
 * Reproduces the two empirical findings behind plans/013 and finding V7 in
 * docs/release/ux-findings-2026-09-10.md.
 *
 *   pnpm --filter @fig-tail/theme build && node scripts/repro-findings.mjs
 *
 * Read-only: resolves fixtures and prints. Touches nothing.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolveTheme } from '../packages/theme/dist/index.js'

const DIST = new URL('../packages/theme/dist/index.js', import.meta.url)
if (!existsSync(DIST)) {
  console.error('Build the theme package first:\n  pnpm --filter @fig-tail/theme build')
  process.exit(1)
}

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const rule = (t) => console.log(`\n${'='.repeat(72)}\n${t}\n${'='.repeat(72)}`)

// ---------------------------------------------------------------------------
rule('FINDING 1 — the gate returns GO while every project colour silently vanishes')

const shadcn = read('../fixtures/configs/v3/shadcn-like.js')
const resolved = resolveTheme({
  sources: [{ name: 'tailwind.config.js', text: shadcn }],
  tailwindVersion: { exact: '3.4.19', source: 'package-json' },
})

const tokens = resolved.tokens
console.log(`
What every signal plan 013 originally told you to read says:

  colours resolved ............ ${Object.keys(tokens?.colors ?? {}).length}
  unresolvedCount ............. ${resolved.unresolved.length}
  unknownNamespaces ........... ${JSON.stringify(tokens?.unknownNamespaces ?? null)}
  partialNamespaces ........... ${JSON.stringify(tokens?.partialNamespaces ?? [])}
  defaults .................... ${JSON.stringify(tokens?.source?.defaults ?? null)}

Every one of those reads clean. Now the only question that matters —
did THIS TEAM's own tokens survive?`)

// Names the fixture itself declares.
const declared = ['border', 'input', 'ring', 'background', 'foreground', 'primary']
let survived = 0
console.log()
for (const name of declared) {
  const present = Object.prototype.hasOwnProperty.call(tokens?.colors ?? {}, name)
  if (present) survived += 1
  console.log(`  ${present ? 'PRESENT' : 'ABSENT '}  colors.${name}`)
}
console.log(`\n  ${survived} of ${declared.length} declared colours survived.`)

// A token can also be present and permanently unmatchable.
const lg = tokens?.radius?.lg
console.log(`
  radius.lg ................... ${JSON.stringify(lg ?? null)}`)
if (lg && lg.px === null) {
  console.log('  ^ present but px:null — matchers/length.ts:43 does `if (token.px === null) continue`,')
  console.log('    so this token is in the set and can never match anything.')
}

console.log(`
VERDICT: a naive reading of this output is GO. The truth is that the plugin will
emit a raw hex for every brand-coloured layer this team has, because
hsl(var(--x)) is not an absolute colour and was dropped with ZERO diagnostics.`)

// ---------------------------------------------------------------------------
rule('FINDING 2 (V7, P0) — the TypeScript pre-pass corrupts plain JavaScript')

// The exact regex at packages/theme/src/v3/ts-prepass.ts:8.
const TS_STRIP = /:\s*[A-Za-z0-9_$.|<>,\s[\]{}]+(?=\s*[=,)])/g
const sample = `module.exports = {
  theme: {
    colors: s.colors,
  },
}`
console.log('\nInput (valid JavaScript):\n')
console.log(sample.split('\n').map((l) => '  ' + l).join('\n'))
console.log('\nAfter stripTypeScript:\n')
console.log(sample.replace(TS_STRIP, '').split('\n').map((l) => '  ' + l).join('\n'))
console.log(`
A closing brace is gone. acorn then fails to parse and v3/evaluate.ts:87 throws
"Replace dynamic TypeScript/JS constructs with plain values" — blaming the user
for JavaScript fig-tail mangled itself.`)

// End to end through the real resolver.
const spread = `const colors = require('tailwindcss/colors')
module.exports = {
  theme: {
    colors: { ...colors, brand: '#f00' },
  },
}`
const broken = resolveTheme({ sources: [{ name: 'tailwind.config.js', text: spread }] })
console.log(`
End to end, on \`colors: { ...colors, brand: '#f00' }\` — one of the most common
Tailwind idioms there is:

  ok ........... ${broken.ok}
  tokens ....... ${broken.tokens ? 'present' : 'null'}
  first error .. ${broken.unresolved[0]?.reason ?? '(none)'}: ${broken.unresolved[0]?.message ?? ''}`)

// ---------------------------------------------------------------------------
rule('CONTROL — a config that genuinely resolves, for comparison')

const minimal = resolveTheme({
  sources: [{ name: 'tailwind.config.js', text: read('../fixtures/configs/v3/minimal.js') }],
  tailwindVersion: { exact: '3.4.19', source: 'package-json' },
})
console.log(`
  colours ...................... ${Object.keys(minimal.tokens?.colors ?? {}).length}
  unknownNamespaces ............ ${JSON.stringify(minimal.tokens?.unknownNamespaces ?? null)}
  radius.lg .................... ${JSON.stringify(minimal.tokens?.radius?.lg ?? null)}

Note this is INDISTINGUISHABLE from the shadcn run on every field plan 013
originally asked the executor to read. That is the defect.
`)
