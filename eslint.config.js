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
          selector:
            "CallExpression[callee.property.name='setName']",
          message: 'Write-safety: node name mutation is forbidden.',
        },
        {
          selector:
            "CallExpression[callee.property.name='appendChild']",
          message: 'Write-safety: document structure mutation is forbidden.',
        },
        {
          selector:
            "MemberExpression[property.name='characters'][parent.type='AssignmentExpression']",
          message: 'Write-safety: text content mutation is forbidden.',
        },
      ],
    },
  },
)
