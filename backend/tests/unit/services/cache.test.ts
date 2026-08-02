import { describe, it, expect } from 'vitest';
import { getCached, setCached, TTL } from '../../../src/services/cache.service.js';

// Le cache est vidé avant chaque test par `tests/setup.ts`.
describe('Cache Service', () => {
  it('doit stocker et récupérer une valeur', () => {
    const key = 'test-key';
    const value = { data: 'test' };

    setCached(key, value, TTL.PREVISIONS);
    const cached = getCached(key);

    expect(cached).toEqual(value);
  });

  it('doit retourner undefined pour une clé inexistante', () => {
    const cached = getCached('nonexistant');
    expect(cached).toBeNull();
  });

  it('doit respecter le TTL (expiration)', async () => {
    const key = 'short-ttl';
    const value = { data: 'test' };

    setCached(key, value, 100); // 100ms

    // Immédiatement, la valeur est là
    expect(getCached(key)).toEqual(value);

    // Après 150ms, elle a expiré
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(getCached(key)).toBeNull();
  });
});
