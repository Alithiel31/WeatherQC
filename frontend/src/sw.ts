/// <reference lib="webworker" />
export {};

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import type { PrecacheEntry } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { clientsClaim } from 'workbox-core';

/**
 * Service worker maison — remplace la génération automatique de
 * `vite-plugin-pwa` (mode `generateSW`), qui ne permet pas d'y greffer un
 * gestionnaire `push`. Le précache et le `runtimeCaching` ci-dessous sont
 * portés tels quels depuis l'ancien bloc `workbox` de `vite.config.js` : mêmes
 * garanties hors ligne, toujours vérifiées par `tests/pwa/build.test.ts`.
 */

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<PrecacheEntry | string>;
};

// `registerType: 'autoUpdate'` déclenchait `workbox.skipWaiting` et
// `workbox.clientsClaim` automatiquement en mode `generateSW` — ce réglage ne
// s'applique qu'au SW généré, pas à celui-ci : sans ces deux appels, un
// nouveau déploiement resterait « en attente » jusqu'à la fermeture complète
// de tous les onglets, cassant la promesse de mise à jour automatique.
self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  // L'index passe désormais par le backend : même motif fonction que
  // /api/previsions, pour couvrir nginx en prod et le proxy Vite en dev.
  ({ url }) => url.pathname.startsWith('/api/rainviewer'),
  new NetworkFirst({
    cacheName: 'rainviewer-index',
    networkTimeoutSeconds: 5,
    plugins: [new ExpirationPlugin({ maxEntries: 2, maxAgeSeconds: 60 * 30 })],
  })
);

registerRoute(
  /^https:\/\/.*\.basemaps\.cartocdn\.com\/.*/,
  new CacheFirst({
    cacheName: 'tuiles-fond',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 })],
  })
);

registerRoute(
  // Matche /api/previsions/... via nginx (prod) ou Vite proxy (dev)
  ({ url }) => url.pathname.startsWith('/api/previsions'),
  new NetworkFirst({
    cacheName: 'api-previsions',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({ maxEntries: 8, maxAgeSeconds: 60 * 60 * 6 }),
      {
        /**
         * `NetworkFirst` ne retombe sur le cache que si le `fetch` *rejette*.
         * Un 502 est une réponse résolue : elle traversait jusqu'à
         * l'application, qui affichait une erreur alors que des prévisions
         * parfaitement valides dormaient dans le cache — la promesse
         * « dernières prévisions en cache » ne tenait donc pas dès que le
         * backend répondait en erreur.
         *
         * Lever ici rend un 5xx équivalent à une panne réseau, ce qui
         * déclenche le repli. Les 4xx passent : un 404 « ville inconnue » ou
         * un 429 portent un message utile qu'il ne faut pas masquer derrière
         * des données périmées.
         */
        fetchDidSucceed: async ({ response }) => {
          if (response.status < 500) return response;
          throw new Error(`Réponse ${response.status} — repli sur le cache`);
        },
        /** Ne jamais mettre une réponse d'erreur en cache. */
        cacheWillUpdate: async ({ response }) => (response.ok ? response : null),
      },
    ],
  })
);

interface AlerteMeteo {
  titre: string;
  corps: string;
}

/**
 * Affiche l'alerte reçue. Le backend envoie `{ titre, corps }` (voir
 * `detecteur-alertes.ts` et `notifications.service.ts`) ; une charge
 * illisible ou absente ne doit pas faire planter le service worker, juste
 * renoncer à l'affichage.
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let alerte: AlerteMeteo;
  try {
    alerte = event.data.json();
  } catch {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(alerte.titre, {
      body: alerte.corps,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    })
  );
});

/**
 * Ramène au premier onglet déjà ouvert plutôt que d'en empiler un nouveau à
 * chaque clic — l'application n'a qu'une seule page (`/`), inutile de router
 * vers autre chose.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientsActifs) => clientsActifs[0]?.focus() ?? self.clients.openWindow('/'))
  );
});
