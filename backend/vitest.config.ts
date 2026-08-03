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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Les fichiers qu'aucun test n'importe sont inclus d'office depuis
      // vitest 4 : un module non testé pèse 0 % au lieu de disparaître.
      // `app.ts` en est absent : il ne contient que `listen()` et les gestionnaires
      // de signaux. Le tester obligerait à simuler `process.exit`, `server.close`
      // et le timer de grâce — le test affirmerait ses propres doublures plutôt
      // que l'arrêt propre. Ce chemin est vérifié par le healthcheck Docker.
      include: ['src/**/*.ts'],
      // Seuils calés sous la mesure réelle (99 / 98 / 100 / 100), pas sur un
      // chiffre rond : ils doivent bloquer une régression franche — un service
      // ou un middleware qui perd ses tests — sans casser la CI dès qu'un
      // refactor ajoute une garde défensive difficile à atteindre.
      thresholds: {
        statements: 97,
        branches: 95,
        functions: 95,
        lines: 97,
      },
    },
  },
});
