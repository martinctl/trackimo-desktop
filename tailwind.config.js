/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'lol-blue': '#0BC6E3',
        'lol-red': '#C89B3C',
        'lol-dark-blue': '#0A1428',
        'lol-dark-red': '#1E2328',
        'lol-gray': '#F0E6D2',
        'lol-dark': '#1E2328',
        'team-blue': '#3B82F6',
        'team-red': '#EF4444',
        'team-blue-dark': '#1E40AF',
        'team-red-dark': '#DC2626',
      },
      backdropBlur: {
        xs: '2px',
      },
      fontFamily: {
        'lol': ['Beaufort for LOL', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

