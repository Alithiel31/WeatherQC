import { config } from '../config.js';

interface CacheEntry<T> {
  data: T;
  expires: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expires > Date.now()) return entry.data;
  store.delete(key);
  return null;
}

export function setCached<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, expires: Date.now() + ttlMs });
}

export const TTL = {
  PREVISIONS: config.cache.ttlPrevisions,
  GEOCODE: config.cache.ttlGeocode,
};
