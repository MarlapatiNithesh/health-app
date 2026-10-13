/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        liva: {
          cyan: '#00a8cc',
          blue: '#1e60f0',
          purple: '#6c35de',
          emerald: '#059669',
          amber: '#f59e0b',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'soft-sm': '0 2px 8px -2px rgba(0, 0, 0, 0.05)',
        'soft-md': '0 8px 24px -4px rgba(0, 0, 0, 0.06)',
        'soft-lg': '0 16px 36px -6px rgba(0, 0, 0, 0.08)',
        'glow-cyan': '0 0 20px -3px rgba(0, 168, 204, 0.35)',
        'glow-purple': '0 0 20px -3px rgba(108, 53, 222, 0.35)',
      }
    },
  },
  plugins: [],
};
