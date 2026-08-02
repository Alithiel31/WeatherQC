import { config } from '../config.js';
import { BadGatewayError, GatewayTimeoutError } from './errors.js';

interface OptionsFetch {
  /** Nom du service amont, utilisé dans les messages d'erreur. */
  service: string;
  timeoutMs?: number;
  /** Nombre total de tentatives, la première comprise. */
  tentatives?: number;
}

const DELAI_AVANT_NOUVELLE_TENTATIVE_MS = 300;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function estTimeout(erreur: unknown): boolean {
  const nom = (erreur as Error | undefined)?.name;
  return nom === 'TimeoutError' || nom === 'AbortError';
}

/**
 * `fetch` avec délai maximal et nouvelle tentative.
 *
 * Sans `AbortSignal`, une API amont lente laisse la requête Express pendue
 * indéfiniment — quelques dizaines suffisent à saturer le serveur.
 *
 * Une seule nouvelle tentative, et uniquement sur erreur réseau ou 5xx : les
 * deux appels concernés sont des GET idempotents. Un 4xx est une réponse
 * légitime de l'amont (un 404 Zippopotam, par exemple) et n'est jamais rejoué.
 */
export async function fetchAvecTimeout(
  url: string,
  { service, timeoutMs = config.fetchTimeoutMs, tentatives = 2 }: OptionsFetch
): Promise<Response> {
  let derniereErreur: unknown;

  for (let essai = 1; essai <= tentatives; essai++) {
    try {
      const reponse = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });

      if (reponse.status >= 500 && essai < tentatives) {
        await pause(DELAI_AVANT_NOUVELLE_TENTATIVE_MS);
        continue;
      }

      return reponse;
    } catch (erreur) {
      derniereErreur = erreur;
      if (essai < tentatives) await pause(DELAI_AVANT_NOUVELLE_TENTATIVE_MS);
    }
  }

  if (estTimeout(derniereErreur)) {
    throw new GatewayTimeoutError(`${service} n'a pas répondu en moins de ${timeoutMs} ms.`);
  }

  const detail = derniereErreur instanceof Error ? derniereErreur.message : String(derniereErreur);
  throw new BadGatewayError(`${service} injoignable : ${detail}`);
}
