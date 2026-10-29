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
          50: '#f0f5fb',
          100: '#dbe7f6',
          200: '#bfd4ef',
          300: '#93b6e3',
          400: '#6090d3',
          500: '#3b6fc2',
          600: '#2955a5',
          700: '#1f4284',
          800: '#163163',
          900: '#0F2547',
          950: '#09172e',
        },
        gold: {
          50: '#fefbec',
          100: '#fbf4ca',
          200: '#f7e691',
          300: '#f2d357',
          400: '#efbf2e',
          500: '#D99B26',
          600: '#bc7819',
          700: '#965617',
          800: '#7b4419',
          900: '#67391a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
