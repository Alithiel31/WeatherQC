import { z } from 'zod';

/**
 * Contrat attendu de RainViewer pour `GET /public/weather-maps.json`.
 *
 * Seuls les champs réellement consommés sont décrits ; `version` et `generated`
 * sont ignorés. Comme pour Open-Meteo, une dérive amont doit donner un 502
 * nommant le champ fautif plutôt qu'un `TypeError` en 500.
 *
 * Les blocs sont optionnels parce que RainViewer l'est réellement : l'index
 * arrive parfois sans `host`, et le radar de nowcast peut être vide hors
 * couverture. Le service comble ces trous plutôt que de rejeter la réponse —
 * c'est déjà ce que faisait le frontend avant que l'appel passe par ici.
 */

const image = z.object({
  time: z.number(),
  path: z.string(),
});

export const indexRainViewerSchema = z.object({
  host: z.string().optional(),
  satellite: z
    .object({
      infrared: z.array(image).optional(),
    })
    .optional(),
  radar: z
    .object({
      past: z.array(image).optional(),
      nowcast: z.array(image).optional(),
    })
    .optional(),
});

export type IndexRainViewer = z.infer<typeof indexRainViewerSchema>;
