import { vi } from 'vitest';

/**
 * Remplace `fetch` par une réponse JSON figée.
 *
 * Le stub posé par `tests/setup.ts` fait échouer tout appel réseau non mocké :
 * chaque test qui traverse un service externe doit passer par ce helper.
 */
export function stubFetchJson(payload: unknown, status = 200) {
  const mock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

/** Simule un dépassement du délai maximal, tel que le produit `AbortSignal.timeout()`. */
export function stubFetchTimeout() {
  const erreur = new Error('The operation was aborted due to timeout');
  erreur.name = 'TimeoutError';

  const mock = vi.fn().mockRejectedValue(erreur);
  vi.stubGlobal('fetch', mock);
  return mock;
}
