import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Identifiant de corrélation, présent sur toute requête. */
      id: string;
    }
  }
}

/**
 * Pose un identifiant sur chaque requête et le renvoie en en-tête.
 *
 * Un utilisateur qui signale une erreur peut citer le `X-Request-Id` de sa
 * réponse ; la ligne de log correspondante se retrouve directement, au lieu de
 * chercher à l'heure dite dans tout le trafic.
 *
 * `X-Request-Id` entrant repris tel quel s'il ressemble à un identifiant :
 * cela permet de suivre une requête à travers cloudflared et nginx. La longueur
 * est bornée et le jeu de caractères restreint — l'en-tête vient du client et
 * finit dans les logs.
 */
const FORMAT_ACCEPTE = /^[\w-]{1,64}$/;

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const fourni = req.get('X-Request-Id');
  req.id = fourni && FORMAT_ACCEPTE.test(fourni) ? fourni : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
