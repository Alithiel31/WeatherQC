import { vi } from 'vitest';

/**
 * Remplace `fetch` par une réponse JSON figée.
 *
 * Le stub posé par `tests/setup.ts` fait échouer tout appel réseau non mocké :
 * chaque test qui traverse `lib/api.ts` doit passer par ce helper.
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

/** Simule une panne réseau : `fetch` rejette avant toute réponse. */
export function stubFetchErreurReseau() {
  const mock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
  vi.stubGlobal('fetch', mock);
  return mock;
}
