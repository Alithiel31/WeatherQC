import { describe, it, expect, vi } from 'vitest';
import {
  getCached,
  getObsolete,
  setCached,
  avecCache,
  purgerExpirees,
  tailleCache,
  statistiquesCache,
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
    // Le balayage ne libère qu'une fois la fenêtre servable écoulée
    // (`facteurObsolete × TTL`) : entre les deux, l'entrée périmée reste le
    // filet qui évite un écran d'erreur si l'amont vient de tomber.
    const apresFenetreServable = (ttlMs: number) => ttlMs * config.cache.facteurObsolete + 30;

    it('supprime les entrées hors fenêtre servable sans toucher aux autres', async () => {
      setCached('expire', 'x', 10);
      setCached('valide', 'y', TTL.PREVISIONS);

      await new Promise((resolve) => setTimeout(resolve, apresFenetreServable(10)));

      expect(purgerExpirees()).toBe(1);
      expect(tailleCache()).toBe(1);
      expect(getCached('valide')).toBe('y');
    });

    it('conserve une entrée périmée mais encore servable', async () => {
      setCached('perimee', 'x', 20);

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Périmée pour la lecture normale…
      expect(getCached('perimee')).toBeNull();
      // …mais toujours là pour le service dégradé.
      expect(purgerExpirees()).toBe(0);
      expect(getObsolete('perimee')).toBe('x');
    });

    it('balaie périodiquement une clé jamais relue', async () => {
      setCached('jamais-relue', 'x', 10);
      startCacheSweeper(20);

      try {
        await new Promise((resolve) => setTimeout(resolve, apresFenetreServable(10) + 40));
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

/**
 * `avecCache` remplace le `getCached` / `await amont` / `setCached` que chaque
 * contrôleur répétait, et où se logeaient trois défauts : la ruée sur
 * expiration, l'absence de service dégradé, et l'impossibilité de compter.
 */
describe('avecCache', () => {
  it('appelle l’amont une seule fois puis sert le cache', async () => {
    const amont = vi.fn().mockResolvedValue({ v: 1 });

    const premier = await avecCache('k', TTL.PREVISIONS, amont);
    const second = await avecCache('k', TTL.PREVISIONS, amont);

    expect(amont).toHaveBeenCalledTimes(1);
    expect(premier).toEqual({ data: { v: 1 }, depuisCache: false, obsolete: false });
    expect(second).toEqual({ data: { v: 1 }, depuisCache: true, obsolete: false });
  });

  it('mutualise les appels concurrents sur une clé froide', async () => {
    // Sans cette mutualisation, dix requêtes simultanées sur une clé expirée
    // partaient en dix appels chez le fournisseur — et le TTL étant fixe, elles
    // expirent toutes en même temps.
    let resoudre!: (v: unknown) => void;
    const amont = vi.fn(() => new Promise((r) => (resoudre = r)));

    const appels = Array.from({ length: 10 }, () => avecCache('k', TTL.PREVISIONS, amont));
    resoudre({ v: 1 });
    const resultats = await Promise.all(appels);

    expect(amont).toHaveBeenCalledTimes(1);
    expect(resultats.every((r) => r.data)).toBe(true);
    expect(statistiquesCache().mutualises).toBe(9);
  });

  it('sert la valeur périmée quand l’amont échoue', async () => {
    const amont = vi.fn().mockResolvedValueOnce({ v: 'ancien' });
    await avecCache('k', 20, amont);

    await new Promise((r) => setTimeout(r, 50));
    amont.mockRejectedValue(new Error('Open-Meteo injoignable'));

    const resultat = await avecCache('k', 20, amont);

    // Des prévisions d'il y a vingt minutes valent mieux qu'un écran d'erreur.
    expect(resultat).toEqual({ data: { v: 'ancien' }, depuisCache: true, obsolete: true });
    expect(statistiquesCache().obsoletes).toBe(1);
  });

  it('relaie l’erreur quand il n’y a rien à servir', async () => {
    const amont = vi.fn().mockRejectedValue(new Error('Open-Meteo injoignable'));

    await expect(avecCache('vide', TTL.PREVISIONS, amont)).rejects.toThrow(
      'Open-Meteo injoignable'
    );
  });

  it('ne garde pas un appel en vol après son échec', async () => {
    const amont = vi.fn().mockRejectedValue(new Error('boum'));

    await expect(avecCache('k', TTL.PREVISIONS, amont)).rejects.toThrow();
    await expect(avecCache('k', TTL.PREVISIONS, amont)).rejects.toThrow();

    // Sans nettoyage, le second appelant aurait attendu une promesse déjà rejetée.
    expect(amont).toHaveBeenCalledTimes(2);
    expect(statistiquesCache().enVol).toBe(0);
  });

  it('compte les accès pour le diagnostic', async () => {
    const amont = vi.fn().mockResolvedValue({ v: 1 });

    await avecCache('a', TTL.PREVISIONS, amont);
    await avecCache('a', TTL.PREVISIONS, amont);
    await avecCache('b', TTL.PREVISIONS, amont);

    const stats = statistiquesCache();
    expect(stats).toMatchObject({ hits: 1, misses: 2, entrees: 2 });
    expect(stats.tauxHit).toBeCloseTo(33.3, 1);
  });

  it('rend un taux nul plutôt que zéro quand rien n’a été mesuré', () => {
    // Zéro pour cent et « aucune mesure » ne se lisent pas pareil.
    expect(statistiquesCache().tauxHit).toBeNull();
  });
});
