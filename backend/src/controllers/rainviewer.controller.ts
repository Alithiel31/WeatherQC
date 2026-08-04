import type { Request, Response } from 'express';
import { fetchFrames } from '../services/rainviewer.service.js';
import { avecCache, TTL } from '../services/cache.service.js';

/**
 * Pas de limiteur dédié, contrairement au géocodage : la clé de cache est unique
 * et constante, donc tous les visiteurs se partagent un seul appel amont par
 * fenêtre de TTL. Le quota général de `/api` suffit.
 */
const CLE_CACHE = 'rv:frames';

export default {
  getFrames: async (_req: Request, res: Response) => {
    const { data, depuisCache, obsolete } = await avecCache(CLE_CACHE, TTL.RAINVIEWER, fetchFrames);

    res.origineCache = obsolete ? 'obsolete' : depuisCache ? 'frais' : 'amont';
    res.json({ ...data, depuisCache, obsolete });
  },
};
