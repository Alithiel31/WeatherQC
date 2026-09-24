import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { envoyerJson } from '../../../src/lib/reponse.js';
import type { Response } from 'express';

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

describe('envoyerJson', () => {
  const schema = z.object({ nom: z.string() });

  it('envoie le corps validé avec le statut par défaut 200', () => {
    const res = makeRes();
    envoyerJson(res, schema, { nom: 'ok' });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ nom: 'ok' });
  });

  it('utilise le statut fourni (ex. 201)', () => {
    const res = makeRes();
    envoyerJson(res, schema, { nom: 'ok' }, 201);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('lève une Error ordinaire — jamais une ZodError brute — si le corps ne respecte pas le schéma', () => {
    const res = makeRes();
    const corpsInvalide = { nom: 42 } as unknown as { nom: string };

    expect(() => envoyerJson(res, schema, corpsInvalide)).toThrow(Error);

    try {
      envoyerJson(res, schema, corpsInvalide);
    } catch (e) {
      expect(e).not.toBeInstanceOf(z.ZodError);
      expect((e as Error).message).toContain('nom');
    }

    expect(res.json).not.toHaveBeenCalled();
  });
});
