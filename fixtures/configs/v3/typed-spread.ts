// A TypeScript config combining the spread idiom with `satisfies` and a default
// export — every construct the pre-pass regex used to eat.
import type { Config } from 'tailwindcss'
import colors from 'tailwindcss/colors'

export default {
  content: [],
  theme: {
    colors: { ...colors, 'brand-500': '#3b82f6' },
    extend: {
      spacing: { 18: '4.5rem' },
    },
  },
  plugins: [],
} satisfies Config
