/** Config that references an external preset. */
module.exports = {
  presets: [require('./shared-preset.js')],
  content: ['./src/**/*.tsx'],
  theme: {
    extend: {
      colors: {
        accent: { 500: '#22c55e' },
      },
    },
  },
}
