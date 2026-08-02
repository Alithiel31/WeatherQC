import { defineConfig } from 'vitest/config';

// Tests de contrat : ils interrogent réellement Open-Meteo et Zippopotam.
// Volontairement séparés de `vitest.config.ts` (qui interdit tout accès réseau)
// pour qu'une panne d'API externe ne casse jamais la CI des PR.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/contract/**/*.test.ts'],
    testTimeout: 20000,
    retry: 1,
  },
});
