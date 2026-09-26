import type { Request, Response } from 'express';
import { geocodeRTA, geocodeNomVille } from '../services/geocode.service.js';
import { avecCache, TTL } from '../services/cache.service.js';
import { geocodeSchema, rechercheVilleSchema } from '../schemas/validation.js';

// Format FSA canadien valide : lettre - chiffre - lettre (ex. H2X, K1A, V6B)
export default {
  geocodeRTA: async (req: Request, res: Response) => {
    const { codePostal } = geocodeSchema.parse({ codePostal: req.params.codePostal });
    const fsa = codePostal.slice(0, 3);

    const { data, depuisCache, obsolete } = await avecCache(`geo:${fsa}`, TTL.GEOCODE, () =>
      geocodeRTA(fsa)
    );

    res.origineCache = obsolete ? 'obsolete' : depuisCache ? 'frais' : 'amont';
    res.json(data);
  },

  geocodeVille: async (req: Request, res: Response) => {
    const { nom } = rechercheVilleSchema.parse({ nom: req.params.nom });
    const cle = nom.toLowerCase();

    const { data, depuisCache, obsolete } = await avecCache(`geo-ville:${cle}`, TTL.GEOCODE, () =>
      geocodeNomVille(nom)
    );

    res.origineCache = obsolete ? 'obsolete' : depuisCache ? 'frais' : 'amont';
    res.json(data);
  },
};
