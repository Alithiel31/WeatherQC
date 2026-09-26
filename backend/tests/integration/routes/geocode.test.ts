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

    // Même enveloppe que les autres erreurs de l'API — le client n'a qu'une
    // seule forme à lire, quel que soit le middleware qui l'a produite.
    expect(response.body.status).toBe(400);
    expect(response.body.error).toBe('Paramètres invalides');
    expect(response.body.details).toBeInstanceOf(Array);
  });

  // Régression : Zippopotam ne filtre par aucune province — un FSA bien formé
  // mais hors Québec (Toronto, Vancouver…) renvoyait de vraies prévisions,
  // contraire au positionnement 100 % québécois de l'application.
  it.each(['M5V', 'V6B', 'K1A'])(
    'doit refuser le FSA %s, bien formé mais hors Québec',
    async (fsa) => {
      const response = await request(app).get(`/api/geocode/${fsa}`).expect(400);

      expect(response.body.status).toBe(400);
      expect(response.body.error).toBe('Paramètres invalides');
      expect(JSON.stringify(response.body.details)).toContain('réservé aux codes postaux du Québec');
    }
  );

  it.each(['H2X', 'G1A', 'J4B'])('doit accepter le FSA québécois %s', async (fsa) => {
    stubFetchJson(reponseZippopotam);

    const response = await request(app).get(`/api/geocode/${fsa}`).expect(200);

    expect(response.body).toHaveProperty('latitude');
  });

  it('doit retourner erreur 404 pour un RTA inexistant', async () => {
    stubFetchJson({}, 404);

    // Doit rester un FSA bien formé *et* québécois : sinon c'est la restriction
    // de province, testée plus haut, qui répondrait — pas la 404 de Zippopotam
    // que ce test vise.
    const response = await request(app).get('/api/geocode/G9Z').expect(404);

    expect(response.body.error).toContain('G9Z');
  });

  it('doit servir la deuxième requête depuis le cache', async () => {
    const fetchMock = stubFetchJson(reponseZippopotam);

    await request(app).get('/api/geocode/H2X').expect(200);
    await request(app).get('/api/geocode/H2X').expect(200);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
