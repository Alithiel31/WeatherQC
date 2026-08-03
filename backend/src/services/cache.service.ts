import { config } from '../config.js';
import { log } from '../lib/log.js';

interface CacheEntry<T> {
  data: T;
  /** Instant jusqu'auquel l'entrée est servie sans rien demander à l'amont. */
  frais: number;
  /** Instant jusqu'auquel elle reste servable si l'amont est en panne. */
  servable: number;
}

// L'ordre d'insertion du Map sert de file LRU : la première clé est la moins
// récemment utilisée, c'est elle qu'on évince quand le plafond est atteint.
const store = new Map<string, CacheEntry<unknown>>();

/**
 * Appels amont en vol, par clé de cache.
 *
 * Sans ça, N requêtes simultanées sur une clé froide déclenchaient N appels
 * amont — et le TTL étant fixe, toutes les clés chaudes expirent en même temps,
 * si bien que la rafale suivant une expiration partait en entier chez le
 * fournisseur. Les appelants concurrents partagent désormais une seule promesse.
 */
const enVol = new Map<string, Promise<unknown>>();

const compteurs = { hits: 0, misses: 0, obsoletes: 0, mutualises: 0 };

export function getCached<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;

  if (entry.frais <= Date.now()) return null;

  // Réinsertion en fin de file : l'entrée redevient la plus récemment utilisée.
  store.delete(key);
  store.set(key, entry);
  return entry.data;
}

/**
 * Entrée périmée mais encore servable.
 *
 * Sert uniquement de filet quand l'amont vient d'échouer : mieux vaut des
 * prévisions d'il y a vingt minutes qu'un écran d'erreur.
 */
export function getObsolete<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  return entry.servable > Date.now() ? entry.data : null;
}

export function setCached<T>(key: string, data: T, ttlMs: number): void {
  const maintenant = Date.now();
  store.delete(key);
  store.set(key, {
    data,
    frais: maintenant + ttlMs,
    servable: maintenant + ttlMs * config.cache.facteurObsolete,
  });

  while (store.size > config.cache.maxEntries) {
    const plusAncienne = store.keys().next().value;
    if (plusAncienne === undefined) break;
    store.delete(plusAncienne);
  }
}

/**
 * Lit le cache, mutualise les appels concurrents, et sert du périmé plutôt que
 * de rendre une erreur quand l'amont tombe.
 *
 * Remplace le `getCached` / `await amont` / `setCached` que chaque contrôleur
 * répétait, et où se logeaient trois défauts : la ruée sur expiration, l'absence
 * de service dégradé, et l'impossibilité de compter les hits.
 */
export async function avecCache<T>(
  cle: string,
  ttlMs: number,
  produire: () => Promise<T>
): Promise<{ data: T; depuisCache: boolean; obsolete: boolean }> {
  const frais = getCached<T>(cle);
  if (frais !== null) {
    compteurs.hits++;
    return { data: frais, depuisCache: true, obsolete: false };
  }

  const dejaEnVol = enVol.get(cle) as Promise<T> | undefined;
  if (dejaEnVol) {
    compteurs.mutualises++;
    return { data: await dejaEnVol, depuisCache: true, obsolete: false };
  }

  compteurs.misses++;
  const promesse = produire()
    .then((data) => {
      setCached(cle, data, ttlMs);
      return data;
    })
    .finally(() => enVol.delete(cle));
  enVol.set(cle, promesse);

  try {
    return { data: await promesse, depuisCache: false, obsolete: false };
  } catch (erreur) {
    const secours = getObsolete<T>(cle);
    if (secours === null) throw erreur;

    compteurs.obsoletes++;
    log.warn('Amont en échec, réponse périmée servie', {
      cle,
      message: erreur instanceof Error ? erreur.message : String(erreur),
    });
    return { data: secours, depuisCache: true, obsolete: true };
  }
}

/**
 * Supprime les entrées qui ne sont même plus servables.
 *
 * `getCached` ne purge que la clé qu'on lui demande : sans ce balayage, une clé
 * jamais relue — cas courant pour les prévisions par coordonnées — resterait en
 * mémoire jusqu'à son éviction par le plafond.
 */
export function purgerExpirees(): number {
  const maintenant = Date.now();
  let supprimees = 0;

  for (const [key, entry] of store) {
    if (entry.servable <= maintenant) {
      store.delete(key);
      supprimees++;
    }
  }

  return supprimees;
}

/** Vide entièrement le cache — utilisé pour isoler les tests entre eux. */
export function clearCache(): void {
  store.clear();
  enVol.clear();
  compteurs.hits = 0;
  compteurs.misses = 0;
  compteurs.obsoletes = 0;
  compteurs.mutualises = 0;
}

/** Nombre d'entrées actuellement en cache (diagnostic et tests). */
export function tailleCache(): number {
  return store.size;
}

/** Instantané des compteurs, exposé par `/api/sante`. */
export function statistiquesCache() {
  const total = compteurs.hits + compteurs.misses + compteurs.mutualises;
  return {
    entrees: store.size,
    enVol: enVol.size,
    ...compteurs,
    // Sans point de comparaison, un nombre de hits ne dit rien.
    tauxHit: total === 0 ? null : Number(((compteurs.hits / total) * 100).toFixed(1)),
  };
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
  RAINVIEWER: config.cache.ttlRainviewer,
};
