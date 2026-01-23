import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // NEM Insurance Color Scheme
        burgundy: {
          DEFAULT: '#800020',
          50: '#fef2f3',
          100: '#fde6e8',
          200: '#fbd0d5',
          300: '#f7aab2',
          400: '#f27a8a',
          500: '#e74c64',
          600: '#d12d4b',
          700: '#b0203d',
          800: '#800020', // Primary burgundy
          900: '#6b0019',
        },
        gold: {
          DEFAULT: '#FFD700',
          50: '#fffef7',
          100: '#fffbeb',
          200: '#fff4c6',
          300: '#ffed9e',
          400: '#ffe066',
          500: '#FFD700', // Primary gold
          600: '#e6c200',
          700: '#c7a600',
          800: '#a38800',
          900: '#856d00',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
};

export default config;
