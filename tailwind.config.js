/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './lib/**/*.js', // e.g. column widths in lib/inventoryLanternTable.js
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
