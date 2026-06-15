import type { NextFunction, Request, Response } from 'express';
import { HttpClientError } from '../lib/errors.js';
import { config } from '../config.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function globalErrorHandler(error: Error, req: Request, res: Response, next: NextFunction) {
  const stack = config.isProd ? {} : { stack: error.stack };

  if (error instanceof HttpClientError) {
    return res.status(error.status).json({
      status: error.status,
      error: error.message,
      ...stack,
    });
  }

  console.error('Internal server error', error);

  res.status(500).json({
    status: 500,
    error: 'Internal server error',
    ...stack,
  });
}
