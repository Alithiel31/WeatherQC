import { z } from 'zod';

/**
 * Contrat attendu d'Open-Meteo pour `GET /v1/forecast`.
 *
 * Seuls les champs réellement consommés par `openmeteo.service.ts` sont décrits ;
 * les unités et métadonnées de la réponse sont ignorées.
 *
 * Sans cette validation, une dérive amont — un bloc renommé, une série absente —
 * sortait en `TypeError` sur `raw.hourly.time.findIndex`, donc en 500
 * « Internal server error », alors que la faute est chez le fournisseur et
 * appelle un 502.
 */

/** Série alignée sur `time`. Open-Meteo insère `null` là où la donnée manque. */
const serie = z.array(z.number().nullable());

export const previsionsOpenMeteoSchema = z.object({
  current: z.object({
    time: z.string(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    relative_humidity_2m: z.number(),
    weather_code: z.number(),
    wind_speed_10m: z.number(),
    is_day: z.number(),
  }),
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: serie,
    weather_code: serie,
    precipitation_probability: serie,
  }),
  daily: z.object({
    time: z.array(z.string()),
    weather_code: serie,
    temperature_2m_max: serie,
    temperature_2m_min: serie,
    precipitation_probability_max: serie,
    sunrise: z.array(z.string()),
    sunset: z.array(z.string()),
  }),
});

export type PrevisionsOpenMeteo = z.infer<typeof previsionsOpenMeteoSchema>;
