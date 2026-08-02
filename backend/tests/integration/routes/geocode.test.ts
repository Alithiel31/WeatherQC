import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../../src/index.js';
import { reponseZippopotam } from '../../fixtures/zippopotam.js';
import { stubFetchJson } from '../../helpers/fetch.js';

describe('GET /api/geocode/:codePostal', () => {
  it('doit retourner les coordonnées pour H2X', async () => {
    stubFetchJson(reponseZippopotam);

    const response = await request(app).get('/api/geocode/H2X').expect(200);

    expect(response.body).toHaveProperty('latitude');
    expect(response.body).toHaveProperty('longitude');
    expect(response.body.rta).toBe('H2X');
  });

  it('doit accepter les majuscules et minuscules', async () => {
    stubFetchJson(reponseZippopotam);

    const response = await request(app).get('/api/geocode/h2x').expect(200);

    expect(response.body).toHaveProperty('latitude');
  });

  it('doit retourner erreur 400 pour un format invalide', async () => {
    const response = await request(app).get('/api/geocode/INVALID').expect(400);

    expect(response.body).toHaveProperty('erreur');
  });

  it('doit retourner erreur 404 pour un RTA inexistant', async () => {
    stubFetchJson({}, 404);

    const response = await request(app).get('/api/geocode/Z9Z').expect(404);

    expect(response.body.error).toContain('Z9Z');
  });

  it('doit servir la deuxième requête depuis le cache', async () => {
    const fetchMock = stubFetchJson(reponseZippopotam);

    await request(app).get('/api/geocode/H2X').expect(200);
    await request(app).get('/api/geocode/H2X').expect(200);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
