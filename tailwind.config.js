/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        draft: {
          bg: '#F5F4F0',
          panel: '#FFFFFF',
          ink: '#161615',
          muted: '#63625E',
          line: '#E2E0D8',
          solar: '#C85A17',
          wind: '#0369A1',
          eco: '#15803D',
        }
      }
    },
  },
  plugins: [],
}
