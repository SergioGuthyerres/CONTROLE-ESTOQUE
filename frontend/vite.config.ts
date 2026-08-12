import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// PWA instalável (Android e iOS) sem loja de aplicativos — decisão da
// seção 5.4 do documento de visão (orçamento zero exclui conta paga da Apple).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icone.svg"],
      manifest: {
        name: "Estoque Casa do Campo",
        short_name: "Estoque",
        description: "Controle de estoque da Casa do Campo",
        theme_color: "#1F3864",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "icone.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
      workbox: {
        // App shell + assets em cache para abrir offline; dados vêm do Dexie
        // (ver src/db), não do cache HTTP.
        globPatterns: ["**/*.{js,css,html,svg}"],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
