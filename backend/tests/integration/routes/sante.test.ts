import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../../src/index.js';
import { reponseOpenMeteo } from '../../fixtures/openmeteo.js';
import { stubFetchJson } from '../../helpers/fetch.js';

describe('GET /api/sante', () => {
  it('doit retourner un statut ok', async () => {
    const response = await request(app).get('/api/sante').expect(200);

    expect(response.body).toHaveProperty('statut');
    expect(response.body.statut).toBe('ok');
  });

  /**
   * La route ne rendait que `{ statut: 'ok' }` — vrai, mais inexploitable. Ce
   * qui suit est ce qu'on veut lire quand l'application « rame » sans savoir si
   * la faute revient au Raspberry Pi ou à un fournisseur.
   */
  it('expose de quoi diagnostiquer sans se connecter à la machine', async () => {
    const response = await request(app).get('/api/sante').expect(200);

    expect(typeof response.body.demarreDepuisS).toBe('number');
    expect(response.body.memoireMo).toBeGreaterThan(0);
    expect(response.body.versionNode).toMatch(/^v\d+\./);
    expect(response.body.cache).toMatchObject({ entrees: expect.any(Number) });
  });

  it('rend le taux de cache une fois des requêtes servies', async () => {
    stubFetchJson(reponseOpenMeteo);

    await request(app).get('/api/previsions/montreal').expect(200);
    await request(app).get('/api/previsions/montreal').expect(200);

    const response = await request(app).get('/api/sante').expect(200);

    // `depuisCache` circulait déjà dans chaque réponse ; il était juste
    // impossible d'en tirer un ratio.
    expect(response.body.cache).toMatchObject({ hits: 1, misses: 1, entrees: 1 });
    expect(response.body.cache.tauxHit).toBe(50);
  });

  it('rend l’état des disjoncteurs amont', async () => {
    stubFetchJson(reponseOpenMeteo);
    await request(app).get('/api/previsions/montreal').expect(200);

    const response = await request(app).get('/api/sante').expect(200);

    expect(response.body.amonts['Open-Meteo']).toEqual({
      etat: 'ferme',
      echecsConsecutifs: 0,
    });
  });

  it('n’est jamais soumis au quota', async () => {
    // Le healthcheck Docker l'interroge toutes les 30 s : il ne doit pas
    // consommer le budget des vrais clients.
    for (let i = 0; i < 5; i++) {
      await request(app).get('/api/sante').expect(200);
    }

    const response = await request(app).get('/api/sante').expect(200);
    expect(response.headers['ratelimit-remaining']).toBeUndefined();
  });
});
