import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'vite';

/**
 * Vérifie que le build produit bien une PWA installable et capable de servir
 * hors ligne — les deux promesses que le README affiche.
 *
 * Pourquoi pas Lighthouse : depuis Lighthouse 12, la catégorie PWA et ses audits
 * (`installable-manifest`, `service-worker`) ont été supprimés. Lighthouse 13 ne
 * connaît plus que performance, accessibility, best-practices et seo. Auditer
 * l'installabilité imposerait donc d'épingler une version abandonnée, plus un
 * Chrome headless et un serveur statique en CI. Les mêmes garanties se lisent
 * directement dans la sortie de build, en une seconde et sans navigateur.
 */

const dist = resolve(import.meta.dirname, '../../dist');
const fichier = (nom: string) => resolve(dist, nom);
const lire = (nom: string) => readFileSync(fichier(nom), 'utf8');

interface Icone {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface Manifeste {
  name: string;
  short_name: string;
  start_url: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: Icone[];
}

let manifeste: Manifeste;
let sw: string;
let indexHtml: string;
let bundle: string;

beforeAll(async () => {
  // Build réel plutôt que réutilisation de `dist/` : un dist obsolète donnerait
  // une confiance imméritée.
  await build({ logLevel: 'silent' });

  manifeste = JSON.parse(lire('manifest.webmanifest')) as Manifeste;
  sw = lire('sw.js');
  indexHtml = lire('index.html');

  const nomBundle = indexHtml.match(/\/assets\/(index-[\w-]+\.js)/)?.[1];
  if (!nomBundle) throw new Error("Bundle applicatif introuvable dans l'index.html construit");
  bundle = lire(`assets/${nomBundle}`);
}, 120_000);

describe('Manifeste — critères d’installabilité', () => {
  it('est référencé depuis l’index.html', () => {
    expect(indexHtml).toContain('rel="manifest"');
    expect(indexHtml).toContain('manifest.webmanifest');
  });

  it('déclare un nom et un nom court', () => {
    expect(manifeste.name).toBeTruthy();
    // Au-delà de 12 caractères, Android tronque sous l'icône.
    expect(manifeste.short_name.length).toBeLessThanOrEqual(12);
  });

  it('déclare start_url et display standalone', () => {
    expect(manifeste.start_url).toBe('/');
    // « standalone » est ce qui retire la barre d'URL une fois installé ;
    // « browser » suffirait à casser l'installabilité.
    expect(manifeste.display).toBe('standalone');
  });

  it('déclare les couleurs de thème et de fond', () => {
    expect(manifeste.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifeste.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('fournit les icônes 192 et 512 exigées pour l’installation', () => {
    const tailles = manifeste.icons.map((i) => i.sizes);
    expect(tailles).toContain('192x192');
    expect(tailles).toContain('512x512');
  });

  it('fournit une icône maskable', () => {
    // Sans elle, Android rogne l'icône dans un carré blanc.
    const maskable = manifeste.icons.filter((i) => i.purpose === 'maskable');
    expect(maskable.length).toBeGreaterThan(0);
    expect(maskable[0].sizes).toBe('512x512');
  });

  it('ne référence que des icônes réellement présentes dans le build', () => {
    for (const icone of manifeste.icons) {
      expect(existsSync(fichier(icone.src)), `icône manquante : ${icone.src}`).toBe(true);
    }
  });
});

describe('Service worker — présence et enregistrement', () => {
  it('est généré à la racine du build', () => {
    expect(existsSync(fichier('sw.js'))).toBe(true);
  });

  it('est enregistré par le bundle applicatif', () => {
    expect(bundle).toContain('serviceWorker');
    expect(bundle).toContain('/sw.js');
  });

  it('précache la coquille applicative', () => {
    // Sans l'index précaché, l'ouverture hors ligne tombe sur l'écran d'erreur
    // du navigateur avant même que l'app démarre.
    expect(sw).toContain('index.html');
    expect(sw).toContain('manifest.webmanifest');
  });
});

describe('Service worker — stratégies de cache hors ligne', () => {
  it('sert les prévisions en NetworkFirst', () => {
    // Le README promet « dernières prévisions en cache » hors ligne : c'est
    // exactement ce que fait NetworkFirst sur cette route.
    expect(sw).toContain('api-previsions');
    expect(sw).toContain('NetworkFirst');
  });

  it('conserve les tuiles de fond de carte en CacheFirst', () => {
    expect(sw).toContain('tuiles-fond');
    expect(sw).toContain('CacheFirst');
  });

  it('garde l’index RainViewer en cache court', () => {
    expect(sw).toContain('rainviewer-index');
  });

  it('traite une erreur serveur comme une panne réseau sur les prévisions', () => {
    // `NetworkFirst` ne consulte le cache que si le `fetch` rejette : sans ce
    // greffon, un 502 traversait et l'application affichait une erreur alors
    // que des prévisions valides étaient en cache. C'est exactement la promesse
    // « dernières prévisions en cache » du README qui en dépend.
    expect(sw).toContain('fetchDidSucceed');
    expect(sw).toContain('repli sur le cache');
    // Les 4xx doivent continuer à remonter leur message.
    expect(sw).toMatch(/status\s*<\s*500/);
    // Et aucune réponse d'erreur ne doit entrer en cache.
    expect(sw).toContain('cacheWillUpdate');
  });
});

/**
 * Pages légales.
 *
 * `privacy-policy.html` est l'URL déclarée dans la console Google Play. Elle
 * n'était couverte par aucun test : un renommage ou un déplacement l'aurait
 * cassée en silence, et l'échec ne serait apparu qu'à la prochaine revue de
 * l'application par Google.
 *
 * Le précache n'est pas non plus un détail cosmétique. `vite-plugin-pwa` pose
 * un `navigateFallback` vers `index.html` : une page absente du précache serait
 * interceptée par ce repli et rendrait la coquille de l'application à la place
 * du document légal.
 */
describe('Pages légales', () => {
  const PAGES = [
    'privacy-policy.html',
    'privacy-policy.en.html',
    'terms.html',
    'terms.en.html',
    'legal.html',
    'legal.en.html',
  ] as const;

  /** Chaque page française et sa traduction, dans cet ordre. */
  const PAIRES = [
    ['privacy-policy.html', 'privacy-policy.en.html'],
    ['terms.html', 'terms.en.html'],
    ['legal.html', 'legal.en.html'],
  ] as const;

  it.each(PAGES)('%s est présente dans le build', (page) => {
    expect(existsSync(fichier(page)), `page manquante : ${page}`).toBe(true);
  });

  it('la feuille de style commune est présente', () => {
    expect(existsSync(fichier('legal.css'))).toBe(true);
  });

  it.each(PAGES)('%s entre dans le précache du service worker', (page) => {
    expect(sw).toContain(`"${page}"`);
  });

  it('la feuille de style commune entre dans le précache', () => {
    expect(sw).toContain('"legal.css"');
  });

  it.each(PAGES)('%s référence legal.css plutôt qu’un style inline', (page) => {
    const html = lire(page);
    expect(html).toContain('href="/legal.css"');
    // La CSP de nginx interdit `script-src` inline ; aucune de ces pages n'a
    // besoin de JavaScript, et aucune ne doit en acquérir par inadvertance.
    expect(html).not.toMatch(/<script/i);
  });

  it.each(PAGES)('%s ramène à l’application', (page) => {
    // Dans la TWA Android, ces pages s'ouvrent sans barre d'adresse : sans ce
    // lien, l'utilisateur est prisonnier du document.
    expect(lire(page)).toContain('href="/"');
  });

  it.each(PAIRES)('%s et %s se pointent mutuellement', (fr, en) => {
    expect(lire(fr)).toContain(`href="/${en}"`);
    expect(lire(en)).toContain(`href="/${fr}"`);
  });

  it.each(PAIRES)('%s est déclarée en français', (fr) => {
    expect(lire(fr)).toContain('lang="fr-CA"');
  });

  it.each(PAIRES)('la traduction de %s cède le pas au français', (fr, en) => {
    const html = lire(en);
    expect(html).toContain('lang="en-CA"');
    // Le service est offert au public au Québec : la version française est
    // celle qui fait foi, et chaque traduction doit le dire.
    expect(html).toContain('prevails');
    expect(html).toContain(`href="/${fr}"`);
  });

  it('l’application relie ses trois pages légales françaises', () => {
    // Le pied de page a longtemps été le point aveugle : la politique existait
    // sans qu'aucun lien n'y mène.
    for (const page of ['privacy-policy.html', 'terms.html', 'legal.html']) {
      expect(bundle, `lien manquant vers ${page}`).toContain(`/${page}`);
    }
  });
});
