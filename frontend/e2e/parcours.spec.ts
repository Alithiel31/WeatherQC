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

    await page.getByRole('button', { name: /Choisir une ville/ }).click();
    await page.getByRole('menuitem', { name: 'Québec' }).click();
    await expect(
      page.getByRole('button', { name: /Choisir une ville — actuellement Québec/ })
    ).toBeVisible();

    // Le choix est persisté : c'est la promesse « mémorisé entre les sessions ».
    await page.reload();
    await expect(
      page.getByRole('button', { name: /Choisir une ville — actuellement Québec/ })
    ).toBeVisible();
  });

  test('recherche par code postal et ajoute l’entrée correspondante au sélecteur', async ({
    page,
  }) => {
    await interceptApi(page);
    await page.goto('/');
    await expect(page.getByText('Partiellement nuageux')).toBeVisible();

    await page.getByLabel('Code postal canadien').fill('H2X 1Y4');
    await page.getByRole('button', { name: 'Rechercher' }).click();

    await expect(
      page.getByRole('button', { name: /Choisir une ville — actuellement H2X/ })
    ).toBeVisible();
    await page.getByRole('button', { name: /Choisir une ville/ }).click();
    await expect(page.getByRole('menuitem', { name: 'H2X' })).toBeVisible();
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

/**
 * Le pied de page vivait à l'intérieur de `{:else if donnees}` : il ne portait
 * que l'heure de mise à jour, et disparaissait donc pendant le chargement comme
 * sur un écran d'erreur. Il porte maintenant l'avertissement météo et l'accès
 * aux pages légales — deux choses qui doivent rester atteignables surtout quand
 * l'application ne fonctionne pas.
 */
test.describe('Pied de page légal', () => {
  const LIENS = [
    { nom: 'Confidentialité', href: '/privacy-policy.html' },
    { nom: 'Conditions', href: '/terms.html' },
    { nom: 'Mentions légales', href: '/legal.html' },
  ];

  test('expose les trois pages légales en fonctionnement nominal', async ({ page }) => {
    await interceptApi(page);
    await page.goto('/');
    await expect(page.getByText('Partiellement nuageux')).toBeVisible();

    for (const { nom, href } of LIENS) {
      await expect(page.getByRole('link', { name: nom })).toHaveAttribute('href', href);
    }
  });

  test('reste visible sur un écran d’erreur', async ({ page }) => {
    await interceptApi(page, { statutPrevisions: 502 });
    await page.goto('/');
    await expect(page.getByRole('alert')).toBeVisible();

    // Aucune prévision n'est affichée, mais l'avertissement et les liens le sont.
    await expect(page.getByText(/à titre indicatif/)).toBeVisible();
    for (const { nom } of LIENS) {
      await expect(page.getByRole('link', { name: nom })).toBeVisible();
    }
  });

  test('la ligne de mise à jour, elle, dépend des données', async ({ page }) => {
    await interceptApi(page, { statutPrevisions: 502 });
    await page.goto('/');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText(/Mis à jour à/)).toBeHidden();

    await interceptApi(page);
    await page.getByRole('button', { name: 'Réessayer' }).click();
    await expect(page.getByText(/Mis à jour à/)).toBeVisible();
  });

  test('mène réellement à la politique de confidentialité', async ({ page }) => {
    await interceptApi(page);
    await page.goto('/');
    await expect(page.getByText('Partiellement nuageux')).toBeVisible();

    // Navigation dans le même onglet : dans la TWA Android, un `target="_blank"`
    // ferait surgir un onglet de navigateur par-dessus l'application.
    await page.getByRole('link', { name: 'Confidentialité' }).click();

    await expect(page).toHaveURL(/\/privacy-policy\.html$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Politique de confidentialité'
    );

    // Et le chemin du retour existe.
    await page
      .getByRole('link', { name: /Retour à l’application|Retour à l'application/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/$/);
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
