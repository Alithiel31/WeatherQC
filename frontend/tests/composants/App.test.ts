import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import type { ReponseMeteo, LieuCP } from '../../src/lib/types.ts';

// La carte Leaflet ne se rend pas dans jsdom (pas de layout) : elle a ses propres
// tests. Ici on la remplace par un composant vide pour isoler App.
vi.mock('../../src/lib/CarteNuages.svelte', async () => {
  const { default: Vide } = await import('./fixtures/Vide.svelte');
  return { default: Vide };
});

const { previsionsVille, previsionsCoordonnees, geocoder, villesDisponibles, ErreurApi } =
  vi.hoisted(() => ({
    previsionsVille: vi.fn(),
    previsionsCoordonnees: vi.fn(),
    geocoder: vi.fn(),
    villesDisponibles: vi.fn(),
    ErreurApi: class ErreurApi extends Error {},
  }));

const VILLES_REPLI = [
  { id: 'montreal', nom: 'Montréal' },
  { id: 'quebec', nom: 'Québec' },
];

vi.mock('../../src/lib/api.ts', () => ({
  previsionsVille,
  previsionsCoordonnees,
  geocoder,
  villesDisponibles,
  VILLES_REPLI,
  ErreurApi,
}));

const { default: App } = await import('../../src/App.svelte');

const montreal: ReponseMeteo = {
  ville: { id: 'montreal', nom: 'Montréal', latitude: 45.5, longitude: -73.6 },
  misAJour: '2026-08-03T12:05:00',
  actuel: { temperature: 21.4, ressenti: 19.6, humidite: 62, vent: 14.2, code: 2, jour: true },
  horaire: [{ heure: '2026-08-03T12:00', temperature: 21, code: 2, precipitation: 0 }],
  quotidien: [
    {
      date: '2026-08-03',
      code: 2,
      max: 24,
      min: 14,
      precipitation: 0,
      lever: '2026-08-03T05:30',
      coucher: '2026-08-03T20:15',
    },
  ],
  depuisCache: false,
};

const lieu: LieuCP = {
  rta: 'H2X',
  nom: 'Montréal',
  province: 'Quebec',
  latitude: 45.5088,
  longitude: -73.5878,
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  previsionsVille.mockResolvedValue(montreal);
  villesDisponibles.mockResolvedValue(VILLES_REPLI);
});

describe('App — chargement initial', () => {
  it('charge la ville mémorisée au montage', async () => {
    localStorage.setItem('selection', 'quebec');

    render(App);

    await waitFor(() =>
      expect(previsionsVille).toHaveBeenCalledWith('quebec', expect.any(AbortSignal))
    );
  });

  it('affiche les conditions actuelles arrondies', async () => {
    render(App);

    expect(await screen.findByText('Partiellement nuageux')).toBeTruthy();
    expect(screen.getByText('21')).toBeTruthy();
    expect(screen.getByText('20°')).toBeTruthy();
    expect(screen.getByText('14 km/h')).toBeTruthy();
    expect(screen.getByText('62 %')).toBeTruthy();
  });

  it('affiche un message de repli quand les prévisions échouent', async () => {
    previsionsVille.mockRejectedValue(new Error('boom'));

    render(App);

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('ne sont pas disponibles')
    );
  });

  it('préfère le message du backend au message de repli', async () => {
    previsionsVille.mockRejectedValue(new ErreurApi('Open-Meteo injoignable : timeout'));

    render(App);

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('Open-Meteo injoignable')
    );
  });

  // Régression : `JSON.parse(localStorage.getItem('lieuCP'))` s'exécutait pendant
  // l'initialisation du composant, donc avant le premier rendu — une valeur
  // corrompue laissait une page blanche jusqu'à un vidage manuel du stockage.
  it('démarre malgré un lieu mémorisé corrompu', async () => {
    localStorage.setItem('lieuCP', '{cassé');
    localStorage.setItem('selection', 'montreal');

    render(App);

    expect(await screen.findByText('Partiellement nuageux')).toBeTruthy();
  });

  it('démarre quand le stockage est refusé par le navigateur', async () => {
    const refus = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refus);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refus);

    render(App);

    expect(await screen.findByText('Partiellement nuageux')).toBeTruthy();
    expect(previsionsVille).toHaveBeenCalledWith('montreal', expect.any(AbortSignal));

    vi.restoreAllMocks();
  });
});

