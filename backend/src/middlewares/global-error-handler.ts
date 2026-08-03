import type { NextFunction, Request, Response } from 'express';
import { HttpClientError } from '../lib/errors.js';
import { config } from '../config.js';
import { log } from '../lib/log.js';

/** Erreurs d'Express et de body-parser : corps trop volumineux, JSON malformé… */
interface ErreurAvecStatut extends Error {
  status?: number;
  statusCode?: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function globalErrorHandler(error: Error, req: Request, res: Response, next: NextFunction) {
  const stack = config.isProd ? {} : { stack: error.stack };

  if (error instanceof HttpClientError) {
    // 4xx et 5xx amont : tracés en `warn`, la cause est connue et le client la
    // reçoit. Seule une 500 inattendue mérite `error` et une pile complète.
    log.warn(error.message, {
      requestId: req.id,
      statut: error.status,
      methode: req.method,
      chemin: req.originalUrl,
    });

    return res.status(error.status).json({
      status: error.status,
      error: error.message,
      ...stack,
    });
  }

  // Sans ceci, un corps de 20 Mo ou un JSON malformé ressort en 500 alors que
  // la faute est côté client.
  const statut = (error as ErreurAvecStatut).status ?? (error as ErreurAvecStatut).statusCode;
  if (typeof statut === 'number' && statut >= 400 && statut < 500) {
    return res.status(statut).json({
      status: statut,
      error: error.message,
      ...stack,
    });
  }

  log.error('Internal server error', {
    requestId: req.id,
    methode: req.method,
    chemin: req.originalUrl,
    message: error.message,
    stack: error.stack,
  });

  res.status(500).json({
    status: 500,
    error: 'Internal server error',
    // Renvoyé au client pour qu'il puisse citer l'identifiant en signalant la panne.
    requestId: req.id,
    ...stack,
  });
}
