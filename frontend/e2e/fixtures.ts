import type { Page, Route } from '@playwright/test';

/** Réponse de `/api/previsions/:ville`, réduite à ce que l'écran affiche. */
export function previsions(nom = 'Montréal', temperature = 21.4) {
  return {
    ville: { id: 'montreal', nom, latitude: 45.5, longitude: -73.6 },
    misAJour: '2026-08-03T12:05:00',
    actuel: { temperature, ressenti: 19.6, humidite: 62, vent: 14.2, code: 2, jour: true },
    horaire: Array.from({ length: 6 }, (_, i) => ({
      heure: `2026-08-03T${String(12 + i).padStart(2, '0')}:00`,
      temperature: 21 + i,
      code: 2,
      precipitation: 0,
    })),
    quotidien: Array.from({ length: 3 }, (_, i) => ({
      date: `2026-08-0${3 + i}`,
      code: 2,
      max: 24,
      min: 14,
      precipitation: 0,
      lever: '2026-08-03T05:30',
      coucher: '2026-08-03T20:15',
    })),
    depuisCache: false,
  };
}

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
}

/**
 * Intercepte toutes les routes de l'API.
 *
 * Les tuiles de carte et l'index RainViewer sont coupés net : ils partiraient
 * vers Internet, et la carte n'est pas le sujet ici.
 */
export async function interceptApi(page: Page, options: Options = {}): Promise<void> {
  const { statutPrevisions = 200, erreur = 'Open-Meteo injoignable : timeout' } = options;

  await page.route('**/api/villes', (route) => json(route, VILLES));

  // Expression régulière et non motif glob : `/api/previsions/:ville` et
  // `/api/previsions-coordonnees?lat=…` n'ont pas la même forme, et un motif
  // trop étroit laisse la seconde filer vers le proxy Vite — donc vers un vrai
  // appel réseau, ce que cette suite s'interdit.
  await page.route(/\/api\/previsions/, (route) =>
    statutPrevisions === 200
      ? json(route, previsions())
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
