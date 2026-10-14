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

export const rechercheVilleSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(2, 'Nom de ville trop court (2 caractères minimum)')
    .max(60, 'Nom de ville trop long (60 caractères maximum)'),
});

/**
 * Services push des navigateurs, seuls destinataires légitimes d'un abonnement.
 *
 * Le vérificateur horaire envoie un POST à chaque `endpoint` enregistré. Une
 * simple URL laissait n'importe qui faire viser au serveur une adresse de son
 * réseau local (`http://192.168.x.x`, `http://backend:3005`, une IP Tailscale) :
 * une SSRF depuis le Raspberry Pi. Seuls ces hôtes, en HTTPS sur le port par
 * défaut, sont acceptés.
 *
 * - Chrome, Edge Chromium, Opera, Samsung Internet : `fcm.googleapis.com`
 * - Firefox : `updates.push.services.mozilla.com`
 * - Safari (macOS, iOS ≥ 16.4) : `web.push.apple.com`
 * - Edge historique (WNS) : `*.notify.windows.com`
 */
const HOTES_PUSH_EXACTS = new Set(['fcm.googleapis.com', 'web.push.apple.com']);
const SUFFIXES_HOTES_PUSH = [
  '.push.services.mozilla.com',
  '.notify.windows.com',
  '.push.apple.com',
];

/** Longueur maximale d'un endpoint : les plus longs observés (FCM) font ~200 caractères. */
const LONGUEUR_MAX_ENDPOINT = 1024;

export function estEndpointPushAutorise(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username || url.password) return false;

  const hote = url.hostname.toLowerCase();
  return HOTES_PUSH_EXACTS.has(hote) || SUFFIXES_HOTES_PUSH.some((s) => hote.endsWith(s));
}

const endpointSchema = z
  .url('endpoint doit être une URL absolue')
  .max(LONGUEUR_MAX_ENDPOINT, `endpoint max ${LONGUEUR_MAX_ENDPOINT} caractères`);

/**
 * Corps attendu de `PushSubscription.toJSON()` côté navigateur — voir
 * https://developer.mozilla.org/docs/Web/API/PushSubscription/toJSON.
 *
 * Les clés sont bornées : `p256dh` fait 87 caractères en base64 URL-safe et
 * `auth` 22. Sans plafond, chaque ligne pouvait porter jusqu'à 10 ko — la
 * limite de `express.json`.
 */
const pushSubscriptionSchema = z.object({
  endpoint: endpointSchema.refine(
    estEndpointPushAutorise,
    'endpoint doit désigner un service push reconnu (FCM, Mozilla, Apple, Windows) en HTTPS'
  ),
  keys: z.object({
    p256dh: z.string().min(1, 'p256dh requis').max(128, 'p256dh max 128 caractères'),
    auth: z.string().min(1, 'auth requis').max(64, 'auth max 64 caractères'),
  }),
});

export const abonnementSchema = z.object({
  ville: z.string().min(1, 'ville requise').toLowerCase(),
  subscription: pushSubscriptionSchema,
});

// Pas de liste blanche ici : un désabonnement ne déclenche aucun appel sortant,
// et il doit rester possible de retirer un endpoint enregistré avant elle.
export const desabonnementSchema = z.object({
  endpoint: endpointSchema,
});
