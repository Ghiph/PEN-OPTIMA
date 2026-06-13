/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#020817',
          900: '#050d1f',
          800: '#0a1628',
          700: '#0f2034',
          600: '#152944',
          500: '#1e3a5f',
        },
        cyan: { DEFAULT: '#00d4ff', dark: '#009ec0' },
        emerald: { DEFAULT: '#00e676' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(0,212,255,0.15)',
        'glow-lg': '0 0 40px rgba(0,212,255,0.2)',
        card: '0 4px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
};
