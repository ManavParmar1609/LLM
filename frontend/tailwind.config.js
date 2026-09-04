/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        dock: {
          900: '#ffffff',
          800: '#f5f5f7',
          700: '#e8e8ed',
          600: '#d2d2d7',
          500: '#86868b',
        },
        apple: {
          blue: '#0071e3',
          darkblue: '#0077ed',
          text: '#1d1d1f',
          secondary: '#86868b',
          tertiary: '#6e6e73',
          bg: '#f5f5f7',
          card: '#ffffff',
          border: 'rgba(0,0,0,0.08)',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.35s ease-out',
      },
      keyframes: {
        slideIn: { '0%': { transform: 'translateY(-8px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        fadeIn: { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
      },
      boxShadow: {
        'apple': '0 2px 12px rgba(0,0,0,0.06)',
        'apple-lg': '0 4px 24px rgba(0,0,0,0.08)',
        'apple-xl': '0 8px 40px rgba(0,0,0,0.1)',
      }
    },
  },
  plugins: [],
}
