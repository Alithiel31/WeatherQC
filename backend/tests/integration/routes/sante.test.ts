import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../../src/index.js';

describe('GET /api/sante', () => {
  it('doit retourner un statut ok', async () => {
    const response = await request(app).get('/api/sante').expect(200);

    expect(response.body).toHaveProperty('statut');
    expect(response.body.statut).toBe('ok');
  });
});
