import { describe, expect, it } from 'vitest'
import { resolveTheme } from './resolve'
import { V3_DEFAULTS_VERSION, V4_DEFAULTS_VERSION } from './defaults'

describe('consistency', () => {
  it('agrees on shared design-intent tokens across v3 and v4', () => {
    const v3 = resolveTheme({
      sources: [
        {
          name: 'tailwind.config.js',
          text: `module.exports = {
            theme: {
              extend: {
                colors: { brand: { 500: '#3b82f6' } },
                spacing: { gutter: '1.5rem' },
                borderRadius: { lg: '0.5rem' },
              },
            },
          }`,
        },
      ],
      tailwindVersion: { exact: V3_DEFAULTS_VERSION, source: 'package-json' },
    })
    const v4 = resolveTheme({
      sources: [
        {
          name: 'app.css',
          text: `@import "tailwindcss";
@theme {
  --color-brand-500: #3b82f6;
  --spacing-gutter: 1.5rem;
  --radius-lg: 0.5rem;
}`,
        },
      ],
      tailwindVersion: { exact: V4_DEFAULTS_VERSION, source: 'package-json' },
    })
    expect(v3.ok && v4.ok).toBe(true)
    expect(v3.tokens?.colors['brand-500']?.hex).toBe(v4.tokens?.colors['brand-500']?.hex)
    expect(v3.tokens?.spacing.scale.gutter?.px).toBe(v4.tokens?.spacing.named.gutter?.px)
    expect(v3.tokens?.radius.lg?.px).toBe(v4.tokens?.radius.lg?.px)
  })
})
