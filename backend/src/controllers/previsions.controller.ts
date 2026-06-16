import type { Request, Response } from 'express';
import { CITIES } from '../data/cities.js';
import { fetchForecast } from '../services/openmeteo.service.js';
import { getCached, setCached, TTL } from '../services/cache.service.js';
import { NotFoundError } from '../lib/errors.js';
import { previsionsParVilleSchema, previsionsCoordonneesSchema } from '../schemas/validation.js';

export default {
  getByVille: async (req: Request, res: Response) => {
    const { ville } = previsionsParVilleSchema.parse({ ville: req.params.ville });
    const city = CITIES[ville];

    if (!city) {
      throw new NotFoundError(
        `Ville inconnue. Villes disponibles : ${Object.keys(CITIES).join(', ')}.`
      );
    }

    const cacheKey = `prev:${city.id}`;
    const cached = getCached<object>(cacheKey);
    if (cached) {
      res.json({ ...cached, depuisCache: true });
      return;
    }

    const data = await fetchForecast(city);
    const payload = {
      ville: { id: city.id, nom: city.nom, latitude: city.latitude, longitude: city.longitude },
      ...data,
    };
    setCached(cacheKey, payload, TTL.PREVISIONS);
    res.json({ ...payload, depuisCache: false });
  },

  getByCoordonnees: async (req: Request, res: Response) => {
    const { lat, lon, nom } = previsionsCoordonneesSchema.parse(req.query);

    const cacheKey = `prev:${lat.toFixed(2)},${lon.toFixed(2)}`;
    const cached = getCached<Record<string, unknown>>(cacheKey);
    if (cached) {
      res.json({ ...cached, ville: { ...(cached.ville as object), nom }, depuisCache: true });
      return;
    }

    const data = await fetchForecast({ latitude: lat, longitude: lon });
    const payload = {
      ville: { id: 'personnalise', nom, latitude: lat, longitude: lon },
      ...data,
    };
    setCached(cacheKey, payload, TTL.PREVISIONS);
    res.json({ ...payload, depuisCache: false });
  },
};
