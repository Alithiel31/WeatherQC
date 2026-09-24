import type { Request, Response } from 'express';
import { CITIES } from '../data/cities.js';
import { villesSchema } from '../schemas/openapi-reponses.js';
import { envoyerJson } from '../lib/reponse.js';

export default {
  getAll: (_req: Request, res: Response) => {
    const villes = Object.values(CITIES).map(({ id, nom, latitude, longitude }) => ({
      id,
      nom,
      latitude,
      longitude,
    }));
    envoyerJson(res, villesSchema, villes);
  },
};
