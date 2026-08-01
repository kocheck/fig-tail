/** Minimal v3 config with a small extend. */
module.exports = {
  content: ['./src/**/*.{js,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          500: '#3b82f6',
          600: '#2563eb',
        },
      },
      spacing: {
        18: '4.5rem',
      },
      borderRadius: {
        lg: '0.5rem',
      },
    },
  },
}
