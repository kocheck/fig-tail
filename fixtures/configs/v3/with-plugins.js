/** Config with plugins contributing theme (unresolvable requires). */
module.exports = {
  content: ['./src/**/*.{js,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 500: '#8b5cf6' },
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
}
