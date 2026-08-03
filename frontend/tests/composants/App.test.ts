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

const { previsionsVille, previsionsCoordonnees, geocoder, ErreurApi } = vi.hoisted(() => ({
  previsionsVille: vi.fn(),
  previsionsCoordonnees: vi.fn(),
  geocoder: vi.fn(),
  ErreurApi: class ErreurApi extends Error {},
}));

vi.mock('../../src/lib/api.ts', () => ({
  previsionsVille,
  previsionsCoordonnees,
  geocoder,
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
});

describe('App — chargement initial', () => {
  it('charge la ville mémorisée au montage', async () => {
    localStorage.setItem('selection', 'quebec');

    render(App);

    await waitFor(() => expect(previsionsVille).toHaveBeenCalledWith('quebec'));
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
});

describe('App — changement de ville', () => {
  it('recharge et mémorise la ville choisie', async () => {
    const user = userEvent.setup();
    render(App);
    await screen.findByText('Partiellement nuageux');

    await user.click(screen.getByRole('button', { name: 'Québec' }));

    await waitFor(() => expect(previsionsVille).toHaveBeenCalledWith('quebec'));
    expect(localStorage.getItem('selection')).toBe('quebec');
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

    await waitFor(() => expect(previsionsCoordonnees).toHaveBeenCalledWith(lieu));
    expect(geocoder).toHaveBeenCalledWith('H2X 1Y4');
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
});
