import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { interceptApi, CIELS } from './fixtures.ts';

/**
 * Vérifications d'accessibilité sur l'application assemblée, dans un navigateur
 * réel : rôles, noms accessibles, structure, focus.
 *
 * **Ce que cette suite ne couvre pas : le contraste.** axe ne sait pas le
 * mesurer sur un fond en dégradé — il classe les nœuds concernés en
 * `incomplete` avec le motif « Element's background color could not be
 * determined due to a background gradient », et `incomplete` n'est pas
 * `violations`. Vérifié sur cette application : en retirant le voile de page,
 * qui ramène le texte à 1.15:1 sur ciel de neige, les six passes ci-dessous
 * restent vertes. Le contraste est donc vérifié numériquement ailleurs, sur les
 * constantes CSS — `tests/unit/contraste.test.ts`.
 *
 * Ce qu'elle attrape en revanche, et qui a servi dès l'écriture : poser
 * `role="group"` sur le `<ul>` de la bande horaire pour le rendre focusable
 * détruisait la sémantique de liste de ses 48 `<li>`, signalé en `serious`.
 */
test.describe('Accessibilité', () => {
  for (const { famille, code } of CIELS) {
    test(`aucune violation sur ciel « ${famille} »`, async ({ page }) => {
      await interceptApi(page, { code });
      await page.goto('/');
      await expect(page.getByRole('region', { name: 'Prévisions horaires' })).toBeVisible();

      const resultat = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        // La carte est rendue par Leaflet : son balisage ne nous appartient pas,
        // et les tuiles sont coupées par les fixtures de toute façon.
        .exclude('.carte')
        .analyze();

      expect(resultat.violations).toEqual([]);
    });
  }

  test('la bande 48 h est atteignable au clavier', async ({ page }) => {
    await interceptApi(page);
    await page.goto('/');

    const bande = page.getByRole('group', { name: /48 heures/ });
    await expect(bande).toBeVisible();

    // `overflow-x: auto` sans `tabindex` : le conteneur n'était focusable par
    // aucun moyen, donc tout ce qui dépassait la sixième heure restait hors
    // d'atteinte au clavier.
    await bande.focus();
    await expect(bande).toBeFocused();
  });

  test('la condition météo horaire est exposée aux lecteurs d’écran', async ({ page }) => {
    await interceptApi(page);
    await page.goto('/');

    // L'icône portait `aria-hidden` sans équivalent textuel : la bande horaire
    // annonçait une heure et une température, jamais le temps qu'il fait.
    await expect(
      page.getByRole('region', { name: 'Prévisions horaires' }).getByRole('img').first()
    ).toHaveAttribute('aria-label', 'Partiellement nuageux');
  });

  test('le changement de ville est annoncé', async ({ page }) => {
    await interceptApi(page);
    await page.goto('/');

    // Les erreurs l'étaient déjà via `role="alert"` ; le succès ne l'était par
    // rien, alors qu'il remplace la totalité du contenu.
    const annonce = page.locator('[aria-live="polite"]');
    await expect(annonce).toContainText('Montréal');
  });

  test('la carte a un équivalent texte pour qui ne peut pas la voir', async ({ page }) => {
    // `precipitation: 40` dans la fixture `previsions()` — au-dessus du seuil de
    // 20 % utilisé par `resumeCarte` (voir `src/lib/meteo.ts`).
    await interceptApi(page);
    await page.goto('/');

    await expect(page.getByText(/probabilité de 40 %/)).toBeVisible();
  });

  /**
   * WCAG 2.1.4.10 (Reflow) : à 320 CSS px de large, aucun défilement horizontal
   * de la page ne doit être nécessaire — la seule exception admise par le
   * critère est le contenu qui exige un agencement bidimensionnel pour son
   * usage (ici, la carte Leaflet elle-même, dont le défilement interne n'est
   * pas concerné par cette vérification, qui porte sur le document entier).
   */
  test('aucun défilement horizontal à 320px de large (reflow WCAG 1.4.10)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await interceptApi(page);
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Prévisions horaires' })).toBeVisible();

    const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(largeur).toBeLessThanOrEqual(320);
  });

  /**
   * WCAG 2.2 / 2.5.8 (Target Size Minimum, AA) : au moins 24×24 CSS px pour les
   * cibles pointeur, à l'exception explicite du critère pour les liens dans une
   * phrase ou un bloc de texte courant (`p a`, `.avis a`, `.legal a` — footer
   * léger, séparé par des « · » comme une phrase plutôt qu'une liste de
   * boutons), des contrôles natifs dont le rendu du curseur échappe au CSS
   * (`input[type="range"]`), et du balisage injecté par Leaflet dans `.carte`
   * (attribution, zoom +/-) — il ne nous appartient pas, même raison que son
   * exclusion des scans axe plus haut.
   */
  test('les cibles interactives mesurent au moins 24×24px', async ({ page }) => {
    await interceptApi(page);
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Prévisions horaires' })).toBeVisible();

    const boutons = page.locator(
      'button, a[href]:not(.legal a):not(p a):not(.carte a), input:not([type="range"])'
    );
    const total = await boutons.count();
    expect(total).toBeGreaterThan(0);

    for (let i = 0; i < total; i++) {
      const cible = boutons.nth(i);
      if (!(await cible.isVisible())) continue;
      const boite = await cible.boundingBox();
      expect(
        boite,
        `cible sans boîte englobante : ${await cible.evaluate((e) => e.outerHTML)}`
      ).not.toBeNull();
      expect(boite!.width, await cible.evaluate((e) => e.outerHTML)).toBeGreaterThanOrEqual(24);
      expect(boite!.height, await cible.evaluate((e) => e.outerHTML)).toBeGreaterThanOrEqual(24);
    }
  });
});

/**
 * Les pages légales sont du HTML statique servi hors de l'application : elles
 * échappent entièrement à la passe ci-dessus. Elles n'ont pas de dégradé, donc
 * axe y mesure aussi le contraste — la réserve qui vaut pour l'application ne
 * s'applique pas ici.
 */
test.describe('Accessibilité des pages légales', () => {
  const PAGES = [
    'privacy-policy.html',
    'privacy-policy.en.html',
    'terms.html',
    'terms.en.html',
    'legal.html',
    'legal.en.html',
  ];

  for (const page_ of PAGES) {
    test(`aucune violation sur ${page_}`, async ({ page }) => {
      await page.goto(`/${page_}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const resultat = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(resultat.violations).toEqual([]);
    });
  }
});
