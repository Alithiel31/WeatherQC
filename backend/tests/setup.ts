import { afterEach, beforeEach, vi } from 'vitest';
import { clearCache } from '../src/services/cache.service.js';

// Filet de sécurité : aucun test de `npm run test:run` ne doit toucher le réseau.
// Un test qui traverse un service externe pose son propre stub (voir
// `tests/helpers/fetch.ts`) ; sinon l'appel échoue avec un message explicite
// plutôt que de dépendre de la disponibilité d'Open-Meteo ou de Zippopotam.
//
// Les tests qui interrogent réellement les APIs vivent dans `tests/contract/`
// et tournent via `npm run test:contract` (workflow nocturne).
beforeEach(() => {
  // Le cache est un module singleton : sans ce reset, une route déjà appelée
  // dans un test précédent répondrait depuis le cache.
  clearCache();

  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown) => {
      throw new Error(
        `Appel réseau non mocké vers ${String(input)} — utiliser stubFetchJson() avec une fixture.`
      );
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});
