import { describe, it, expect } from 'vitest';
import { chargerConfig } from '../../src/config.js';

describe('chargerConfig', () => {
  it('applique les valeurs par défaut sur un environnement vide', () => {
    const config = chargerConfig({});

    expect(config.port).toBe(3005);
    expect(config.isProd).toBe(false);
    expect(config.defaultTimezone).toBe('America/Toronto');
    expect(config.fetchTimeoutMs).toBe(5000);
    expect(config.trustProxyHops).toBe(2);
    expect(config.rateLimit).toEqual({ windowMs: 60_000, max: 100, maxGeocode: 20 });
    expect(config.cache.maxEntries).toBe(500);
  });

  it('convertit les variables fournies en nombres', () => {
    const config = chargerConfig({ PORT: '8080', RATE_LIMIT_MAX: '42' });

    expect(config.port).toBe(8080);
    expect(config.rateLimit.max).toBe(42);
  });

  it('reconnaît la production', () => {
    expect(chargerConfig({ NODE_ENV: 'production' }).isProd).toBe(true);
  });

  // Régression : `parseInt('abc')` donnait `NaN`, le serveur démarrait quand même
  // et la limitation de débit tournait avec un quota `NaN`.
  it('refuse une valeur non numérique', () => {
    expect(() => chargerConfig({ PORT: 'abc' })).toThrow(/PORT/);
  });

  it('refuse un quota négatif ou nul', () => {
    expect(() => chargerConfig({ RATE_LIMIT_MAX: '0' })).toThrow(/RATE_LIMIT_MAX/);
    expect(() => chargerConfig({ CACHE_MAX_ENTRIES: '-5' })).toThrow(/CACHE_MAX_ENTRIES/);
  });

  it('refuse une valeur décimale là où un entier est attendu', () => {
    expect(() => chargerConfig({ FETCH_TIMEOUT_MS: '1.5' })).toThrow(/FETCH_TIMEOUT_MS/);
  });

  // Cas réel : `.env` contenant `TAILSCALE_IP=` puis `RATE_LIMIT_MAX=` laissé vide.
  it('traite une variable vide comme absente', () => {
    const config = chargerConfig({ RATE_LIMIT_MAX: '', TAILSCALE_IP: '' });

    expect(config.rateLimit.max).toBe(100);
    expect(config.tailscaleIp).toBe('');
  });

  // Zéro proxy est légitime : API jointe en direct, sans cloudflared ni nginx.
  it('accepte TRUST_PROXY_HOPS à zéro', () => {
    expect(chargerConfig({ TRUST_PROXY_HOPS: '0' }).trustProxyHops).toBe(0);
  });

  it('nomme toutes les variables fautives d’un coup', () => {
    expect(() => chargerConfig({ PORT: 'abc', CACHE_TTL_GEOCODE: 'jamais' })).toThrow(
      /PORT[\s\S]*CACHE_TTL_GEOCODE/
    );
  });
});
