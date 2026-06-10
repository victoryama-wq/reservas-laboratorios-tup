/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        "tup-navy": "#271e5d",
        "tup-blue": "#252a86",
        "tup-gray": "#888887",
      },
    },
  },
  plugins: [],
};
