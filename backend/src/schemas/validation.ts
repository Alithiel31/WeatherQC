import { z } from 'zod';

export const previsionsParVilleSchema = z.object({
  ville: z.string().min(1, 'Ville requis').toLowerCase(),
});

export const previsionsCoordonneesSchema = z.object({
  lat: z.coerce
    .number({ invalid_type_error: 'lat doit être un nombre' })
    .min(-90, 'lat doit être >= -90')
    .max(90, 'lat doit être <= 90'),
  lon: z.coerce
    .number({ invalid_type_error: 'lon doit être un nombre' })
    .min(-180, 'lon doit être >= -180')
    .max(180, 'lon doit être <= 180'),
  nom: z.string().max(80, 'nom max 80 caractères').optional().default('Position personnalisee'),
});

export const geocodeSchema = z.object({
  codePostal: z
    .string()
    .min(1, 'Code postal requis')
    .toUpperCase()
    .refine((val) => /^[A-Z]\d[A-Z]/.test(val.slice(0, 3)), 'Format invalide (ex: H2X ou K1A 0B1)'),
});
