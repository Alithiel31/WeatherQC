import { z } from 'zod';

/**
 * Configuration validée au chargement du module.
 *
 * Les `parseInt(process.env.X || '…')` d'origine ne gardaient rien : `PORT=abc`
 * ou une variable laissée vide produisaient `NaN`, et le serveur démarrait avec
 * un port invalide ou un quota `NaN`. La panne n'apparaissait qu'en production,
 * sans rien pour la relier à sa cause.
 *
 * Un `parse()` ici fait échouer le démarrage en nommant la variable fautive —
 * le healthcheck Docker rend l'échec visible immédiatement.
 */

/** Entier strictement positif, tolérant une variable absente ou laissée vide. */
const entier = (defaut: number) =>
  z.preprocess(
    (v) => (v === undefined || v === '' ? undefined : v),
    z.coerce.number().int().positive().default(defaut)
  );

/**
 * Liste d'origines séparées par des virgules.
 *
 * Le découpage écarte les entrées vides : `PUBLIC_ORIGINS=` ou une virgule en
 * trop produirait sinon `['']`, une origine que `cors` compare à la lettre —
 * jamais autorisée, mais impossible à diagnostiquer.
 *
 * La barre oblique finale est retirée pour la même raison : les navigateurs
 * envoient `https://exemple.com`, et `https://exemple.com/` ne l'aurait jamais
 * égalé.
 */
const origines = z.preprocess(
  (v) =>
    typeof v === 'string'
      ? v
          .split(',')
          .map((o) => o.trim().replace(/\/+$/, ''))
          .filter(Boolean)
      : [],
  z.array(z.url({ message: 'doit être une origine absolue, ex. https://exemple.com' }))
);

export const environnementSchema = z.object({
  PORT: entier(3005),
  NODE_ENV: z.string().optional(),
  TAILSCALE_IP: z.string().optional(),
  // Origines autorisées en plus du poste de développement et de Tailscale :
  // en production, le domaine public servi par le tunnel Cloudflare.
  PUBLIC_ORIGINS: origines,
  DEFAULT_TIMEZONE: z.string().min(1).optional(),
  // Délai maximal d'un appel aux APIs externes (Open-Meteo, Zippopotam).
  FETCH_TIMEOUT_MS: entier(5000),
  // Nombre de proxies devant l'API : cloudflared + nginx en production. Sert à
  // retrouver l'IP réelle du client pour la limitation de débit. Zéro est une
  // valeur légitime — API jointe en direct — d'où `nonnegative` plutôt qu'`entier`.
  TRUST_PROXY_HOPS: z.preprocess(
    (v) => (v === undefined || v === '' ? undefined : v),
    z.coerce.number().int().nonnegative().default(2)
  ),
  RATE_LIMIT_WINDOW_MS: entier(60_000),
  RATE_LIMIT_MAX: entier(100),
  // Le géocodage tape Zippopotam : quota plus serré.
  RATE_LIMIT_GEOCODE_MAX: entier(20),
  CACHE_TTL_PREVISIONS: entier(600_000),
  CACHE_TTL_GEOCODE: entier(2_592_000_000),
  // L'index RainViewer se renouvelle toutes les ~10 min et la carte le
  // re-sollicite à la même cadence : 5 min garantit une image fraîche sans
  // laisser passer un appel amont par visiteur.
  CACHE_TTL_RAINVIEWER: entier(300_000),
  // Plafond du nombre d'entrées : la clé des prévisions par coordonnées est
  // pilotée depuis Internet, le cache ne doit pas pouvoir croître sans fin.
  CACHE_MAX_ENTRIES: entier(500),
  // Une entrée reste servable `facteur × TTL` après sa péremption, mais
  // uniquement si l'amont vient d'échouer. Des prévisions d'il y a vingt
  // minutes valent mieux qu'un écran d'erreur ; six fois le TTL laisse le temps
  // à une panne Open-Meteo de passer sans que l'application se vide.
  CACHE_FACTEUR_OBSOLETE: entier(6),
  // Disjoncteur : nombre d'échecs consécutifs avant de cesser d'appeler un
  // amont, et durée de la suspension.
  BREAKER_SEUIL_ECHECS: entier(5),
  BREAKER_REPOS_MS: entier(30_000),
  // Notifications push d'alertes météo. Facultatives : sans elles, l'API
  // fonctionne normalement, seul l'abonnement aux alertes reste indisponible.
  // Les deux clés vont ensemble — l'une sans l'autre est une config à moitié
  // faite, détectée par le .refine() ci-dessous plutôt que par un crash à
  // l'appel de web-push.
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_CONTACT_EMAIL: z.string().optional(),
  // Fichier SQLite des abonnements aux alertes météo. Chemin relatif au
  // répertoire de travail du process (`/app` en conteneur, monté sur un
  // volume nommé — voir docker-compose.yml — pour survivre aux redéploiements).
  DB_PATH: z.string().min(1).optional(),
});

