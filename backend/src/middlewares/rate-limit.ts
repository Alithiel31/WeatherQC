import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

// Le corps de réponse reprend le format de `global-error-handler`.
const reponse429 = {
  status: 429,
  error: 'Trop de requêtes — réessayez dans un instant.',
};

const communs = {
  windowMs: config.rateLimit.windowMs,
  standardHeaders: true,
  legacyHeaders: false,
  message: reponse429,
};

/** Quota général de l'API. */
export const limiteurApi = rateLimit({
  ...communs,
  limit: config.rateLimit.max,
});

/**
 * Quota du géocodage : chaque appel non caché part chez Zippopotam, un tiers
 * gratuit qu'on ne veut pas marteler depuis notre IP.
 */
export const limiteurGeocode = rateLimit({
  ...communs,
  limit: config.rateLimit.maxGeocode,
});
