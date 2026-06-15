export const config = {
  port: parseInt(process.env.PORT || '3005'),
  isProd: process.env.NODE_ENV === 'production',
  tailscaleIp: process.env.TAILSCALE_IP || '',
  defaultTimezone: process.env.DEFAULT_TIMEZONE || 'America/Toronto',
  cache: {
    ttlPrevisions: parseInt(process.env.CACHE_TTL_PREVISIONS || '600000'),
    ttlGeocode:    parseInt(process.env.CACHE_TTL_GEOCODE    || '2592000000'),
  },
};
