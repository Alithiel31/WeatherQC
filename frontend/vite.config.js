import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        // Non minifié à dessein : les tests (`tests/pwa/build.test.ts`) et une
        // inspection manuelle du service worker généré vérifient la présence
        // de littéraux (`NetworkFirst`, noms de cache…) que la minification
        // effacerait. Le fichier reste minuscule à côté du bundle applicatif.
        minify: false,
      },
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
      // Le précache et le `runtimeCaching` vivent désormais dans `src/sw.ts`
      // (mode `injectManifest`) : `generateSW` ne permet pas d'y greffer un
      // gestionnaire `push`.
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3005',
    },
  },
});