// `.refine()` sur une copie, pas sur `environnementSchema` lui-même : ce
// dernier reste un `z.object()` nu, dont `.shape` sert au test qui vérifie que
// `.env.example` documente bien chaque variable du schéma. Un `ZodEffects`
// (le type que produit `.refine()`) n'expose plus `.shape`.
const environnementSchemaValide = environnementSchema.refine(
  (v) => Boolean(v.VAPID_PUBLIC_KEY) === Boolean(v.VAPID_PRIVATE_KEY),
  {
    message:
      'VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY doivent être définies ensemble, ou absentes toutes les deux',
    path: ['VAPID_PRIVATE_KEY'],
  }
);

export function chargerConfig(env: NodeJS.ProcessEnv = process.env) {
  const analyse = environnementSchemaValide.safeParse(env);

  if (!analyse.success) {
    const details = analyse.error.issues
      .map((e) => `  ${e.path.join('.')} : ${e.message}`)
      .join('\n');
    throw new Error(`Configuration d'environnement invalide :\n${details}`);
  }

  const valide = analyse.data;

  return {
    port: valide.PORT,
    isProd: valide.NODE_ENV === 'production',
    tailscaleIp: valide.TAILSCALE_IP ?? '',
    publicOrigins: valide.PUBLIC_ORIGINS,
    defaultTimezone: valide.DEFAULT_TIMEZONE ?? 'America/Toronto',
    fetchTimeoutMs: valide.FETCH_TIMEOUT_MS,
    trustProxyHops: valide.TRUST_PROXY_HOPS,
    rateLimit: {
      windowMs: valide.RATE_LIMIT_WINDOW_MS,
      max: valide.RATE_LIMIT_MAX,
      maxGeocode: valide.RATE_LIMIT_GEOCODE_MAX,
    },
    cache: {
      ttlPrevisions: valide.CACHE_TTL_PREVISIONS,
      ttlGeocode: valide.CACHE_TTL_GEOCODE,
      ttlRainviewer: valide.CACHE_TTL_RAINVIEWER,
      maxEntries: valide.CACHE_MAX_ENTRIES,
      facteurObsolete: valide.CACHE_FACTEUR_OBSOLETE,
    },
    breaker: {
      seuilEchecs: valide.BREAKER_SEUIL_ECHECS,
      reposMs: valide.BREAKER_REPOS_MS,
    },
    // `null` plutôt que `undefined` : un objet absent est plus simple à tester
    // (`config.vapid === null`) qu'un couple de champs facultatifs séparés.
    vapid:
      valide.VAPID_PUBLIC_KEY && valide.VAPID_PRIVATE_KEY
        ? {
            publicKey: valide.VAPID_PUBLIC_KEY,
            privateKey: valide.VAPID_PRIVATE_KEY,
            contact: valide.VAPID_CONTACT_EMAIL ?? 'mailto:contact@alithiel31.dev',
          }
        : null,
    dbPath: valide.DB_PATH ?? 'data/abonnements.sqlite',
  };
}

export type Config = ReturnType<typeof chargerConfig>;

export const config: Config = chargerConfig();
