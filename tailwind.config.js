/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: {
          purple: '#b44fff',
          pink: '#ff2d78',
          cyan: '#00f5ff',
          green: '#39ff14',
        },
        dark: {
          950: '#050508',
          900: '#0a0a12',
          800: '#0f0f1a',
          700: '#141425',
          600: '#1a1a30',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-neon': 'pulse-neon 2s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'eq-bar': 'eq-bar 0.5s ease-in-out infinite alternate',
      },
      keyframes: {
        'pulse-neon': {
          '0%, 100%': { boxShadow: '0 0 5px #b44fff, 0 0 10px #b44fff' },
          '50%': { boxShadow: '0 0 20px #b44fff, 0 0 40px #b44fff' },
        },
      },
    },
  },
  plugins: [],
}
