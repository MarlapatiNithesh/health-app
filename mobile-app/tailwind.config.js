/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          canvas: '#080c14',
          surface: 'rgba(15, 23, 42, 0.75)',
          subcard: 'rgba(30, 41, 59, 0.50)',
          border: 'rgba(255, 255, 255, 0.08)',
          'border-highlight': 'rgba(255, 255, 255, 0.18)',
        },
        cyber: {
          cyan: '#00f2fe',
          teal: '#06b6d4',
          blue: '#3b82f6',
          violet: '#8b5cf6',
          purple: '#7c3aed',
          emerald: '#10b981',
          rose: '#f43f5e',
          amber: '#f59e0b',
        },
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
          cyan: '#00f2fe',
          blue: '#1e60f0',
          purple: '#6c35de',
          emerald: '#10b981',
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
        'glow-cyan': '0 0 24px -2px rgba(6, 182, 212, 0.45)',
        'glow-purple': '0 0 24px -2px rgba(139, 92, 246, 0.45)',
        'glow-emerald': '0 0 24px -2px rgba(16, 185, 129, 0.45)',
        'glass-card': '0 16px 36px 0 rgba(0, 0, 0, 0.45)',
        'glass-dock': '0 20px 50px 0 rgba(0, 0, 0, 0.70)',
      }
    },
  },
  plugins: [],
};
