/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        ind: {
          50:  '#eef4ff',
          100: '#dae6ff',
          200: '#bcd2ff',
          300: '#8eb4ff',
          400: '#5a8bfb',
          500: '#3563f0',
          600: '#2145d6',
          700: '#1c37ab',
          800: '#1c3187',
          900: '#1c2d6b',
        },
      },
    },
  },
  plugins: [],
};
