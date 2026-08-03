import type { NextFunction, Request, Response } from 'express';
import { log } from '../lib/log.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Response {
      /** Renseigné par les contrôleurs : d'où vient la réponse servie. */
      origineCache?: 'frais' | 'obsolete' | 'amont';
    }
  }
}

/**
 * Une ligne par requête terminée.
 *
 * Le journal n'existait qu'aux erreurs : une requête réussie ne laissait aucune
 * trace. Impossible, donc, de dire si la lenteur venait d'Open-Meteo ou du
 * Raspberry Pi, de calculer un taux de cache — alors que l'information circulait
 * déjà dans chaque réponse — ou de voir un seul 429, les rejets du limiteur
 * n'atteignant jamais le gestionnaire d'erreurs.
 *
 * Le README dit à l'utilisateur de citer son `X-Request-Id` et à l'exploitant de
 * le chercher dans les logs ; sans cette ligne, la recherche ne trouvait rien
 * tant que la requête n'avait pas échoué.
 *
 * `res.on('finish')` plutôt qu'un enrobage de `res.end` : l'événement part une
 * fois la réponse écrite, sans rien intercepter.
 */
export function journalAcces(req: Request, res: Response, next: NextFunction): void {
  const debut = process.hrtime.bigint();

  res.on('finish', () => {
    const dureeMs = Number(process.hrtime.bigint() - debut) / 1e6;

    // `req.route` est absent sur un 404 : `originalUrl` reste le seul repère.
    // Elle peut porter une chaîne de requête pilotée par le client — d'où la
    // troncature, les logs n'ont pas à absorber une URL de 8 ko.
    const chemin = req.originalUrl.slice(0, 200);

    const contexte = {
      requestId: req.id,
      methode: req.method,
      chemin,
      statut: res.statusCode,
      dureeMs: Number(dureeMs.toFixed(1)),
      ...(res.origineCache ? { cache: res.origineCache } : {}),
    };

    // Un 5xx a déjà sa ligne détaillée dans le gestionnaire d'erreurs ; celle-ci
    // ne fait que la compléter. Les 4xx montent en `warn` pour rester visibles
    // dans un flux filtré — c'est là que vivent les 429.
    if (res.statusCode >= 500) log.error('Requête terminée', contexte);
    else if (res.statusCode >= 400) log.warn('Requête terminée', contexte);
    else log.info('Requête terminée', contexte);
  });

  next();
}
