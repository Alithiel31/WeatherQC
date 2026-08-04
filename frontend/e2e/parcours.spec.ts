import { test, expect } from '@playwright/test';
import { interceptApi } from './fixtures.ts';

test.describe('Parcours nominal', () => {
  test('affiche les conditions actuelles au chargement', async ({ page }) => {
    await interceptApi(page);
    await page.goto('/');

    await expect(page.getByText('Partiellement nuageux')).toBeVisible();
    await expect(page.getByText('14 km/h')).toBeVisible();
    await expect(page.getByText('62 %')).toBeVisible();
  });

  test('rend les trois sections de prévisions', async ({ page }) => {
    await interceptApi(page);
    await page.goto('/');

    await expect(page.getByRole('region', { name: 'Conditions actuelles' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Prévisions horaires' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Prévisions sur 7 jours' })).toBeVisible();
  });

  test('change de ville et mémorise le choix entre deux visites', async ({ page }) => {
    await interceptApi(page);
    await page.goto('/');
    await expect(page.getByText('Partiellement nuageux')).toBeVisible();

    await page.getByRole('button', { name: 'Québec' }).click();
    await expect(page.getByRole('button', { name: 'Québec' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    // Le choix est persisté : c'est la promesse « mémorisé entre les sessions ».
    await page.reload();
    await expect(page.getByRole('button', { name: 'Québec' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('recherche par code postal et ajoute l’onglet correspondant', async ({ page }) => {
    await interceptApi(page);
    await page.goto('/');
    await expect(page.getByText('Partiellement nuageux')).toBeVisible();

    await page.getByLabel('Code postal canadien').fill('H2X 1Y4');
    await page.getByRole('button', { name: 'Rechercher' }).click();

    await expect(page.getByRole('button', { name: 'H2X' })).toBeVisible();
  });
});

/**
 * Deux chemins qu'aucun test ne parcourait : la couverture signalait le bouton
 * « Réessayer » comme jamais cliqué, et le bandeau hors ligne comme jamais rendu
 * — `App.test.ts` n'émet ni `online` ni `offline`.
 */
test.describe('Chemins de récupération', () => {
  test('le bouton « Réessayer » relance vraiment le chargement', async ({ page }) => {
    await interceptApi(page, { statutPrevisions: 502 });
    await page.goto('/');

    await expect(page.getByRole('alert')).toContainText('Open-Meteo injoignable');

    // L'amont se remet : le bouton doit produire un écran utilisable.
    await interceptApi(page);
    await page.getByRole('button', { name: 'Réessayer' }).click();

    await expect(page.getByText('Partiellement nuageux')).toBeVisible();
  });

  test('affiche le message du backend plutôt qu’un texte générique', async ({ page }) => {
    await interceptApi(page, {
      statutPrevisions: 404,
      erreur: 'Ville inconnue. Villes disponibles : montreal, quebec.',
    });
    await page.goto('/');

    await expect(page.getByRole('alert')).toContainText('Villes disponibles');
  });

  test('signale le passage hors ligne, puis recharge au retour', async ({ page, context }) => {
    await interceptApi(page);
    await page.goto('/');
    await expect(page.getByText('Partiellement nuageux')).toBeVisible();

    await context.setOffline(true);
    await expect(page.getByText(/Hors ligne/)).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByText(/Hors ligne/)).toBeHidden();
    await expect(page.getByText('Partiellement nuageux')).toBeVisible();
  });
});

test.describe('Préférences persistées', () => {
  test('démarre malgré un lieu mémorisé illisible', async ({ page }) => {
    // Régression connue : la lecture jetait avant le premier rendu et laissait
    // une page blanche jusqu'à un vidage manuel du stockage.
    await interceptApi(page);
    await page.addInitScript(() => {
      localStorage.setItem('lieuCP', '{cassé');
      localStorage.setItem('selection', 'montreal');
    });

    await page.goto('/');

    await expect(page.getByText('Partiellement nuageux')).toBeVisible();
  });
});
