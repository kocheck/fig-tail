import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          500: '#3b82f6',
        },
      },
      spacing: {
        gutter: '1.5rem',
      },
    },
  },
  plugins: [],
} satisfies Config

export default config
