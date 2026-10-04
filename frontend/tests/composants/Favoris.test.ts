import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import type { Favori, ReponseMeteo } from '../../src/lib/types.ts';

const { previsionsVille, previsionsCoordonnees } = vi.hoisted(() => ({
  previsionsVille: vi.fn(),
  previsionsCoordonnees: vi.fn(),
}));

vi.mock('../../src/lib/api.ts', () => ({ previsionsVille, previsionsCoordonnees }));

const { default: Favoris } = await import('../../src/lib/Favoris.svelte');

const villeQuebec: Favori = { type: 'ville', id: 'quebec', nom: 'Québec' };
const cpFavori: Favori = {
  type: 'cp',
  lieu: { rta: 'H2X', nom: 'Montréal', province: 'Quebec', latitude: 45.5, longitude: -73.6 },
};

function reponse(temperature: number, code = 2): ReponseMeteo {
  return {
    ville: { id: 'x', nom: 'x', latitude: 0, longitude: 0 },
    misAJour: '2026-08-03T12:00:00',
    actuel: { temperature, ressenti: temperature, humidite: 50, vent: 10, code, jour: true },
    horaire: [],
    quotidien: [],
    alertes: [],
    depuisCache: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Favoris — liste vide', () => {
  it('affiche un message d’état vide', () => {
    render(Favoris, { favoris: [], onchoisir: vi.fn(), onretirer: vi.fn() });

    expect(screen.getByText(/Aucun favori/)).toBeTruthy();
  });
});

describe('Favoris — résumé météo', () => {
  it('affiche un résumé pour une ville favorite', async () => {
    previsionsVille.mockResolvedValue(reponse(15));

    render(Favoris, { favoris: [villeQuebec], onchoisir: vi.fn(), onretirer: vi.fn() });

    expect(await screen.findByText('15°')).toBeTruthy();
    expect(previsionsVille).toHaveBeenCalledWith('quebec');
  });

  it('affiche un résumé pour un lieu géocodé par code postal, sans regéocoder', async () => {
    previsionsCoordonnees.mockResolvedValue(reponse(10));

    render(Favoris, { favoris: [cpFavori], onchoisir: vi.fn(), onretirer: vi.fn() });

    expect(await screen.findByText('10°')).toBeTruthy();
    expect(previsionsCoordonnees).toHaveBeenCalledWith(cpFavori.lieu);
  });

  // Un favori dont l'amont échoue ne doit pas empêcher l'affichage des autres —
  // ici il n'y en a qu'un, on vérifie juste que l'échec est visible, pas fatal.
  it('affiche « Indisponible » quand la requête échoue', async () => {
    previsionsVille.mockRejectedValue(new Error('boom'));

    render(Favoris, { favoris: [villeQuebec], onchoisir: vi.fn(), onretirer: vi.fn() });

    expect(await screen.findByText('Indisponible')).toBeTruthy();
  });
});

describe('Favoris — interactions', () => {
  it('choisit le favori cliqué', async () => {
    previsionsVille.mockResolvedValue(reponse(15));
    const onchoisir = vi.fn();
    const user = userEvent.setup();

    render(Favoris, { favoris: [villeQuebec], onchoisir, onretirer: vi.fn() });
    await screen.findByText('15°');

    await user.click(screen.getByText('Québec'));

    expect(onchoisir).toHaveBeenCalledWith(villeQuebec);
  });

  it('retire le favori au clic sur son bouton dédié', async () => {
    previsionsVille.mockResolvedValue(reponse(15));
    const onretirer = vi.fn();
    const user = userEvent.setup();

    render(Favoris, { favoris: [villeQuebec], onchoisir: vi.fn(), onretirer });
    await screen.findByText('15°');

    await user.click(
      screen.getByRole('button', { name: /Retirer Québec de la liste des favoris/ })
    );

    expect(onretirer).toHaveBeenCalledWith(villeQuebec);
  });
});
