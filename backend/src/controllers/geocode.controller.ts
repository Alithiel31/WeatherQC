import type { Request, Response } from 'express';
import { geocodeRTA } from '../services/geocode.service.js';
import { getCached, setCached, TTL } from '../services/cache.service.js';
import { geocodeSchema } from '../schemas/validation.js';

// Format FSA canadien valide : lettre - chiffre - lettre (ex. H2X, K1A, V6B)
export default {
  geocodeRTA: async (req: Request, res: Response) => {
    const { codePostal } = geocodeSchema.parse({ codePostal: req.params.codePostal });
    const fsa = codePostal.slice(0, 3);

    const cacheKey = `geo:${fsa}`;
    const cached = getCached<object>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    const result = await geocodeRTA(fsa);
    setCached(cacheKey, result, TTL.GEOCODE);
    res.json(result);
  },
};
