export const config = {
  port: parseInt(process.env.PORT || '3005'),
  isProd: process.env.NODE_ENV === 'production',
  tailscaleIp: process.env.TAILSCALE_IP || '',
  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'America/Toronto',
  // Délai maximal d'un appel aux APIs externes (Open-Meteo, Zippopotam).
  fetchTimeoutMs: parseInt(process.env.FETCH_TIMEOUT_MS || '5000'),
  // Nombre de proxies devant l'API : cloudflared + nginx en production.
  // Sert à retrouver l'IP réelle du client pour la limitation de débit.
  trustProxyHops: parseInt(process.env.TRUST_PROXY_HOPS || '2'),
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    // Le géocodage tape Zippopotam : quota plus serré.
    maxGeocode: parseInt(process.env.RATE_LIMIT_GEOCODE_MAX || '20'),
  },
  cache: {
    ttlPrevisions: parseInt(process.env.CACHE_TTL_PREVISIONS || '600000'),
    ttlGeocode: parseInt(process.env.CACHE_TTL_GEOCODE || '2592000000'),
    // Plafond du nombre d'entrées : la clé des prévisions par coordonnées est
    // pilotée depuis Internet, le cache ne doit pas pouvoir croître sans fin.
    maxEntries: parseInt(process.env.CACHE_MAX_ENTRIES || '500'),
  },
};
