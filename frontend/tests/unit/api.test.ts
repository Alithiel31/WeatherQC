import { describe, it, expect } from 'vitest';
import {
  previsionsVille,
  previsionsCoordonnees,
  geocoder,
  framesRainViewer,
  ErreurApi,
  HOTE_TUILES_DEFAUT,
} from '../../src/lib/api.ts';
import { stubFetchJson, stubFetchErreurReseau } from '../helpers/fetch.ts';
import type { LieuCP } from '../../src/lib/types.ts';

const lieu: LieuCP = {
  rta: 'H2X',
  nom: 'Montréal',
  province: 'Quebec',
  latitude: 45.5088,
  longitude: -73.5878,
};

const previsions = {
  ville: { id: 'montreal', nom: 'Montréal', latitude: 45.5, longitude: -73.6 },
  misAJour: '2026-08-03T12:00:00',
  actuel: { temperature: 21, ressenti: 20, humidite: 60, vent: 12, code: 2, jour: true },
  horaire: [],
  quotidien: [],
  depuisCache: false,
};

describe('previsionsVille', () => {
  it('appelle la route de la ville et retourne la charge utile', async () => {
    const mock = stubFetchJson(previsions);

    await expect(previsionsVille('montreal')).resolves.toEqual(previsions);
    expect(mock).toHaveBeenCalledWith('/api/previsions/montreal');
  });

  it('rejette sur une réponse 404', async () => {
    stubFetchJson({ erreur: 'Ville inconnue' }, 404);

    await expect(previsionsVille('laval')).rejects.toThrow('Réponse invalide du serveur');
  });

  it('rejette sur une réponse 500', async () => {
    stubFetchJson({}, 500);

    await expect(previsionsVille('montreal')).rejects.toThrow('Réponse invalide du serveur');
  });

  it('propage une panne réseau', async () => {
    stubFetchErreurReseau();

    await expect(previsionsVille('montreal')).rejects.toThrow(TypeError);
  });
});

describe('previsionsCoordonnees', () => {
  it('encode latitude, longitude et nom dans la requête', async () => {
    const mock = stubFetchJson(previsions);

    await previsionsCoordonnees(lieu);

    const url = new URL(mock.mock.calls[0][0], 'http://localhost');
    expect(url.pathname).toBe('/api/previsions-coordonnees');
    expect(url.searchParams.get('lat')).toBe('45.5088');
    expect(url.searchParams.get('lon')).toBe('-73.5878');
    expect(url.searchParams.get('nom')).toBe('Montréal');
  });

  it('rejette sur une réponse non-ok', async () => {
    stubFetchJson({}, 502);

    await expect(previsionsCoordonnees(lieu)).rejects.toThrow('Réponse invalide du serveur');
  });
});

describe('geocoder', () => {
  it('retourne le lieu et encode le code postal dans l’URL', async () => {
    const mock = stubFetchJson(lieu);

    await expect(geocoder('H2X 1Y4')).resolves.toEqual(lieu);
    expect(mock).toHaveBeenCalledWith('/api/geocode/H2X%201Y4');
  });

  it('lève une ErreurApi portant le message du backend sur un 404', async () => {
    stubFetchJson({ erreur: 'Code postal introuvable : ZZZ' }, 404);

    await expect(geocoder('ZZZ')).rejects.toThrow(ErreurApi);
    await expect(geocoder('ZZZ')).rejects.toThrow('Code postal introuvable : ZZZ');
  });

  it('retombe sur un message par défaut si le backend n’en fournit pas', async () => {
    stubFetchJson({}, 500);

    await expect(geocoder('H2X')).rejects.toThrow('Code postal introuvable.');
  });

  it('propage une panne réseau sans la déguiser en ErreurApi', async () => {
    stubFetchErreurReseau();

    await expect(geocoder('H2X')).rejects.not.toThrow(ErreurApi);
  });
});

describe('framesRainViewer', () => {
  const index = {
    host: 'https://tilecache.rainviewer.com',
    satellite: { infrared: Array.from({ length: 14 }, (_, i) => ({ path: `/s${i}`, time: i })) },
    radar: {
      past: Array.from({ length: 10 }, (_, i) => ({ path: `/p${i}`, time: i })),
      nowcast: Array.from({ length: 5 }, (_, i) => ({ path: `/n${i}`, time: 100 + i })),
    },
  };

  it('garde les 10 dernières images satellite', async () => {
    stubFetchJson(index);

    const frames = await framesRainViewer();

    expect(frames.satellite).toHaveLength(10);
    expect(frames.satellite[9].path).toBe('/s13');
  });

  it('concatène passé et prévision radar en gardant les 12 dernières', async () => {
    stubFetchJson(index);

    const frames = await framesRainViewer();

    expect(frames.radar).toHaveLength(12);
    expect(frames.radar[11].path).toBe('/n4');
  });

  it('conserve l’hôte courant si l’index n’en fournit pas', async () => {
    stubFetchJson({ ...index, host: undefined });

    const frames = await framesRainViewer('https://ancien.exemple');

    expect(frames.hote).toBe('https://ancien.exemple');
  });

  it('retombe sur l’hôte par défaut sans argument', async () => {
    stubFetchJson({ ...index, host: undefined });

    await expect(framesRainViewer()).resolves.toMatchObject({ hote: HOTE_TUILES_DEFAUT });
  });

  it('tolère un index sans aucune couche', async () => {
    stubFetchJson({});

    const frames = await framesRainViewer();

    expect(frames.satellite).toEqual([]);
    expect(frames.radar).toEqual([]);
  });

  it('rejette quand RainViewer répond en erreur', async () => {
    stubFetchJson({}, 503);

    await expect(framesRainViewer()).rejects.toThrow('RainViewer indisponible');
  });

  it('propage une panne réseau', async () => {
    stubFetchErreurReseau();

    await expect(framesRainViewer()).rejects.toThrow(TypeError);
  });
});
