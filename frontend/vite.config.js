import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Météo Québec · Montréal',
        short_name: 'Météo QC',
        description: 'Prévisions météo pour Québec et Montréal',
        lang: 'fr-CA',
        start_url: '/',
        display: 'standalone',
        background_color: '#10243b',
        theme_color: '#10243b',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            // L'index passe désormais par le backend : même motif fonction que
            // /api/previsions, pour couvrir nginx en prod et le proxy Vite en dev.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/rainviewer'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'rainviewer-index',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.basemaps\.cartocdn\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tuiles-fond',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // Matche /api/previsions/... via nginx (prod) ou Vite proxy (dev)
            urlPattern: ({ url }) => url.pathname.startsWith('/api/previsions'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-previsions',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 6 },
              plugins: [
                {
                  /**
                   * `NetworkFirst` ne retombe sur le cache que si le `fetch`
                   * *rejette*. Un 502 est une réponse résolue : elle traversait
                   * jusqu'à l'application, qui affichait une erreur alors que
                   * des prévisions parfaitement valides dormaient dans le cache
                   * — la promesse « dernières prévisions en cache » ne tenait
                   * donc pas dès que le backend répondait en erreur.
                   *
                   * Lever ici rend un 5xx équivalent à une panne réseau, ce qui
                   * déclenche le repli. Les 4xx passent : un 404 « ville
                   * inconnue » ou un 429 portent un message utile qu'il ne faut
                   * pas masquer derrière des données périmées.
                   */
                  fetchDidSucceed: async ({ response }) => {
                    if (response.status < 500) return response;
                    throw new Error(`Réponse ${response.status} — repli sur le cache`);
                  },
                  /** Ne jamais mettre une réponse d'erreur en cache. */
                  cacheWillUpdate: async ({ response }) => (response.ok ? response : null),
                },
              ],
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3005',
    },
  },
});
