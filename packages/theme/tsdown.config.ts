import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  minify: false,
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
})
