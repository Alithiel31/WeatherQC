import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { config } from '../../src/config.js';
import { reponseZippopotam } from '../fixtures/zippopotam.js';
import { stubFetchJson } from '../helpers/fetch.js';

// Fichier séparé : les compteurs de la limitation de débit sont un état de
// module, isolé par fichier de test.
describe('Durcissement de l’exposition publique', () => {
  describe('En-têtes de sécurité (helmet)', () => {
    it('pose les en-têtes de durcissement', async () => {
      const response = await request(app).get('/api/sante').expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['referrer-policy']).toBeDefined();
    });

    it('ne divulgue plus le moteur applicatif', async () => {
      const response = await request(app).get('/api/sante').expect(200);

      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Taille du corps de requête', () => {
    it('refuse un corps JSON au-delà de 10 ko', async () => {
      const gros = { donnees: 'a'.repeat(20_000) };

      const response = await request(app).post('/api/villes').send(gros).expect(413);
      expect(response.body.status).toBe(413);
    });

    it('renvoie 400 sur un JSON malformé', async () => {
      await request(app)
        .post('/api/villes')
        .set('Content-Type', 'application/json')
        .send('{"casse":')
        .expect(400);
    });

    it('accepte un petit corps JSON', async () => {
      // Aucune route POST : 404 prouve que le corps a bien été analysé.
      await request(app).post('/api/villes').send({ donnees: 'ok' }).expect(404);
    });
  });

  describe('Limitation de débit', () => {
    it('expose les en-têtes standard de quota', async () => {
      const response = await request(app).get('/api/villes').expect(200);

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });

    it('renvoie 429 au-delà du quota, par client réel et non par proxy', async () => {
      stubFetchJson(reponseZippopotam);

      // Chaîne telle que la reçoit Express en production : « client, cloudflared »,
      // le socket étant nginx. Deux clients distincts derrière les mêmes proxies.
      const clientA = '203.0.113.7, 10.1.2.3';
      const clientB = '198.51.100.42, 10.1.2.3';

      for (let i = 0; i < config.rateLimit.maxGeocode; i++) {
        await request(app).get('/api/geocode/H2X').set('X-Forwarded-For', clientA).expect(200);
      }

      const bloque = await request(app)
        .get('/api/geocode/H2X')
        .set('X-Forwarded-For', clientA)
        .expect(429);
      expect(bloque.body.error).toContain('Trop de requêtes');

      // Si `trust proxy` était mal réglé, les deux clients partageraient le même
      // compteur et celui-ci serait bloqué lui aussi.
      await request(app).get('/api/geocode/H2X').set('X-Forwarded-For', clientB).expect(200);
    });

    it('ne limite jamais le healthcheck', async () => {
      for (let i = 0; i < 5; i++) {
        const response = await request(app).get('/api/sante').expect(200);
        expect(response.headers['ratelimit-limit']).toBeUndefined();
      }
    });
  });
});
