import type { Page, Route } from '@playwright/test';

/**
 * Réponse de `/api/previsions/:ville`, réduite à ce que l'écran affiche.
 *
 * `code` est paramétrable : c'est lui qui détermine la famille de ciel, donc le
 * dégradé de fond — et le contraste du texte en dépend entièrement.
 * `precipitation` est fixé au-dessus du seuil de 20 % pour que `.pluie`, la
 * couleur la plus fragile de l'interface, soit effectivement rendue.
 */
export function previsions(nom = 'Montréal', temperature = 21.4, code = 2) {
  return {
    ville: { id: 'montreal', nom, latitude: 45.5, longitude: -73.6 },
    misAJour: '2026-08-03T12:05:00',
    actuel: { temperature, ressenti: 19.6, humidite: 62, vent: 14.2, code, jour: true },
    horaire: Array.from({ length: 6 }, (_, i) => ({
      heure: `2026-08-03T${String(12 + i).padStart(2, '0')}:00`,
      temperature: 21 + i,
      code,
      precipitation: 40,
    })),
    quotidien: Array.from({ length: 3 }, (_, i) => ({
      date: `2026-08-0${3 + i}`,
      code,
      max: 24,
      min: 14,
      precipitation: 40,
      lever: '2026-08-03T05:30',
      coucher: '2026-08-03T20:15',
    })),
    depuisCache: false,
  };
}

/**
 * Un code par famille de ciel (`familleMeteo`). Chacune peint un dégradé
 * différent : `neige` est le plus clair (`#b9cce0`), `orage` le plus sombre
 * (`#3d4d63`). Aucune couleur de texte fixe ne passe sur les deux, d'où la
 * nécessité de tester la totalité et pas un échantillon.
 */
export const CIELS: ReadonlyArray<{ famille: string; code: number }> = [
  { famille: 'degage', code: 0 },
  { famille: 'nuageux', code: 2 },
  { famille: 'brouillard', code: 45 },
  { famille: 'neige', code: 73 },
  { famille: 'orage', code: 95 },
  { famille: 'pluie', code: 61 },
];

export const VILLES = [
  { id: 'montreal', nom: 'Montréal' },
  { id: 'quebec', nom: 'Québec' },
];

const json = (route: Route, corps: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corps) });

interface Options {
  /** Statut renvoyé par `/api/previsions/*` ; 200 par défaut. */
  statutPrevisions?: number;
  /** Corps renvoyé en cas d'erreur — l'enveloppe `{ status, error }` du backend. */
  erreur?: string;
  /** Code météo, donc famille de ciel et dégradé de fond ; `2` (nuageux) par défaut. */
  code?: number;
}

/**
 * Intercepte toutes les routes de l'API.
 *
 * Les tuiles de carte et l'index RainViewer sont coupés net : ils partiraient
 * vers Internet, et la carte n'est pas le sujet ici.
 */
export async function interceptApi(page: Page, options: Options = {}): Promise<void> {
  const { statutPrevisions = 200, erreur = 'Open-Meteo injoignable : timeout', code = 2 } = options;

  await page.route('**/api/villes', (route) => json(route, VILLES));

  // Expression régulière et non motif glob : `/api/previsions/:ville` et
  // `/api/previsions-coordonnees?lat=…` n'ont pas la même forme, et un motif
  // trop étroit laisse la seconde filer vers le proxy Vite — donc vers un vrai
  // appel réseau, ce que cette suite s'interdit.
  await page.route(/\/api\/previsions/, (route) =>
    statutPrevisions === 200
      ? json(route, previsions('Montréal', 21.4, code))
      : json(route, { status: statutPrevisions, error: erreur }, statutPrevisions)
  );

  await page.route('**/api/geocode/**', (route) =>
    json(route, {
      rta: 'H2X',
      nom: 'Montréal',
      province: 'Quebec',
      latitude: 45.5088,
      longitude: -73.5878,
    })
  );

  await page.route('**/api/rainviewer', (route) =>
    json(route, { hote: 'https://tuiles.invalid', satellite: [], radar: [] })
  );

  // Tuiles de fond et images RainViewer : jamais de sortie réseau réelle.
  await page.route(/basemaps\.cartocdn\.com|tilecache\.rainviewer\.com|tuiles\.invalid/, (route) =>
    route.abort()
  );
}
