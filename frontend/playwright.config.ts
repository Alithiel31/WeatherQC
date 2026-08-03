import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout : navigateur réel, bundle réel.
 *
 * Les tests de composants montent des morceaux isolés dans jsdom ; ceux-ci
 * ouvrent l'application construite dans Chromium. Deux choses n'étaient
 * couvertes nulle part ailleurs : le bouton « Réessayer », qu'aucun test ne
 * cliquait, et le bandeau hors ligne, qu'aucun test ne faisait apparaître.
 *
 * L'API est interceptée par Playwright plutôt que servie par le vrai backend :
 * une suite de bout en bout qui dépend d'Open-Meteo redevient exactement ce que
 * `tests/setup.ts` interdit partout ailleurs — un test qui échoue pour une
 * raison étrangère au code.
 */
/**
 * Un environnement qui fournit déjà Chromium — conteneur de développement, image
 * CI préchargée — peut le désigner ici plutôt que d'en faire télécharger un
 * second, souvent d'une version incompatible avec celle qu'attend Playwright.
 * Sans la variable, on retombe sur le navigateur installé par
 * `npx playwright install chromium`, ce que fait la CI.
 */
const chromiumFourni = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: './e2e',
  // Aucun appel réseau réel : un test qui dépasse 15 s est un test cassé.
  timeout: 15_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    // Le service worker intercepterait les requêtes avant Playwright, rendant
    // les doublures inopérantes. Ses garanties sont vérifiées séparément, sur
    // la sortie de build, par `tests/pwa/build.test.ts`.
    serviceWorkers: 'block',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromiumFourni ? { launchOptions: { executablePath: chromiumFourni } } : {}),
      },
    },
  ],

  // `preview` sert `dist/`, donc le bundle réellement déployé — pas le serveur
  // de développement.
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
