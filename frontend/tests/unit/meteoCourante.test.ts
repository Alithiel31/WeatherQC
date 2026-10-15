import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import type { ReponseMeteo, LieuCP } from '../../src/lib/types.ts';

const {
  previsionsVille,
  previsionsCoordonnees,
  geocoder,
  geocoderVille,
  villesDisponibles,
  ErreurApi,
} = vi.hoisted(() => ({
  previsionsVille: vi.fn(),
  previsionsCoordonnees: vi.fn(),
  geocoder: vi.fn(),
  geocoderVille: vi.fn(),
  villesDisponibles: vi.fn(),
  ErreurApi: class ErreurApi extends Error {},
}));

vi.mock('../../src/lib/api.ts', () => ({
  previsionsVille,
  previsionsCoordonnees,
  geocoder,
  geocoderVille,
  villesDisponibles,
  VILLES_REPLI: [
    { id: 'montreal', nom: 'Montréal' },
    { id: 'quebec', nom: 'Québec' },
  ],
  ErreurApi,
}));

const { creerMeteoCourante } = await import('../../src/lib/meteoCourante.svelte.ts');
const { creerPreferences } = await import('../../src/lib/preferences.svelte.ts');

const reponse = (nom: string): ReponseMeteo => ({
  ville: { id: nom.toLowerCase(), nom, latitude: 45.5, longitude: -73.6 },
  misAJour: '2026-08-03T12:05:00',
  actuel: { temperature: 21, ressenti: 20, humidite: 60, vent: 10, code: 2, jour: true },
  horaire: [],
  quotidien: [],
  alertes: [],
  depuisCache: false,
});

const lieu: LieuCP = {
  rta: 'H2X',
  nom: 'Montréal',
  province: 'Quebec',
  latitude: 45.5,
  longitude: -73.6,
};

/** Promesse contrôlée de l'extérieur, et rejetée à l'annulation comme le ferait `fetch`. */
function enAttente<T>(signal: AbortSignal) {
  let resoudre!: (v: T) => void;
  const promesse = new Promise<T>((ok, ko) => {
    resoudre = ok;
    signal.addEventListener('abort', () => ko(new DOMException('annulée', 'AbortError')));
  });
  return { promesse, resoudre };
}

