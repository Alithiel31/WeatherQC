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

export const geocodeSchema = z.object({
  codePostal: z
    .string()
    .min(1, 'Code postal requis')
    .toUpperCase()
    .refine((val) => /^[A-Z]\d[A-Z]/.test(val.slice(0, 3)), 'Format invalide (ex: H2X ou K1A 0B1)'),
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

/**
 * Sous-ensemble de `Seuils` (`detecteur-alertes.ts`) qu'un abonné peut
 * personnaliser — voir `abonnements.service.ts#SeuilsPersonnalises`.
 */
const seuilsPersonnalisesSchema = z.object({
  precipitationProbabilite: z
    .number()
    .min(0, 'doit être >= 0')
    .max(100, 'doit être <= 100')
    .optional(),
  chuteTemperature: z.number().positive('doit être positif').max(30, 'doit être <= 30').optional(),
  rafales: z.number().positive('doit être positif').max(200, 'doit être <= 200').optional(),
});

export const abonnementSchema = z.object({
  ville: z.string().min(1, 'ville requise').toLowerCase(),
  subscription: pushSubscriptionSchema,
  seuils: seuilsPersonnalisesSchema.optional(),
});

export const desabonnementSchema = z.object({
  endpoint: z.url('endpoint doit être une URL absolue'),
});
