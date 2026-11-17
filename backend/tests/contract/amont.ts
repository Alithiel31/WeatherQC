import type { TestContext } from 'vitest';
import {
  BadGatewayError,
  GatewayTimeoutError,
  ServiceIndisponibleError,
} from '../../src/lib/errors.js';

// Une API amont qui ne répond pas à temps n'est pas une dérive de contrat : le
// schéma n'a pas été observé, donc rien n'est à réaligner. Faire échouer le
// workflow nocturne dans ce cas ouvrait une issue « dérive de contrat » à tort.
//
// Sont ignorés : timeout, disjoncteur ouvert, panne réseau (`BadGatewayError`
// avec `cause`). Une `BadGatewayError` sans `cause` (statut non-2xx ou schéma
// invalide) reste un échec : c'est la vraie dérive à détecter.
export async function appelAmont<T>(ctx: TestContext, appel: () => Promise<T>): Promise<T> {
  try {
    return await appel();
  } catch (erreur) {
    const indisponible =
      erreur instanceof GatewayTimeoutError ||
      erreur instanceof ServiceIndisponibleError ||
      (erreur instanceof BadGatewayError && erreur.cause !== undefined);
    if (indisponible) {
      const motif = `Amont indisponible, contrat non vérifié : ${erreur.message}`;
      console.warn(`⚠️ ${motif}`);
      ctx.skip(motif);
    }
    throw erreur;
  }
}
