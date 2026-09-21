import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../../src/index.js';

describe('GET /api/openapi.json', () => {
  it('rend un document OpenAPI 3.1 valide', async () => {
    const response = await request(app).get('/api/openapi.json').expect(200);

    expect(response.body.openapi).toBe('3.1.0');
    expect(response.body.paths).toHaveProperty('/api/previsions/{ville}');
    expect(response.body.paths).toHaveProperty('/api/villes');
  });

  it('décrit le paramètre de chemin comme requis, même optionnel côté Zod', async () => {
    const response = await request(app).get('/api/openapi.json').expect(200);

    const parametres = response.body.paths['/api/geocode/{codePostal}'].get.parameters;
    expect(parametres).toEqual([expect.objectContaining({ name: 'codePostal', required: true })]);
  });

  it("ne marque pas requis un paramètre de requête portant un défaut ('nom')", async () => {
    // `nom` a un `.default()` côté Zod : sans `io: 'input'`, il ressortirait à
    // tort comme requis, puisque la sortie de Zod le contient toujours.
    const response = await request(app).get('/api/openapi.json').expect(200);

    const parametres = response.body.paths['/api/previsions-coordonnees'].get.parameters;
    const nom = parametres.find((p: { name: string }) => p.name === 'nom');
    const lat = parametres.find((p: { name: string }) => p.name === 'lat');

    expect(nom.required).toBe(false);
    expect(lat.required).toBe(true);
  });

  it('n’est jamais soumis au quota', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).get('/api/openapi.json').expect(200);
    }

    const response = await request(app).get('/api/openapi.json').expect(200);
    expect(response.headers['ratelimit-remaining']).toBeUndefined();
  });
});
