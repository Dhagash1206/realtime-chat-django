/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      // Single brand palette: navy for structure, cream as the only accent
      colors: {
        brand: {
          50: "#f2f4fa",
          100: "#e3e8f4",
          200: "#c5cfe8",
          300: "#9aabd5",
          400: "#6b82bd",
          500: "#4a63a6",
          600: "#36508f",
          700: "#2a3f74",
          800: "#1e2f5c",
          900: "#15224a",
          950: "#0d1633",
        },
        cream: "#f3e3c3",
      },
    },
  },
  plugins: [],
};
