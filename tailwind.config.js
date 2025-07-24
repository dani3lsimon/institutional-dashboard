/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  safelist: [
    {
      pattern: /^(bg|text)-(blue|green|red|yellow|purple|orange)-(400|600)$/,
    },
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}