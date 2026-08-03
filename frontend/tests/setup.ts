import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/svelte';

// Même filet de sécurité que côté backend : aucun test ne doit toucher le réseau.
// Un test qui traverse `lib/api.ts` pose son propre stub (voir `tests/helpers/fetch.ts`) ;
// sinon l'appel échoue avec un message explicite plutôt que de dépendre de la
// disponibilité du backend ou de RainViewer.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown) => {
      throw new Error(
        `Appel réseau non mocké vers ${String(input)} — utiliser stubFetchJson() dans le test.`
      );
    })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
