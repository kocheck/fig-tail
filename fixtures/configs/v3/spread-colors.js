// A plain-JS config using the spread idiom the TypeScript pre-pass used to eat.
// `colors: { ...colors, brand: '#f00' }` looks like a type annotation to a regex
// that cannot tell `key:` from `: Type`, and the file stopped parsing.
const colors = require('tailwindcss/colors')

module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    colors: { ...colors, 'brand-500': '#3b82f6' },
    extend: {
      spacing: { 18: '4.5rem' },
    },
  },
}
