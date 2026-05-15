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
          50:  '#f4f6ef',
          100: '#e6ebda',
          200: '#cdd7b5',
          300: '#aebf87',
          400: '#8fa45d',
          500: '#6b7f3a',  // Main olive green
          600: '#556430',  // Buttons / active states
          700: '#404c25',
          800: '#2e361a',
          900: '#1c2210',
          950: '#0e1208',
        },
        // Tan / sand accent — from the right half of the MOD|TUBE patch
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
        // Dark army backgrounds
        army: {
          900: '#181f11',
          800: '#1e2618',
          700: '#262f1e',
          600: '#2e3a24',
          500: '#3a4a2e',
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
