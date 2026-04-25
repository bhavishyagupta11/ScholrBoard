/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#1e40af',
          green: '#047857',
          light: '#e0f2fe',
        },
      },
    },
  },
  plugins: [],
};


