import { describe, it, expect, vi, afterEach } from 'vitest';
import { globalErrorHandler } from '../../../src/middlewares/global-error-handler.js';
import { NotFoundError, BadGatewayError, BadRequestError } from '../../../src/lib/errors.js';
import { config } from '../../../src/config.js';
import type { Request, Response, NextFunction } from 'express';

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

const req = {} as Request;
const next = vi.fn() as NextFunction;

describe('globalErrorHandler', () => {
  describe('HttpClientError', () => {
    it('retourne 404 pour NotFoundError', () => {
      const res = makeRes();
      globalErrorHandler(new NotFoundError('Ville inconnue'), req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 404, error: 'Ville inconnue' })
      );
    });

    it('retourne 502 pour BadGatewayError', () => {
      const res = makeRes();
      globalErrorHandler(new BadGatewayError('Open-Meteo a répondu 503'), req, res, next);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 502 }));
    });

    it('retourne 400 pour BadRequestError', () => {
      const res = makeRes();
      globalErrorHandler(new BadRequestError('Paramètre manquant'), req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Erreurs Express portant un statut', () => {
    it('relaie le statut 4xx de body-parser (corps trop volumineux)', () => {
      const res = makeRes();
      const erreur = Object.assign(new Error('request entity too large'), { status: 413 });

      globalErrorHandler(erreur, req, res, next);

      expect(res.status).toHaveBeenCalledWith(413);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 413 }));
    });

    it('accepte aussi la propriété statusCode', () => {
      const res = makeRes();
      const erreur = Object.assign(new Error('JSON malformé'), { statusCode: 400 });

      globalErrorHandler(erreur, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('ignore un statut 5xx et retombe sur la réponse générique', () => {
      const res = makeRes();
      const erreur = Object.assign(new Error('panne interne détaillée'), { status: 503 });

      globalErrorHandler(erreur, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Internal server error' })
      );
    });
  });

  describe('Erreur générique', () => {
    it('retourne 500 pour une erreur inconnue', () => {
      const res = makeRes();
      globalErrorHandler(new Error('crash inattendu'), req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 500, error: 'Internal server error' })
      );
    });

    it("ne laisse pas fuiter le message d'erreur interne", () => {
      const res = makeRes();
      globalErrorHandler(new Error('secret db password'), req, res, next);

      const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(body.error).not.toContain('secret db password');
    });
  });

  describe('Divulgation de la stack', () => {
    const isProdInitial = config.isProd;

    afterEach(() => {
      config.isProd = isProdInitial;
    });

    it('joint la stack hors production, pour le débogage', () => {
      config.isProd = false;
      const res = makeRes();

      globalErrorHandler(new Error('crash inattendu'), req, res, next);

      const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(body.stack).toBeDefined();
    });

    it('ne joint jamais la stack en production', () => {
      // L'API est exposée publiquement : une stack révèle l'arborescence du
      // serveur et les versions des dépendances.
      config.isProd = true;
      const res = makeRes();

      globalErrorHandler(new Error('crash inattendu'), req, res, next);

      const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(body).not.toHaveProperty('stack');
    });

    it('ne joint pas non plus la stack sur une erreur cliente en production', () => {
      config.isProd = true;
      const res = makeRes();

      globalErrorHandler(new NotFoundError('Ville inconnue'), req, res, next);

      const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(body).not.toHaveProperty('stack');
    });
  });
});
