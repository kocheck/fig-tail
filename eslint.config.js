import js from '@eslint/js'
import tseslint from 'typescript-eslint'

const nodeBuiltins = [
  'fs',
  'fs/promises',
  'path',
  'process',
  'child_process',
  'os',
  'url',
  'buffer',
  'module',
  'worker_threads',
  'node:fs',
  'node:fs/promises',
  'node:path',
  'node:process',
  'node:child_process',
  'node:os',
  'node:url',
  'node:buffer',
  'node:module',
  'node:worker_threads',
]

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/data/**',
      '**/spike/**',
      'spikes/**',
      'fixtures/**',
      '**/scripts/**',
      '**/*.mjs',
      '**/build.mjs',
      '**/*.test.ts',
      '**/test-helpers.ts',
    ],
  },
  {
    files: ['packages/theme/src/**/*.{ts,tsx}', 'packages/match/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: nodeBuiltins.map((name) => ({
            name,
            message: 'Browser/plugin packages must not import Node built-ins.',
          })),
          patterns: [
            {
              group: ['node:*'],
              message: 'Browser/plugin packages must not import Node built-ins.',
            },
          ],
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Use named exports only.',
        },
      ],
    },
  },
  {
    // Write-safety invariant (plan 003 Step 7, program-wide per plans/README.md):
    // fig-tail never mutates the Figma document except via
    // `figma.root.setPluginData` under `figtail`-prefixed keys (this plan) and
    // `Variable.setVariableCodeSyntax('WEB', …)` (plan 007). Every other
    // document-mutation API is banned below. `setPluginData` itself is
    // intentionally left off this list — `no-restricted-syntax`/
    // `no-restricted-properties` have no clean "ban except one call site"
    // allowlist mechanism, so the single permitted call in `src/storage.ts`
    // instead carries a targeted `eslint-disable-next-line` comment naming
    // this plan, and `write-safety.test.ts` independently audits the built
    // bundle for every OTHER banned identifier.
    files: ['packages/plugin/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'figma',
          property: 'createNodeFromSvg',
          message: 'Write-safety: document mutation APIs are forbidden.',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Use named exports only.',
        },
        {
          selector: "CallExpression[callee.property.name='setName']",
          message: 'Write-safety: node name mutation is forbidden.',
        },
        {
          selector: "CallExpression[callee.property.name='appendChild']",
          message: 'Write-safety: document structure mutation is forbidden.',
        },
        {
          selector: "CallExpression[callee.property.name='remove']",
          message: 'Write-safety: node removal is forbidden.',
        },
        {
          selector: "CallExpression[callee.property.name='setBoundVariable']",
          message: 'Write-safety: variable binding mutation is forbidden.',
        },
        {
          selector: "CallExpression[callee.property.name='setValueForMode']",
          message: 'Write-safety: variable mode value mutation is forbidden.',
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(createVariable|createVariableCollection|createRectangle|createFrame|createText|createComponent|createEllipse|createPolygon|createStar|createVector|createBooleanOperation|createSlice|createPage|createPaintStyle|createTextStyle|createEffectStyle|createGridStyle)$/]",
          message: 'Write-safety: node/variable/style creation is forbidden.',
        },
        {
          selector:
            "CallExpression[callee.property.name=/^(addDevResourceAsync|editDevResourceAsync|deleteDevResourceAsync)$/]",
          message: 'Write-safety: dev resource mutation is forbidden.',
        },
        {
          selector:
            "AssignmentExpression[left.type='MemberExpression'][left.property.name=/^(name|characters|fills|strokes|cornerRadius|paddingTop|paddingBottom|paddingLeft|paddingRight|topLeftRadius|topRightRadius|bottomLeftRadius|bottomRightRadius)$/]",
          message: 'Write-safety: node/variable property mutation is forbidden.',
        },
      ],
    },
  },
)
