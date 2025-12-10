/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        // Tema oscuro tipo Twitter/X
        'dark-bg': '#000000',           // Fondo principal negro puro
        'dark-card': '#16181C',         // Cards y elementos
        'dark-border': '#2F3336',       // Bordes
        'dark-hover': '#1A1A1A',        // Hover states
        'text-primary': '#E7E9EA',      // Texto principal
        'text-secondary': '#71767B',    // Texto secundario
        'accent': '#1D9BF0',            // Azul accent (Twitter blue)
        'accent-hover': '#1A8CD8',      // Azul hover
        'accent-dark': '#0F4E78',       // Azul oscuro
        'danger': '#F4212E',            // Rojo para unlike/delete
        'success': '#00BA7C',           // Verde para success
      },
      fontFamily: {
        'sans': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
