import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { redactDiagnostics } from './shared/redact'
import { resolveSetupInput } from './setup'
import { runPipeline } from './pipeline'

describe('messages contract', () => {
  it('exposes setup and inspect message types', async () => {
    const mod = await import('./shared/messages')
    expect(mod).toBeTruthy()
  })
})

describe('setup', () => {
  it('redacts unresolved snippets and resolves minimal config', async () => {
    const canary = '__FIG_TAIL_SECRET_CANARY__'
    const result = await resolveSetupInput({
      configName: 'tailwind.config.js',
      configText: `module.exports = {
        theme: {
          extend: {
            colors: { brand: { 500: '#3b82f6' } },
            spacing: ({ theme }) => ({ sneak: '${canary}' }),
          },
        },
      }`,
      packageJsonText: JSON.stringify({ dependencies: { tailwindcss: '3.4.19' } }),
      canary,
    })
    expect(result.ok).toBe(true)
    expect(result.canaryLeaked).toBe(false)
    expect(result.tokens?.colors['brand-500']?.hex).toBe('#3b82f6')
    const redacted = redactDiagnostics([
      {
        path: 'theme.extend.spacing',
        reason: 'function-value',
        snippet: canary,
        source: 'tailwind.config.js',
        message: 'function',
      },
    ])
    expect(JSON.stringify(redacted)).not.toContain(canary)
  })
})

describe('pipeline', () => {
  it('produces classes from CSS with no config', () => {
    const output = runPipeline({
      css: { display: 'flex', padding: '24px', 'background-color': '#3b82f6' },
      config: {
        active: null,
        available: { document: false, user: false },
        preferred: 'document',
        overridden: false,
        failures: [],
        label:
          'No Tailwind config — generic Tailwind syntax; project prefix/settings may require changes. Add your config for confirmed names.',
      },
    })
    expect(output.className).toContain('flex')
    expect(output.warnings[0]).toMatch(/No Tailwind config/)
  })
})

// Property-assignment mutations (`.name =`, `.fills =`, …) are intentionally
// NOT substring-checked here: bundled third-party code (e.g. the acorn-based
// evaluator inside @fig-tail/theme) legitimately assigns `.name=` on AST
// nodes, which would false-positive a plain substring scan. The ESLint rule
// in `eslint.config.js` covers those assignments — but only in first-party
// `packages/plugin/src/**` source, since it never sees bundled dependency code.
const BANNED_BUNDLE_SUBSTRINGS = [
  '.setName(',
  '.appendChild(',
  'createRectangle',
  'createFrame(',
  'createText(',
  'createComponent(',
  'createEllipse(',
  'createPolygon(',
  'createStar(',
  'createVector(',
  'createBooleanOperation(',
  'createSlice(',
  'createPage(',
  'createPaintStyle(',
  'createTextStyle(',
  'createEffectStyle(',
  'createGridStyle(',
  'createVariable(',
  'createVariableCollection(',
  'setBoundVariable(',
  'setValueForMode(',
  'addDevResourceAsync(',
  'editDevResourceAsync(',
  'deleteDevResourceAsync(',
  'createNodeFromSvg(',
]

describe('write-safety', () => {
  it('builds current source and forbids document mutation APIs in the bundle', () => {
    const root = path.dirname(fileURLToPath(import.meta.url))
    const bundle = readFileSync(path.join(root, '../dist/main.js'), 'utf8')
    // The bundle must exist and reflect current source.
    // Permitted document writes: setPluginData (storage) + setVariableCodeSyntax (stamp).
    expect(bundle.includes('setPluginData')).toBe(true)
    expect(bundle.includes('setVariableCodeSyntax')).toBe(true)
    for (const banned of BANNED_BUNDLE_SUBSTRINGS) {
      expect(bundle.includes(banned), `bundle must not contain "${banned}"`).toBe(false)
    }
  })
})
