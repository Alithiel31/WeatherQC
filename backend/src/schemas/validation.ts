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

// Services push des navigateurs : Chrome/Android/Samsung (FCM), Firefox
// (Mozilla), Edge (Windows), Safari (Apple). Tout autre hôte est refusé, sans
// quoi l'endpoint — que le client choisit librement — ferait émettre au Pi une
// requête vers n'importe quelle machine.
const HOTES_PUSH_EXACTS = new Set(['fcm.googleapis.com', 'updates.push.services.mozilla.com']);
// Le point initial est voulu : `.push.apple.com` accepte `web.push.apple.com`
// mais pas `evilpush.apple.com` ni `push.apple.com.evil.net`.
const SUFFIXES_PUSH = ['.notify.windows.com', '.push.apple.com'];
const ENDPOINT_MAX = 2048;

function estEndpointPushAutorise(valeur: string): boolean {
  let url: URL;
  try {
    url = new URL(valeur);
  } catch {
    return false;
  }
  // `port` vaut '' pour le 443 par défaut : tout port explicite est refusé,
  // car `web-push` le reprend tel quel dans sa requête.
  if (url.protocol !== 'https:' || url.port !== '' || url.username || url.password) {
    return false;
  }
  const hote = url.hostname;
  return HOTES_PUSH_EXACTS.has(hote) || SUFFIXES_PUSH.some((s) => hote.endsWith(s));
}

// Clés générées par le navigateur : base64url sans remplissage, de taille fixe
// (point P-256 non compressé de 65 octets ; secret d'authentification de 16).
const cleBase64url = (octets: number, nom: string) =>
  z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/, `${nom} doit être en base64url`)
    .refine((v) => Buffer.from(v, 'base64url').length === octets, `${nom} : taille invalide`);

/**
 * Corps attendu de `PushSubscription.toJSON()` côté navigateur — voir
 * https://developer.mozilla.org/docs/Web/API/PushSubscription/toJSON.
 */
const pushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .max(ENDPOINT_MAX, `endpoint max ${ENDPOINT_MAX} caractères`)
    .refine(estEndpointPushAutorise, 'endpoint non autorisé (service push inconnu)'),
  keys: z.object({
    p256dh: cleBase64url(65, 'p256dh'),
    auth: cleBase64url(16, 'auth'),
  }),
});

export const abonnementSchema = z.object({
  ville: z.string().min(1, 'ville requise').toLowerCase(),
  subscription: pushSubscriptionSchema,
});

export const desabonnementSchema = z.object({
  endpoint: z.url('endpoint doit être une URL absolue').max(ENDPOINT_MAX),
});
