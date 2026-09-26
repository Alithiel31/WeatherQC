import { z } from 'zod';

export const previsionsParVilleSchema = z.object({
  ville: z.string().min(1, 'Ville requis').toLowerCase(),
});

export const previsionsCoordonneesSchema = z.object({
  lat: z.coerce
    .number({ message: 'lat doit être un nombre' })
    .min(-90, 'lat doit être >= -90')
    .max(90, 'lat doit être <= 90'),
  lon: z.coerce
    .number({ message: 'lon doit être un nombre' })
    .min(-180, 'lon doit être >= -180')
    .max(180, 'lon doit être <= 180'),
  nom: z.string().max(80, 'nom max 80 caractères').optional().default('Position personnalisée'),
});

// Premières lettres des FSA couvrant le Québec (G, H, J) — Postes Canada
// attribue une lettre par région, jamais partagée entre deux provinces.
const PREMIERE_LETTRE_QUEBEC = new Set(['G', 'H', 'J']);

export const geocodeSchema = z.object({
  codePostal: z
    .string()
    .min(1, 'Code postal requis')
    .toUpperCase()
    .refine((val) => /^[A-Z]\d[A-Z]/.test(val.slice(0, 3)), 'Format invalide (ex: H2X ou K1A 0B1)')
    .refine(
      (val) => PREMIERE_LETTRE_QUEBEC.has(val[0]),
      'Ce service est réservé aux codes postaux du Québec.'
    ),
});

/**
 * Corps attendu de `PushSubscription.toJSON()` côté navigateur — voir
 * https://developer.mozilla.org/docs/Web/API/PushSubscription/toJSON.
 */
const pushSubscriptionSchema = z.object({
  endpoint: z.url('endpoint doit être une URL absolue'),
  keys: z.object({
    p256dh: z.string().min(1, 'p256dh requis'),
    auth: z.string().min(1, 'auth requis'),
  }),
});

export const abonnementSchema = z.object({
  ville: z.string().min(1, 'ville requise').toLowerCase(),
  subscription: pushSubscriptionSchema,
});

export const desabonnementSchema = z.object({
  endpoint: z.url('endpoint doit être une URL absolue'),
});
