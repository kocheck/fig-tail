/** Monorepo-style config requiring a sibling package theme. */
const shared = require('@acme/tailwind-config')

module.exports = {
  presets: [shared],
  content: ['./apps/web/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 500: '#f97316' },
      },
    },
  },
}
