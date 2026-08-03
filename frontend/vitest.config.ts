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
  },
});
