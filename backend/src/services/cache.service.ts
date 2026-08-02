import { config } from '../config.js';

interface CacheEntry<T> {
  data: T;
  expires: number;
}

// L'ordre d'insertion du Map sert de file LRU : la première clé est la moins
// récemment utilisée, c'est elle qu'on évince quand le plafond est atteint.
const store = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;

  if (entry.expires <= Date.now()) {
    store.delete(key);
    return null;
  }

  // Réinsertion en fin de file : l'entrée redevient la plus récemment utilisée.
  store.delete(key);
  store.set(key, entry);
  return entry.data;
}

export function setCached<T>(key: string, data: T, ttlMs: number): void {
  store.delete(key);
  store.set(key, { data, expires: Date.now() + ttlMs });

  while (store.size > config.cache.maxEntries) {
    const plusAncienne = store.keys().next().value;
    if (plusAncienne === undefined) break;
    store.delete(plusAncienne);
  }
}

/**
 * Supprime les entrées expirées.
 *
 * `getCached` ne purge que la clé qu'on lui demande : sans ce balayage, une clé
 * jamais relue — cas courant pour les prévisions par coordonnées — resterait en
 * mémoire jusqu'à son éviction par le plafond.
 */
export function purgerExpirees(): number {
  const maintenant = Date.now();
  let supprimees = 0;

  for (const [key, entry] of store) {
    if (entry.expires <= maintenant) {
      store.delete(key);
      supprimees++;
    }
  }

  return supprimees;
}

/** Vide entièrement le cache — utilisé pour isoler les tests entre eux. */
export function clearCache(): void {
  store.clear();
}

/** Nombre d'entrées actuellement en cache (diagnostic et tests). */
export function tailleCache(): number {
  return store.size;
}

let balayage: ReturnType<typeof setInterval> | null = null;

/**
 * Démarre le balayage périodique. Appelé depuis `app.ts` — surtout pas à
 * l'import du module, pour que les tests restent déterministes.
 */
export function startCacheSweeper(intervalMs = 60_000): void {
  if (balayage) return;
  balayage = setInterval(purgerExpirees, intervalMs);
  // Ne pas maintenir le process en vie pour ce timer.
  balayage.unref?.();
}

export function stopCacheSweeper(): void {
  if (!balayage) return;
  clearInterval(balayage);
  balayage = null;
}

export const TTL = {
  PREVISIONS: config.cache.ttlPrevisions,
  GEOCODE: config.cache.ttlGeocode,
};
