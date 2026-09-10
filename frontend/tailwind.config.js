/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgMain: '#171817',
        boxBg: '#383838',
        borderLine: '#595959',
        accent: '#70c9ac',
        brandPrimary: '#39bb86',
      },
    },
  },
  plugins: [],
}