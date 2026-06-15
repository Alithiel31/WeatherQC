import type { Request, Response } from 'express';
import { CITIES } from '../data/cities.js';
import { fetchForecast } from '../services/openmeteo.service.js';
import { getCached, setCached, TTL } from '../services/cache.service.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';

export default {
  getByVille: async (req: Request, res: Response) => {
    const city = CITIES[req.params.ville as string];
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
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const nom = ((req.query.nom as string) ?? 'Position personnalisee').slice(0, 80);

    // Bornes couvrant tout le Canada
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < 41 ||
      lat > 84 ||
      lon < -141 ||
      lon > -52
    ) {
      throw new BadRequestError('Coordonnees invalides ou hors du Canada.');
    }

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
