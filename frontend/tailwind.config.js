/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Cor provisória (documento de visão, seção 7: cliente tem liberdade
        // total, sem identidade visual definida ainda).
        marca: "#1F3864",
      },
    },
  },
  plugins: [],
};
