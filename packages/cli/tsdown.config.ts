import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  minify: false,
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
})
