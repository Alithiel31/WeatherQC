import type { Request, Response } from 'express';
import { fetchFrames } from '../services/rainviewer.service.js';
import { getCached, setCached, TTL } from '../services/cache.service.js';

/**
 * Pas de limiteur dédié, contrairement au géocodage : la clé de cache est unique
 * et constante, donc tous les visiteurs se partagent un seul appel amont par
 * fenêtre de TTL. Le quota général de `/api` suffit.
 */
const CLE_CACHE = 'rv:frames';

export default {
  getFrames: async (_req: Request, res: Response) => {
    const cached = getCached<object>(CLE_CACHE);
    if (cached) {
      res.json({ ...cached, depuisCache: true });
      return;
    }

    const frames = await fetchFrames();
    setCached(CLE_CACHE, frames, TTL.RAINVIEWER);
    res.json({ ...frames, depuisCache: false });
  },
};
