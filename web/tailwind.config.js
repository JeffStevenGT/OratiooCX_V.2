/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        oratioo: {
          light: '#f5ebf3',        // Fondo general
          white: '#ffffff',        // Cards
          dark: '#1a1030',         // Sidebar + textos principales
          purple: '#481164',       // Acento corporativo
          'purple-light': '#2d1a4a', // Sidebar hover
          gray: '#7c757c',         // Texto secundario
          border: '#e8dce6',       // Bordes
          'border-light': '#f0e6f0', // Bordes suaves
        },
      },
    },
  },
  plugins: [],
}
