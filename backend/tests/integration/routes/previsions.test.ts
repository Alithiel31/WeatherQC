import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../../src/index.js';

describe('Routes Prévisions', () => {
  describe('GET /api/previsions/:ville', () => {
    it('doit retourner les prévisions pour montreal', async () => {
      const response = await request(app).get('/api/previsions/montreal').expect(200);

      expect(response.body).toHaveProperty('ville');
      expect(response.body).toHaveProperty('depuisCache');
      expect(response.body.ville.nom).toBe('Montréal');
    });

    it('doit retourner erreur 404 pour une ville inconnue', async () => {
      const response = await request(app).get('/api/previsions/xyzabc').expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('inconnue');
    });
  });

  describe('GET /api/previsions-coordonnees', () => {
    it('doit retourner les prévisions pour des coordonnées valides', async () => {
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
      const response = await request(app)
        .get('/api/previsions-coordonnees?lat=45.5&lon=-73.6')
        .expect(200);

      expect(response.body.ville.nom).toBe('Position personnalisee');
    });
  });
});
