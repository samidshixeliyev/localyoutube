/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Army / military olive palette — replaces the old orange "primary"
        primary: {
          50:  '#fff5f5',
          100: '#ffe4e4',
          200: '#ffbcbc',
          300: '#ff8585',
          400: '#f85050',
          500: '#e02020',  // Main crimson — matches logo
          600: '#c41515',  // Buttons / active states
          700: '#a10f0f',
          800: '#7f0c0c',
          900: '#5c0a0a',
          950: '#3d0606',
        },
        // Tan / sand accent
        tan: {
          50:  '#faf8f0',
          100: '#f2edda',
          200: '#e5dab5',
          300: '#d4c288',
          400: '#c4aa62',
          500: '#b59448',
          600: '#9a7b38',
          700: '#7a602c',
          800: '#5e4a22',
          900: '#3d3016',
        },
        // Dark backgrounds — YouTube-like neutral dark (500–950) + olive light (50–400)
        army: {
          50:  '#f2f5eb',
          100: '#e4ebd4',
          200: '#c8d6aa',
          300: '#a6ba7a',
          400: '#7f9b50',
          500: '#606060',
          600: '#4d4d4d',
          700: '#3d3d3d',
          800: '#212121',
          900: '#0f0f0f',
          950: '#070707',
        }
      },
      fontFamily: {
        // system-only, no CDN fonts
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"Courier New"', 'Courier', 'monospace'],
      },
    },
  },
  plugins: [],
}
