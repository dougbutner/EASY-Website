import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        garden: {
          green: '#2d6a4f',
          amber: '#d4a373',
          moss: '#40916c',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
