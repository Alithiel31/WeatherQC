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
 * Quota du géocodage : chaque appel non caché part chez Zippopotam ou
 * Open-Meteo Geocoding, deux tiers gratuits qu'on ne veut pas marteler depuis
 * notre IP. Partagé entre `/api/geocode` (code postal) et `/api/geocode-ville`
 * (nom de ville).
 */
export const limiteurGeocode = rateLimit({
  ...communs,
  limit: config.rateLimit.maxGeocode,
});

/**
 * Quota de la création d'abonnement push. Fenêtre distincte (une heure) : le
 * quota général d'une minute ne protège pas la base contre un remplissage lent.
 */
export const limiteurAbonnement = rateLimit({
  ...communs,
  windowMs: config.rateLimit.windowAbonnementMs,
  limit: config.rateLimit.maxAbonnement,
  message: {
    status: 429,
    error: "Trop de demandes d'abonnement — réessayez plus tard.",
  },
});