describe('App — unités', () => {
  it('affiche le métrique par défaut', async () => {
    render(App);

    await screen.findByText('Partiellement nuageux');

    const bascule = screen.getByRole('button', { name: 'Unités impériales' });
    expect(bascule).toHaveProperty('textContent', '°C');
    expect(bascule.getAttribute('aria-pressed')).toBe('false');
  });

  it('bascule vers l’impérial et convertit l’affichage', async () => {
    const user = userEvent.setup();
    render(App);
    await screen.findByText('Partiellement nuageux');

    await user.click(screen.getByRole('button', { name: 'Unités impériales' }));

    const bascule = screen.getByRole('button', { name: 'Unités impériales' });
    expect(bascule).toHaveProperty('textContent', '°F');
    expect(bascule.getAttribute('aria-pressed')).toBe('true');
    // 21.4 °C → 71 °F, 14.2 km/h → 9 mph.
    expect(screen.getByText('71')).toBeTruthy();
    expect(screen.getByText('9 mph')).toBeTruthy();
    expect(localStorage.getItem('unite')).toBe('imperial');
  });

  it('mémorise l’unité choisie entre deux montages', async () => {
    localStorage.setItem('unite', 'imperial');

    render(App);
    await screen.findByText('Partiellement nuageux');

    expect(
      screen.getByRole('button', { name: 'Unités impériales' })
    ).toHaveProperty('textContent', '°F');
    expect(screen.getByText('71')).toBeTruthy();
  });
});

describe('App — prévisions périmées servies par le backend', () => {
  it('signale que les prévisions ne sont plus actualisées', async () => {
    // Le backend sert une entrée périmée quand l'amont est en panne : sans le
    // dire, l'heure de mise à jour du pied de page passerait pour l'heure réelle.
    previsionsVille.mockResolvedValue({ ...montreal, depuisCache: true, obsolete: true });

    render(App);

    expect(await screen.findByText(/prévisions non actualisées/)).toBeTruthy();
    expect(screen.getByText('Partiellement nuageux')).toBeTruthy();
  });

  it('ne signale rien quand les prévisions sont fraîches', async () => {
    render(App);
    await screen.findByText('Partiellement nuageux');

    expect(screen.queryByText(/prévisions non actualisées/)).toBeNull();
  });
});

