import type { Request, Response } from 'express';
import { CITIES } from '../data/cities.js';
import { fetchForecast } from '../services/openmeteo.service.js';
import { avecCache, TTL } from '../services/cache.service.js';
import { NotFoundError } from '../lib/errors.js';
import { previsionsParVilleSchema, previsionsCoordonneesSchema } from '../schemas/validation.js';

export default {
  getByVille: async (req: Request, res: Response) => {
    const { ville } = previsionsParVilleSchema.parse({ ville: req.params.ville });
    // `ville` vient d'Internet : sans `hasOwn`, les clés héritées d'Object
    // (`constructor`, `toString`, `valueOf`…) renvoient une valeur truthy qui
    // passe la garde ci-dessous, et l'appel amont part avec des coordonnées
    // `undefined` — 502 au lieu de 404, et un appel sortant offert à qui le demande.
    const city = Object.hasOwn(CITIES, ville) ? CITIES[ville] : undefined;

    if (!city) {
      throw new NotFoundError(
        `Ville inconnue. Villes disponibles : ${Object.keys(CITIES).join(', ')}.`
      );
    }

    const { data, depuisCache, obsolete } = await avecCache(
      `prev:${city.id}`,
      TTL.PREVISIONS,
      async () => ({
        ville: { id: city.id, nom: city.nom, latitude: city.latitude, longitude: city.longitude },
        ...(await fetchForecast(city)),
      })
    );

    res.origineCache = obsolete ? 'obsolete' : depuisCache ? 'frais' : 'amont';
    res.json({ ...data, depuisCache, obsolete });
  },

  getByCoordonnees: async (req: Request, res: Response) => {
    const { lat, lon, nom } = previsionsCoordonneesSchema.parse(req.query);

    const { data, depuisCache, obsolete } = await avecCache(
      // Arrondi à deux décimales : la clé est pilotée depuis Internet, sans quoi
      // son espace serait illimité.
      `prev:${lat.toFixed(2)},${lon.toFixed(2)}`,
      TTL.PREVISIONS,
      async () => ({
        ville: { id: 'personnalise', nom, latitude: lat, longitude: lon },
        ...(await fetchForecast({ latitude: lat, longitude: lon })),
      })
    );

    res.origineCache = obsolete ? 'obsolete' : depuisCache ? 'frais' : 'amont';
    // Le `nom` accompagne la requête, pas les données : deux RTA voisines
    // partagent la même clé arrondie et doivent garder leur libellé.
    res.json({
      ...data,
      ville: { ...((data as Record<string, unknown>).ville as object), nom },
      depuisCache,
      obsolete,
    });
  },
};
