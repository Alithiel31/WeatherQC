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

const environnementSchema = z.object({
  PORT: entier(3005),
  NODE_ENV: z.string().optional(),
  TAILSCALE_IP: z.string().optional(),
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
  // Plafond du nombre d'entrées : la clé des prévisions par coordonnées est
  // pilotée depuis Internet, le cache ne doit pas pouvoir croître sans fin.
  CACHE_MAX_ENTRIES: entier(500),
});

export function chargerConfig(env: NodeJS.ProcessEnv = process.env) {
  const analyse = environnementSchema.safeParse(env);

  if (!analyse.success) {
    const details = analyse.error.errors
      .map((e) => `  ${e.path.join('.')} : ${e.message}`)
      .join('\n');
    throw new Error(`Configuration d'environnement invalide :\n${details}`);
  }

  const valide = analyse.data;

  return {
    port: valide.PORT,
    isProd: valide.NODE_ENV === 'production',
    tailscaleIp: valide.TAILSCALE_IP ?? '',
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
      maxEntries: valide.CACHE_MAX_ENTRIES,
    },
  };
}

export type Config = ReturnType<typeof chargerConfig>;

export const config: Config = chargerConfig();