function creer() {
  const prefs = creerPreferences();
  return { prefs, meteo: creerMeteoCourante(prefs) };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('creerMeteoCourante — chargement', () => {
  it('charge la ville sélectionnée et fige le libellé à l’arrivée des données', async () => {
    previsionsVille.mockResolvedValue(reponse('Montréal'));
    const { meteo } = creer();

    expect(meteo.chargement).toBe(true);
    await meteo.charger();

    expect(previsionsVille).toHaveBeenCalledWith('montreal', expect.any(AbortSignal));
    expect(meteo.donnees?.ville.nom).toBe('Montréal');
    expect(meteo.nomLieu).toBe('Montréal');
    expect(meteo.chargement).toBe(false);
  });

  it('interroge les coordonnées pour un lieu géocodé, libellé avec son RTA', async () => {
    previsionsCoordonnees.mockResolvedValue(reponse('Montréal'));
    const { prefs, meteo } = creer();
    prefs.retenirLieu(lieu, 'H2X');

    await meteo.charger();

    expect(previsionsCoordonnees).toHaveBeenCalledWith(lieu, expect.any(AbortSignal));
    expect(meteo.nomLieu).toBe('Montréal (H2X)');
  });

  it('distingue le message du backend d’une panne réseau', async () => {
    const { meteo } = creer();

    previsionsVille.mockRejectedValueOnce(new ErreurApi('Ville inconnue.'));
    await meteo.charger();
    expect(meteo.erreur).toBe('Ville inconnue.');

    previsionsVille.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await meteo.charger();
    expect(meteo.erreur).toMatch(/Vérifiez la connexion/);
    expect(meteo.chargement).toBe(false);
  });

  it('annule la requête supplantée, qui ne rend ni erreur ni fin de chargement', async () => {
    const { meteo } = creer();
    let premiere!: ReturnType<typeof enAttente<ReponseMeteo>>;
    previsionsVille.mockImplementationOnce((_v: string, signal: AbortSignal) => {
      premiere = enAttente<ReponseMeteo>(signal);
      return premiere.promesse;
    });
    let seconde!: ReturnType<typeof enAttente<ReponseMeteo>>;
    previsionsVille.mockImplementationOnce((_v: string, signal: AbortSignal) => {
      seconde = enAttente<ReponseMeteo>(signal);
      return seconde.promesse;
    });

    const p1 = meteo.charger();
    const p2 = meteo.charger();
    await p1;

    // La première, annulée, ne doit ni afficher d'erreur ni couper le spinner.
    expect(meteo.erreur).toBeNull();
    expect(meteo.chargement).toBe(true);

    seconde.resoudre(reponse('Québec'));
    await p2;
    expect(meteo.donnees?.ville.nom).toBe('Québec');
    expect(meteo.chargement).toBe(false);
  });

  it('annuler() interrompt les requêtes en vol', async () => {
    const { meteo } = creer();
    let signalRecu!: AbortSignal;
    previsionsVille.mockImplementationOnce((_v: string, signal: AbortSignal) => {
      signalRecu = signal;
      return enAttente<ReponseMeteo>(signal).promesse;
    });

    const enCours = meteo.charger();
    meteo.annuler();
    await enCours;

    expect(signalRecu.aborted).toBe(true);
  });
});

describe('creerMeteoCourante — choix et recherche', () => {
  it('choisirVille ignore la ville déjà active, sinon efface l’erreur de recherche et charge', async () => {
    previsionsVille.mockResolvedValue(reponse('Québec'));
    geocoder.mockRejectedValueOnce(new ErreurApi('Code postal introuvable.'));
    const { prefs, meteo } = creer();

    await meteo.rechercherCP('G9Z');
    expect(meteo.erreurCP).toBe('Code postal introuvable.');

    meteo.choisirVille('montreal');
    expect(previsionsVille).not.toHaveBeenCalled();

    meteo.choisirVille('quebec');
    expect(prefs.selection).toBe('quebec');
    expect(meteo.erreurCP).toBeNull();
    expect(previsionsVille).toHaveBeenCalledWith('quebec', expect.any(AbortSignal));
  });

  it('aiguille un code postal vers le géocodage RTA et un nom vers la recherche de ville', async () => {
    previsionsCoordonnees.mockResolvedValue(reponse('Montréal'));
    geocoder.mockResolvedValue(lieu);
    geocoderVille.mockResolvedValue({ ...lieu, rta: '' });
    const { prefs, meteo } = creer();

    await meteo.rechercherCP('h2x 1y4');
    expect(geocoder).toHaveBeenCalledWith('h2x 1y4', expect.any(AbortSignal));
    expect(prefs.lieuCP).toEqual(lieu);

    await meteo.rechercherCP('Sherbrooke');
    expect(geocoderVille).toHaveBeenCalledWith('Sherbrooke', expect.any(AbortSignal));
    expect(meteo.rechercheCP).toBe(false);
  });

  it('rend un message générique quand la recherche échoue hors backend', async () => {
    geocoderVille.mockRejectedValue(new TypeError('Failed to fetch'));
    const { meteo } = creer();

    await meteo.rechercherCP('Sherbrooke');

    expect(meteo.erreurCP).toBe('Recherche impossible. Vérifiez la connexion.');
  });

  it('choisirFavori charge une ville par son id, et un lieu sans le regéocoder', async () => {
    previsionsVille.mockResolvedValue(reponse('Québec'));
    previsionsCoordonnees.mockResolvedValue(reponse('Montréal'));
    const { prefs, meteo } = creer();

    meteo.choisirFavori({ type: 'ville', id: 'quebec', nom: 'Québec' });
    expect(prefs.selection).toBe('quebec');

    meteo.choisirFavori({ type: 'cp', lieu });
    expect(prefs.lieuCP).toEqual(lieu);
    expect(geocoder).not.toHaveBeenCalled();
    expect(previsionsCoordonnees).toHaveBeenCalledWith(lieu, expect.any(AbortSignal));
  });

  it('chargerVilles remplace le repli, et le garde si le backend échoue ou rend une liste vide', async () => {
    const { meteo } = creer();

    villesDisponibles.mockResolvedValueOnce([]);
    meteo.chargerVilles();
    await vi.waitFor(() => expect(villesDisponibles).toHaveBeenCalledTimes(1));
    flushSync();
    expect(meteo.villes).toHaveLength(2);

    villesDisponibles.mockRejectedValueOnce(new Error('hors ligne'));
    meteo.chargerVilles();
    await Promise.resolve();
    expect(meteo.villes).toHaveLength(2);

    villesDisponibles.mockResolvedValueOnce([{ id: 'gatineau', nom: 'Gatineau' }]);
    meteo.chargerVilles();
    await vi.waitFor(() => expect(meteo.villes).toEqual([{ id: 'gatineau', nom: 'Gatineau' }]));
  });
});
