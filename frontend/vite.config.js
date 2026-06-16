import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Météo Québec · Montréal",
        short_name: "Météo QC",
        description: "Prévisions météo pour Québec et Montréal",
        lang: "fr-CA",
        start_url: "/",
        display: "standalone",
        background_color: "#10243b",
        theme_color: "#10243b",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.rainviewer\.com\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "rainviewer-index",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.basemaps\.cartocdn\.com\/.*/,
            handler: "CacheFirst",
            options: {
              cacheName: "tuiles-fond",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // Matche /api/previsions/... via nginx (prod) ou Vite proxy (dev)
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/api/previsions"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-previsions",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 6 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": "http://localhost:3005",
    },
  },
});
