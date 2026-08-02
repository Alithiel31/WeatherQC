import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // `tests/contract/` en est exclu : ces tests tapent les vraies APIs
    // et tournent via `npm run test:contract`.
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Plus aucun appel réseau ici : un test qui dépasse 5 s est un test cassé.
    testTimeout: 5000,
  },
});