describe('App — liste des villes', () => {
  it('remplit le sélecteur depuis /api/villes', async () => {
    villesDisponibles.mockResolvedValue([
      { id: 'montreal', nom: 'Montréal' },
      { id: 'quebec', nom: 'Québec' },
      { id: 'sherbrooke', nom: 'Sherbrooke' },
    ]);

    render(App);

    expect(await screen.findByRole('button', { name: 'Sherbrooke' })).toBeTruthy();
  });

  // La PWA doit rester utilisable hors ligne : le sélecteur ne peut pas dépendre
  // d'une requête réussie.
  it('garde la liste de repli quand le backend ne répond pas', async () => {
    villesDisponibles.mockRejectedValue(new TypeError('Failed to fetch'));

    render(App);

    expect(await screen.findByRole('button', { name: 'Montréal' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Québec' })).toBeTruthy();
  });

  it('ignore une liste vide plutôt que de vider le sélecteur', async () => {
    villesDisponibles.mockResolvedValue([]);

    render(App);

    expect(await screen.findByRole('button', { name: 'Montréal' })).toBeTruthy();
  });
});

describe('App — changement de ville', () => {
  it('recharge et mémorise la ville choisie', async () => {
    const user = userEvent.setup();
    render(App);
    await screen.findByText('Partiellement nuageux');

    await user.click(screen.getByRole('button', { name: 'Québec' }));

    await waitFor(() =>
      expect(previsionsVille).toHaveBeenCalledWith('quebec', expect.any(AbortSignal))
    );
    expect(localStorage.getItem('selection')).toBe('quebec');
  });

  // Régression : rien n'annulait la requête précédente. Si elle répondait en
  // dernier, l'écran affichait une ville et le bouton actif en désignait une autre.
  it('ignore la réponse d’une requête supplantée', async () => {
    const user = userEvent.setup();
    // C'est la température qui distingue les deux réponses : le nom du lieu ne
    // change qu'avec les données qui l'accompagnent, il ne peut plus servir de
    // témoin d'une bascule sans requête aboutie.
    const quebec: ReponseMeteo = { ...montreal, actuel: { ...montreal.actuel, temperature: 5.2 } };

    // Montréal (le chargement initial) répond après Québec : sans annulation,
    // c'est sa réponse périmée qui resterait affichée.
    let rendreMontreal!: (v: ReponseMeteo) => void;
    // `signal` optionnel à dessein : sans lui, la réponse tardive de Montréal
    // écrase Québec — c'est précisément la régression que ce test surveille.
    previsionsVille.mockImplementation((ville: string, signal?: AbortSignal) => {
      if (ville === 'quebec') return Promise.resolve(quebec);
      return new Promise<ReponseMeteo>((resolve, reject) => {
        rendreMontreal = resolve;
        signal?.addEventListener('abort', () => reject(signal.reason));
      });
    });

    render(App);
    await user.click(screen.getByRole('button', { name: 'Québec' }));
    expect(await screen.findByText('5')).toBeTruthy();

    rendreMontreal(montreal);
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.queryByText('21')).toBeNull();
  });

  it('ne recharge pas si la ville est déjà active', async () => {
    const user = userEvent.setup();
    render(App);
    await screen.findByText('Partiellement nuageux');

    await user.click(screen.getByRole('button', { name: 'Montréal' }));

    expect(previsionsVille).toHaveBeenCalledTimes(1);
  });
});

describe('App — recherche par code postal', () => {
  it('bascule sur les coordonnées géocodées et mémorise le lieu', async () => {
    const user = userEvent.setup();
    geocoder.mockResolvedValue(lieu);
    previsionsCoordonnees.mockResolvedValue(montreal);
    render(App);
    await screen.findByText('Partiellement nuageux');

    await user.type(screen.getByLabelText('Code postal canadien'), 'H2X 1Y4');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    await waitFor(() =>
      expect(previsionsCoordonnees).toHaveBeenCalledWith(lieu, expect.any(AbortSignal))
    );
    // Le signal accompagne désormais la requête : une recherche supplantée est
    // annulée, comme l'est déjà un chargement de ville supplanté.
    expect(geocoder).toHaveBeenCalledWith('H2X 1Y4', expect.any(AbortSignal));
    expect(JSON.parse(localStorage.getItem('lieuCP')!)).toEqual(lieu);
  });

  it('ignore une saisie vide', async () => {
    const user = userEvent.setup();
    render(App);
    await screen.findByText('Partiellement nuageux');

    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(geocoder).not.toHaveBeenCalled();
  });

  it('affiche le message du backend quand le code postal est refusé', async () => {
    const user = userEvent.setup();
    geocoder.mockRejectedValue(new ErreurApi('Code postal introuvable : ZZZ'));
    render(App);
    await screen.findByText('Partiellement nuageux');

    await user.type(screen.getByLabelText('Code postal canadien'), 'ZZZ');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(await screen.findByText('Code postal introuvable : ZZZ')).toBeTruthy();
  });

  it('affiche un message générique sur une panne réseau', async () => {
    const user = userEvent.setup();
    geocoder.mockRejectedValue(new TypeError('Failed to fetch'));
    render(App);
    await screen.findByText('Partiellement nuageux');

    await user.type(screen.getByLabelText('Code postal canadien'), 'H2X');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    expect(await screen.findByText('Recherche impossible. Vérifiez la connexion.')).toBeTruthy();
  });

  it('annule la recherche encore en vol au démontage', async () => {
    const user = userEvent.setup();
    let signal: AbortSignal | undefined;
    geocoder.mockImplementation((_cp: string, s: AbortSignal) => {
      signal = s;
      return new Promise(() => {}); // jamais résolue
    });

    const { unmount } = render(App);
    await screen.findByText('Partiellement nuageux');

    await user.type(screen.getByLabelText('Code postal canadien'), 'H2X');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));
    await screen.findByRole('button', { name: 'Recherche…' });

    unmount();

    // `geocoder` était la seule fonction de `api.ts` à ne pas prendre de signal :
    // sa requête survivait au composant, jusqu'à 10 s durant.
    expect(signal?.aborted).toBe(true);
  });

  it('désactive le bouton pendant la recherche', async () => {
    const user = userEvent.setup();
    geocoder.mockImplementation(() => new Promise(() => {}));
    render(App);
    await screen.findByText('Partiellement nuageux');

    await user.type(screen.getByLabelText('Code postal canadien'), 'H2X');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));

    // Jusqu'à 10 s peuvent s'écouler avant la réponse : sans retour visuel,
    // rien ne distingue une recherche en cours d'un clic non pris en compte.
    const bouton = await screen.findByRole('button', { name: 'Recherche…' });
    expect((bouton as HTMLButtonElement).disabled).toBe(true);
  });

  it('efface l’erreur de code postal quand on change de ville', async () => {
    const user = userEvent.setup();
    geocoder.mockRejectedValue(new ErreurApi('Code postal introuvable : ZZZ'));
    render(App);
    await screen.findByText('Partiellement nuageux');

    await user.type(screen.getByLabelText('Code postal canadien'), 'ZZZ');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));
    await screen.findByText('Code postal introuvable : ZZZ');

    await user.click(screen.getByRole('button', { name: 'Québec' }));

    await waitFor(() => expect(screen.queryByText('Code postal introuvable : ZZZ')).toBeNull());
  });
});

