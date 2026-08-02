import { describe, it, expect } from 'vitest';
import {
  getCached,
  setCached,
  purgerExpirees,
  tailleCache,
  startCacheSweeper,
  stopCacheSweeper,
  TTL,
} from '../../../src/services/cache.service.js';
import { config } from '../../../src/config.js';

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

  describe('Plafond LRU', () => {
    it('ne dépasse jamais le nombre maximal d’entrées', () => {
      for (let i = 0; i < config.cache.maxEntries + 20; i++) {
        setCached(`cle-${i}`, i, TTL.PREVISIONS);
      }

      expect(tailleCache()).toBe(config.cache.maxEntries);
    });

    it('évince la clé la moins récemment utilisée', () => {
      for (let i = 0; i < config.cache.maxEntries; i++) {
        setCached(`cle-${i}`, i, TTL.PREVISIONS);
      }

      // Relire `cle-0` la remonte en fin de file : c'est `cle-1` qui doit sauter.
      expect(getCached('cle-0')).toBe(0);
      setCached('cle-nouvelle', 'x', TTL.PREVISIONS);

      expect(getCached('cle-0')).toBe(0);
      expect(getCached('cle-1')).toBeNull();
      expect(getCached('cle-nouvelle')).toBe('x');
    });

    it('ne compte pas deux fois une clé réécrite', () => {
      setCached('cle', 1, TTL.PREVISIONS);
      setCached('cle', 2, TTL.PREVISIONS);

      expect(tailleCache()).toBe(1);
      expect(getCached('cle')).toBe(2);
    });
  });

  describe('Balayage des entrées expirées', () => {
    it('supprime les entrées expirées sans toucher aux autres', async () => {
      setCached('expire', 'x', 50);
      setCached('valide', 'y', TTL.PREVISIONS);

      await new Promise((resolve) => setTimeout(resolve, 80));

      expect(purgerExpirees()).toBe(1);
      expect(tailleCache()).toBe(1);
      expect(getCached('valide')).toBe('y');
    });

    it('balaie périodiquement une clé jamais relue', async () => {
      setCached('jamais-relue', 'x', 30);
      startCacheSweeper(50);

      try {
        await new Promise((resolve) => setTimeout(resolve, 120));
        expect(tailleCache()).toBe(0);
      } finally {
        stopCacheSweeper();
      }
    });

    it('startCacheSweeper est idempotent', () => {
      startCacheSweeper(1000);
      startCacheSweeper(1000);
      stopCacheSweeper();

      // Un second arrêt ne doit pas lever.
      expect(() => stopCacheSweeper()).not.toThrow();
    });
  });
});
