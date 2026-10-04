import { z } from 'zod';

/**
 * Contrat attendu de l'API de géocodage Open-Meteo pour `GET /v1/search`.
 *
 * `results` est absent (pas un tableau vide) quand aucune ville ne correspond
 * à la recherche — c'est un résultat légitime, pas une rupture de contrat,
 * d'où l'`.optional()` plutôt qu'un tableau requis comme pour Zippopotam.
 */
export const reponseGeocodageSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country_code: z.string().optional(),
        admin1: z.string().optional(),
        population: z.number().optional(),
      })
    )
    .optional(),
});

export type ReponseGeocodage = z.infer<typeof reponseGeocodageSchema>;
