import { config } from '../config.js';
const store = new Map();
export function getCached(key) {
    const entry = store.get(key);
    if (entry && entry.expires > Date.now())
        return entry.data;
    store.delete(key);
    return null;
}
export function setCached(key, data, ttlMs) {
    store.set(key, { data, expires: Date.now() + ttlMs });
}
export const TTL = {
    PREVISIONS: config.cache.ttlPrevisions,
    GEOCODE: config.cache.ttlGeocode,
};
