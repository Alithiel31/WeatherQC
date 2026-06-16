import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../../src/index.js';

describe('GET /api/geocode/:codePostal', () => {
  it('doit retourner les coordonnées pour H2X', async () => {
    const response = await request(app).get('/api/geocode/H2X').expect(200);

    expect(response.body).toHaveProperty('latitude');
    expect(response.body).toHaveProperty('longitude');
  });

  it('doit accepter les majuscules et minuscules', async () => {
    const response = await request(app).get('/api/geocode/h2x').expect(200);

    expect(response.body).toHaveProperty('latitude');
  });

  it('doit retourner erreur 400 pour un format invalide', async () => {
    const response = await request(app).get('/api/geocode/INVALID').expect(400);

    expect(response.body).toHaveProperty('erreur');
  });
});
