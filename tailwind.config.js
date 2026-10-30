/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#EFF5FD',
          100: '#DCE9F8',
          200: '#B9D2F0',
          300: '#8AB0E2',
          400: '#5A8ACF',
          500: '#2E6BC0',
          600: '#1B56A6',
          700: '#144582',
          800: '#103A6E',
          900: '#0B3570',
          950: '#071F42',
        },
        gold: {
          50: '#FFFBEB',
          100: '#FFF3C4',
          200: '#FFE588',
          300: '#FFD43B',
          400: '#FFCF3D',
          500: '#FFC400',
          600: '#E0A800',
          700: '#B78600',
          800: '#8A6500',
          900: '#5C4300',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 12px rgba(11,53,112,0.08)',
        pop: '0 8px 30px rgba(7,31,66,0.18)',
      },
    },
  },
  plugins: [],
}
