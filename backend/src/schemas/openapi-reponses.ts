import { z } from 'zod';

/**
 * Schémas de *documentation* uniquement — jamais utilisés pour valider une
 * réponse réelle. Contrairement aux schémas de `validation.ts`, qui sont la
 * source de vérité des requêtes entrantes, le backend ne valide pas ses
 * propres sorties : il n'existe donc pas de schéma existant à réutiliser côté
 * réponse. Celui-ci sert seulement à générer `/api/openapi.json` sans dupliquer
 * à la main la forme de chaque route dans une spec figée — et sans prétendre
 * qu'il garantit la conformité de ce que les contrôleurs renvoient réellement.
 */

export const villeSchema = z.object({
  id: z.string(),
  nom: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

const conditionsActuellesSchema = z.object({
  temperature: z.number(),
  ressenti: z.number(),
  humidite: z.number(),
  vent: z.number(),
  code: z.number(),
  jour: z.boolean(),
});

const previsionsHorairesSchema = z.object({
  heure: z.string(),
  temperature: z.number().nullable(),
  code: z.number().nullable(),
  precipitation: z.number().nullable(),
});

const previsionsQuotidiennesSchema = z.object({
  date: z.string(),
  code: z.number().nullable(),
  max: z.number().nullable(),
  min: z.number().nullable(),
  precipitation: z.number().nullable(),
  lever: z.string(),
  coucher: z.string(),
});

const alerteSchema = z.object({
  type: z.enum(['precipitation', 'chute-temperature', 'vent', 'verglas', 'orage']),
  importante: z.boolean(),
  titre: z.string(),
  corps: z.string(),
});

export const reponseMeteoSchema = z.object({
  ville: villeSchema,
  misAJour: z.string(),
  actuel: conditionsActuellesSchema,
  horaire: z.array(previsionsHorairesSchema),
  quotidien: z.array(previsionsQuotidiennesSchema),
  // Dérivées des mêmes seuils que les notifications push
  // (`services/detecteur-alertes.ts`), calculées à la demande — pas persistées.
  alertes: z.array(alerteSchema),
  depuisCache: z.boolean(),
  // Vrai uniquement quand l'amont vient d'échouer et qu'une entrée périmée a
  // pris le relais — voir « Résilience des amonts » dans le README.
  obsolete: z.boolean().optional(),
});

export const lieuGeocodeSchema = z.object({
  rta: z.string(),
  nom: z.string(),
  province: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

const imageRainViewerSchema = z.object({
  path: z.string(),
  time: z.number(),
});

export const framesRainViewerSchema = z.object({
  hote: z.string(),
  satellite: z.array(imageRainViewerSchema),
  radar: z.array(imageRainViewerSchema),
  depuisCache: z.boolean(),
  obsolete: z.boolean().optional(),
});

export const santeSchema = z.object({
  statut: z.literal('ok'),
  versionNode: z.string(),
  demarreDepuisS: z.number(),
  memoireMo: z.number(),
  cache: z.object({
    entrees: z.number(),
    enVol: z.number(),
    hits: z.number(),
    misses: z.number(),
    obsoletes: z.number(),
    mutualises: z.number(),
    tauxHit: z.number().nullable(),
  }),
  amonts: z.record(
    z.string(),
    z.object({
      etat: z.enum(['ferme', 'ouvert', 'demi-ouvert']),
      echecsConsecutifs: z.number(),
    })
  ),
});

/** Enveloppe commune à toutes les erreurs — voir `global-error-handler.ts`. */
export const erreurSchema = z.object({
  status: z.number(),
  error: z.string(),
  details: z.array(z.object({ chemin: z.string(), message: z.string() })).optional(),
});

export const clePubliqueSchema = z.object({
  clePublique: z.string(),
});

export const abonnementConfirmeSchema = z.object({
  statut: z.literal('abonne'),
});
