import { describe, it, expect, vi } from 'vitest';
import { zodErrorHandler } from '../../../src/middlewares/zod-error-handler.js';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

const req = {} as Request;

function getZodError(schema: z.ZodTypeAny, data: unknown): z.ZodError {
  try {
    schema.parse(data);
  } catch (e) {
    if (e instanceof z.ZodError) return e;
  }
  throw new Error('Aucune ZodError générée');
}

describe('zodErrorHandler', () => {
  it('retourne 400 avec le bon format pour une ZodError', () => {
    const zodError = getZodError(z.object({ lat: z.number() }), { lat: 'abc' });

    const res = makeRes();
    const next = vi.fn() as NextFunction;
    zodErrorHandler(zodError, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        erreur: 'Paramètres invalides',
        details: expect.arrayContaining([
          expect.objectContaining({ chemin: 'lat', message: expect.any(String) }),
        ]),
      })
    );
  });

  it("passe au middleware suivant si ce n'est pas une ZodError", () => {
    const res = makeRes();
    const next = vi.fn() as NextFunction;
    const erreurOrdinaire = new Error('autre chose');

    zodErrorHandler(erreurOrdinaire, req, res, next);

    expect(next).toHaveBeenCalledWith(erreurOrdinaire);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('retourne les détails de chaque champ invalide', () => {
    const zodError = getZodError(z.object({ lat: z.number(), lon: z.number() }), {
      lat: 'abc',
      lon: 'xyz',
    });

    const res = makeRes();
    const next = vi.fn() as NextFunction;
    zodErrorHandler(zodError, req, res, next);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.details).toHaveLength(2);
  });

  it('formate le chemin imbriqué avec des points', () => {
    const zodError = getZodError(
      z.object({ ville: z.object({ nom: z.string().min(1) }) }),
      { ville: { nom: '' } }
    );

    const res = makeRes();
    const next = vi.fn() as NextFunction;
    zodErrorHandler(zodError, req, res, next);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.details[0].chemin).toBe('ville.nom');
  });
});
