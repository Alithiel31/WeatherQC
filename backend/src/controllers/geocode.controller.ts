import type { Request, Response } from 'express';
import { geocodeRTA } from '../services/geocode.service.js';
import { getCached, setCached, TTL } from '../services/cache.service.js';
import { BadRequestError } from '../lib/errors.js';

// Format FSA canadien valide : lettre - chiffre - lettre (ex. H2X, K1A, V6B)
const REGEX_FSA_CA = /^[A-Z]\d[A-Z]$/;

export default {
  geocodeRTA: async (req: Request, res: Response) => {
    const brut = (req.params.codePostal as string).toUpperCase().replace(/\s+/g, '');
    const fsa = brut.slice(0, 3);

    if (!REGEX_FSA_CA.test(fsa)) {
      throw new BadRequestError('Format invalide. Exemples attendus : H2X ou K1A 0B1.');
    }

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
