import { z } from 'zod';

/**
 * Source de vérité des réponses sortantes : sert à la fois à générer
 * `/api/openapi.json` et à valider, via `lib/reponse.ts#envoyerJson`, chaque
 * réponse juste avant son envoi — une dérive entre ce que les contrôleurs
 * renvoient réellement et ce qui est documenté échoue donc bruyamment
 * (tests, puis 500 en prod) plutôt que de se propager silencieusement.
 */

export const villeSchema = z.object({
  id: z.string(),
  nom: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

export const villesSchema = z.array(villeSchema);

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
  rafales: z.number().nullable(),
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

export const reponseMeteoSchema = z.object({
  ville: villeSchema,
  misAJour: z.string(),
  actuel: conditionsActuellesSchema,
  horaire: z.array(previsionsHorairesSchema),
  quotidien: z.array(previsionsQuotidiennesSchema),
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
