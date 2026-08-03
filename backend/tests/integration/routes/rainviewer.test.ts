import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../../src/index.js';
import { indexRainViewer } from '../../fixtures/rainviewer.js';
import { stubFetchJson } from '../../helpers/fetch.js';

describe('GET /api/rainviewer', () => {
  it('doit retourner l’hôte des tuiles et les deux séries d’images', async () => {
    stubFetchJson(indexRainViewer);

    const response = await request(app).get('/api/rainviewer').expect(200);

    expect(response.body.hote).toBe('https://tilecache.rainviewer.com');
    expect(response.body.satellite[0]).toHaveProperty('path');
    expect(response.body.satellite[0]).toHaveProperty('time');
  });

  it('doit couper les séries à ce que l’animation exploite', async () => {
    // 13 images satellite et 12 + 3 radar en amont : le client n'a pas à
    // télécharger des tuiles qu'il n'affichera jamais.
    stubFetchJson(indexRainViewer);

    const response = await request(app).get('/api/rainviewer').expect(200);

    expect(response.body.satellite).toHaveLength(10);
    expect(response.body.radar).toHaveLength(12);
  });

  it('doit enchaîner le passé et le nowcast du radar', async () => {
    stubFetchJson(indexRainViewer);

    const response = await request(app).get('/api/rainviewer').expect(200);

    const chemins = response.body.radar.map((i: { path: string }) => i.path);
    expect(chemins.at(-1)).toContain('nowcast_2');
    expect(chemins.at(-3)).toContain('nowcast_0');
  });

  it('doit servir la deuxième requête depuis le cache', async () => {
    // La clé est unique et constante : tous les visiteurs se partagent un seul
    // appel amont par fenêtre de TTL. C'est ce qui remplace un limiteur dédié.
    const fetchMock = stubFetchJson(indexRainViewer);

    const premiere = await request(app).get('/api/rainviewer').expect(200);
    const seconde = await request(app).get('/api/rainviewer').expect(200);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(premiere.body.depuisCache).toBe(false);
    expect(seconde.body.depuisCache).toBe(true);
  });

  it('doit retomber sur l’hôte par défaut quand l’index n’en déclare pas', async () => {
    const { host: _host, ...sansHote } = indexRainViewer;
    stubFetchJson(sansHote);

    const response = await request(app).get('/api/rainviewer').expect(200);

    expect(response.body.hote).toBe('https://tilecache.rainviewer.com');
  });

  it('doit rendre des séries vides quand les blocs manquent', async () => {
    // Hors couverture radar, RainViewer omet les blocs plutôt que de les vider.
    stubFetchJson({ host: 'https://exemple.invalid' });

    const response = await request(app).get('/api/rainviewer').expect(200);

    expect(response.body.satellite).toEqual([]);
    expect(response.body.radar).toEqual([]);
  });

  it('doit retourner 502 quand RainViewer est en erreur', async () => {
    stubFetchJson({}, 503);

    const response = await request(app).get('/api/rainviewer').expect(502);

    expect(response.body.status).toBe(502);
    expect(response.body.error).toContain('RainViewer');
  });

  it('doit retourner 502 en nommant le champ fautif sur une dérive de schéma', async () => {
    // Une dérive amont est une panne du fournisseur, pas un bug interne : 502.
    stubFetchJson({ host: 42, satellite: { infrared: [{ time: 'hier' }] } });

    const response = await request(app).get('/api/rainviewer').expect(502);

    expect(response.body.status).toBe(502);
    expect(response.body.error).toContain('host');
  });
});
