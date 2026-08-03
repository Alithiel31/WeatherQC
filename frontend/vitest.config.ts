import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    // Sans cette condition, Svelte 5 résout sa version serveur et les
    // composants rendus n'ont ni cycle de vie ni réactivité.
    conditions: ['browser'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Aucun appel réseau ici : un test qui dépasse 5 s est un test cassé.
    testTimeout: 5000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Les fichiers qu'aucun test n'importe sont inclus d'office depuis
      // vitest 4 : un module non testé pèse 0 % au lieu de disparaître.
      // `main.ts` en est absent : il ne fait que monter l'app et enregistrer le
      // service worker. Le tester reviendrait à affirmer des doublures.
      include: ['src/**/*.ts', 'src/**/*.svelte'],
      exclude: ['src/main.ts', 'src/vite-env.d.ts'],
      // Seuils calés sous la mesure réelle (94 / 87 / 94 / 95), pas sur un
      // chiffre rond : ils doivent bloquer une régression franche — un composant
      // ou un module qui perd ses tests — sans casser la CI dès qu'un refactor
      // ajoute une branche défensive difficile à atteindre.
      thresholds: {
        statements: 92,
        branches: 83,
        functions: 90,
        lines: 92,
      },
    },
  },
});
