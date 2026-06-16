import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../../src/index.js';

describe('GET /api/villes', () => {
  it('doit retourner la liste des villes', async () => {
    const response = await request(app).get('/api/villes').expect(200);

    // La réponse est directement un array, pas { villes: [...] }
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toHaveProperty('id');
    expect(response.body[0]).toHaveProperty('nom');
  });
});
