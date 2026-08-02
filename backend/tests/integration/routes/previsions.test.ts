import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../../src/index.js';
import { reponseOpenMeteo } from '../../fixtures/openmeteo.js';
import { stubFetchJson } from '../../helpers/fetch.js';

describe('Routes Prévisions', () => {
  describe('GET /api/previsions/:ville', () => {
    it('doit retourner les prévisions pour montreal', async () => {
      stubFetchJson(reponseOpenMeteo);

      const response = await request(app).get('/api/previsions/montreal').expect(200);

      expect(response.body).toHaveProperty('ville');
      expect(response.body).toHaveProperty('depuisCache');
      expect(response.body.ville.nom).toBe('Montréal');
    });

    it('doit mapper les données renvoyées par Open-Meteo', async () => {
      stubFetchJson(reponseOpenMeteo);

      const response = await request(app).get('/api/previsions/quebec').expect(200);

      expect(response.body.actuel.temperature).toBe(-5.2);
      expect(response.body.actuel.jour).toBe(true);
      expect(response.body.horaire).toHaveLength(48);
      expect(response.body.horaire[0].heure).toBe('2026-01-15T14:00');
      expect(response.body.quotidien).toHaveLength(7);
    });

    it('doit servir la deuxième requête depuis le cache', async () => {
      const fetchMock = stubFetchJson(reponseOpenMeteo);

      const premiere = await request(app).get('/api/previsions/montreal').expect(200);
      const seconde = await request(app).get('/api/previsions/montreal').expect(200);

      expect(premiere.body.depuisCache).toBe(false);
      expect(seconde.body.depuisCache).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('doit retourner erreur 404 pour une ville inconnue', async () => {
      const response = await request(app).get('/api/previsions/xyzabc').expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('inconnue');
    });

    it('doit retourner erreur 502 si Open-Meteo répond en erreur', async () => {
      stubFetchJson({}, 503);

      const response = await request(app).get('/api/previsions/montreal').expect(502);

      expect(response.body.error).toContain('503');
    });
  });

  describe('GET /api/previsions-coordonnees', () => {
    it('doit retourner les prévisions pour des coordonnées valides', async () => {
      stubFetchJson(reponseOpenMeteo);

      const response = await request(app)
        .get('/api/previsions-coordonnees?lat=45.5&lon=-73.6')
        .expect(200);

      expect(response.body).toHaveProperty('ville');
      expect(response.body.ville.latitude).toBe(45.5);
      expect(response.body.ville.longitude).toBe(-73.6);
    });

    it('doit retourner erreur 400 si lat est invalide', async () => {
      const response = await request(app)
        .get('/api/previsions-coordonnees?lat=abc&lon=-73.6')
        .expect(400);

      expect(response.body).toHaveProperty('erreur');
      expect(response.body.erreur).toBe('Paramètres invalides');
    });

    it('doit retourner erreur 400 si lon est hors limites', async () => {
      const response = await request(app)
        .get('/api/previsions-coordonnees?lat=45.5&lon=-200')
        .expect(400);

      expect(response.body).toHaveProperty('erreur');
      expect(response.body.erreur).toBe('Paramètres invalides');
    });

    it('doit accepter un nom personnalisé', async () => {
      stubFetchJson(reponseOpenMeteo);

      const response = await request(app)
        .get('/api/previsions-coordonnees?lat=45.5&lon=-73.6&nom=MaVille')
        .expect(200);

      expect(response.body.ville.nom).toBe('MaVille');
    });

    it('doit limiter le nom à 80 caractères', async () => {
      const longNom = 'a'.repeat(100);
      const response = await request(app)
        .get(`/api/previsions-coordonnees?lat=45.5&lon=-73.6&nom=${longNom}`)
        .expect(400);

      expect(response.body).toHaveProperty('erreur');
      expect(response.body.erreur).toBe('Paramètres invalides');
    });

    it('doit utiliser le nom par défaut si non fourni', async () => {
      stubFetchJson(reponseOpenMeteo);

      const response = await request(app)
        .get('/api/previsions-coordonnees?lat=45.5&lon=-73.6')
        .expect(200);

      expect(response.body.ville.nom).toBe('Position personnalisee');
    });
  });
});
