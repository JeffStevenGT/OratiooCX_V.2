/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        oratioo: {
          purple: '#481163',
          'purple-light': '#5d1a7a',
          blue: '#0a6ea9',
          'blue-dark': '#085d8f',
          gray: '#7c757c',
          dark: '#1a1030',
          light: '#f5f5fa',
          border: '#e0e0f0',
        },
      },
    },
  },
  plugins: [],
};
