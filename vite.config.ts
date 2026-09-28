import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      manifest: {
        name: "Recallbox",
        short_name: "Recallbox",
        description: "A little practice. A lasting memory.",
        theme_color: "#2d6257",
        background_color: "#f7f8fa",
        display: "standalone",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png,svg}"],
        maximumFileSizeToCacheInBytes: 4000000,
      },
    }),
  ],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
})
