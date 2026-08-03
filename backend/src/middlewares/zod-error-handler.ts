import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

/**
 * Même enveloppe que `global-error-handler` : `{ status, error }`, plus le détail
 * par champ. Un client n'a ainsi qu'une seule forme à lire, quel que soit le
 * middleware qui a produit l'erreur.
 */
export const zodErrorHandler = (err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      status: 400,
      error: 'Paramètres invalides',
      details: err.errors.map((e) => ({
        chemin: e.path.join('.'),
        message: e.message,
      })),
    });
  }
  next(err);
};