/**
 * Régression : `{:else if erreur}` était évalué avant `{:else if donnees}`, et
 * `charger()` ne vide jamais `donnees`. Un échec de rafraîchissement effaçait
 * donc de l'écran des prévisions parfaitement lisibles, toujours en mémoire —
 * l'inverse de ce que promet une application hors ligne d'abord.
 */
describe('App — une erreur ne doit pas effacer les données affichées', () => {
  it('garde les prévisions à l’écran et ajoute un bandeau', async () => {
    const user = userEvent.setup();
    render(App);
    await screen.findByText('Partiellement nuageux');

    previsionsVille.mockRejectedValue(new ErreurApi('Open-Meteo injoignable : timeout'));
    await user.click(screen.getByRole('button', { name: 'Québec' }));

    expect(await screen.findByText('Open-Meteo injoignable : timeout')).toBeTruthy();
    // Les données précédentes sont toujours là.
    expect(screen.getByText('Partiellement nuageux')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('n’annonce pas une ville dont il affiche les prévisions d’une autre', async () => {
    const user = userEvent.setup();
    render(App);
    // `.lieu` est le libellé au-dessus des relevés, à distinguer du bouton de
    // même nom dans le sélecteur de villes.
    const libelle = () => document.querySelector('.lieu')?.textContent;
    await waitFor(() => expect(libelle()).toBe('Montréal'));

    previsionsVille.mockRejectedValue(new ErreurApi('Open-Meteo injoignable'));
    await user.click(screen.getByRole('button', { name: 'Québec' }));
    await screen.findByText('Open-Meteo injoignable');

    // Le libellé est figé avec les données, pas dérivé de la sélection : sinon
    // il annoncerait « Québec » au-dessus des relevés de Montréal.
    expect(libelle()).toBe('Montréal');
  });

  it('occupe tout l’écran quand il n’y a rien à préserver', async () => {
    previsionsVille.mockRejectedValue(new ErreurApi('Open-Meteo injoignable'));

    render(App);

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('Open-Meteo injoignable')
    );
    expect(screen.queryByText('Partiellement nuageux')).toBeNull();
  });
});
