import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    passWithNoTests: false,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test-helpers.ts'],
      thresholds: {
        statements: 90,
        lines: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
})
