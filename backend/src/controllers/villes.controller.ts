import type { Request, Response } from 'express';
import { CITIES } from '../data/cities.js';

export default {
  getAll: (_req: Request, res: Response) => {
    const villes = Object.values(CITIES).map(({ id, nom, latitude, longitude }) => ({
      id,
      nom,
      latitude,
      longitude,
    }));
    res.json(villes);
  },
};
